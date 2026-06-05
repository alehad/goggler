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
      const callName = init.headers["X-EBAY-API-CALL-NAME"];
      if (callName === "GetOrders") {
        calls.push({
          callName,
          token: init.headers["X-EBAY-API-IAF-TOKEN"],
          body
        });
        return new Response(getOrdersResponseXml(), {
          headers: { "Content-Type": "text/xml" }
        });
      }

      const list = body.match(/<(WatchList|LostList|WonList)>/)?.[1];
      calls.push({
        callName,
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
    calls.map((call) => call.list ?? call.callName).sort(),
    ["GetOrders", "LostList", "WatchList", "WonList"]
  );
  assert.equal(calls.every((call) => call.token === "session-access-token"), true);
  assert.equal(calls.every((call) => !call.body.includes("session-access-token")), true);
  assert.equal(response.source, "live");
  assert.equal(response.counts.watchlist, 2);
  assert.equal(response.counts.watchlistRelistings, 1);
  assert.equal(response.counts.lost, 2);
  assert.equal(response.counts.won, 2);
  assert.equal(response.homeFeed.counts.won, 2);
  assert.deepEqual(response.diagnostics?.purchases, {
    wonListCount: 1,
    getOrdersCount: 1,
    mergedWonCount: 2,
    overlapCount: 0,
    wonListTruncated: false,
    getOrdersTruncated: false,
    getOrdersWindowDays: 30,
    getOrdersWindowEndDaysAgo: 60
  });
  const getOrdersCall = calls.find((call) => call.callName === "GetOrders");
  assert.match(getOrdersCall?.body ?? "", /<CreateTimeFrom>2026-02-12T12:00:00.000Z<\/CreateTimeFrom>/);
  assert.match(getOrdersCall?.body ?? "", /<CreateTimeTo>2026-03-14T12:00:00.000Z<\/CreateTimeTo>/);
  assert.equal(response.homeFeed.rows[0].section, "watchlist");
  assert.equal(response.homeFeed.rows[0].watchlistPosition, 1);
  assert.equal(response.homeFeed.rows[0].imageUrl, "https://i.ebayimg.example/watch-001.jpg");
  assert.equal(response.homeFeed.rows[0].itemWebUrl, "https://www.ebay.co.uk/itm/watch-001");
  assert.equal(
    response.homeFeed.rows.find((row) => row.section === "unresolved")?.imageUrl,
    "https://i.ebayimg.example/lost-001.jpg"
  );
  assert.equal(response.homeFeed.ebayRows.every((row) => row.modelList === "ebay"), true);
  assert.equal(response.homeFeed.relistingRows.every((row) => row.modelList === "relisting_candidate"), true);
  assert.equal(response.homeFeed.rows.find((row) => row.section === "won")?.imageUrl, "https://i.ebayimg.example/won-001.jpg");
  assert.equal(response.watchlistItems.every((item) => item.itemId !== "watch-ended"), true);
  assert.equal(JSON.stringify(response).includes("session-access-token"), false);
});

test("returns truncation warnings when a live list exceeds the safety limit", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    fetch: async (_url, init) => {
      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response(getOrdersResponseXml({ totalPages: 2 }), {
          headers: { "Content-Type": "text/xml" }
        });
      }

      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list, { totalPages: list === "WatchList" ? 2 : 1 }), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.deepEqual(response.warnings, ["WatchList truncated after 1 pages", "GetOrders truncated after 1 pages"]);
});

test("dedupes overlapping WonList and GetOrders purchases", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
    fetch: async (_url, init) => {
      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response(getOrdersResponseXml({ itemId: "won-001" }), {
          headers: { "Content-Type": "text/xml" }
        });
      }

      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.equal(response.counts.won, 1);
  assert.equal(response.diagnostics?.purchases?.wonListCount, 1);
  assert.equal(response.diagnostics?.purchases?.getOrdersCount, 1);
  assert.equal(response.diagnostics?.purchases?.mergedWonCount, 1);
  assert.equal(response.diagnostics?.purchases?.overlapCount, 1);
  assert.equal(response.wonItems[0].imageUrl, "https://i.ebayimg.example/won-001.jpg");
});

test("keeps WonList purchases when GetOrders fails softly", async () => {
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
    fetch: async (_url, init) => {
      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response("<GetOrdersResponse><Ack>Failure</Ack></GetOrdersResponse>", {
          headers: { "Content-Type": "text/xml" }
        });
      }

      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.equal(response.counts.won, 1);
  assert.equal(response.diagnostics?.purchases?.getOrdersCount, undefined);
  assert.equal(response.diagnostics?.purchases?.mergedWonCount, 1);
  assert.deepEqual(response.warnings, ["GetOrders buyer purchases unavailable"]);
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
      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response(getOrdersResponseXml({ empty: true }), {
          headers: { "Content-Type": "text/xml" }
        });
      }

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
      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response(getOrdersResponseXml({ empty: true }), {
          headers: { "Content-Type": "text/xml" }
        });
      }

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

