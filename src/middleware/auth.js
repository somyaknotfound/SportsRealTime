import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/db.js';
import { userSessions, users } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required.');

// Hash the raw token string so we never store plaintext JWTs in the DB
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * authenticate — verifies Bearer JWT and confirms session exists in DB.
 * Attaches req.user = { id, username, email, role, avatarUrl } on success.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const hashed = hashToken(token);
    const now = new Date();

    // Confirm session exists and has not expired
    const [session] = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.token, hashed),
          gt(userSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(401).json({ error: 'Session not found or expired. Please login again.' });
    }

    // Fetch fresh user to catch role changes / deactivations
    const [user] = await db
      .select({
        id:        users.id,
        username:  users.username,
        email:     users.email,
        role:      users.role,
        avatarUrl: users.avatarUrl,
        isActive:  users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account not found or deactivated.' });
    }

    req.user  = user;
    req.token = token; // raw token — used by logout to look up the hash
    next();
  } catch (err) {
    console.error('Auth middleware DB error:', err);
    return res.status(500).json({ error: 'Authentication check failed.' });
  }
}

/**
 * requireRole(...roles) — role-gate factory.
 * Usage: router.post('/', authenticate, requireRole('admin'), handler)
 *        router.post('/', authenticate, requireRole('commentator', 'admin'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}
