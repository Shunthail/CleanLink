import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { database, closeDatabase } from "../src/lib/database";

nextEnv.loadEnvConfig(process.cwd(), true);
try {
  const schema = await readFile(
    new URL("../database/schema.sql", import.meta.url),
    "utf8",
  );
  for (const statement of schema
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean))
    await database().query(statement);
  console.log("Tables MySQL prêtes.");
} catch {
  console.error(
    "Impossible de préparer la base. Vérifiez .env et que MySQL est lancé.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
