import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, { message: 'Message cannot be empty' })
    .max(2000, { message: 'Message cannot exceed 2000 characters' }),
  sessionId: z
    .string()
    .trim()
    .max(100, { message: 'Session ID cannot exceed 100 characters' })
    .optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const getConversationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, { message: 'page must be an integer >= 1' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
      message: 'limit must be an integer between 1 and 50',
    }),
});

export type GetConversationsQuery = z.infer<typeof getConversationsQuerySchema>;
