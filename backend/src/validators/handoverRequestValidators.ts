import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createHandoverRequestSchema = z.object({
  recyclerId: z
    .string({ required_error: 'Recycler ID is required' })
    .regex(objectIdRegex, { message: 'Invalid recycler ID format' }),
  wasteItemIds: z
    .array(z.string().regex(objectIdRegex, { message: 'Invalid waste item ID in list' }), {
      required_error: 'wasteItemIds is required',
    })
    .min(1, { message: 'At least one waste item must be selected' })
    .max(50, { message: 'Cannot include more than 50 waste items in a single request' }),
  requestedDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  notes: z.string().trim().max(500, { message: 'Notes cannot exceed 500 characters' }).optional(),
  collectorMessage: z
    .string()
    .trim()
    .max(500, { message: 'Collector message cannot exceed 500 characters' })
    .optional(),
  // Disallowed fields that clients might try to forge
  collectorId: z.undefined({ invalid_type_error: 'collectorId cannot be set by client' }),
  totalQuantityKg: z.undefined({ invalid_type_error: 'totalQuantityKg is calculated server-side' }),
  estimatedValue: z.undefined({ invalid_type_error: 'estimatedValue is calculated server-side' }),
  status: z.undefined({ invalid_type_error: 'Initial status cannot be set by client' }),
  scheduledDate: z.undefined({ invalid_type_error: 'scheduledDate cannot be set on creation' }),
});

export const scheduleRequestSchema = z.object({
  scheduledDate: z
    .string({ required_error: 'scheduledDate is required' })
    .refine(
      (val) => {
        const date = new Date(val);
        if (isNaN(date.getTime())) return false;
        // Compare against beginning of current day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
      },
      { message: 'Scheduled date cannot be in the past' }
    ),
});

export const rejectRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  recyclerMessage: z.string().trim().max(500).optional(),
});

export const completeRequestSchema = z.object({
  collectorConfirmation: z.boolean().optional(),
  recyclerConfirmation: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
  // Disallow clients from spoofing financial/identity/reference fields
  finalValue: z.undefined({ invalid_type_error: 'finalValue cannot be set by client' }),
  amount: z.undefined({ invalid_type_error: 'amount cannot be set by client' }),
  handoverReference: z.undefined({ invalid_type_error: 'handoverReference cannot be set by client' }),
  transactionReference: z.undefined({ invalid_type_error: 'transactionReference cannot be set by client' }),
  totalQuantityKg: z.undefined({ invalid_type_error: 'totalQuantityKg cannot be set by client' }),
  collectorId: z.undefined({ invalid_type_error: 'collectorId cannot be set by client' }),
  recyclerId: z.undefined({ invalid_type_error: 'recyclerId cannot be set by client' }),
  status: z.undefined({ invalid_type_error: 'status cannot be set by client' }),
});

export type CreateHandoverRequestInput = z.infer<typeof createHandoverRequestSchema>;
export type ScheduleRequestInput = z.infer<typeof scheduleRequestSchema>;
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;
export type CompleteRequestInput = z.infer<typeof completeRequestSchema>;

