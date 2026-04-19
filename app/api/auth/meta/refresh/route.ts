import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { pageId, userId } = await request.json() as { pageId?: string; userId?: string };

  if (!pageId || !userId) {
    return NextResponse.json({ ok: false, error: "Missing pageId or userId" }, { status: 400 });
  }

  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
  }

  const db   = getAdminDb();
  const snap = await db.collection("instagram_accounts").doc(pageId).get();

  if (!snap.exists || snap.data()?.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Not found or unauthorized" }, { status: 404 });
  }

  const currentToken = snap.data()?.accessToken as string | undefined;
  if (!currentToken) {
    return NextResponse.json({ ok: false, error: "No token to refresh" }, { status: 400 });
  }

  const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
  refreshUrl.searchParams.set("grant_type",   "ig_refresh_token");
  refreshUrl.searchParams.set("access_token", currentToken);

  const res = await fetch(refreshUrl.toString());
  if (!res.ok) {
    const body = await res.text();
    console.error("Token refresh failed", { status: res.status, body });
    return NextResponse.json({ ok: false, error: "Token refresh failed" }, { status: 502 });
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    return NextResponse.json({ ok: false, error: "No token returned" }, { status: 502 });
  }

  await db.collection("instagram_accounts").doc(pageId).update({
    accessToken: data.access_token,
    expiresIn:   data.expires_in ?? null,
    connectedAt: Date.now(), // reset the clock
  });

  return NextResponse.json({ ok: true, expiresIn: data.expires_in });
}
