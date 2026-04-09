import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      message?: {
        text?: string;
        is_echo?: boolean;
      };
    }>;
  }>;
};

type IncomingTextMessage = {
  senderId: string;
  text: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function isValidSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): boolean {
  const [algorithm, signatureHash] = signatureHeader.split("=");

  if (algorithm !== "sha256" || !signatureHash) {
    return false;
  }

  const expectedHash = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const provided = Buffer.from(signatureHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

function extractIncomingTextMessages(payload: MetaWebhookPayload): IncomingTextMessage[] {
  const messages: IncomingTextMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text?.trim();
      const isEcho = event.message?.is_echo === true;

      if (!senderId || !text || isEcho) {
        continue;
      }

      messages.push({ senderId, text });
    }
  }

  return messages;
}

function extractOpenAIText(responseData: OpenAIResponse): string {
  if (typeof responseData.output_text === "string" && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const chunks: string[] = [];
  for (const outputItem of responseData.output ?? []) {
    if (outputItem.type !== "message") {
      continue;
    }

    for (const content of outputItem.content ?? []) {
      const isTextContent = content.type === "output_text" || content.type === "text";
      if (isTextContent && typeof content.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

async function generateAiReply(customerMessage: string): Promise<string> {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const systemPrompt =
    process.env.ZELO_SYSTEM_PROMPT ??
    "You are a sales assistant for Albanian small businesses. Reply clearly and briefly, and help close the sale.";

  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: customerMessage }],
        },
      ],
    }),
  });

  if (!openAiResponse.ok) {
    const body = await openAiResponse.text();
    throw new Error(`OpenAI API error (${openAiResponse.status}): ${body}`);
  }

  const responseData = (await openAiResponse.json()) as OpenAIResponse;
  const reply = extractOpenAIText(responseData);

  if (!reply) {
    throw new Error("OpenAI returned an empty reply");
  }

  return reply;
}

async function sendInstagramReply(recipientId: string, text: string): Promise<void> {
  const pageId = process.env.META_PAGE_ID;
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageId) {
    throw new Error("Missing META_PAGE_ID");
  }

  if (!pageAccessToken) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN");
  }

  const metaResponse = await fetch(
    `https://graph.facebook.com/v25.0/${encodeURIComponent(pageId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    }
  );

  if (!metaResponse.ok) {
    const body = await metaResponse.text();
    throw new Error(`Meta Send API error (${metaResponse.status}): ${body}`);
  }
}

export async function GET(request: NextRequest) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    return NextResponse.json(
      { error: "Server missing META_WEBHOOK_VERIFY_TOKEN" },
      { status: 500 }
    );
  }

  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  console.info("Webhook GET received", {
    mode,
    hasVerifyToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appSecret) {
    return NextResponse.json(
      { error: "Server missing META_APP_SECRET" },
      { status: 500 }
    );
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");

  console.info("Webhook POST received", {
    hasSignatureHeader: Boolean(signatureHeader),
    appSecretLength: appSecret.length,
  });

  if (!signatureHeader) {
    console.warn("Webhook POST missing signature header");
    return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
  }

  const rawBody = await request.text();

  if (!isValidSignature(rawBody, signatureHeader, appSecret)) {
    console.warn("Webhook POST invalid signature", {
      signatureHeader,
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incomingMessages = extractIncomingTextMessages(payload);

  console.info("Webhook POST parsed", {
    object: payload.object ?? null,
    incomingMessageCount: incomingMessages.length,
  });

  for (const incomingMessage of incomingMessages) {
    try {
      const aiReply = await generateAiReply(incomingMessage.text);
      await sendInstagramReply(incomingMessage.senderId, aiReply);
    } catch (error) {
      console.error("Failed to process incoming Instagram message", {
        senderId: incomingMessage.senderId,
        error,
      });
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
