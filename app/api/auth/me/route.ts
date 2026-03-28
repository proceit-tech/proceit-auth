import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    user: null,
    message: "me endpoint base",
  });
}