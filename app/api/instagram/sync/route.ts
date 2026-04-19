import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const FB_API = "https://graph.facebook.com/v21.0";
const IG_API = "https://graph.instagram.com";

export async function POST(request: NextRequest) {
  const { userId } = await request.json() as { userId?: string };
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });

  const db = getAdminDb();
  const accountsSnap = await db.collection("instagram_accounts").where("userId", "==", userId).get();

  if (accountsSnap.empty) {
    return NextResponse.json({ ok: false, error: "No accounts found" }, { status: 404 });
  }

  let totalSynced = 0;

  for (const accountDoc of accountsSnap.docs) {
    const { accessToken, pageId } = accountDoc.data() as { accessToken: string; pageId: string };
    if (!accessToken || !pageId) continue;

    console.info("Trying token", { pageId, tokenPrefix: accessToken.slice(0, 12) + "…", tokenLen: accessToken.length });

    // Try IG API first, fall back to FB API
    let resolvedId = pageId;
    let apiBase = IG_API;

    const igMeUrl = new URL(`${IG_API}/me`);
    igMeUrl.searchParams.set("fields", "id,username");
    igMeUrl.searchParams.set("access_token", accessToken);
    const igMe = await fetch(igMeUrl.toString());
    const igMeData = await igMe.json() as { id?: string; username?: string; error?: unknown };
    console.info("IG /me", { ok: igMe.ok, data: igMeData });

    if (!igMe.ok) {
      // Fall back to Facebook Graph API
      const fbMeUrl = new URL(`${FB_API}/me`);
      fbMeUrl.searchParams.set("fields", "id,name");
      fbMeUrl.searchParams.set("access_token", accessToken);
      const fbMe = await fetch(fbMeUrl.toString());
      const fbMeData = await fbMe.json() as { id?: string; name?: string; error?: unknown };
      console.info("FB /me", { ok: fbMe.ok, data: fbMeData });
      if (!fbMe.ok) {
        console.error("Token invalid on both IG and FB APIs for account", pageId);
        continue;
      }
      resolvedId = fbMeData.id ?? pageId;
      apiBase = FB_API;
    } else {
      resolvedId = igMeData.id ?? pageId;
    }

    console.info("Using API", { apiBase, resolvedId });

    // Fetch conversations
    const convUrl = new URL(`${apiBase}/${resolvedId}/conversations`);
    convUrl.searchParams.set("platform", "instagram");
    convUrl.searchParams.set("fields", "id,updated_time,participants");
    convUrl.searchParams.set("access_token", accessToken);

    const convRes = await fetch(convUrl.toString());
    const convBody = await convRes.text();
    console.info("Conversations response", { status: convRes.status, body: convBody });

    if (!convRes.ok) {
      console.error("Failed to fetch conversations", { status: convRes.status, body: convBody });
      continue;
    }

    const convData = JSON.parse(convBody) as {
      data?: Array<{
        id: string;
        updated_time: string;
        participants?: { data: Array<{ id: string }> };
      }>;
    };

    for (const conv of convData.data ?? []) {
      const otherParticipant = conv.participants?.data.find((p) => p.id !== pageId);
      const senderId = otherParticipant?.id ?? conv.id;

      const msgUrl = new URL(`${apiBase}/${conv.id}/messages`);
      msgUrl.searchParams.set("fields", "id,text,from,timestamp");
      msgUrl.searchParams.set("access_token", accessToken);

      const msgRes = await fetch(msgUrl.toString());
      type RawMsg = { id: string; text?: string; from?: { id: string }; timestamp: string };
      const rawMessages: RawMsg[] = [];

      if (msgRes.ok) {
        const msgData = await msgRes.json() as { data?: RawMsg[] };
        rawMessages.push(...(msgData.data ?? []));
      }

      const chatMessages = rawMessages.map((m) => ({
        role: (m.from?.id === pageId ? "assistant" : "user") as "user" | "assistant",
        content: m.text ?? "",
        timestamp: new Date(m.timestamp).getTime(),
      }));

      const convDocId = `${pageId}_${senderId}`;
      const lastMsg = chatMessages[chatMessages.length - 1];

      await db.collection("conversations").doc(convDocId).set({
        userId,
        pageId,
        senderId,
        lastMessage: lastMsg?.content ?? "",
        messageCount: chatMessages.length,
        orderDetected: false,
        createdAt: chatMessages[0]?.timestamp ?? Date.now(),
        updatedAt: new Date(conv.updated_time).getTime(),
        messages: chatMessages,
      }, { merge: true });

      totalSynced++;
    }
  }

  return NextResponse.json({ ok: true, synced: totalSynced });
}
