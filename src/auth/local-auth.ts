import { InMemorySessionStore, type AppUser } from "./session-store.ts";

type LocalAuthGlobal = typeof globalThis & {
  __gogglerLocalAuth?: {
    sessionStore: InMemorySessionStore;
  };
};

export const SEEDED_LOCAL_USER: AppUser = {
  id: "local-saja",
  displayName: "Saja"
};

const localAuthGlobal = globalThis as LocalAuthGlobal;

export const sessionStore =
  localAuthGlobal.__gogglerLocalAuth?.sessionStore ??
  (localAuthGlobal.__gogglerLocalAuth = {
    sessionStore: new InMemorySessionStore([SEEDED_LOCAL_USER])
  }).sessionStore;

export function getDefaultLocalUser(): AppUser {
  return SEEDED_LOCAL_USER;
}
