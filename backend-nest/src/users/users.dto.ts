import { z } from 'zod';

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  confirmationEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
}).strict();
