import { z } from 'zod';
import mongoose from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createWasteSchema = z.object({
  materialId: z
    .string({ required_error: 'Material ID is required' })
    .regex(objectIdRegex, { message: 'Invalid material ID format' }),
  quantityKg: z
    .number({ invalid_type_error: 'Quantity in kg must be a number' })
    .positive({ message: 'Quantity must be greater than 0 kg' })
    .max(50000, { message: 'Quantity cannot exceed 50,000 kg' }),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes cannot exceed 500 characters' })
    .optional(),
  // Disallowed fields that clients might attempt to override
  collectorId: z.undefined({ invalid_type_error: 'collectorId cannot be supplied by client' }),
  estimatedValue: z.undefined({ invalid_type_error: 'estimatedValue is calculated server-side' }),
  status: z.undefined({ invalid_type_error: 'status cannot be set on creation' }),
});

export const updateWasteSchema = z.object({
  materialId: z
    .string()
    .regex(objectIdRegex, { message: 'Invalid material ID format' })
    .optional(),
  quantityKg: z
    .number({ invalid_type_error: 'Quantity in kg must be a number' })
    .positive({ message: 'Quantity must be greater than 0 kg' })
    .max(50000, { message: 'Quantity cannot exceed 50,000 kg' })
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, { message: 'Notes cannot exceed 500 characters' })
    .optional(),
  // Disallowed fields
  collectorId: z.undefined({ invalid_type_error: 'collectorId cannot be modified' }),
  estimatedValue: z.undefined({ invalid_type_error: 'estimatedValue is calculated server-side' }),
  status: z.undefined({ invalid_type_error: 'status cannot be directly updated here' }),
});

export type CreateWasteInput = z.infer<typeof createWasteSchema>;
export type UpdateWasteInput = z.infer<typeof updateWasteSchema>;
