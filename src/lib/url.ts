import { isIP } from "node:net";
import { domainToUnicode } from "node:url";
import type { LinkAnalysis, Signal } from "./types";

const TRACKERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "gbraid",
  "wbraid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "vero_id",
  "oly_anon_id",
  "oly_enc_id",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
]);
const SENSITIVE = new Set([
  "password",
  "passwd",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "auth_token",
  "session_token",
  "token",
  "secret",
]);
const BRANDS = [
  "paypal.com",
  "microsoft.com",
  "google.com",
  "apple.com",
  "amazon.com",
  "github.com",
  "facebook.com",
];

export class InputError extends Error {}

function privateHost(host: string): boolean {
  const value = host
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local") ||
    value.endsWith(".internal")
  )
    return true;
  const version = isIP(value);
  if (version === 6) return !/^[23][0-9a-f]{0,3}:/i.test(value);
  if (version === 4) {
    const [first, second] = value.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 168 || second === 0)) ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }
  return (
    !value.includes(".") ||
    value.endsWith(".invalid") ||
    value.endsWith(".test") ||
    value.endsWith(".example")
  );
}

export function analyzeUrl(
  input: string,
  removeFragment = false,
): LinkAnalysis {
  if (typeof input !== "string" || !input.trim() || input.length > 4096)
    throw new InputError("Collez une URL de moins de 4 096 caractères.");
  const value = input.trim();
  if (/[\u0000-\u0020\u007f]/.test(value))
    throw new InputError(
      "Les espaces et caractères de contrôle doivent être encodés dans l’URL.",
    );
  let url: URL;
  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
    const hostWithPort = /^(?:[a-z\d.-]+|\[[\da-f:]+\]):\d+(?:\/|$)/i.test(
      value,
    );
    url = new URL(hasScheme && !hostWithPort ? value : "https://" + value);
  } catch {
    throw new InputError("Cette URL n’est pas valide.");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new InputError("Seuls les liens HTTP et HTTPS sont acceptés.");
  if (url.username || url.password)
    throw new InputError(
      "Les liens contenant des identifiants ne sont pas acceptés.",
    );
  if (!url.hostname)
    throw new InputError("Le lien doit contenir un nom de domaine.");
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const original = url.toString();
  const removed: string[] = [];
  const kept = new URLSearchParams();
  for (const [name, parameter] of url.searchParams) {
    if (
      name.toLowerCase().startsWith("utm_") ||
      TRACKERS.has(name.toLowerCase())
    )
      removed.push(name);
    else kept.append(name, parameter);
  }
  // Avoid re-encoding functional parameters when the query has not changed.
  if (removed.length) url.search = kept.toString();
  if (removeFragment && url.hash) {
    url.hash = "";
    removed.push("#fragment");
  }
  const signals: Signal[] = [];
  let blocked = false;
  const add = (code: string, title: string, detail: string, block = false) => {
    signals.push({ code, title, detail });
    blocked ||= block;
  };
  if (privateHost(url.hostname))
    add(
      "private-host",
      "Destination privée ou réservée",
      "Ce lien ne peut pas être partagé avec le raccourcisseur.",
      true,
    );
  if (url.protocol === "http:")
    add(
      "unencrypted",
      "Connexion HTTP",
      "Le site ne garantit pas le chiffrement de la connexion.",
    );
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")))
    add(
      "ip-host",
      "Adresse IP dans le lien",
      "Vérifiez l’identité du serveur avant de continuer.",
    );
  const unicode = domainToUnicode(url.hostname);
  if (url.hostname.includes("xn--"))
    add(
      "idn",
      "Nom de domaine internationalisé",
      "Vérifiez les caractères affichés : certains peuvent se ressembler.",
    );
  if (
    /\p{Script=Latin}/u.test(unicode) &&
    /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(unicode)
  )
    add(
      "mixed-script",
      "Alphabet inhabituel dans le domaine",
      "Des caractères visuellement proches peuvent masquer une usurpation.",
      true,
    );
  if (BRANDS.some((brand) => url.hostname.includes(brand + ".")))
    add(
      "brand-spoof",
      "Adresse pouvant imiter une marque",
      "Le nom d’un service apparaît devant un autre domaine.",
      true,
    );
  if (url.hostname.length > 100 || url.hostname.split(".").length > 5)
    add(
      "complex-host",
      "Domaine difficile à lire",
      "Le grand nombre de sous-domaines peut rendre la destination trompeuse.",
    );
  if (url.port && !["80", "443"].includes(url.port))
    add(
      "custom-port",
      "Port inhabituel",
      "Le lien utilise un port réseau autre que le port web par défaut.",
    );
  for (const [name, parameter] of url.searchParams) {
    if (SENSITIVE.has(name.toLowerCase()) && parameter)
      add(
        "sensitive-query",
        "Information sensible dans l’URL",
        "Retirez les mots de passe, jetons ou identifiants de session avant d’enregistrer ce lien.",
        true,
      );
    if (
      [
        "url",
        "redirect",
        "redirect_uri",
        "next",
        "target",
        "continue",
      ].includes(name.toLowerCase()) &&
      /^https?:\/\//i.test(parameter)
    ) {
      try {
        if (new URL(parameter).hostname !== url.hostname)
          add(
            "nested-redirect",
            "Une autre destination est intégrée au lien",
            "Le site pourrait rediriger vers un domaine différent.",
          );
      } catch {
        /* A malformed nested URL is not followed. */
      }
    }
  }
  return {
    original,
    cleaned: url.toString(),
    hostname: url.hostname,
    removed,
    originalLength: original.length,
    cleanedLength: url.toString().length,
    verdict: blocked ? "blocked" : signals.length ? "caution" : "clear",
    signals,
    details: {
      protocol: url.protocol.slice(0, -1),
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      parameterCount: Array.from(new URL(original).searchParams).length,
      keptParameterCount: Array.from(url.searchParams).length,
      hasFragment: Boolean(url.hash),
    },
  };
}
