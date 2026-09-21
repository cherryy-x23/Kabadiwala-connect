import { z } from 'zod';
import { PRICE_TRENDS } from '../config/constants';

export const createMaterialSchema = z.object({
  name: z.string().trim().min(1, { message: 'Material name is required' }),
  category: z.string().trim().min(1, { message: 'Category is required' }),
  pricePerKg: z
    .number({ invalid_type_error: 'Price per kg must be a number' })
    .positive({ message: 'Price per kg must be a positive number' })
    .optional(),
  indicativePrice: z
    .number({ invalid_type_error: 'Indicative price must be a number' })
    .positive({ message: 'Indicative price must be a positive number' })
    .optional(),
  unit: z.string().trim().default('per kg'),
  priceTrend: z.enum(PRICE_TRENDS).default('stable'),
  description: z.string().trim().optional(),
}).refine((data) => data.pricePerKg !== undefined || data.indicativePrice !== undefined, {
  message: 'Either pricePerKg or indicativePrice must be provided',
  path: ['pricePerKg'],
});

export const updateMaterialSchema = z.object({
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  pricePerKg: z.number().positive().optional(),
  indicativePrice: z.number().positive().optional(),
  unit: z.string().trim().optional(),
  priceTrend: z.enum(PRICE_TRENDS).optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
