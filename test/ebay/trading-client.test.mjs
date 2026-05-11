import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import {
  buildGetMyeBayBuyingRequest,
  fetchGetMyeBayBuyingPage,
  parseGetMyeBayBuyingResponse
} from "../../src/ebay/trading-client.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_CLIENT_ID: "client-id",
  EBAY_CLIENT_SECRET: "client-secret",
  EBAY_REDIRECT_URI: "runame-value",
  EBAY_OAUTH_SCOPES: "scope-one"
});

test("builds GetMyeBayBuying Trading API requests with OAuth bearer material only in headers", () => {
  const request = buildGetMyeBayBuyingRequest(config, "session-access-token", {
    list: "LostList",
    pageNumber: 2,
    entriesPerPage: 25
  });

  assert.equal(request.url, "https://api.sandbox.ebay.com/ws/api.dll");
  assert.equal(request.headers["X-EBAY-API-CALL-NAME"], "GetMyeBayBuying");
  assert.equal(request.headers["X-EBAY-API-SITEID"], "3");
  assert.equal(request.headers["X-EBAY-API-IAF-TOKEN"], "session-access-token");
  assert.equal(request.headers["Content-Type"], "text/xml");
  assert.match(request.body, /<LostList>/);
  assert.match(request.body, /<EntriesPerPage>25<\/EntriesPerPage>/);
  assert.match(request.body, /<PageNumber>2<\/PageNumber>/);
  assert.equal(request.body.includes("RequesterCredentials"), false);
  assert.equal(request.body.includes("session-access-token"), false);
});

test("builds WonList requests independently from LostList requests", () => {
  const request = buildGetMyeBayBuyingRequest(config, "session-access-token", {
    list: "WonList"
  });

  assert.match(request.body, /<WonList>/);
  assert.match(request.body, /<EntriesPerPage>100<\/EntriesPerPage>/);
  assert.match(request.body, /<PageNumber>1<\/PageNumber>/);
  assert.equal(request.body.includes("<LostList>"), false);
});

test("rejects unexpected Trading API URLs before sending token material", () => {
  assert.throws(
    () =>
      buildGetMyeBayBuyingRequest(
        {
          ...config,
          tradingApiUrl: "https://example.test/ws/api.dll"
        },
        "session-access-token",
        { list: "LostList" }
      ),
    /not trusted/
  );
});

test("parses normalized buying history pages", () => {
  const page = parseGetMyeBayBuyingResponse(responseXml("LostList"), "LostList");

  assert.equal(page.ack, "Success");
  assert.equal(page.pageNumber, 1);
  assert.equal(page.totalPages, 3);
  assert.equal(page.totalEntries, 48);
  assert.equal(page.items.length, 2);
  assert.deepEqual(page.items[0], {
    itemId: "sandbox-lost-001",
    title: "Rega Planar 3 turntable & Elys cartridge",
    list: "LostList",
    currentPrice: { value: 214.25, currency: "GBP" },
    endTime: "2026-01-12T20:15:00.000Z",
    sellerUserId: "sandbox-seller",
    conditionDisplayName: "Used"
  });
});

test("fetches and parses GetMyeBayBuying pages", async () => {
  let request;
  const page = await fetchGetMyeBayBuyingPage(
    config,
    "session-access-token",
    { list: "WonList", pageNumber: 1, entriesPerPage: 50 },
    {
      fetch: async (url, init) => {
        request = { url, init };
        return new Response(responseXml("WonList"), {
          headers: { "Content-Type": "text/xml" }
        });
      }
    }
  );

  assert.equal(request.url, "https://api.sandbox.ebay.com/ws/api.dll");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["X-EBAY-API-IAF-TOKEN"], "session-access-token");
  assert.equal(page.list, "WonList");
  assert.equal(page.items[0].list, "WonList");
});

test("normalizes HTTP and API failures without leaking token values", async () => {
  await assert.rejects(
    () =>
      fetchGetMyeBayBuyingPage(config, "secret-token-value", { list: "LostList" }, {
        fetch: async () => new Response("nope", { status: 500 })
      }),
    (error) => {
      assert.match(error.message, /status 500/);
      assert.equal(error.message.includes("secret-token-value"), false);
      return true;
    }
  );

  assert.throws(
    () => parseGetMyeBayBuyingResponse("<GetMyeBayBuyingResponse><Ack>Failure</Ack></GetMyeBayBuyingResponse>", "LostList"),
    /Failure/
  );
});

function responseXml(listName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <${listName}>
    <PaginationResult>
      <TotalNumberOfPages>3</TotalNumberOfPages>
      <TotalNumberOfEntries>48</TotalNumberOfEntries>
    </PaginationResult>
    <PageNumber>1</PageNumber>
    <ItemArray>
      <Item>
        <ItemID>sandbox-lost-001</ItemID>
        <Title>Rega Planar 3 turntable &amp; Elys cartridge</Title>
        <Seller>
          <UserID>sandbox-seller</UserID>
        </Seller>
        <ListingDetails>
          <EndTime>2026-01-12T20:15:00.000Z</EndTime>
        </ListingDetails>
        <SellingStatus>
          <CurrentPrice currencyID="GBP">214.25</CurrentPrice>
        </SellingStatus>
        <ConditionDisplayName>Used</ConditionDisplayName>
      </Item>
      <Item>
        <ItemID>sandbox-lost-002</ItemID>
        <Title>Naim Nait 5si integrated amplifier</Title>
        <SellingStatus>
          <CurrentPrice currencyID="GBP">326.01</CurrentPrice>
        </SellingStatus>
      </Item>
    </ItemArray>
  </${listName}>
</GetMyeBayBuyingResponse>`;
}
