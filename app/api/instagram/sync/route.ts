import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const IG_API = "https://graph.instagram.com/v21.0";

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

    // Verify token is valid
    const meRes = await fetch(`${IG_API}/me?fields=id,username&access_token=${accessToken}`);
    const meData = await meRes.json() as { id?: string; username?: string; error?: unknown };
    console.info("Token check", { ok: meRes.ok, data: meData });
    if (!meRes.ok) {
      console.error("Access token invalid for account", pageId);
      continue;
    }

    // Try fetching conversations via /me/conversations
    const convUrl = new URL(`${IG_API}/me/conversations`);
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

      const msgUrl = new URL(`${IG_API}/${conv.id}/messages`);
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
