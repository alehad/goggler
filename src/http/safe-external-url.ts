export function safePublicHttpsUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || isLocalOrPrivateHost(url.hostname)) {
      return undefined;
    }

    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function safeEbayItemUrl(value: string | undefined): string | undefined {
  const safeUrl = safePublicHttpsUrl(value);
  if (!safeUrl) {
    return undefined;
  }

  const url = new URL(safeUrl);
  const hostname = url.hostname.toLocaleLowerCase("en-GB");
  if (hostname !== "ebay.co.uk" && hostname !== "www.ebay.co.uk" && hostname !== "ebay.com" && hostname !== "www.ebay.com") {
    return undefined;
  }

  url.search = "";
  return url.toString();
}

export function safeEbayImageUrl(value: string | undefined): string | undefined {
  const safeUrl = safePublicHttpsUrl(value);
  if (!safeUrl) {
    return undefined;
  }

  const url = new URL(safeUrl);
  const hostname = normalizedHostname(url.hostname);
  if (!isTrustedEbayImageHost(hostname)) {
    return undefined;
  }

  return url.toString();
}

function isTrustedEbayImageHost(hostname: string): boolean {
  return hostname === "ebayimg.com" || hostname.endsWith(".ebayimg.com") || hostname === "ebaystatic.com" || hostname.endsWith(".ebaystatic.com");
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = normalizedHostname(hostname).replace(/^\[(.*)\]$/, "$1");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.includes(":")
  ) {
    return true;
  }

  const ipv4Host = host.startsWith("::ffff:") ? host.slice("::ffff:".length) : host;
  const parts = ipv4Host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function normalizedHostname(hostname: string): string {
  return hostname.toLocaleLowerCase("en-GB");
}
