import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const error            = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code             = searchParams.get("code");
  const userId           = searchParams.get("state") ?? "";

  if (error) {
    return NextResponse.json({ ok: false, error, error_description: errorDescription ?? "Instagram login failed" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing OAuth code" }, { status: 400 });
  }

  const appId       = process.env.META_APP_ID;
  const appSecret   = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
  }

  /* ── 1. Short-lived token (Instagram OAuth endpoint) ── */
  const tokenBody = new URLSearchParams({
    client_id:     appId,
    client_secret: appSecret,
    grant_type:    "authorization_code",
    redirect_uri:  redirectUri,
    code,
  });

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Instagram token exchange failed", { status: tokenRes.status, body });
    return NextResponse.json({ ok: false, error: "Token exchange failed" }, { status: 502 });
  }

  const tokenData = await tokenRes.json() as { access_token?: string; user_id?: number };
  if (!tokenData.access_token) {
    return NextResponse.json({ ok: false, error: "No access token returned" }, { status: 502 });
  }

  /* ── 2. Long-lived token (60 days) ── */
  const llBody = new URLSearchParams({
    grant_type:    "ig_exchange_token",
    client_secret: appSecret,
    access_token:  tokenData.access_token,
  });

  const llRes = await fetch("https://graph.instagram.com/access_token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    llBody.toString(),
  });
  if (!llRes.ok) {
    const body = await llRes.text();
    console.error("Instagram long-lived token exchange failed", { status: llRes.status, body });
    return NextResponse.json({ ok: false, error: "Long-lived token exchange failed" }, { status: 502 });
  }

  const llData = await llRes.json() as { access_token?: string; expires_in?: number };
  if (!llData.access_token) {
    return NextResponse.json({ ok: false, error: "No long-lived access token returned" }, { status: 502 });
  }

  /* ── 3. Fetch Instagram user info ── */
  let instagramUsername = "";
  let igUserId = String(tokenData.user_id ?? "");

  try {
    const meUrl = new URL("https://graph.instagram.com/me");
    meUrl.searchParams.set("fields",       "id,username");
    meUrl.searchParams.set("access_token", llData.access_token);
    const meRes  = await fetch(meUrl.toString());
    const meData = await meRes.json() as { id?: string; username?: string };
    if (meData.id)       igUserId           = meData.id;
    if (meData.username) instagramUsername  = meData.username;
  } catch {
    console.warn("Could not fetch Instagram user info — storing without username");
  }

  /* ── 4. Persist to Firestore (keyed by igUserId) ── */
  if (userId && igUserId) {
    try {
      const adminDb = getAdminDb();
      await adminDb.collection("instagram_accounts").doc(igUserId).set({
        userId,
        pageId:            igUserId,   // igUserId used as pageId for webhook lookup
        instagramUsername,
        accessToken:       llData.access_token,
        expiresIn:         llData.expires_in ?? null,
        connectedAt:       Date.now(),
      }, { merge: true });
      console.info("Saved Instagram account to Firestore", { userId, igUserId, instagramUsername });
    } catch (err) {
      console.error("Failed to save account to Firestore", err);
    }
  }

  /* ── 5. Set session cookie and redirect to dashboard ── */
  const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
  redirectResponse.cookies.set("zelo_connected", "1", {
    httpOnly: false,
    maxAge:   60 * 60 * 24 * 60,
    path:     "/",
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
  });
  return redirectResponse;
}
