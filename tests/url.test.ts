import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeUrl, InputError } from "../src/lib/url";

test("normalizes a bare domain and removes known campaign parameters", () => {
  const result = analyzeUrl(
    "EXAMPLE.com/article?utm_source=mail&item=42&FBCLID=abc&utm_source=again#intro",
  );
  assert.equal(result.cleaned, "https://example.com/article?item=42#intro");
  assert.deepEqual(result.removed, ["utm_source", "FBCLID", "utm_source"]);
  assert.equal(result.verdict, "clear");
});

test("keeps functional parameters, duplicate values and an unmodified query encoding", () => {
  const original =
    "https://example.com/search?q=hello%20world&ref=shop&tag=a&tag=b#section";
  assert.equal(analyzeUrl(original).cleaned, original);
  const cleaned = new URL(
    analyzeUrl(original.replace("#section", "&utm_medium=email#section"))
      .cleaned,
  );
  assert.deepEqual(cleaned.searchParams.getAll("tag"), ["a", "b"]);
});

test("fragment removal is opt-in", () => {
  assert.equal(
    analyzeUrl("https://example.com/#/settings").cleaned,
    "https://example.com/#/settings",
  );
  const result = analyzeUrl("https://example.com/#/settings", true);
  assert.equal(result.cleaned, "https://example.com/");
  assert.deepEqual(result.removed, ["#fragment"]);
});

test("rejects unsupported schemes, embedded credentials and malformed input", () => {
  for (const input of [
    "",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/a\nb",
    "https://example.com/a b",
    "x".repeat(4097),
  ]) {
    assert.throws(() => analyzeUrl(input), InputError, input);
  }
});

test("blocks private destinations including normalized and IPv6 addresses", () => {
  for (const host of [
    "localhost",
    "service.internal",
    "10.0.0.1",
    "172.16.2.3",
    "192.168.1.2",
    "0x7f000001",
    "2130706433",
    "[::1]",
    "[::ffff:127.0.0.1]",
    "[fc00::1]",
    "service.test",
  ]) {
    assert.equal(analyzeUrl("https://" + host).verdict, "blocked", host);
  }
});

test("reports HTTP, public IP addresses and unusual ports as points to verify", () => {
  for (const input of [
    "http://example.com",
    "https://8.8.8.8",
    "https://example.com:8443",
  ]) {
    assert.equal(analyzeUrl(input).verdict, "caution", input);
  }
  assert.equal(
    analyzeUrl("example.com:8443/path").cleaned,
    "https://example.com:8443/path",
  );
});

test("detects brand subdomain deception and mixed alphabets", () => {
  assert.equal(
    analyzeUrl("https://paypal.com.login.example.org").verdict,
    "blocked",
  );
  assert.equal(analyzeUrl("https://pаypal.com").verdict, "blocked"); // Cyrillic а.
  assert.equal(analyzeUrl("https://www.paypal.com").verdict, "clear");
  assert.equal(analyzeUrl("https://café.fr").verdict, "caution");
});

test("refuses to store common secret parameters and detects nested redirects", () => {
  const secret = analyzeUrl(
    "https://example.com/?access_token=synthetic-test-value",
  );
  assert.equal(secret.verdict, "blocked");
  assert.ok(secret.signals.some((signal) => signal.code === "sensitive-query"));
  const redirect = analyzeUrl(
    "https://example.com/?next=https%3A%2F%2Fexample.org%2F",
  );
  assert.equal(redirect.verdict, "caution");
  assert.ok(
    redirect.signals.some((signal) => signal.code === "nested-redirect"),
  );
});

test("preserves functional video, playlist and radio parameters", () => {
  const input =
    "https://example.com/watch?v=video123&list=playlist123&start_radio=1";
  const analysis = analyzeUrl(input);
  assert.equal(analysis.cleaned, input);
  assert.deepEqual(analysis.removed, []);
  assert.equal(analysis.verdict, "clear");
  assert.deepEqual(analysis.details, {
    protocol: "https",
    port: 443,
    parameterCount: 3,
    keptParameterCount: 3,
    hasFragment: false,
  });
});
