import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Invalid email address' })
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' }),
  role: z.enum(['collector', 'recycler'], {
    errorMap: () => ({ message: "Role must be either 'collector' or 'recycler'" }),
  }),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Invalid email address' })
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, { message: 'Password is required' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
