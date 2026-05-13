export type EbayEnvironment = "sandbox" | "production";

export type EbayConfig = {
  environment: EbayEnvironment;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  marketplaceId: string;
  tradingSiteId: string;
  scopes: string[];
  authorizeUrl: string;
  tokenUrl: string;
  tradingApiUrl: string;
};

export type EbayConfigStatus = {
  ready: boolean;
  environment: EbayEnvironment;
  missing: string[];
  invalid: string[];
  marketplaceId: string;
  tradingSiteId: string;
  scopeCount: number;
};

type Env = Record<string, string | undefined>;

const DEFAULT_MARKETPLACE_ID = "EBAY_GB";
const DEFAULT_TRADING_SITE_ID = "3";
const REQUIRED_SHARED_CONFIG_KEYS = ["GOGGLER_AUTH_SECRET"] as const;

const CREDENTIAL_KEYS = {
  sandbox: {
    clientId: ["EBAY_SANDBOX_CLIENT_ID"],
    clientSecret: ["EBAY_SANDBOX_CLIENT_SECRET"],
    redirectUri: ["EBAY_SANDBOX_REDIRECT_URI"],
    scopes: ["EBAY_SANDBOX_OAUTH_SCOPES"]
  },
  production: {
    clientId: ["EBAY_PRODUCTION_CLIENT_ID"],
    clientSecret: ["EBAY_PRODUCTION_CLIENT_SECRET"],
    redirectUri: ["EBAY_PRODUCTION_REDIRECT_URI"],
    scopes: ["EBAY_PRODUCTION_OAUTH_SCOPES"]
  }
} as const;

export function loadEbayConfig(env: Env = process.env): EbayConfig {
  const environment = parseEnvironment(env.EBAY_ENVIRONMENT);
  const credentialKeys = CREDENTIAL_KEYS[environment];
  const clientId = requireFirstEnv(env, credentialKeys.clientId);
  const clientSecret = requireFirstEnv(env, credentialKeys.clientSecret);
  const redirectUri = requireFirstEnv(env, credentialKeys.redirectUri);
  const scopes = parseScopes(requireFirstEnv(env, credentialKeys.scopes));

  return {
    environment,
    clientId,
    clientSecret,
    redirectUri,
    marketplaceId: env.EBAY_MARKETPLACE_ID ?? DEFAULT_MARKETPLACE_ID,
    tradingSiteId: env.EBAY_TRADING_SITE_ID ?? DEFAULT_TRADING_SITE_ID,
    scopes,
    authorizeUrl:
      environment === "sandbox"
        ? "https://auth.sandbox.ebay.com/oauth2/authorize"
        : "https://auth.ebay.com/oauth2/authorize",
    tokenUrl:
      environment === "sandbox"
        ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
        : "https://api.ebay.com/identity/v1/oauth2/token",
    tradingApiUrl:
      environment === "sandbox" ? "https://api.sandbox.ebay.com/ws/api.dll" : "https://api.ebay.com/ws/api.dll"
  };
}

export function buildEbayConsentUrl(config: EbayConfig, state: string): URL {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export function getEbayConfigStatus(env: Env = process.env): EbayConfigStatus {
  const invalid: string[] = [];

  let environment: EbayEnvironment = "sandbox";
  try {
    environment = parseEnvironment(env.EBAY_ENVIRONMENT);
  } catch {
    invalid.push("EBAY_ENVIRONMENT");
  }

  if (env.GOGGLER_AUTH_SECRET && env.GOGGLER_AUTH_SECRET.length < 32) {
    invalid.push("GOGGLER_AUTH_SECRET");
  }

  const credentialKeys = CREDENTIAL_KEYS[environment];
  const missing = [
    ...REQUIRED_SHARED_CONFIG_KEYS.filter((key) => !env[key]),
    missingCredentialName(env, credentialKeys.clientId),
    missingCredentialName(env, credentialKeys.clientSecret),
    missingCredentialName(env, credentialKeys.redirectUri),
    missingCredentialName(env, credentialKeys.scopes)
  ].filter((key): key is string => key !== undefined);

  const scopeValue = findFirstEnv(env, credentialKeys.scopes);
  let scopeCount = 0;
  if (scopeValue) {
    try {
      scopeCount = parseScopes(scopeValue).length;
    } catch {
      invalid.push(credentialKeys.scopes[0]);
    }
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    environment,
    missing,
    invalid,
    marketplaceId: env.EBAY_MARKETPLACE_ID ?? DEFAULT_MARKETPLACE_ID,
    tradingSiteId: env.EBAY_TRADING_SITE_ID ?? DEFAULT_TRADING_SITE_ID,
    scopeCount
  };
}

function parseEnvironment(value: string | undefined): EbayEnvironment {
  if (value === "production" || value === "sandbox") {
    return value;
  }

  if (!value) {
    return "sandbox";
  }

  throw new Error("EBAY_ENVIRONMENT must be sandbox or production");
}

function parseScopes(value: string): string[] {
  const scopes = value.split(/\s+/).filter(Boolean);
  if (scopes.length === 0) {
    throw new Error("eBay OAuth scopes must include at least one scope");
  }

  return scopes;
}

function findFirstEnv(env: Env, names: readonly string[]): string | undefined {
  return names.map((name) => env[name]).find((value): value is string => value !== undefined && value.trim() !== "");
}

function missingCredentialName(env: Env, names: readonly string[]): string | undefined {
  return findFirstEnv(env, names) ? undefined : names.join(" or ");
}

function requireFirstEnv(env: Env, names: readonly string[]): string {
  const value = findFirstEnv(env, names);
  if (!value) {
    throw new Error(`${names.join(" or ")} is required`);
  }

  return value;
}
