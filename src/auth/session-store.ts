import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AppUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type SessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type EbaySessionAuthorization = {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: Date;
  refreshTokenExpiresAt?: Date;
  scopes: string[];
  authorizedAt: Date;
};

export type EbayConnectionStatus = {
  connected: boolean;
  status: "connected_this_session" | "reauth_required" | "disconnected";
  authorizedAt?: Date;
  expiresAt?: Date;
  scopes: string[];
};

export type SessionWithToken = {
  token: string;
  session: SessionRecord;
};

export type SessionLookupResult = {
  session: SessionRecord;
  user: AppUser;
};

export const SESSION_COOKIE_NAME = "goggler_session";
export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export class InMemorySessionStore {
  private readonly users = new Map<string, AppUser>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ebayAuthorizations = new Map<string, EbaySessionAuthorization>();
  private readonly pendingEbayOAuthStates = new Map<string, Map<string, Date>>();

  constructor(seedUsers: AppUser[] = []) {
    for (const user of seedUsers) {
      this.users.set(user.id, user);
    }
  }

  listUsers(): AppUser[] {
    return [...this.users.values()];
  }

  getUser(userId: string): AppUser | undefined {
    return this.users.get(userId);
  }

  ensureUser(user: AppUser): AppUser {
    this.users.set(user.id, user);
    return user;
  }

  createSession(userId: string, options: { now?: Date; ttlMs?: number } = {}): SessionWithToken {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`Cannot create session for unknown user: ${userId}`);
    }

    const now = options.now ?? new Date();
    const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    const token = randomBytes(32).toString("base64url");
    const session: SessionRecord = {
      id: randomBytes(16).toString("hex"),
      tokenHash: hashSessionToken(token),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs)
    };

    this.sessions.set(session.id, session);
    return { token, session };
  }

  lookupSession(token: string | undefined, options: { now?: Date } = {}): SessionLookupResult | undefined {
    if (!token) {
      return undefined;
    }

    const now = options.now ?? new Date();
    const tokenHash = hashSessionToken(token);

    for (const session of this.sessions.values()) {
      if (!safeEqual(session.tokenHash, tokenHash)) {
        continue;
      }

      if (session.expiresAt <= now) {
        this.sessions.delete(session.id);
        this.ebayAuthorizations.delete(session.id);
        this.pendingEbayOAuthStates.delete(session.id);
        return undefined;
      }

      const user = this.users.get(session.userId);
      if (!user) {
        this.sessions.delete(session.id);
        this.ebayAuthorizations.delete(session.id);
        this.pendingEbayOAuthStates.delete(session.id);
        return undefined;
      }

      return { session, user };
    }

    return undefined;
  }

  expireSession(token: string | undefined): boolean {
    if (!token) {
      return false;
    }

    const tokenHash = hashSessionToken(token);
    for (const session of this.sessions.values()) {
      if (safeEqual(session.tokenHash, tokenHash)) {
        this.ebayAuthorizations.delete(session.id);
        this.pendingEbayOAuthStates.delete(session.id);
        return this.sessions.delete(session.id);
      }
    }

    return false;
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  setEbayAuthorization(sessionId: string, authorization: EbaySessionAuthorization): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Cannot set eBay authorization for unknown session: ${sessionId}`);
    }

    this.ebayAuthorizations.set(sessionId, authorization);
  }

  getEbayAuthorization(sessionId: string, options: { now?: Date } = {}): EbaySessionAuthorization | undefined {
    const authorization = this.ebayAuthorizations.get(sessionId);
    if (!authorization) {
      return undefined;
    }

    const now = options.now ?? new Date();
    if (authorization.expiresAt <= now) {
      this.ebayAuthorizations.delete(sessionId);
      return undefined;
    }

    return authorization;
  }

  clearEbayAuthorization(sessionId: string): boolean {
    return this.ebayAuthorizations.delete(sessionId);
  }

  getEbayConnectionStatus(sessionId: string, options: { now?: Date } = {}): EbayConnectionStatus {
    const authorization = this.getEbayAuthorization(sessionId, options);
    if (!authorization) {
      return {
        connected: false,
        status: this.sessions.has(sessionId) ? "reauth_required" : "disconnected",
        scopes: []
      };
    }

    return {
      connected: true,
      status: "connected_this_session",
      authorizedAt: authorization.authorizedAt,
      expiresAt: authorization.expiresAt,
      scopes: authorization.scopes
    };
  }

  addPendingEbayOAuthState(sessionId: string, stateId: string, expiresAt: Date): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Cannot set eBay OAuth state for unknown session: ${sessionId}`);
    }

    const states = this.pendingEbayOAuthStates.get(sessionId) ?? new Map<string, Date>();
    states.set(stateId, expiresAt);
    this.pendingEbayOAuthStates.set(sessionId, states);
  }

  consumePendingEbayOAuthState(sessionId: string, stateId: string, options: { now?: Date } = {}): boolean {
    const states = this.pendingEbayOAuthStates.get(sessionId);
    if (!states) {
      return false;
    }

    const expiresAt = states.get(stateId);
    if (!expiresAt) {
      return false;
    }

    states.delete(stateId);
    if (states.size === 0) {
      this.pendingEbayOAuthStates.delete(sessionId);
    }

    const now = options.now ?? new Date();
    return expiresAt > now;
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
