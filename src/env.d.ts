/// <reference types="astro/client" />

// Inferred from the auth instance rather than better-auth's base `User`/`Session`
// types, so plugin-added fields (the admin plugin's `role`, `banned`, ...) are typed.
type AuthSession = (typeof import('./lib/auth.ts').auth)['$Infer']['Session'];

declare namespace App {
  interface Locals {
    user: AuthSession['user'] | null;
    session: AuthSession['session'] | null;
  }
}
