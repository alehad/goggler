const MIN_SECRET_LENGTH = 32;

export function loadRequiredAppSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.GOGGLER_AUTH_SECRET;
  if (!secret) {
    throw new Error("GOGGLER_AUTH_SECRET is required");
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`GOGGLER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  return secret;
}
