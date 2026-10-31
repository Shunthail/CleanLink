import { NextResponse } from "next/server";
import { InputError } from "./url";
import { ExpiredLink, MissingLink, appOrigin } from "./links";

export function checkOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const current = new URL(request.url).origin;
  const configured = new URL(appOrigin());
  const trusted = new Set([current, configured.origin]);
  // Both loopback names point to the same local application.
  if (["localhost", "127.0.0.1"].includes(configured.hostname)) {
    const alternate = new URL(configured);
    alternate.hostname =
      configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
    trusted.add(alternate.origin);
  }
  if (origin && !trusted.has(origin))
    throw new InputError("Origine de la requête refusée.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new InputError("Origine de la requête refusée.");
}
export async function payload(
  request: Request,
): Promise<Record<string, unknown>> {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new InputError("Un objet JSON est attendu.");
  const text = await request.text();
  if (text.length > 12000)
    throw new InputError("La requête est trop volumineuse.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new InputError("Le JSON est invalide.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InputError("Un objet JSON est attendu.");
  return value as Record<string, unknown>;
}
export function failure(error: unknown): NextResponse {
  if (error instanceof InputError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof MissingLink)
    return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  if (error instanceof ExpiredLink)
    return NextResponse.json({ error: "Ce lien a expiré." }, { status: 410 });
  return NextResponse.json(
    {
      error:
        "L’enregistrement est momentanément indisponible. Le nettoyage et l’analyse restent accessibles.",
    },
    { status: 503 },
  );
}
