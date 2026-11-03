import { test } from "node:test";
import assert from "node:assert/strict";
import { parseApiResponse } from "../src/lib/api-response.ts";

test("hosting HTML 429 is identified separately and respects Retry-After", async () => {
  await assert.rejects(parseApiResponse(new Response("<html>Just a moment… private challenge</html>", {
    status: 429,
    headers: { "Content-Type": "text/html", "cf-mitigated": "challenge", "Retry-After": "90" },
  })), (error) => {
    assert.equal(error.code, "UPSTREAM_RATE_LIMITED");
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterSeconds, 90);
    assert.match(error.message, /hosting provider/);
    assert.doesNotMatch(error.message, /private|<html>/);
    return true;
  });
});

test("application JSON 429 keeps its message and defaults to a 60 second cooldown", async () => {
  await assert.rejects(parseApiResponse(Response.json({ code: "RATE_LIMITED", error: "Too many changes." }, { status: 429 })), (error) => {
    assert.equal(error.code, "RATE_LIMITED");
    assert.equal(error.message, "Too many changes.");
    assert.equal(error.retryAfterSeconds, 60);
    return true;
  });
});

test("HTML gateway failures produce a retryable message without exposing HTML", async () => {
  for (const status of [502, 503, 504]) {
    await assert.rejects(
      parseApiResponse(
        new Response("<!DOCTYPE html><html>private upstream details</html>", {
          status,
          headers: { "Content-Type": "text/html" },
        }),
      ),
      (error) => {
        assert.equal(error.code, "SERVICE_UNAVAILABLE");
        assert.equal(error.status, status);
        assert.match(error.message, /ANVIRA is temporarily unavailable/);
        assert.doesNotMatch(error.message, /DOCTYPE|private|Unexpected token/);
        return true;
      },
    );
  }
});

test("HTML with status 200 and malformed JSON are rejected as invalid API responses", async () => {
  for (const [body, contentType] of [
    ["<!DOCTYPE html><html>SPA fallback</html>", "text/html"],
    ["not-json", "application/json"],
    ["null", "application/json"],
  ]) {
    await assert.rejects(
      parseApiResponse(
        new Response(body, { headers: { "Content-Type": contentType } }),
      ),
      (error) =>
        error.code === "INVALID_API_RESPONSE" &&
        /unexpected response/.test(error.message),
    );
  }
});

test("valid JSON payloads and structured server failures remain available to callers", async () => {
  for (const [status, value] of [
    [200, { token: "fixture-csrf-token" }],
    [401, { error: "Session expired", code: "AUTH_REQUIRED" }],
    [403, { error: "Refresh session", code: "CSRF_FAILED" }],
    [503, { error: "Workspace quota exceeded", code: "QUOTA_EXCEEDED" }],
  ]) {
    assert.deepEqual(
      await parseApiResponse(
        new Response(JSON.stringify(value), {
          status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }),
      ),
      value,
    );
  }
});

test("JSON cancellation remains an AbortError for the request timeout handler", async () => {
  const error = new DOMException("Aborted", "AbortError");
  await assert.rejects(
    parseApiResponse({
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => {
        throw error;
      },
    }),
    (failure) => failure === error,
  );
});
