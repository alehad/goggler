import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import { fetchLiveEbayHistoryResponse } from "../../src/ebay/live-history-source.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
});

test("fetches live watchlist, lost, and won lists into the Home feed contract", async () => {
  const calls = [];
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
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
  assert.equal(response.counts.lost, 2);
  assert.equal(response.counts.won, 1);
  assert.equal(response.homeFeed.counts.won, 1);
  assert.equal(response.homeFeed.rows[0].section, "watchlist");
  assert.equal(response.homeFeed.rows[0].watchlistPosition, 1);
  assert.equal(response.homeFeed.rows[0].imageUrl, "https://i.ebayimg.example/watch-001.jpg");
  assert.equal(response.homeFeed.rows[0].itemWebUrl, "https://www.ebay.co.uk/itm/watch-001");
  assert.equal(
    response.homeFeed.rows.find((row) => row.section === "unresolved")?.imageUrl,
    "https://i.ebayimg.example/lost-002.jpg"
  );
  assert.equal(response.homeFeed.rows.find((row) => row.section === "won")?.imageUrl, "https://i.ebayimg.example/won-001.jpg");
  assert.equal(response.watchlistItems.every((item) => item.itemId !== "watch-ended"), true);
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

test("uses configured catalogue criteria before exact title matching", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
    matchingPreferences: {
      exactTitleMatch: false,
      criteriaText: String.raw`TBM\s*\d{1,4}; PAP\s*\d{1,4}`
    },
    fetch: async (_url, init) => {
      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list, { catalogueTitles: true }), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  const matchedWatch = response.homeFeed.rows.find((row) => row.sourceItemId === "watch-001");
  assert.equal(matchedWatch?.relistingGroupId, "criteria:TBM17");
  assert.equal(matchedWatch?.tags.includes("Relisting candidate"), true);
  assert.equal(response.counts.watchlistRelistings, 1);
});

test("uses default generic record ids before exact title matching", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
    matchingPreferences: {
      exactTitleMatch: false,
      criteriaText: String.raw`\b[A-Z]{1,5}\d{1,6}\b`
    },
    fetch: async (_url, init) => {
      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list, { genericCatalogueTitles: true }), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  const matchedWatch = response.homeFeed.rows.find((row) => row.sourceItemId === "watch-001");
  assert.equal(matchedWatch?.relistingGroupId, "criteria:BNJ71001");
  assert.equal(matchedWatch?.tags.includes("Relisting candidate"), true);
  assert.equal(response.counts.watchlistRelistings, 1);
});

function responseXml(listName, options = {}) {
  const watchTitle = options.genericCatalogueTitles
    ? "Blue Note style LP BNJ71001 clean copy"
    : options.catalogueTitles
      ? "Blue Note style LP TBM17 clean copy"
      : "Quad 33 preamp and 303 power amp pair";
  const lostTitle = options.genericCatalogueTitles
    ? "Japanese jazz record BNJ71001 original"
    : options.catalogueTitles
      ? "Three Blind Mice jazz record TBM 17"
      : "Quad 33 preamp and 303 power amp pair";
  const items = {
    WatchList: `
      <Item>
        <ItemID>watch-001</ItemID>
        <Title>${watchTitle}</Title>
        <Seller><UserID>watch-seller</UserID></Seller>
        <ListingDetails>
          <EndTime>2026-05-14T20:30:00.000Z</EndTime>
          <ViewItemURL>https://www.ebay.co.uk/itm/watch-001?mkcid=1</ViewItemURL>
        </ListingDetails>
        <PictureDetails><GalleryURL>https://i.ebayimg.example/watch-001.jpg</GalleryURL></PictureDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">410.00</CurrentPrice></SellingStatus>
        <ConditionDisplayName>Used</ConditionDisplayName>
      </Item>
      <Item>
        <ItemID>watch-002</ItemID>
        <Title>Unrelated watchlist item</Title>
        <ListingDetails><EndTime>2026-05-15T20:30:00.000Z</EndTime></ListingDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">99.00</CurrentPrice></SellingStatus>
      </Item>
      <Item>
        <ItemID>watch-ended</ItemID>
        <Title>Ended watchlist item</Title>
        <ListingDetails><EndTime>2026-05-12T20:30:00.000Z</EndTime></ListingDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">88.00</CurrentPrice></SellingStatus>
      </Item>`,
    LostList: `
      <Item>
        <ItemID>lost-001</ItemID>
        <Title>${lostTitle}</Title>
        <PictureDetails><GalleryURL>https://i.ebayimg.example/lost-001.jpg</GalleryURL></PictureDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">390.00</CurrentPrice></SellingStatus>
      </Item>
      <Item>
        <ItemID>lost-002</ItemID>
        <Title>Unmatched lost item with image</Title>
        <PictureDetails><GalleryURL>https://i.ebayimg.example/lost-002.jpg</GalleryURL></PictureDetails>
        <SellingStatus><CurrentPrice currencyID="GBP">45.00</CurrentPrice></SellingStatus>
      </Item>`,
    WonList: `
      <Item>
        <ItemID>won-001</ItemID>
        <Title>Rega Fono Mini A2D phono stage</Title>
        <PictureDetails><GalleryURL>https://i.ebayimg.example/won-001.jpg</GalleryURL></PictureDetails>
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
