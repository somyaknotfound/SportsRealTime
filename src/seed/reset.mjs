/**
 * reset.mjs
 * ---------
 * Wipes all app data and re-seeds the admin account so the server
 * starts from a completely clean state.
 *
 * Run:  node src/seed/reset.mjs
 *
 * Then: npm run dev        (in one terminal)
 *       npm run seed       (in another terminal)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../db/db.js';
import { sql } from 'drizzle-orm';
import {
  notifications,
  matchEvents,
  subscriptions,
  commentary,
  userSessions,
  matches,
  users,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

const SEED_ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@seed.local';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'SeedAdmin123!';

async function reset() {
  console.log('\n🗑️  Resetting database to clean slate...\n');

  // Disable FK checks so we can truncate in any order
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

  await db.delete(notifications);  console.log('  ✓ notifications cleared');
  await db.delete(matchEvents);     console.log('  ✓ match_events cleared');
  await db.delete(subscriptions);   console.log('  ✓ subscriptions cleared');
  await db.delete(commentary);      console.log('  ✓ commentary cleared');
  await db.delete(matches);         console.log('  ✓ matches cleared');
  await db.delete(userSessions);    console.log('  ✓ user_sessions cleared');
  await db.delete(users);           console.log('  ✓ users cleared');

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  // Re-create the seed admin so the seed script can post events
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  await db.insert(users).values({
    username:     'seed_admin',
    email:        SEED_ADMIN_EMAIL,
    passwordHash,
    role:         'admin',
    isActive:     true,
  });

  console.log(`\n✅ Seed admin created: ${SEED_ADMIN_EMAIL} (role: admin)`);
  console.log('\n🚀 Ready! Now run:\n   npm run dev    ← terminal 1\n   npm run seed   ← terminal 2\n');

  process.exit(0);
}

reset().catch((err) => {
  console.error('\n❌ Reset failed:', err.message);
  process.exit(1);
});
