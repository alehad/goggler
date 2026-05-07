import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionToken
} from "../../src/auth/session-cookie.ts";
import { SESSION_COOKIE_NAME } from "../../src/auth/session-store.ts";

test("creates an http-only session cookie", () => {
  const cookie = createSessionCookie("abc 123", new Date("2026-05-01T10:00:00.000Z"));

  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=abc%20123`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Expires=Fri, 01 May 2026 10:00:00 GMT/);
});

test("omits secure flag for local http session cookies", () => {
  const cookie = createSessionCookie("abc 123", new Date("2026-05-01T10:00:00.000Z"), {
    secure: false
  });

  assert.doesNotMatch(cookie, /Secure/);
});

test("reads the session token from a cookie header", () => {
  const token = readSessionToken("theme=light; goggler_session=abc%20123; other=value");

  assert.equal(token, "abc 123");
});

test("creates a clearing cookie", () => {
  const cookie = clearSessionCookie();

  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});
