import { NextResponse } from "next/server";
import { createLink, library } from "@/lib/links";
import { InputError } from "@/lib/url";
import { payload, failure } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await library(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const data = await payload(request);
    if (
      typeof data.url !== "string" ||
      typeof data.title !== "string" ||
      typeof data.expiryDays !== "number" ||
      typeof data.removeFragment !== "boolean" ||
      typeof data.acknowledged !== "boolean"
    )
      throw new InputError("Les paramètres du lien sont invalides.");
    return NextResponse.json(
      await createLink(
        data.url,
        data.title,
        data.expiryDays,
        data.removeFragment,
        data.acknowledged,
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
