import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    return NextResponse.json(
      { error: "Server missing META_APP_SECRET" },
      { status: 500 }
    );
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
  }

  const rawBody = await request.text();

  if (!isValidSignature(rawBody, signatureHeader, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
