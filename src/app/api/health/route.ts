import { NextResponse } from "next/server";
import { database } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await database().query("SELECT 1");
    return NextResponse.json(
      { database: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { database: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
