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

  return NextResponse.json({
    ok: true,
    message: "Meta Business Login redirect received successfully.",
  });
}
