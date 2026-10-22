import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "oac-web", mode: "scaffold" }, {
    headers: { "Cache-Control": "no-store" }
  });
}
