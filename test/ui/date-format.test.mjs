import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAbsoluteDate } from "../../src/ui/date-format.ts";

test("formats valid timestamps as compact absolute dates", () => {
  assert.equal(formatAbsoluteDate("2026-05-03T02:21:00.000Z"), "3 May 2026");
});

test("omits missing and invalid timestamps", () => {
  assert.equal(formatAbsoluteDate(undefined), undefined);
  assert.equal(formatAbsoluteDate("not-a-date"), undefined);
});
