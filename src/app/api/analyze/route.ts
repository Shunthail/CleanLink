import { NextResponse } from "next/server";
import { analyzeUrl, InputError } from "@/lib/url";
import { payload, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = await payload(request);
    if (
      typeof data.url !== "string" ||
      (data.removeFragment !== undefined &&
        typeof data.removeFragment !== "boolean")
    )
      throw new InputError("URL ou option invalide.");
    return NextResponse.json(
      analyzeUrl(data.url, data.removeFragment === true),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
