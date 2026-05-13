import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { fetchLiveEbayHistoryResponse } from "../../src/ebay/live-history-source.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_CLIENT_ID: "client-id",
  EBAY_CLIENT_SECRET: "client-secret",
  EBAY_REDIRECT_URI: "runame-value",
  EBAY_OAUTH_SCOPES: "scope-one"
});

test("fetches live watchlist, lost, and won lists into the Home feed contract", async () => {
  const calls = [];
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    fetch: async (_url, init) => {
      const body = String(init.body);
      const list = body.match(/<(WatchList|LostList|WonList)>/)?.[1];
      calls.push({
        list,
        token: init.headers["X-EBAY-API-IAF-TOKEN"],
        body
      });
      return new Response(responseXml(list), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.deepEqual(
    calls.map((call) => call.list).sort(),
    ["LostList", "WatchList", "WonList"]
  );
  assert.equal(calls.every((call) => call.token === "session-access-token"), true);
  assert.equal(calls.every((call) => !call.body.includes("session-access-token")), true);
  assert.equal(response.source, "live");
  assert.equal(response.counts.watchlist, 2);
  assert.equal(response.counts.watchlistRelistings, 1);
  assert.equal(response.counts.lost, 1);
  assert.equal(response.counts.won, 1);
  assert.equal(response.homeFeed.rows[0].section, "watchlist");
  assert.equal(response.homeFeed.rows[0].watchlistPosition, 1);
  assert.equal(JSON.stringify(response).includes("session-access-token"), false);
});

test("returns truncation warnings when a live list exceeds the safety limit", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    fetch: async (_url, init) => {
      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list, { totalPages: list === "WatchList" ? 2 : 1 }), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.deepEqual(response.warnings, ["WatchList truncated after 1 pages"]);
});

function responseXml(listName, options = {}) {
  const items = {
    WatchList: `
      <Item>
        <ItemID>watch-001</ItemID>
        <Title>Quad 33 preamp and 303 power amp pair</Title>
        <Seller><UserID>watch-seller</UserID></Seller>
        <ListingDetails><EndTime>2026-05-14T20:30:00.000Z</EndTime></ListingDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">410.00</CurrentPrice></SellingStatus>
        <ConditionDisplayName>Used</ConditionDisplayName>
      </Item>
      <Item>
        <ItemID>watch-002</ItemID>
        <Title>Unrelated watchlist item</Title>
        <SellingStatus><CurrentPrice currencyID="GBP">99.00</CurrentPrice></SellingStatus>
      </Item>`,
    LostList: `
      <Item>
        <ItemID>lost-001</ItemID>
        <Title>Quad 33 preamp and 303 power amp pair</Title>
        <SellingStatus><CurrentPrice currencyID="GBP">390.00</CurrentPrice></SellingStatus>
      </Item>`,
    WonList: `
      <Item>
        <ItemID>won-001</ItemID>
        <Title>Rega Fono Mini A2D phono stage</Title>
        <SellingStatus><CurrentPrice currencyID="GBP">88.00</CurrentPrice></SellingStatus>
      </Item>`
  }[listName];

  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <${listName}>
    <PaginationResult>
      <TotalNumberOfPages>${options.totalPages ?? 1}</TotalNumberOfPages>
      <TotalNumberOfEntries>1</TotalNumberOfEntries>
    </PaginationResult>
    <PageNumber>1</PageNumber>
    <ItemArray>${items}</ItemArray>
  </${listName}>
</GetMyeBayBuyingResponse>`;
}
