import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { deleteMarketPriceRecords } from "../../../../src/persistence/market-price-records.ts";

const MAX_DELETE_ITEMS = 200;
const MAX_STRING_LENGTH = 500;

export async function DELETE(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  const body = (await request.json().catch(() => ({}))) as Partial<{ itemIds: unknown }>;
  const itemIds = parseItemIds(body.itemIds);
  if (itemIds.length === 0) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "item_ids_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  try {
    const result = await deleteMarketPriceRecords(currentUser.context.user.id, itemIds);
    return withInternalSessionCookie(NextResponse.json(result), currentUser.setCookie);
  } catch {
    console.warn("Market insights history deletion failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "deletion_failed" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function parseItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const itemIds: string[] = [];
  for (const entry of value.slice(0, MAX_DELETE_ITEMS)) {
    const itemId = boundedString(entry);
    if (itemId) {
      itemIds.push(itemId);
    }
  }
  return itemIds;
}

function boundedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().slice(0, MAX_STRING_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
