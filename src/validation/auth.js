import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters.').max(50),
  email:    z.string().email('Must be a valid email address.').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const loginSchema = z.object({
  email:    z.string().email('Must be a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

/** Partial profile update — at least one field required */
export const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().max(255).optional(),
    /** Empty string clears the avatar URL in the DB */
    avatarUrl: z.string().max(500).optional(),
  })
  .strict()
  .refine((d) => d.username !== undefined || d.email !== undefined || d.avatarUrl !== undefined, {
    message: 'Provide at least one of username, email, avatarUrl',
  });
