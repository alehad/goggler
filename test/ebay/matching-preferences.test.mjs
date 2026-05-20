import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_MATCHING_CRITERIA_TEXT,
  catalogueIdForTitle,
  parseMatchingPreferences,
  relistingGroupForTitle
} from "../../src/ebay/matching-preferences.ts";

test("defaults matching preferences to exact title plus generic record id criteria", () => {
  const preferences = parseMatchingPreferences({});

  assert.equal(preferences.exactTitleMatch, true);
  assert.equal(preferences.criteriaText, DEFAULT_MATCHING_CRITERIA_TEXT);
  assert.equal(relistingGroupForTitle("Japanese LP TBM17 original", preferences), "criteria:TBM17");
  assert.equal(relistingGroupForTitle("Blue Note BNJ71001 promo pressing", preferences), "criteria:BNJ71001");
  assert.equal(relistingGroupForTitle("Archive reissue ABCDE123456 vinyl", preferences), "criteria:ABCDE123456");
  assert.equal(relistingGroupForTitle("PAP 2005 promo pressing", preferences), "title:pap 2005 promo pressing");
  assert.equal(relistingGroupForTitle("Japanese LP TBM-2541 original", preferences), "title:japanese lp tbm-2541 original");
});

test("uses exact title fallback when criteria do not match", () => {
  const preferences = parseMatchingPreferences({
    exactTitleMatch: "true",
    criteriaText: "NOPE\\d+"
  });

  assert.equal(relistingGroupForTitle("Same Record Title", preferences), "title:same record title");
});

test("can disable exact title fallback", () => {
  const preferences = parseMatchingPreferences({
    exactTitleMatch: "false",
    criteriaText: "NOPE\\d+"
  });

  assert.equal(relistingGroupForTitle("Same Record Title", preferences), undefined);
});

test("ignores invalid regex criteria without failing matching", () => {
  const preferences = parseMatchingPreferences({
    criteriaText: "[broken; TBM\\s*\\d{1,4}"
  });

  assert.equal(relistingGroupForTitle("TBM 2005 pressing", preferences), "criteria:TBM2005");
});

test("bounds user criteria before matching", () => {
  const longCriterion = `TBM${".".repeat(90)}\\d{1,4}`;
  const preferences = parseMatchingPreferences({
    criteriaText: `${longCriterion}; PAP\\s*\\d{1,4}`
  });

  assert.equal(relistingGroupForTitle("PAP 17 pressing", preferences), "criteria:PAP17");
  assert.equal(relistingGroupForTitle("TBM 17 pressing", preferences), "title:tbm 17 pressing");
});

test("ignores unsafe regex criteria", () => {
  const preferences = parseMatchingPreferences({
    criteriaText: "(a+)+$; TBM\\s*\\d{1,4}"
  });

  assert.equal(relistingGroupForTitle("aaaaaaaaaaaaaaaa!", preferences), "title:aaaaaaaaaaaaaaaa!");
  assert.equal(relistingGroupForTitle("TBM 17 pressing", preferences), "criteria:TBM17");
});

test("extracts catalogue ids for market-history queries", () => {
  assert.equal(catalogueIdForTitle("Blue Note BNJ71001 promo pressing", DEFAULT_MATCHING_CRITERIA_TEXT), "BNJ71001");
  assert.equal(catalogueIdForTitle("Archive reissue ABCDE123456 vinyl", DEFAULT_MATCHING_CRITERIA_TEXT), "ABCDE123456");
  assert.equal(catalogueIdForTitle("Too many letters ABCDEF1234 vinyl", DEFAULT_MATCHING_CRITERIA_TEXT), undefined);
  assert.equal(catalogueIdForTitle("Too many digits ABC1234567 vinyl", DEFAULT_MATCHING_CRITERIA_TEXT), undefined);
  assert.equal(catalogueIdForTitle("Separated code TBM 2541 Japan vinyl", DEFAULT_MATCHING_CRITERIA_TEXT), undefined);
});

test("extracts catalogue ids for market-history queries when saved criteria are older", () => {
  assert.equal(catalogueIdForTitle("Three Blind Mice TBM2541 Japan vinyl", String.raw`TBM\s*\d{1,4}`), "TBM2541");
  assert.equal(catalogueIdForTitle("Three Blind Mice TBM-2541 Japan vinyl", String.raw`TBM[-\s]*\d{1,4}`), "TBM2541");
  assert.equal(catalogueIdForTitle("PAP2005 promo pressing", String.raw`TBM\s*\d{1,4}`), "PAP2005");
});
