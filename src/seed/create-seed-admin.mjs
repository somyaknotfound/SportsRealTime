/**
 * create-seed-admin.mjs
 * ---------------------
 * One-shot script: registers the seed admin account (if it doesn't exist)
 * and promotes it to 'admin' role via direct DB update.
 *
 * Run ONCE before the seed:
 *   node src/seed/create-seed-admin.mjs
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@seed.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'SeedAdmin123!';
const USERNAME = 'seed_admin';

async function run() {
  console.log(`\n🔧 Ensuring seed admin exists: ${EMAIL}\n`);

  // Check if user already exists
  const [existing] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);

  if (existing) {
    if (existing.role === 'admin' || existing.role === 'commentator') {
      console.log(`✅ Seed admin already exists with role '${existing.role}'. Nothing to do.`);
      process.exit(0);
    }
    // Upgrade role
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
    console.log(`✅ Upgraded existing user '${USERNAME}' to role 'admin'.`);
    process.exit(0);
  }

  // Create new admin user
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await db.insert(users).values({
    username:     USERNAME,
    email:        EMAIL,
    passwordHash,
    role:         'admin',
    isActive:     true,
  });

  console.log(`✅ Created seed admin: ${EMAIL} (role: admin)`);
  console.log(`   Password: ${PASSWORD}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed to create seed admin:', err.message);
  process.exit(1);
});