test("discovers live relisting candidates for unresolved lost record ids", async () => {
  const calls = [];
  const response = await fetchLiveEbayHistoryResponse(config, "session-access-token", {
    maxPagesPerList: 1,
    now: new Date("2026-05-13T12:00:00.000Z"),
    fetch: async (url, init) => {
      const urlText = String(url);
      if (urlText.includes("/identity/v1/oauth2/token")) {
        calls.push({ type: "app-token", body: String(init.body) });
        return Response.json({
          access_token: "app-access-token",
          expires_in: 7200,
          token_type: "Bearer"
        });
      }

      if (urlText.includes("/buy/browse/v1/item_summary/search")) {
        calls.push({ type: "browse", query: new URL(urlText).searchParams.get("q"), token: init.headers.Authorization });
        return Response.json({
          total: 1,
          itemSummaries: [
            {
              itemId: "live-bnj-1",
              title: "Blue Note BNJ-71001 promo pressing live auction",
              price: { value: "51.00", currency: "GBP" },
              itemWebUrl: "https://www.ebay.co.uk/itm/live-bnj-1",
              image: { imageUrl: "https://i.ebayimg.com/images/g/live-bnj-1/s-l500.jpg" },
              categories: [{ categoryId: "176985", categoryName: "Records" }],
              buyingOptions: ["AUCTION"]
            }
          ]
        });
      }

      if (init.headers["X-EBAY-API-CALL-NAME"] === "GetOrders") {
        return new Response(getOrdersResponseXml({ empty: true }), {
          headers: { "Content-Type": "text/xml" }
        });
      }

      const list = String(init.body).match(/<(WatchList|LostList|WonList)>/)?.[1];
      return new Response(responseXml(list, { genericCatalogueTitles: true, noWatchlistMatch: true }), {
        headers: { "Content-Type": "text/xml" }
      });
    }
  });

  assert.equal(calls.find((call) => call.type === "app-token")?.body.includes("client_credentials"), true);
  assert.equal(calls.find((call) => call.type === "browse")?.query, "BNJ71001");
  assert.equal(calls.find((call) => call.type === "browse")?.token, "Bearer app-access-token");
  assert.equal(response.relistingCandidates.length, 1);
  assert.equal(response.relistingCandidates[0].itemId, "live-bnj-1");
  const relistingRow = response.homeFeed.rows.find((row) => row.sourceItemId === "live-bnj-1");
  assert.equal(relistingRow?.section, "needs_action");
  assert.equal(relistingRow?.categoryId, "176985");
  assert.equal(relistingRow?.tags.includes("Auction"), true);
  assert.equal(response.counts.relistings, 1);
});

function responseXml(listName, options = {}) {
  const watchTitle = options.genericCatalogueTitles
    ? options.noWatchlistMatch
      ? "Different watchlist item"
      : "Blue Note style LP BNJ71001 clean copy"
    : options.catalogueTitles
      ? "Blue Note style LP TBM17 clean copy"
      : "Quad 33 preamp and 303 power amp pair";
  const lostTitle = options.genericCatalogueTitles
    ? "Japanese jazz record BNJ-71001 original"
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
        <PrimaryCategory>
          <CategoryID>176985</CategoryID>
          <CategoryName>Records</CategoryName>
        </PrimaryCategory>
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

function getOrdersResponseXml(options = {}) {
  const totalPages = options.totalPages ?? 1;
  const itemId = options.itemId ?? "order-only-001";
  const items = options.empty
    ? ""
    : `<Order>
      <OrderID>order-001</OrderID>
      <CreatedTime>2026-02-12T10:15:00.000Z</CreatedTime>
      <TransactionArray>
        <Transaction>
          <TransactionID>transaction-001</TransactionID>
          <CreatedDate>2026-02-12T10:15:00.000Z</CreatedDate>
          <TransactionPrice currencyID="GBP">77.00</TransactionPrice>
          <Item>
            <ItemID>${itemId}</ItemID>
            <Title>Order-only won record TBM2541</Title>
            <PictureDetails><GalleryURL>https://i.ebayimg.example/${itemId}.jpg</GalleryURL></PictureDetails>
            <ListingDetails><ViewItemURL>https://www.ebay.co.uk/itm/${itemId}?mkcid=1</ViewItemURL></ListingDetails>
          </Item>
        </Transaction>
      </TransactionArray>
    </Order>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <PaginationResult>
    <TotalNumberOfPages>${totalPages}</TotalNumberOfPages>
    <TotalNumberOfEntries>${options.empty ? 0 : 1}</TotalNumberOfEntries>
  </PaginationResult>
  <PageNumber>1</PageNumber>
  <OrderArray>${items}</OrderArray>
</GetOrdersResponse>`;
}
