# Better Auth notes

Pinned to **better-auth 1.7.4**. The API moved recently and most tutorials and model priors are
stale. Everything below was verified against the installed packages in this repo.

## Things that changed (do not trust older examples)

| Stale | Current |
| --- | --- |
| `import { drizzleAdapter } from 'better-auth/adapters/drizzle'` | `from '@better-auth/drizzle-adapter'` — a **separate package**, version-locked to `better-auth` |
| `npx @better-auth/cli generate` | `npx auth@latest generate` — the `@better-auth/cli` package lags behind |

Keep `better-auth` and `@better-auth/drizzle-adapter` on the exact same version when upgrading.

## Configuration

[src/lib/auth.ts](../src/lib/auth.ts) is the only place auth is configured:

- `emailAndPassword: { enabled: true, disableSignUp: true }` — sign-in works, public
  registration is refused with `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- `admin({ defaultRole: 'user', adminRoles: ['admin'] })` — adds `role`, `banned`, `banReason`,
  `banExpires` to `user` and `impersonatedBy` to `session`. New accounts default to `user`, so
  future member accounts are unprivileged unless explicitly promoted.

## Regenerating the schema

The auth tables in [src/db/schema.ts](../src/db/schema.ts) are generated from the auth config.
After changing plugins or auth options:

```sh
npx auth@1.7.4 generate --config src/lib/auth.ts --output src/db/schema.ts --yes
npm run db:generate && npm run db:migrate
```

The generator **overwrites the whole file**, so CMS tables must never live in it. They are in
[src/db/content-schema.ts](../src/db/content-schema.ts) instead; `src/db/index.ts` merges both
modules into one schema object and `drizzle.config.ts` lists both paths. Regenerating auth
tables therefore cannot touch content tables.

Note the generator prints a "Drizzle schema mismatch / Missing tables" error while loading a
schema that does not yet match the config. That is expected on first run and it still writes
the file correctly.

## Sign-in and sign-out server-side

`auth.api.*` with `asResponse: true` returns a `Response` carrying the session cookies. Read
them with `response.headers.getSetCookie()` and append each onto your own response:

```ts
const result = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
if (!result.ok) return /* 302 back with an error */;
const headers = new Headers({ Location: '/admin' });
for (const cookie of result.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
return new Response(null, { status: 302, headers });
```

`signInEmail` can both return a non-ok response *and* throw, so wrap it in `try/catch` as
[src/pages/api/login.ts](../src/pages/api/login.ts) does. Never let the raw error reach the
user — it distinguishes "no such user" from "wrong password".

`auth.api.signOut` needs `headers: request.headers` to know which session to kill, and returns
cookie-clearing `Set-Cookie` headers the same way.

## Reading the session

[src/middleware.ts](../src/middleware.ts) calls `auth.api.getSession({ headers })` once per
request and puts the result on `Astro.locals`. In pages and endpoints use `Astro.locals.user`
and `Astro.locals.session` — do not call `getSession` again.

Types come from the auth instance, not from better-auth's base exports:

```ts
type AuthSession = (typeof import('./lib/auth.ts').auth)['$Infer']['Session'];
```

This matters because the base `User` type has no `role` — that field comes from the admin
plugin, and only the inferred type knows about it. See [src/env.d.ts](../src/env.d.ts).

## Seeding the first admin

With `disableSignUp: true`, `auth.api.signUpEmail` is unavailable, so
[scripts/seed-admin.ts](../scripts/seed-admin.ts) goes through the internal context:

```ts
const ctx = await auth.$context;
await ctx.internalAdapter.findUserByEmail(email);   // -> { user, accounts } | null
await ctx.internalAdapter.createUser({ ... });      // role goes in here
await ctx.internalAdapter.linkAccount({ userId, providerId: 'credential', accountId, password });
await ctx.password.hash(plaintext);                 // produces the format sign-in expects
```

Always hash with `ctx.password.hash`. Writing the rows directly with a hash from anywhere else
produces an account that cannot sign in.

The script carries one narrow cast: the internal adapter's inferred types omit plugin fields
like `role` and mark `createUser`'s second argument required though it is optional at runtime.
The cast is scoped to that one call — do not widen it to `any` across the file.

This is an internal API with no stability guarantee. **Verify a Better Auth upgrade by actually
signing in**, not by inspecting rows.

## Gotchas

- **Astro's CSRF origin check** rejects form POSTs with no `Origin` header (403 before your
  handler runs). Browsers always send it; `curl` needs `-H "Origin: <origin>"`.
- **`BETTER_AUTH_URL` must match the request origin** or cookies silently fail to stick.
- **Adding a plugin is a schema change.** Regenerate and migrate, or you get runtime errors
  about missing columns.

## Testing auth from the shell

```sh
O="Origin: http://localhost:4321"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:4321/admin
curl -s -c jar -H "$O" -X POST http://localhost:4321/api/login \
  --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASS"
curl -s -b jar http://localhost:4321/admin
curl -s -b jar -c jar -H "$O" -X POST http://localhost:4321/api/logout
```

Expected: signed-out `/admin` → 302 `/en/login`; bad password → 302 `/en/login?error=invalid` with no
cookie; good password → 302 `/admin` with a session cookie; `role: 'user'` on `/admin` → 403;
`POST /api/auth/sign-up/email` → 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
