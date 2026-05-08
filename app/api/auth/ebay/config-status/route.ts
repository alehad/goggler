import { NextResponse } from "next/server.js";
import { getEbayConfigStatus } from "../../../../../src/ebay/config.ts";

export async function GET() {
  return NextResponse.json({
    config: getEbayConfigStatus()
  });
}
