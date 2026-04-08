import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/db.js';
import { users, userSessions } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { registerSchema, loginSchema } from '../validation/auth.js';
import { authenticate, hashToken } from '../middleware/auth.js';

export const authRouter = Router();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS  = 12;

/** Generate a signed JWT and insert a session row. Returns the raw token. */
async function createSession(user, req) {
  // jti is a unique ID per token — used as the DB handle
  const jti   = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // Decode to get the real expiry timestamp set by jwt.sign
  const decoded   = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  await db.insert(userSessions).values({
    userId:    user.id,
    token:     hashToken(token),          // only store hash
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    expiresAt,
  });

  return token;
}

/** Strip password_hash from a user row before sending to client */
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── POST /auth/register ──────────────────────────────────────────────────────
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed.', details: parsed.error.issues });
  }

  const { username, email, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const insertResult = await db.insert(users).values({
      username,
      email,
      passwordHash,
    });

    const insertId = Array.isArray(insertResult) && insertResult[0]?.insertId
      ? insertResult[0].insertId
      : insertResult.insertId;

    const [user] = await db.select().from(users).where(eq(users.id, insertId)).limit(1);

    const token = await createSession(user, req);

    return res.status(201).json({ data: { user: sanitizeUser(user), token } });
  } catch (err) {
    // MySQL duplicate entry error code
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or username already taken.' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed.', details: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Use constant-time comparison even when user not found
    const passwordHash = user?.passwordHash ?? '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const match = await bcrypt.compare(password, passwordHash);

    if (!user || !match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const token = await createSession(user, req);

    return res.status(200).json({ data: { user: sanitizeUser(user), token } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req, res) => {
  try {
    const hashed = hashToken(req.token);
    await db.delete(userSessions).where(eq(userSessions.token, hashed));
    return res.status(204).send();
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, (req, res) => {
  // req.user is already stripped of passwordHash by the middleware
  return res.status(200).json({ data: { user: req.user } });
});
