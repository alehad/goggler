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
        return undefined;
      }

      const user = this.users.get(session.userId);
      if (!user) {
        this.sessions.delete(session.id);
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
        return this.sessions.delete(session.id);
      }
    }

    return false;
  }

  sessionCount(): number {
    return this.sessions.size;
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

