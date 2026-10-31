import { NextResponse } from "next/server";
import { checkOrigin, failure } from "@/lib/http";
import { deleteLink } from "@/lib/links";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    checkOrigin(request);
    await deleteLink((await context.params).code);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
