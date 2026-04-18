import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const error            = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code             = searchParams.get("code");
  const userId           = searchParams.get("state") ?? "";   // UID passed from dashboard

  if (error) {
    return NextResponse.json({ ok: false, error, error_description: errorDescription ?? "Meta login failed" }, { status: 400 });
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

  /* ── 1. Short-lived token ── */
  const tokenUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id",     appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri",  redirectUri);
  tokenUrl.searchParams.set("code",          code);

  const tokenRes = await fetch(tokenUrl.toString());
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Meta token exchange failed", { status: tokenRes.status, body });
    return NextResponse.json({ ok: false, error: "Token exchange failed" }, { status: 502 });
  }
  const tokenData = await tokenRes.json() as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.json({ ok: false, error: "No access token returned" }, { status: 502 });
  }

  /* ── 2. Long-lived token (60 days) ── */
  const llUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  llUrl.searchParams.set("grant_type",       "fb_exchange_token");
  llUrl.searchParams.set("client_id",        appId);
  llUrl.searchParams.set("client_secret",    appSecret);
  llUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

  const llRes = await fetch(llUrl.toString());
  if (!llRes.ok) {
    const body = await llRes.text();
    console.error("Meta long-lived token exchange failed", { status: llRes.status, body });
    return NextResponse.json({ ok: false, error: "Long-lived token exchange failed" }, { status: 502 });
  }
  const llData = await llRes.json() as { access_token?: string; expires_in?: number };
  if (!llData.access_token) {
    return NextResponse.json({ ok: false, error: "No long-lived access token returned" }, { status: 502 });
  }

  /* ── 3. Fetch the user's Instagram Business account info via pages ── */
  let instagramUsername = "";
  let pageId = "";
  let pageAccessToken = llData.access_token;
  try {
    const pagesUrl = new URL("https://graph.facebook.com/v25.0/me/accounts");
    pagesUrl.searchParams.set("access_token", llData.access_token);
    const pagesRes  = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; access_token: string }> };
    const page = pagesData.data?.[0];
    if (page) {
      pageId = page.id;
      pageAccessToken = page.access_token; // page-scoped token for messaging
      const igUrl = new URL(`https://graph.facebook.com/v25.0/${page.id}`);
      igUrl.searchParams.set("fields",       "instagram_business_account{id,username}");
      igUrl.searchParams.set("access_token", page.access_token);
      const igRes  = await fetch(igUrl.toString());
      const igData = await igRes.json() as {
        instagram_business_account?: { id?: string; username?: string };
      };
      instagramUsername = igData.instagram_business_account?.username ?? "";
    }
  } catch {
    console.warn("Could not fetch Meta page info — storing without username");
  }

  /* ── 4. Persist to Firestore (keyed by pageId so re-connecting updates in place) ── */
  if (userId) {
    try {
      const adminDb = getAdminDb();
      const docId   = pageId || `${userId}_${Date.now()}`;
      await adminDb.collection("instagram_accounts").doc(docId).set({
        userId,
        pageId,
        instagramUsername,
        accessToken:  pageAccessToken,
        expiresIn:    llData.expires_in ?? null,
        connectedAt:  Date.now(),
      }, { merge: true });
      console.info("Saved Instagram account to Firestore", { userId, pageId, instagramUsername });
    } catch (err) {
      console.error("Failed to save account to Firestore", err);
    }
  }

  /* ── 5. Subscribe the page to the webhook ── */
  if (pageId && pageAccessToken) {
    try {
      const subUrl = new URL(`https://graph.facebook.com/v25.0/${pageId}/subscribed_apps`);
      subUrl.searchParams.set("subscribed_fields", "messages,messaging_postbacks");
      subUrl.searchParams.set("access_token", pageAccessToken);
      const subRes = await fetch(subUrl.toString(), { method: "POST" });
      if (!subRes.ok) {
        const body = await subRes.text();
        console.warn("Webhook subscription failed (non-fatal)", { status: subRes.status, body });
      } else {
        console.info("Subscribed page to webhook", { pageId });
      }
    } catch (err) {
      console.warn("Webhook subscription threw (non-fatal)", err);
    }
  }

  /* ── 6. Set session cookie and redirect to dashboard ── */
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
