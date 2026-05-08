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
const REQUIRED_CONFIG_KEYS = [
  "GOGGLER_AUTH_SECRET",
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "EBAY_REDIRECT_URI",
  "EBAY_OAUTH_SCOPES"
] as const;

export function loadEbayConfig(env: Env = process.env): EbayConfig {
  const environment = parseEnvironment(env.EBAY_ENVIRONMENT);
  const clientId = requireEnv(env, "EBAY_CLIENT_ID");
  const clientSecret = requireEnv(env, "EBAY_CLIENT_SECRET");
  const redirectUri = requireEnv(env, "EBAY_REDIRECT_URI");
  const scopes = parseScopes(requireEnv(env, "EBAY_OAUTH_SCOPES"));

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
        : "https://api.ebay.com/identity/v1/oauth2/token"
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
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => !env[key]);
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

  const scopeCount = env.EBAY_OAUTH_SCOPES ? parseScopes(env.EBAY_OAUTH_SCOPES).length : 0;

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
    throw new Error("EBAY_OAUTH_SCOPES must include at least one scope");
  }

  return scopes;
}

function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
