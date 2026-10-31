import { getLink } from "@/lib/links";
import { analyzeUrl } from "@/lib/url";
import { Icon } from "@/components/icons";
export const dynamic = "force-dynamic";
export default async function Destination({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let link = null;
  let unavailable = false;
  try {
    link = await getLink(code);
  } catch {
    unavailable = true;
  }
  const analysis = link ? analyzeUrl(link.destination) : null;
  const blocked = analysis?.verdict === "blocked";
  return (
    <main className="redirect-shell">
      <a href="/" className="brand">
        <span className="brand-mark">
          <Icon name="link" />
        </span>
        clean<span>link</span>
        <i />
      </a>
      <section className="redirect-card">
        <div className="redirect-symbol">
          <Icon
            name={link && !link.expired && !blocked ? "external" : "shield"}
          />
        </div>
        <span className="intro-label">AVANT DE CONTINUER</span>
        <h1>
          {unavailable
            ? "Un petit contretemps."
            : !link
              ? "Ce lien est introuvable."
              : link.expired
                ? "Ce lien a expiré."
                : blocked
                  ? "Cette destination est bloquée."
                  : "Voici où ce lien vous emmène."}
        </h1>
        {link && !link.expired && !blocked ? (
          <>
            <p>Vérifiez la destination avant d’ouvrir le site.</p>
            <div className="redirect-destination">
              <strong>{analysis?.hostname}</strong>
              <span>{link.destination}</span>
            </div>
            {analysis?.signals.length ? (
              <div className="redirect-signals">
                {analysis.signals.map((signal, index) => (
                  <p key={signal.code + index}>
                    <b>{signal.title}.</b> {signal.detail}
                  </p>
                ))}
              </div>
            ) : null}
            <form method="post" action={`/api/links/${code}/visit`}>
              <button className="button primary">
                Continuer vers le site
                <Icon name="arrow" />
              </button>
            </form>
            <p className="redirect-privacy">
              Cette ouverture ajoute un clic au total du jour. Aucune adresse
              IP, aucun cookie et aucun identifiant visiteur ne sont
              enregistrés.
            </p>
          </>
        ) : (
          <>
            <p>
              {unavailable
                ? "Le stockage ne répond pas. Réessayez dans un instant."
                : !link
                  ? "Vérifiez que l’adresse a été copiée en entier."
                  : link.expired
                    ? "Son créateur devra générer une nouvelle adresse."
                    : "Les contrôles ont détecté un risque dans la structure du lien."}
            </p>
            <a href="/" className="button secondary">
              Revenir à CleanLink
            </a>
          </>
        )}
      </section>
      <p className="redirect-foot">
        L’analyse de la structure d’une URL ne garantit pas le contenu du site.
      </p>
    </main>
  );
}
