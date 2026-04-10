// Handles Instagram OAuth callback
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code) {
    return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });
  }
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Missing Meta app env vars" }, { status: 500 });
  }

  // 1. Exchange code for short-lived access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`
  );
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.json({ error: "Token exchange failed", details: body }, { status: 502 });
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token returned" }, { status: 502 });
  }

  // 2. Get user pages (to find Instagram business account)
  const pagesRes = await fetch(
    `https://graph.facebook.com/v25.0/me/accounts?access_token=${accessToken}`
  );
  if (!pagesRes.ok) {
    const body = await pagesRes.text();
    return NextResponse.json({ error: "Failed to fetch pages", details: body }, { status: 502 });
  }
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.[0];
  if (!page) {
    return NextResponse.json({ error: "No Facebook page found" }, { status: 404 });
  }

  // 3. Get Instagram business account ID
  const igRes = await fetch(
    `https://graph.facebook.com/v25.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
  );
  if (!igRes.ok) {
    const body = await igRes.text();
    return NextResponse.json({ error: "Failed to fetch IG business account", details: body }, { status: 502 });
  }
  const igData = await igRes.json();
  const igAccountId = igData.instagram_business_account?.id;
  if (!igAccountId) {
    return NextResponse.json({ error: "No Instagram business account linked to page" }, { status: 404 });
  }

  // 4. Save to Firestore
  const db = getAdminDb();
  await db.collection("instagram_accounts").doc(page.id).set({
    userId: state || "unknown", // TODO: use real user auth
    pageId: page.id,
    pageName: page.name,
    accessToken,
    igAccountId,
    connectedAt: Date.now(),
  }, { merge: true });

  // 5. Redirect to dashboard
  return NextResponse.redirect("/dashboard");
}
