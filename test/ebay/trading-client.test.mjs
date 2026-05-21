import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEbayConfig } from "../../src/ebay/config.ts";
import {
  buildGetMyeBayBuyingRequest,
  fetchGetMyeBayBuyingPage,
  fetchGetMyeBayBuyingPages,
  parseGetMyeBayBuyingResponse
} from "../../src/ebay/trading-client.ts";

const config = loadEbayConfig({
  EBAY_ENVIRONMENT: "sandbox",
  EBAY_SANDBOX_CLIENT_ID: "client-id",
  EBAY_SANDBOX_CLIENT_SECRET: "client-secret",
  EBAY_SANDBOX_REDIRECT_URI: "runame-value",
  EBAY_SANDBOX_OAUTH_SCOPES: "scope-one"
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

test("builds WatchList requests independently from history list requests", () => {
  const request = buildGetMyeBayBuyingRequest(config, "session-access-token", {
    list: "WatchList",
    pageNumber: 1,
    entriesPerPage: 10
  });

  assert.match(request.body, /<WatchList>/);
  assert.match(request.body, /<EntriesPerPage>10<\/EntriesPerPage>/);
  assert.equal(request.body.includes("<LostList>"), false);
  assert.equal(request.body.includes("<WonList>"), false);
  assert.equal(request.body.includes("session-access-token"), false);
});

test("fetches GetMyeBayBuying pages up to the safety limit", async () => {
  const requestedPages = [];
  const pages = await fetchGetMyeBayBuyingPages(
    config,
    "session-access-token",
    { list: "WatchList", entriesPerPage: 1, maxPages: 2 },
    {
      fetch: async (_url, init) => {
        const pageNumber = Number(init.body.match(/<PageNumber>(\d+)<\/PageNumber>/)?.[1]);
        requestedPages.push(pageNumber);
        return new Response(responseXml("WatchList", { pageNumber, totalPages: 3, totalEntries: 3 }), {
          headers: { "Content-Type": "text/xml" }
        });
      }
    }
  );

  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(pages.truncated, true);
  assert.equal(pages.pagesFetched, 2);
  assert.equal(pages.items.length, 4);
});

test("falls back on malformed pagination values", () => {
  const page = parseGetMyeBayBuyingResponse(
    responseXml("WatchList", { pageNumber: "not-a-number", totalPages: "-1", totalEntries: "nope" }),
    "WatchList"
  );

  assert.equal(page.pageNumber, 1);
  assert.equal(page.totalPages, 1);
  assert.equal(page.totalEntries, 0);
});

test("treats a missing requested list in a successful response as empty history", () => {
  const page = parseGetMyeBayBuyingResponse(
    "<?xml version=\"1.0\" encoding=\"utf-8\"?><GetMyeBayBuyingResponse><Ack>Success</Ack></GetMyeBayBuyingResponse>",
    "WonList"
  );

  assert.equal(page.list, "WonList");
  assert.equal(page.totalEntries, 0);
  assert.deepEqual(page.items, []);
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
    conditionDisplayName: "Used",
    categoryId: "176985",
    categoryName: "Records",
    imageUrl: "https://i.ebayimg.example/sandbox-lost-001.jpg",
    itemWebUrl: "https://www.ebay.co.uk/itm/sandbox-lost-001"
  });
});

test("rejects unsafe listing image URLs", () => {
  const page = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "javascript:alert(1)" }), "WatchList");
  const httpPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "http://i.ebayimg.example/item.jpg" }), "WatchList");
  const localhostPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://localhost/item.jpg" }), "WatchList");
  const privateIpPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://192.168.1.10/item.jpg" }), "WatchList");
  const apipaPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://169.254.1.10/item.jpg" }), "WatchList");
  const mappedIpPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://[::ffff:192.168.1.10]/item.jpg" }), "WatchList");
  const linkLocalPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://[fe80::1]/item.jpg" }), "WatchList");
  const decimalPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://2130706433/item.jpg" }), "WatchList");
  const hexPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://0x7f000001/item.jpg" }), "WatchList");
  const octalPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { imageUrl: "https://017700000001/item.jpg" }), "WatchList");

  assert.equal(page.items[0].imageUrl, undefined);
  assert.equal(httpPage.items[0].imageUrl, undefined);
  assert.equal(localhostPage.items[0].imageUrl, undefined);
  assert.equal(privateIpPage.items[0].imageUrl, undefined);
  assert.equal(apipaPage.items[0].imageUrl, undefined);
  assert.equal(mappedIpPage.items[0].imageUrl, undefined);
  assert.equal(linkLocalPage.items[0].imageUrl, undefined);
  assert.equal(decimalPage.items[0].imageUrl, undefined);
  assert.equal(hexPage.items[0].imageUrl, undefined);
  assert.equal(octalPage.items[0].imageUrl, undefined);
});

test("parses trusted eBay item URLs and strips unnecessary URL material", () => {
  const page = parseGetMyeBayBuyingResponse(
    responseXml("WatchList", {
      itemWebUrl: "https://user:password@www.ebay.co.uk/itm/sandbox-lost-001?mkcid=1#tracking"
    }),
    "WatchList"
  );

  assert.equal(page.items[0].itemWebUrl, "https://www.ebay.co.uk/itm/sandbox-lost-001");
});

test("rejects unsafe eBay item URLs", () => {
  const javascriptPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { itemWebUrl: "javascript:alert(1)" }), "WatchList");
  const httpPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { itemWebUrl: "http://www.ebay.co.uk/itm/1" }), "WatchList");
  const otherHostPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { itemWebUrl: "https://example.test/itm/1" }), "WatchList");
  const localhostPage = parseGetMyeBayBuyingResponse(responseXml("WatchList", { itemWebUrl: "https://localhost/itm/1" }), "WatchList");

  assert.equal(javascriptPage.items[0].itemWebUrl, undefined);
  assert.equal(httpPage.items[0].itemWebUrl, undefined);
  assert.equal(otherHostPage.items[0].itemWebUrl, undefined);
  assert.equal(localhostPage.items[0].itemWebUrl, undefined);
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

function responseXml(listName, options = {}) {
  const pageNumber = options.pageNumber ?? 1;
  const totalPages = options.totalPages ?? 3;
  const totalEntries = options.totalEntries ?? 48;
  const imageUrl = options.imageUrl ?? "https://i.ebayimg.example/sandbox-lost-001.jpg";
  const itemWebUrl = options.itemWebUrl ?? "https://www.ebay.co.uk/itm/sandbox-lost-001";
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <${listName}>
    <PaginationResult>
      <TotalNumberOfPages>${totalPages}</TotalNumberOfPages>
      <TotalNumberOfEntries>${totalEntries}</TotalNumberOfEntries>
    </PaginationResult>
    <PageNumber>${pageNumber}</PageNumber>
    <ItemArray>
      <Item>
        <ItemID>sandbox-lost-001</ItemID>
        <Title>Rega Planar 3 turntable &amp; Elys cartridge</Title>
        <Seller>
          <UserID>sandbox-seller</UserID>
        </Seller>
        <ListingDetails>
          <EndTime>2026-01-12T20:15:00.000Z</EndTime>
          <ViewItemURL>${itemWebUrl}</ViewItemURL>
        </ListingDetails>
        <PictureDetails>
          <GalleryURL>${imageUrl}</GalleryURL>
        </PictureDetails>
        <SellingStatus>
          <CurrentPrice currencyID="GBP">214.25</CurrentPrice>
        </SellingStatus>
        <PrimaryCategory>
          <CategoryID>176985</CategoryID>
          <CategoryName>Records</CategoryName>
        </PrimaryCategory>
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
