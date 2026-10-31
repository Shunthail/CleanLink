import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { database } from "./database";
import { analyzeUrl, InputError } from "./url";
import type { Library, SavedLink } from "./types";

export class MissingLink extends Error {}
export class ExpiredLink extends Error {}

export function appOrigin(): string {
  const url = new URL(process.env.APP_URL || "http://localhost:3020");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("INVALID_APP_URL");
  return url.origin;
}
function iso(value: string | null): string | null {
  return value ? new Date(value.replace(" ", "T") + "Z").toISOString() : null;
}
function saved(row: RowDataPacket): SavedLink {
  const expiresAt = iso(row.expires_at);
  return {
    code: row.code,
    title: row.title,
    destination: row.destination,
    shortUrl: `${appOrigin()}/s/${row.code}`,
    removedCount: Number(row.removed_count),
    verdict: row.verdict,
    clicks: Number(row.clicks),
    createdAt: iso(row.created_at)!,
    expiresAt,
    expired: expiresAt !== null && Date.parse(expiresAt) <= Date.now(),
  };
}
export async function createLink(
  input: string,
  title: string,
  expiryDays: number,
  removeFragment: boolean,
  acknowledged: boolean,
): Promise<SavedLink> {
  const analysis = analyzeUrl(input, removeFragment);
  if (analysis.verdict === "blocked")
    throw new InputError(
      "Ce lien présente un risque empêchant son enregistrement. Consultez l’analyse.",
    );
  if (analysis.verdict === "caution" && !acknowledged)
    throw new InputError(
      "Confirmez avoir lu les points d’attention avant de raccourcir ce lien.",
    );
  if (![0, 7, 30, 90].includes(expiryDays))
    throw new InputError("Durée de validité invalide.");
  if (typeof title !== "string" || title.trim().length > 100)
    throw new InputError("Le titre doit contenir au plus 100 caractères.");
  const expires = expiryDays
    ? new Date(Date.now() + expiryDays * 86400000)
    : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomBytes(6).toString("base64url");
    try {
      await database().execute<ResultSetHeader>(
        "INSERT INTO links (code,title,destination,removed_count,verdict,expires_at,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(3))",
        [
          code,
          title.trim() || analysis.hostname,
          analysis.cleaned,
          analysis.removed.length,
          analysis.verdict,
          expires,
        ],
      );
      return (await getLink(code))!;
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
    }
  }
  throw new Error("CODE_GENERATION_FAILED");
}
export async function getLink(code: string): Promise<SavedLink | null> {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) return null;
  const [rows] = await database().execute<RowDataPacket[]>(
    "SELECT * FROM links WHERE code=? LIMIT 1",
    [code],
  );
  return rows[0] ? saved(rows[0]) : null;
}
export async function library(): Promise<Library> {
  const pool = database();
  const [[rows], [stats], [daily]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      "SELECT * FROM links ORDER BY id DESC LIMIT 100",
    ),
    pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS totalLinks, COALESCE(SUM(clicks),0) AS totalClicks, COALESCE(SUM(removed_count),0) AS removedParameters FROM links",
    ),
    pool.query<RowDataPacket[]>(
      'SELECT DATE_FORMAT(visit_date, "%Y-%m-%d") AS date, SUM(clicks) AS clicks FROM daily_clicks WHERE visit_date >= UTC_DATE() - INTERVAL 13 DAY GROUP BY visit_date ORDER BY visit_date',
    ),
  ]);
  return {
    links: rows.map(saved),
    stats: {
      totalLinks: Number(stats[0].totalLinks),
      totalClicks: Number(stats[0].totalClicks),
      removedParameters: Number(stats[0].removedParameters),
      daily: daily.map((row) => ({
        date: row.date,
        clicks: Number(row.clicks),
      })),
    },
  };
}
export async function visit(code: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) throw new MissingLink();
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM links WHERE code=? FOR UPDATE",
      [code],
    );
    if (!rows[0]) throw new MissingLink();
    const link = saved(rows[0]);
    if (link.expired) throw new ExpiredLink();
    if (analyzeUrl(link.destination).verdict === "blocked")
      throw new InputError(
        "Cette destination est bloquée par les contrôles de sécurité.",
      );
    await connection.execute("UPDATE links SET clicks=clicks+1 WHERE id=?", [
      rows[0].id,
    ]);
    await connection.execute(
      "INSERT INTO daily_clicks (link_id,visit_date,clicks) VALUES (?,UTC_DATE(),1) ON DUPLICATE KEY UPDATE clicks=clicks+1",
      [rows[0].id],
    );
    await connection.commit();
    return link.destination;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function deleteLink(code: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) throw new MissingLink();
  const [result] = await database().execute<ResultSetHeader>(
    "DELETE FROM links WHERE code=?",
    [code],
  );
  if (!result.affectedRows) throw new MissingLink();
}
