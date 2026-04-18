import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { pageId, userId } = await request.json() as { pageId?: string; userId?: string };

  if (!pageId || !userId) {
    return NextResponse.json({ ok: false, error: "Missing pageId or userId" }, { status: 400 });
  }

  const db   = getAdminDb();
  const snap = await db.collection("instagram_accounts").doc(pageId).get();

  if (!snap.exists || snap.data()?.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Not found or unauthorized" }, { status: 404 });
  }

  const accessToken = snap.data()?.accessToken as string | undefined;

  // Revoke the token on Meta's side (best-effort — don't fail if it errors)
  if (accessToken) {
    try {
      const revokeUrl = new URL("https://graph.facebook.com/v25.0/me/permissions");
      revokeUrl.searchParams.set("access_token", accessToken);
      await fetch(revokeUrl.toString(), { method: "DELETE" });
    } catch (err) {
      console.warn("Token revocation failed (non-fatal)", err);
    }
  }

  await db.collection("instagram_accounts").doc(pageId).delete();

  return NextResponse.json({ ok: true });
}
