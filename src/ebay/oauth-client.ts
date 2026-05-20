import type { EbayConfig } from "./config.ts";
import type { EbaySessionAuthorization } from "../auth/session-store.ts";

export const EBAY_MARKETPLACE_INSIGHTS_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";
export const EBAY_BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";
const EBAY_APPLICATION_SCOPES = [EBAY_MARKETPLACE_INSIGHTS_SCOPE, EBAY_BROWSE_SCOPE] as const;

export type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export class EbayOAuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type EbayApplicationAuthorization = {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  scopes: string[];
  authorizedAt: Date;
};

export async function exchangeEbayAuthorizationCode(
  config: EbayConfig,
  code: string,
  options: { now?: Date; fetch?: typeof fetch } = {}
): Promise<EbaySessionAuthorization> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri
    })
  });

  if (!response.ok) {
    throw new EbayOAuthError(`eBay token exchange failed with status ${response.status}`, response.status);
  }

  const token = validateTokenResponse(await response.json());
  const now = options.now ?? new Date();
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    expiresAt: new Date(now.getTime() + token.expires_in * 1000),
    refreshTokenExpiresAt:
      token.refresh_token_expires_in === undefined
        ? undefined
        : new Date(now.getTime() + token.refresh_token_expires_in * 1000),
    scopes: config.scopes,
    authorizedAt: now
  };
}

export async function getEbayApplicationAccessToken(
  config: EbayConfig,
  options: { now?: Date; fetch?: typeof fetch; scope?: string } = {}
): Promise<EbayApplicationAuthorization> {
  const fetchImpl = options.fetch ?? fetch;
  const scope = options.scope ?? EBAY_MARKETPLACE_INSIGHTS_SCOPE;
  if (!isAllowedApplicationScope(scope)) {
    throw new EbayOAuthError("eBay application token scope is not allowed");
  }
  const response = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope
    })
  });

  if (!response.ok) {
    throw new EbayOAuthError(`eBay application token request failed with status ${response.status}`, response.status);
  }

  const token = validateTokenResponse(await response.json());
  const now = options.now ?? new Date();
  return {
    accessToken: token.access_token,
    tokenType: token.token_type,
    expiresAt: new Date(now.getTime() + token.expires_in * 1000),
    scopes: [scope],
    authorizedAt: now
  };
}

function isAllowedApplicationScope(scope: string): scope is (typeof EBAY_APPLICATION_SCOPES)[number] {
  return EBAY_APPLICATION_SCOPES.some((allowedScope) => allowedScope === scope);
}

function validateTokenResponse(value: unknown): EbayTokenResponse {
  if (!value || typeof value !== "object") {
    throw new EbayOAuthError("eBay token response was not an object");
  }

  const token = value as Partial<EbayTokenResponse>;
  if (
    typeof token.access_token !== "string" ||
    typeof token.expires_in !== "number" ||
    typeof token.token_type !== "string"
  ) {
    throw new EbayOAuthError("eBay token response was missing required fields");
  }

  if (token.refresh_token !== undefined && typeof token.refresh_token !== "string") {
    throw new EbayOAuthError("eBay token response had an invalid refresh token");
  }

  if (token.refresh_token_expires_in !== undefined && typeof token.refresh_token_expires_in !== "number") {
    throw new EbayOAuthError("eBay token response had an invalid refresh token expiry");
  }

  return token as EbayTokenResponse;
}
