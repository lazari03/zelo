import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { InstagramAccount, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

// ── Payload types ─────────────────────────────────────────────────────────────

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string; // page ID
    messaging?: Array<{
      sender?:    { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        text?:    string;
        is_echo?: boolean;
        mid?:     string;
      };
    }>;
  }>;
};

type IncomingMessage = {
  pageId:    string;
  senderId:  string;
  text:      string;
  timestamp: number;
};

// ── Signature verification ────────────────────────────────────────────────────

function isValidSignature(rawBody: Buffer, signatureHeader: string, appSecret: string): boolean {
  const [algorithm, signatureHash] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !signatureHash) return false;

  const expectedHash = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = Buffer.from(signatureHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

// ── Payload extraction ────────────────────────────────────────────────────────

function extractMessages(payload: MetaWebhookPayload): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  for (const entry of payload.entry ?? []) {
    const pageId = entry.id ?? "";
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text     = event.message?.text?.trim();
      const isEcho   = event.message?.is_echo === true;
      if (!senderId || !text || isEcho) continue;
      out.push({ pageId, senderId, text, timestamp: event.timestamp ?? Date.now() });
    }
  }
  return out;
}

// ── Order detection (keyword heuristic) ──────────────────────────────────────

const ORDER_KEYWORDS = [
  "porosi", "porosia", "rezerv", "adres", "adresë",
  "deliver", "shipp", "order", "booking", "book",
  "blej", "blerj", "dërgoj", "dergoj", "pagoj",
  "çmim", "cmim", "kosto", "çanta", "produkt",
];

function detectOrderIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return ORDER_KEYWORDS.some((k) => lower.includes(k));
}

// ── Account lookup ────────────────────────────────────────────────────────────

async function getAccount(pageId: string): Promise<(InstagramAccount & { docId: string }) | null> {
  const db   = getAdminDb();
  const snap = await db.collection("instagram_accounts").doc(pageId).get();
  if (!snap.exists) return null;
  return { docId: snap.id, ...(snap.data() as InstagramAccount) };
}

// ── Core message processing ───────────────────────────────────────────────────

async function processMessage(msg: IncomingMessage): Promise<void> {
  const db      = getAdminDb();
  const account = await getAccount(msg.pageId);

  // Resolve userId and accessToken — fall back to env vars for legacy single-account setup
  const userId      = account?.userId      ?? "__legacy__";
  const accessToken = account?.accessToken ?? process.env.META_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const aiEnabled   = account?.aiEnabled   ?? true; // default on for legacy accounts

  if (!accessToken) {
    throw new Error(`No access token for pageId ${msg.pageId}`);
  }

  if (!aiEnabled) {
    // Save the incoming message to conversation history but skip AI reply
    const convId  = `${msg.pageId}_${msg.senderId}`;
    const convRef = db.collection("conversations").doc(convId);
    const convSnap = await convRef.get();
    const convData = convSnap.exists ? convSnap.data()! : null;
    const history: ChatMessage[] = Array.isArray(convData?.messages) ? convData.messages : [];
    const now = Date.now();
    await convRef.set({
      userId,
      pageId:       msg.pageId,
      senderId:     msg.senderId,
      messages:     [...history, { role: "user", content: msg.text, timestamp: now }],
      messageCount: history.length + 1,
      lastMessage:  msg.text.slice(0, 150),
      orderDetected: convData?.orderDetected ?? false,
      createdAt:    convData?.createdAt ?? now,
      updatedAt:    now,
    }, { merge: true });
    return;
  }

  const convId  = `${msg.pageId}_${msg.senderId}`;
  const convRef = db.collection("conversations").doc(convId);

  // Load existing conversation
  const convSnap = await convRef.get();
  const convData = convSnap.exists ? convSnap.data()! : null;
  const history: ChatMessage[] = Array.isArray(convData?.messages) ? convData.messages : [];
  const isNewConv = !convSnap.exists;

  // Build OpenAI messages
  const systemPrompt = process.env.ZELO_SYSTEM_PROMPT
    ?? "You are a helpful sales assistant. Reply briefly and help close the sale.";

  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user",   content: msg.text },
  ];

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) throw new Error("Missing OPENAI_API_KEY");

  const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: apiMessages,
    }),
  });

  if (!openAiRes.ok) {
    const body = await openAiRes.text();
    throw new Error(`OpenAI error (${openAiRes.status}): ${body}`);
  }

  const resData  = await openAiRes.json();
  const reply    = (resData.choices?.[0]?.message?.content ?? "").trim();
  if (!reply) throw new Error("OpenAI returned empty reply");

  // Update conversation
  const now = Date.now();
  const newHistory: ChatMessage[] = [
    ...history,
    { role: "user",      content: msg.text, timestamp: now },
    { role: "assistant", content: reply,    timestamp: now },
  ];

  const orderDetected  = detectOrderIntent(msg.text) || detectOrderIntent(reply);
  const wasOrderBefore = convData?.orderDetected === true;
  const isNewOrder     = orderDetected && !wasOrderBefore;

  await convRef.set({
    userId,
    pageId:        msg.pageId,
    senderId:      msg.senderId,
    messages:      newHistory,
    messageCount:  newHistory.length,
    lastMessage:   reply.slice(0, 150),
    orderDetected,
    createdAt:     convData?.createdAt ?? now,
    updatedAt:     now,
  }, { merge: true });

  // Create order doc if newly detected
  if (isNewOrder) {
    await db.collection("orders").add({
      userId,
      pageId:         msg.pageId,
      senderId:       msg.senderId,
      conversationId: convId,
      description:    msg.text.slice(0, 300),
      status:         "pending",
      createdAt:      now,
      updatedAt:      now,
    });
  }

  // Update daily analytics counters (atomic increments)
  const today        = new Date().toISOString().slice(0, 10);
  const analyticsRef = db
    .collection("analytics")
    .doc(userId)
    .collection("daily")
    .doc(today);

  const analyticsUpdate: Record<string, unknown> = {
    date:     today,
    messages: FieldValue.increment(2), // user + assistant
  };
  if (isNewConv)  analyticsUpdate.conversations = FieldValue.increment(1);
  if (isNewOrder) analyticsUpdate.orders        = FieldValue.increment(1);
  await analyticsRef.set(analyticsUpdate, { merge: true });

  // Send reply via Instagram Graph API
  const metaRes = await fetch(
    `https://graph.instagram.com/v25.0/${encodeURIComponent(msg.pageId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient:       { id: msg.senderId },
        messaging_type:  "RESPONSE",
        message:         { text: reply },
      }),
    }
  );

  if (!metaRes.ok) {
    const body = await metaRes.text();
    throw new Error(`Meta Send API error (${metaRes.status}): ${body}`);
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "Server missing META_WEBHOOK_VERIFY_TOKEN" }, { status: 500 });
  }

  const mode      = request.nextUrl.searchParams.get("hub.mode");
  const token     = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    return NextResponse.json({ error: "Server missing META_APP_SECRET" }, { status: 500 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  if (process.env.SKIP_SIGNATURE_CHECK !== "1" && !isValidSignature(rawBody, signatureHeader, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = extractMessages(payload);

  for (const msg of messages) {
    try {
      await processMessage(msg);
    } catch (err) {
      console.error("[ZELO] Failed to process message", { pageId: msg.pageId, senderId: msg.senderId, err });
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
