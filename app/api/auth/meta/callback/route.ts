import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error,
        error_description: errorDescription ?? "Meta login failed",
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Missing OAuth code" },
      { status: 400 }
    );
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    console.error("Meta OAuth callback: missing required env vars", {
      hasAppId: Boolean(appId),
      hasAppSecret: Boolean(appSecret),
      hasRedirectUri: Boolean(redirectUri),
    });
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // Exchange short-lived code for short-lived user access token
  const tokenUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl.toString());

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    console.error("Meta token exchange failed", { status: tokenResponse.status, body });
    return NextResponse.json(
      { ok: false, error: "Token exchange failed" },
      { status: 502 }
    );
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!tokenData.access_token) {
    console.error("Meta token exchange: no access_token in response", tokenData);
    return NextResponse.json(
      { ok: false, error: "No access token returned" },
      { status: 502 }
    );
  }

  // Exchange short-lived token for long-lived token (60 days)
  const longLivedUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

  const longLivedResponse = await fetch(longLivedUrl.toString());

  if (!longLivedResponse.ok) {
    const body = await longLivedResponse.text();
    console.error("Meta long-lived token exchange failed", { status: longLivedResponse.status, body });
    return NextResponse.json(
      { ok: false, error: "Long-lived token exchange failed" },
      { status: 502 }
    );
  }

  const longLivedData = (await longLivedResponse.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (!longLivedData.access_token) {
    return NextResponse.json(
      { ok: false, error: "No long-lived access token returned" },
      { status: 502 }
    );
  }

  // Log the token so it can be set as META_PAGE_ACCESS_TOKEN in env
  // In production, store this in a secrets manager or database instead
  console.info("Meta OAuth complete — set this as META_PAGE_ACCESS_TOKEN:", {
    token_type: longLivedData.token_type,
    expires_in_seconds: longLivedData.expires_in,
  });

  return NextResponse.json({
    ok: true,
    message: "Meta Business Login complete. Store the access token as META_PAGE_ACCESS_TOKEN.",
    token_type: longLivedData.token_type,
    expires_in: longLivedData.expires_in,
    // Do NOT expose the token in the response body in production;
    // write it to a secrets store here instead.
    access_token: longLivedData.access_token,
  });
}
