import { NextResponse } from "next/server";
import { checkOrigin, failure } from "@/lib/http";
import { visit } from "@/lib/links";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    checkOrigin(request);
    const { code } = await context.params;
    return NextResponse.redirect(await visit(code), {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
