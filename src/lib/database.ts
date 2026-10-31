import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

const globalDatabase = globalThis as typeof globalThis & {
  cleanlinkPool?: Pool;
};

export function database(): Pool {
  if (!process.env.MYSQL_PASSWORD) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!globalDatabase.cleanlinkPool) {
    globalDatabase.cleanlinkPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3307),
      database: process.env.MYSQL_DATABASE || "cleanlink",
      user: process.env.MYSQL_USER || "cleanlink",
      password: process.env.MYSQL_PASSWORD,
      connectionLimit: 5,
      connectTimeout: 4000,
      timezone: "Z",
      dateStrings: true,
      charset: "utf8mb4",
      multipleStatements: false,
    });
  }
  return globalDatabase.cleanlinkPool;
}

export async function closeDatabase(): Promise<void> {
  if (globalDatabase.cleanlinkPool) await globalDatabase.cleanlinkPool.end();
  delete globalDatabase.cleanlinkPool;
}
