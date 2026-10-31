import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOrigin, payload, failure } from "../src/lib/http";
import { InputError } from "../src/lib/url";
import { ExpiredLink, MissingLink } from "../src/lib/links";

const endpoint = "http://localhost:3020/api/analyze";

test("accepts the local browser origin and refuses cross-site submissions", () => {
  process.env.APP_URL = "http://localhost:3020";
  checkOrigin(
    new Request(endpoint, { headers: { origin: "http://127.0.0.1:3020" } }),
  );
  assert.throws(
    () =>
      checkOrigin(
        new Request(endpoint, { headers: { origin: "https://example.org" } }),
      ),
    InputError,
  );
  assert.throws(
    () =>
      checkOrigin(
        new Request(endpoint, { headers: { "sec-fetch-site": "cross-site" } }),
      ),
    InputError,
  );
  assert.throws(
    () =>
      checkOrigin(
        new Request(endpoint, { headers: { origin: "http://127.0.0.1:3021" } }),
      ),
    InputError,
  );
});

test("requires a bounded JSON object", async () => {
  const request = (body: string, type = "application/json") =>
    new Request(endpoint, {
      method: "POST",
      headers: { "Content-Type": type },
      body,
    });
  assert.deepEqual(await payload(request('{"url":"https://example.com"}')), {
    url: "https://example.com",
  });
  for (const body of [
    "{",
    "[]",
    "null",
    "1",
    JSON.stringify({ url: "a".repeat(12001) }),
  ])
    await assert.rejects(payload(request(body)), InputError);
  await assert.rejects(payload(request("{}", "text/plain")), InputError);
});

test("API errors have useful statuses and do not expose database internals", async () => {
  assert.equal(failure(new InputError("Invalid URL")).status, 400);
  assert.equal(failure(new MissingLink()).status, 404);
  assert.equal(failure(new ExpiredLink()).status, 410);
  const response = failure(new Error("mysql://synthetic-credential@server"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /synthetic-credential|mysql:/);
});
