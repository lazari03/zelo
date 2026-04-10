// Starts Instagram OAuth flow
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing META_APP_ID or META_REDIRECT_URI" }, { status: 500 });
  }
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "pages_messaging,pages_show_list,instagram_basic,instagram_manage_messages");
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
