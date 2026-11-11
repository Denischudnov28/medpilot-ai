"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  cleanText,
  hasProAccess,
  UUID_RE
} = require("./medflow-api");

test("password hashes use a unique salt and verify correctly", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");

  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword("correct horse battery staple", first.salt, first.hash), true);
  assert.equal(await verifyPassword("wrong password", first.salt, first.hash), false);
});

test("signed tokens validate and reject tampering", () => {
  process.env.MEDFLOW_TOKEN_SECRET = "test-only-secret-with-enough-entropy-for-unit-tests";
  const user = {
    id: "4f7c1e9a-4f32-4b1c-9c10-8df50c8d1f10",
    email: "doctor@example.test"
  };

  const token = signToken(user);
  assert.equal(verifyToken(token).sub, user.id);
  assert.equal(verifyToken(token + "tampered"), null);
  assert.equal(verifyToken("not-a-token"), null);
});

test("text cleanup enforces type, trimming, required values and length", () => {
  assert.equal(cleanText("  ICU  ", 10), "ICU");
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText(null, 10), "");
  assert.equal(cleanText("   ", 10, true), null);
  assert.equal(cleanText("ok", 10, true), "ok");
});

test("UUID validation accepts canonical UUIDs and rejects malformed ids", () => {
  assert.equal(UUID_RE.test("4f7c1e9a-4f32-4b1c-9c10-8df50c8d1f10"), true);
  assert.equal(UUID_RE.test("not-a-uuid"), false);
});

test("Pro access requires an active or trialing subscription within its paid period", () => {
  const now = Date.parse("2026-11-11T00:00:00.000Z");
  assert.equal(hasProAccess({ plan: "free", status: "active" }, now), false);
  assert.equal(hasProAccess({ plan: "pro", status: "past_due" }, now), false);
  assert.equal(hasProAccess({ plan: "pro", status: "active", current_period_end: "2026-11-12T00:00:00.000Z" }, now), true);
  assert.equal(hasProAccess({ plan: "pro", status: "trialing", current_period_end: null }, now), true);
  assert.equal(hasProAccess({ plan: "pro", status: "active", current_period_end: "2026-11-10T00:00:00.000Z" }, now), false);
  assert.equal(hasProAccess({ plan: "pro", status: "canceled" }, now), false);
});
