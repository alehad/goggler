import { InMemorySessionStore, type AppUser } from "./session-store.ts";

export const SEEDED_LOCAL_USER: AppUser = {
  id: "local-saja",
  displayName: "Saja"
};

export const sessionStore = new InMemorySessionStore([SEEDED_LOCAL_USER]);

export function getDefaultLocalUser(): AppUser {
  return SEEDED_LOCAL_USER;
}
