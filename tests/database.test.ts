import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import nextEnv from "@next/env";
import type { RowDataPacket } from "mysql2/promise";
import { database, closeDatabase } from "../src/lib/database";
import {
  createLink,
  getLink,
  visit,
  library,
  deleteLink,
  MissingLink,
  ExpiredLink,
} from "../src/lib/links";
import { InputError } from "../src/lib/url";

const enabled = process.env.TEST_DATABASE === "1";

test(
  "MySQL persistence, counting and expiry",
  { skip: !enabled },
  async (context) => {
    nextEnv.loadEnvConfig(process.cwd());
    if (!process.env.MYSQL_DATABASE?.endsWith("_test")) {
      throw new Error(
        "Integration tests require a separate MYSQL_DATABASE ending in _test.",
      );
    }
    const pool = database();
    try {
      const schema = await readFile(
        new URL("../database/schema.sql", import.meta.url),
        "utf8",
      );
      for (const statement of schema.split(";").filter((value) => value.trim()))
        await pool.query(statement);
      await pool.query("DELETE FROM daily_clicks");
      await pool.query("DELETE FROM links");

      await context.test(
        "starts empty and stores only the cleaned destination",
        async () => {
          assert.equal((await library()).stats.totalLinks, 0);
          const link = await createLink(
            "https://example.com/article?utm_source=news&item=42",
            "Article",
            30,
            false,
            false,
          );
          assert.match(link.code, /^[A-Za-z0-9_-]{8}$/);
          assert.equal(link.destination, "https://example.com/article?item=42");
          assert.equal(link.removedCount, 1);
          assert.equal(link.clicks, 0);
          assert.ok(link.expiresAt);
          assert.equal((await getLink(link.code))?.title, "Article");
          assert.equal((await library()).stats.removedParameters, 1);
        },
      );

      await context.test(
        "rejects risky input without inserting rows",
        async () => {
          await assert.rejects(
            createLink("https://localhost/", "", 30, false, true),
            InputError,
          );
          await assert.rejects(
            createLink("http://example.com/", "", 30, false, false),
            InputError,
          );
          await assert.rejects(
            createLink("https://example.com/", "", 31, false, false),
            InputError,
          );
          assert.equal((await library()).stats.totalLinks, 1);
        },
      );

      await context.test(
        "increments concurrent visits atomically and aggregates by date",
        async () => {
          const link = (await library()).links[0];
          const destinations = await Promise.all(
            Array.from({ length: 12 }, () => visit(link.code)),
          );
          assert.ok(destinations.every((value) => value === link.destination));
          assert.equal((await getLink(link.code))?.clicks, 12);
          const stats = (await library()).stats;
          assert.equal(stats.totalClicks, 12);
          assert.deepEqual(stats.daily, [
            { date: new Date().toISOString().slice(0, 10), clicks: 12 },
          ]);
          await getLink(link.code);
          assert.equal((await getLink(link.code))?.clicks, 12);
        },
      );

      await context.test(
        "acknowledged HTTP links work, expired links do not count",
        async () => {
          const link = await createLink(
            "http://example.org/",
            "",
            0,
            false,
            true,
          );
          assert.equal(link.expiresAt, null);
          assert.equal(await visit(link.code), "http://example.org/");
          await pool.execute(
            "UPDATE links SET expires_at=UTC_TIMESTAMP() - INTERVAL 1 DAY WHERE code=?",
            [link.code],
          );
          assert.equal((await getLink(link.code))?.expired, true);
          await assert.rejects(visit(link.code), ExpiredLink);
          assert.equal((await getLink(link.code))?.clicks, 1);
          await assert.rejects(visit("invalid"), MissingLink);
          assert.equal(await getLink("invalid"), null);
        },
      );

      await context.test(
        "deleting a link removes its daily counts",
        async () => {
          for (const link of (await library()).links)
            await deleteLink(link.code);
          assert.equal((await library()).stats.totalClicks, 0);
          const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) AS total FROM daily_clicks",
          );
          assert.equal(Number(rows[0].total), 0);
          await assert.rejects(deleteLink("abcdefgh"), MissingLink);
        },
      );
    } finally {
      await pool.query("DELETE FROM links");
      await closeDatabase();
    }
  },
);
