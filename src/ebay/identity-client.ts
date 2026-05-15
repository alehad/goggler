import type { EbayAccountIdentity } from "../auth/session-store.ts";
import type { EbayConfig } from "./config.ts";

const IDENTITY_READ_SCOPE = "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly";

export async function fetchEbayAccountIdentity(
  config: EbayConfig,
  accessToken: string
): Promise<EbayAccountIdentity | undefined> {
  if (!config.scopes.includes(IDENTITY_READ_SCOPE)) {
    return undefined;
  }

  assertTrustedIdentityApiUrl(config);

  const response = await fetch(config.identityApiUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json().catch(() => undefined)) as Partial<{
    userId: unknown;
    username: unknown;
  }>;
  if (!body || typeof body.userId !== "string") {
    return undefined;
  }

  return {
    userId: body.userId,
    displayName: typeof body.username === "string" && body.username.trim() ? body.username : undefined
  };
}

function assertTrustedIdentityApiUrl(config: EbayConfig): void {
  const url = new URL(config.identityApiUrl);
  const allowedHost = config.environment === "sandbox" ? "apiz.sandbox.ebay.com" : "apiz.ebay.com";
  if (url.protocol !== "https:" || url.host !== allowedHost) {
    throw new Error("eBay Identity API URL is not trusted");
  }
}
