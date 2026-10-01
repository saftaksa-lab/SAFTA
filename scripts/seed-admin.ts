/**
 * Creates the first admin account from the credentials in `.env`.
 *
 * Public sign-up is disabled, so `auth.api.signUpEmail` is not available here.
 * This goes through Better Auth's internal context instead, which bypasses the
 * route guards while still writing the exact user/account shape — and the exact
 * password hash format — that sign-in expects.
 *
 * Idempotent: safe to run on every start.
 */
import { auth } from '../src/lib/auth.ts';
import { env } from '../src/lib/env.ts';

const email = env.ADMIN_EMAIL.toLowerCase();
const ctx = await auth.$context;

const existing = await ctx.internalAdapter.findUserByEmail(email);

// The admin plugin adds `role` at runtime, but the internal adapter's static
// types describe only the core user shape, and type `createUser`'s context
// argument as required though it is optional at runtime. Narrow the surface we
// use to a shape that matches the actual behaviour.
type WithRole = { role?: string | null };
const createUser = ctx.internalAdapter.createUser as unknown as (
  user: Record<string, unknown>,
) => Promise<{ id: string }>;

if (existing) {
  if ((existing.user as WithRole).role === 'admin') {
    console.log(`[seed] Admin ${email} already exists — nothing to do.`);
  } else {
    await ctx.internalAdapter.updateUser(existing.user.id, { role: 'admin' });
    console.log(`[seed] Promoted existing user ${email} to admin.`);
  }
} else {
  const user = await createUser({
    email,
    name: env.ADMIN_NAME,
    emailVerified: true,
    role: 'admin',
  });

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: await ctx.password.hash(env.ADMIN_PASSWORD),
  });

  console.log(`[seed] Created admin ${email}.`);
}

process.exit(0);
