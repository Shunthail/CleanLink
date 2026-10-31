"use client";
import { useCallback, useEffect, useState } from "react";
import type { Library, LinkAnalysis, SavedLink, Verdict } from "@/lib/types";
import { Icon } from "./icons";

type Mode = "clean" | "shorten" | "analyze";

const verdictLabels: Record<Verdict, string> = {
  clear: "Pas de signal évident",
  caution: "Points à vérifier",
  blocked: "Enregistrement bloqué",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Le serveur ne répond pas. Réessayez dans un instant.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "La requête a échoué.");
  return data as T;
}
export function Workspace() {
  const [view, setView] = useState<"tool" | "library">("tool");
  const [mode, setMode] = useState<Mode>("clean");
  const [input, setInput] = useState("");
  const [fragment, setFragment] = useState(false);
  const [analysis, setAnalysis] = useState<LinkAnalysis | null>(null);
  const [saved, setSaved] = useState<SavedLink | null>(null);
  const [title, setTitle] = useState("");
  const [expiry, setExpiry] = useState(30);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [library, setLibrary] = useState<Library | null>(null);
  const [databaseReady, setDatabaseReady] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [help, setHelp] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await request<Library>("/api/links"));
      setDatabaseReady(true);
    } catch {
      setDatabaseReady(false);
    }
  }, []);
  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);
  useEffect(() => {
    if (!copyNotice) return;
    const timer = setTimeout(() => setCopyNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [copyNotice]);
  function resetResult() {
    setAnalysis(null);
    setSaved(null);
    setAcknowledged(false);
    setMessage("");
  }
  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setSaved(null);
    setAcknowledged(false);
    try {
      setAnalysis(
        await request<LinkAnalysis>("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input, removeFragment: fragment }),
        }),
      );
    } catch (error) {
      setAnalysis(null);
      setMessage(
        error instanceof Error ? error.message : "Analyse impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function shorten() {
    if (busy || !analysis) return;
    setBusy(true);
    setMessage("");
    try {
      const link = await request<SavedLink>("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input,
          title,
          expiryDays: expiry,
          removeFragment: fragment,
          acknowledged,
        }),
      });
      setSaved(link);
      setDatabaseReady(true);
      await loadLibrary();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice("Lien copié.");
    } catch {
      setMessage(
        "La copie est indisponible. Sélectionnez le lien pour le copier.",
      );
    }
  }
  async function remove(link: SavedLink) {
    if (
      !window.confirm(
        `Supprimer le lien « ${link.title} » et ses statistiques ?`,
      )
    )
      return;
    try {
      await request(`/api/links/${link.code}`, { method: "DELETE" });
      await loadLibrary();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    }
  }
  const filtered =
    library?.links.filter((link) =>
      `${link.title} ${link.destination} ${link.code}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  const currentLink = mode === "shorten" ? saved : null;
  return (
    <div className="site">
      <header className="site-header">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            setView("tool");
          }}
        >
          <span className="brand-mark">
            <Icon name="link" />
          </span>
          clean<span>link</span>
          <i />
        </a>
        <nav aria-label="Navigation">
          <button
            className={view === "tool" ? "active" : ""}
            onClick={() => setView("tool")}
          >
            Outil
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => {
              setView("library");
              void loadLibrary();
            }}
          >
            Mes liens {library && <span>{library.stats.totalLinks}</span>}
          </button>
          <button onClick={() => setHelp((value) => !value)}>Aide</button>
        </nav>
        <span className={"storage-status " + (databaseReady ? "ready" : "")}>
          <i />
          {databaseReady === null
            ? "Connexion…"
            : databaseReady
              ? "Enregistrement disponible"
              : "Enregistrement indisponible"}
        </span>
      </header>
      {message && (
        <div className="message" role="alert">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Fermer le message">
            ×
          </button>
        </div>
      )}
      {view === "tool" ? (
        <main>
          <div className="tool-intro">
            <h1>
              colle ton lien<span>_</span>
            </h1>
            <p>Retire le suivi, vérifie l’adresse, partage plus court.</p>
          </div>
          <section className="tool-window" aria-label="Traitement du lien">
            <div className="mode-row">
              <div className="mode-tabs" role="tablist" aria-label="Fonction">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "clean"}
                  className={mode === "clean" ? "selected" : ""}
                  onClick={() => setMode("clean")}
                >
                  <Icon name="spark" />
                  Nettoyer
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "shorten"}
                  className={mode === "shorten" ? "selected" : ""}
                  onClick={() => setMode("shorten")}
                >
                  <Icon name="link" />
                  Raccourcir
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "analyze"}
                  className={mode === "analyze" ? "selected" : ""}
                  onClick={() => setMode("analyze")}
                >
                  <Icon name="shield" />
                  Analyser
                </button>
              </div>
            </div>
            <div className="workbench">
              <form onSubmit={analyze} className="input-side">
                <div className="field-caption">
                  <span>01</span>
                  <label htmlFor="url">Votre lien de départ</label>
                </div>
                <textarea
                  id="url"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    resetResult();
                  }}
                  placeholder="Collez une URL ici…"
                  maxLength={4096}
                  spellCheck={false}
                  required
                />
                <div className="input-foot">
                  <span>{input.length} / 4 096 caractères</span>
                  {input && (
                    <button
                      type="button"
                      onClick={() => {
                        setInput("");
                        resetResult();
                      }}
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={fragment}
                    onChange={(event) => {
                      setFragment(event.target.checked);
                      resetResult();
                    }}
                  />
                  Retirer aussi l’ancre après le #{" "}
                  <span title="Une ancre peut être nécessaire à la navigation dans le site.">
                    ?
                  </span>
                </label>
                <button
                  className="button primary action-button"
                  disabled={busy || !input.trim()}
                >
                  {busy
                    ? "Un instant…"
                    : mode === "clean"
                      ? "Nettoyer ce lien"
                      : mode === "analyze"
                        ? "Analyser ce lien"
                        : "Préparer le lien court"}
                  <Icon name="arrow" />
                </button>
                <p className="input-note">
                  <Icon name="shield" />
                  Le site n’est pas visité et l’URL n’est envoyée à aucun
                  service tiers.
                </p>
              </form>
              <div
                className={"result-side " + (analysis ? "has-result" : "")}
                aria-live="polite"
              >
                <div className="field-caption">
                  <span>02</span>
                  <strong>
                    {currentLink
                      ? "Votre lien court"
                      : analysis
                        ? "Le résultat"
                        : "Le lien, après le tri"}
                  </strong>
                </div>
                {analysis ? (
                  <>
                    <div className={"verdict " + analysis.verdict}>
                      <Icon
                        name={analysis.verdict === "clear" ? "check" : "shield"}
                      />
                      {verdictLabels[analysis.verdict]}
                    </div>
                    <div className="result-url">
                      <a
                        href={currentLink ? currentLink.shortUrl : undefined}
                        target={currentLink ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={currentLink ? "short-result" : ""}
                      >
                        {currentLink ? currentLink.shortUrl : analysis.cleaned}
                      </a>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          copy(
                            currentLink
                              ? currentLink.shortUrl
                              : analysis.cleaned,
                          )
                        }
                        aria-label="Copier le lien"
                      >
                        <Icon name="copy" />
                      </button>
                    </div>
                    <div className="result-numbers">
                      <span>
                        <b>{analysis.removed.length}</b> paramètre(s) retiré(s)
                      </span>
                      <span>
                        {analysis.originalLength}
                        <i>→</i>
                        <b>
                          {currentLink
                            ? currentLink.shortUrl.length
                            : analysis.cleanedLength}
                        </b>{" "}
                        caractères
                      </span>
                    </div>
                    {mode === "clean" && analysis.removed.length === 0 && (
                      <p className="result-explanation">
                        Aucun paramètre de suivi connu à retirer. Les paramètres
                        utiles restent en place.
                      </p>
                    )}
                    {mode === "analyze" && (
                      <>
                        <dl className="url-facts">
                          <div>
                            <dt>Domaine</dt>
                            <dd>{analysis.hostname}</dd>
                          </div>
                          <div>
                            <dt>Connexion</dt>
                            <dd>{analysis.details.protocol.toUpperCase()}</dd>
                          </div>
                          <div>
                            <dt>Port</dt>
                            <dd>{analysis.details.port}</dd>
                          </div>
                          <div>
                            <dt>Paramètres</dt>
                            <dd>{analysis.details.parameterCount}</dd>
                          </div>
                          <div>
                            <dt>Signaux détectés</dt>
                            <dd>{analysis.signals.length}</dd>
                          </div>
                          <div>
                            <dt>Ancre</dt>
                            <dd>
                              {analysis.details.hasFragment
                                ? "Présente"
                                : "Aucune"}
                            </dd>
                          </div>
                        </dl>
                        <p className="result-explanation">
                          Contrôles de structure uniquement. La réputation et le
                          contenu du site ne sont pas vérifiés.
                        </p>
                      </>
                    )}
                    {currentLink && (
                      <dl className="url-facts">
                        <div>
                          <dt>Code</dt>
                          <dd>{currentLink.code}</dd>
                        </div>
                        <div>
                          <dt>Clics enregistrés</dt>
                          <dd>{currentLink.clicks}</dd>
                        </div>
                        <div>
                          <dt>Création</dt>
                          <dd>{date(currentLink.createdAt)}</dd>
                        </div>
                      </dl>
                    )}
                    {analysis.removed.length > 0 && (
                      <div className="removed-list">
                        {analysis.removed.map((name, index) => (
                          <span key={name + index}>
                            {name}
                            <i>×</i>
                          </span>
                        ))}
                      </div>
                    )}
                    {analysis.signals.length > 0 && (
                      <div className="signal-list">
                        {analysis.signals.map((signal, index) => (
                          <div key={signal.code + index}>
                            <strong>{signal.title}</strong>
                            <p>{signal.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {mode === "shorten" &&
                      !currentLink &&
                      analysis.verdict !== "blocked" && (
                        <div className="shorten-options">
                          <div className="option-row">
                            <label>
                              Titre du lien
                              <input
                                value={title}
                                maxLength={100}
                                placeholder={analysis.hostname}
                                onChange={(event) =>
                                  setTitle(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Expiration
                              <select
                                value={expiry}
                                onChange={(event) =>
                                  setExpiry(Number(event.target.value))
                                }
                              >
                                <option value={7}>7 jours</option>
                                <option value={30}>30 jours</option>
                                <option value={90}>90 jours</option>
                                <option value={0}>Sans limite</option>
                              </select>
                            </label>
                          </div>
                          {analysis.verdict === "caution" && (
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={acknowledged}
                                onChange={(event) =>
                                  setAcknowledged(event.target.checked)
                                }
                              />
                              J’ai vérifié les points d’attention.
                            </label>
                          )}
                          <button
                            className="button dark"
                            type="button"
                            disabled={
                              busy ||
                              (analysis.verdict === "caution" && !acknowledged)
                            }
                            onClick={() => void shorten()}
                          >
                            Créer le lien court
                            <Icon name="link" />
                          </button>
                        </div>
                      )}
                    {currentLink && (
                      <div className="saved-note">
                        <Icon name="check" />
                        <span>
                          Enregistré
                          {currentLink.expiresAt
                            ? " jusqu’au " + date(currentLink.expiresAt)
                            : ", sans expiration"}
                          . Un aperçu précède chaque ouverture.
                        </span>
                      </div>
                    )}
                    {mode === "clean" &&
                      analysis.verdict !== "blocked" &&
                      !currentLink && (
                        <button
                          className="text-button"
                          onClick={() => setMode("shorten")}
                        >
                          Le raccourcir aussi
                          <Icon name="arrow" />
                        </button>
                      )}
                  </>
                ) : (
                  <p className="empty-result">[ en attente d’un lien ]</p>
                )}
              </div>
            </div>
          </section>
          <p className="tool-bottom">
            Pas de cookies. Pas de profil visiteur. Juste un compteur de clics.
          </p>
        </main>
      ) : (
        <main className="library-page">
          <div className="library-heading">
            <div>
              <span className="intro-label">LIENS ENREGISTRÉS</span>
              <h1>
                Mes liens<span>.</span>
              </h1>
              <p>Les liens enregistrés et leurs ouvertures, simplement.</p>
            </div>
            <button className="button primary" onClick={() => setView("tool")}>
              Nouveau lien
              <Icon name="link" />
            </button>
          </div>
          {databaseReady === false ? (
            <section className="database-unavailable">
              <Icon name="link" />
              <h2>L’enregistrement est indisponible.</h2>
              <p>
                Les liens sauvegardés seront affichés dès que le stockage
                répondra.
              </p>
              <button
                className="button secondary"
                onClick={() => void loadLibrary()}
              >
                Réessayer
                <Icon name="refresh" />
              </button>
            </section>
          ) : (
            <>
              <div className="library-summary">
                <div>
                  <strong>{library ? library.stats.totalLinks : "—"}</strong>
                  <span>liens enregistrés</span>
                </div>
                <div>
                  <strong>{library ? library.stats.totalClicks : "—"}</strong>
                  <span>ouvertures au total</span>
                </div>
                <div>
                  <strong>
                    {library ? library.stats.removedParameters : "—"}
                  </strong>
                  <span>paramètres retirés</span>
                </div>
                <div className="privacy-summary">
                  <Icon name="shield" />
                  <p>
                    Comptage agrégé.
                    <br />
                    Ni IP, ni profil visiteur.
                  </p>
                </div>
              </div>
              <div className="library-toolbar">
                <label className="library-search">
                  ⌕
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un titre, un domaine…"
                    aria-label="Rechercher un lien"
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Actualiser les liens"
                  onClick={() => void loadLibrary()}
                >
                  <Icon name="refresh" />
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>LIEN</th>
                      <th>ADRESSE COURTE</th>
                      <th>OUVERTURES</th>
                      <th>EXPIRATION</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((link) => (
                      <tr key={link.code}>
                        <td>
                          <strong>{link.title}</strong>
                          <span className="destination">
                            {link.destination}
                          </span>
                          <span
                            className={
                              "library-verdict " +
                              (link.expired ? "expired" : link.verdict)
                            }
                          >
                            {link.expired
                              ? "Expiré"
                              : verdictLabels[link.verdict]}
                          </span>
                        </td>
                        <td>
                          <div className="short-cell">
                            <a
                              href={link.shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              /s/{link.code}
                            </a>
                            <button
                              className="icon-button"
                              aria-label={"Copier " + link.title}
                              onClick={() => void copy(link.shortUrl)}
                            >
                              <Icon name="copy" />
                            </button>
                          </div>
                        </td>
                        <td className="click-number">{link.clicks}</td>
                        <td>
                          {link.expiresAt
                            ? date(link.expiresAt)
                            : "Sans limite"}
                        </td>
                        <td>
                          <button
                            className="icon-button delete"
                            aria-label={"Supprimer " + link.title}
                            onClick={() => void remove(link)}
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="library-empty">
                    <Icon name="link" />
                    <h2>
                      {search
                        ? "Aucun lien ne correspond."
                        : "Votre premier lien attend son tour."}
                    </h2>
                    <p>
                      {search
                        ? "Essayez un autre titre ou domaine."
                        : "Nettoyez une URL, puis enregistrez sa version courte."}
                    </p>
                  </div>
                )}
              </div>
              <p className="library-footnote">
                Les 100 derniers liens sont affichés. Les ouvertures sont des
                clics, pas des visiteurs uniques.
              </p>
            </>
          )}
        </main>
      )}
      {help && (
        <section className="help-panel">
          <button
            className="help-close"
            aria-label="Fermer l’aide"
            onClick={() => setHelp(false)}
          >
            ×
          </button>
          <h2>Sous le capot</h2>
          <div>
            <article>
              <b>01</b>
              <h3>Nettoyer</h3>
              <p>
                Les paramètres de campagne connus sont retirés. Le chemin et les
                autres paramètres restent en place.
              </p>
            </article>
            <article>
              <b>02</b>
              <h3>Vérifier</h3>
              <p>
                Les caractères inhabituels, destinations privées, secrets et
                redirections imbriquées sont signalés. Cette analyse ne garantit
                pas l’innocuité du site.
              </p>
            </article>
            <article>
              <b>03</b>
              <h3>Partager</h3>
              <p>
                Un lien court montre sa destination avant l’ouverture. Seul le
                total journalier des clics est conservé.
              </p>
            </article>
          </div>
        </section>
      )}
      <footer>
        <span className="footer-brand">
          cleanlink<span>↗</span>
        </span>
        <span>Nettoyer · raccourcir · analyser</span>
        <button onClick={() => setHelp((value) => !value)}>
          À propos des contrôles
        </button>
      </footer>
      {copyNotice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {copyNotice}
        </div>
      )}
    </div>
  );
}
