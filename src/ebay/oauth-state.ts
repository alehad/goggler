import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadRequiredAppSecret } from "../auth/app-secret.ts";

export type EbayOAuthStatePayload = {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  /** Absent = today's web behavior. "native" = the flow was started by the
   * macOS app via /api/auth/ebay/start?nativeRedirect=1; the callback route
   * redirects to the app's custom URL scheme instead of the web root. */
  redirectTarget?: "native";
};

export type EbayOAuthStateValidation =
  | { ok: true; payload: EbayOAuthStatePayload }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" | "wrong_user" | "wrong_session" };

const DEFAULT_STATE_TTL_MS = 1000 * 60 * 10;

export class EbayOAuthStateStore {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret) {
      throw new Error("OAuth state secret is required");
    }

    this.secret = secret;
  }

  create(input: { userId: string; sessionId: string; now?: Date; ttlMs?: number }): string {
    return this.createWithPayload(input).state;
  }

  createWithPayload(input: {
    userId: string;
    sessionId: string;
    now?: Date;
    ttlMs?: number;
    redirectTarget?: "native";
  }): {
    state: string;
    payload: EbayOAuthStatePayload;
  } {
    const now = input.now ?? new Date();
    const payload: EbayOAuthStatePayload = {
      id: randomBytes(16).toString("base64url"),
      userId: input.userId,
      sessionId: input.sessionId,
      createdAt: now.getTime(),
      expiresAt: now.getTime() + (input.ttlMs ?? DEFAULT_STATE_TTL_MS),
      ...(input.redirectTarget ? { redirectTarget: input.redirectTarget } : {})
    };

    const encodedPayload = encodeJson(payload);
    return {
      payload,
      state: `${encodedPayload}.${sign(encodedPayload, this.secret)}`
    };
  }

  validate(
    state: string | undefined,
    expected: { userId: string; sessionId: string; now?: Date }
  ): EbayOAuthStateValidation {
    const validation = this.validateSignedState(state, { now: expected.now });
    if (!validation.ok) {
      return validation;
    }

    if (validation.payload.userId !== expected.userId) {
      return { ok: false, reason: "wrong_user" };
    }

    if (validation.payload.sessionId !== expected.sessionId) {
      return { ok: false, reason: "wrong_session" };
    }

    return validation;
  }

  validateSignedState(state: string | undefined, options: { now?: Date } = {}): EbayOAuthStateValidation {
    if (!state) {
      return { ok: false, reason: "malformed" };
    }

    const [encodedPayload, signature, extra] = state.split(".");
    if (!encodedPayload || !signature || extra !== undefined) {
      return { ok: false, reason: "malformed" };
    }

    const expectedSignature = sign(encodedPayload, this.secret);
    if (!safeEqual(signature, expectedSignature)) {
      return { ok: false, reason: "invalid_signature" };
    }

    const payload = decodeJson(encodedPayload);
    if (!payload) {
      return { ok: false, reason: "malformed" };
    }

    const now = options.now ?? new Date();
    if (payload.expiresAt <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, payload };
  }
}

export function getEbayOAuthStateStore(): EbayOAuthStateStore {
  return new EbayOAuthStateStore(loadRequiredAppSecret());
}

/**
 * Best-effort, UNSIGNED read of a state parameter's `redirectTarget`, for a
 * failed OAuth attempt where full signature validation already failed (or
 * hasn't been attempted) but the callback route still needs to know which
 * URL scheme to redirect the browser to. Never use this result for a trust
 * or authorization decision — only for choosing where an error redirect
 * goes. The actual code exchange remains fully gated by
 * `validate`/`validateSignedState` elsewhere.
 */
export function peekRedirectTarget(state: string | undefined): "native" | "web" {
  if (!state) {
    return "web";
  }

  const [encodedPayload] = state.split(".");
  if (!encodedPayload) {
    return "web";
  }

  const payload = decodeJson(encodedPayload);
  return payload?.redirectTarget === "native" ? "native" : "web";
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeJson(value: EbayOAuthStatePayload): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value: string): EbayOAuthStatePayload | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<EbayOAuthStatePayload>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return undefined;
    }

    return parsed as EbayOAuthStatePayload;
  } catch {
    return undefined;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
