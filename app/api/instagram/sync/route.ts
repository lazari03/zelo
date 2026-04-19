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

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // First attempt: IG API with pageId (Bearer header)
    const convUrl1 = new URL(`${IG_API}/v21.0/${pageId}/conversations`);
    convUrl1.searchParams.set("platform", "instagram");
    convUrl1.searchParams.set("fields", "id,updated_time,participants");
    let convRes = await fetch(convUrl1.toString(), { headers: authHeader });
    let convBody = await convRes.text();
    console.info("IG conversations (Bearer)", { status: convRes.status, body: convBody });

    // Second attempt: IG /me/conversations (Bearer header)
    if (!convRes.ok) {
      const convUrl2 = new URL(`${IG_API}/v21.0/me/conversations`);
      convUrl2.searchParams.set("platform", "instagram");
      convUrl2.searchParams.set("fields", "id,updated_time,participants");
      convRes = await fetch(convUrl2.toString(), { headers: authHeader });
      convBody = await convRes.text();
      console.info("IG /me/conversations (Bearer)", { status: convRes.status, body: convBody });
    }

    const apiBase = convRes.ok ? IG_API : FB_API;

    if (!convRes.ok) {
      console.error("All conversation endpoints failed for account", pageId);
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

      const msgRes = await fetch(msgUrl.toString(), { headers: authHeader });
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
