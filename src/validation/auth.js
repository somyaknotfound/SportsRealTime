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
