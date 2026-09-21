import { z } from 'zod';

export const updateLocationSchema = z.object({
  latitude: z
    .number({
      required_error: 'Latitude is required',
      invalid_type_error: 'Latitude must be a number',
    })
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Latitude must be a finite number',
    })
    .refine((val) => val >= -90 && val <= 90, {
      message: 'Latitude must be between -90 and 90',
    }),
  longitude: z
    .number({
      required_error: 'Longitude is required',
      invalid_type_error: 'Longitude must be a number',
    })
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Longitude must be a finite number',
    })
    .refine((val) => val >= -180 && val <= 180, {
      message: 'Longitude must be between -180 and 180',
    }),
  // Client cannot inject protected fields
  userId: z.undefined({
    invalid_type_error: 'User ID cannot be provided in request body',
  }),
  recyclerId: z.undefined({
    invalid_type_error: 'Recycler ID cannot be provided in request body',
  }),
  isVerified: z.undefined({
    invalid_type_error: 'Verification status cannot be modified via location endpoint',
  }),
  role: z.undefined({
    invalid_type_error: 'Role cannot be modified',
  }),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const nearbyRecyclersQuerySchema = z.object({
  latitude: z
    .string({ required_error: 'Latitude is required' })
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Latitude must be a valid number',
    })
    .refine((val) => val >= -90 && val <= 90, {
      message: 'Latitude must be between -90 and 90',
    }),
  longitude: z
    .string({ required_error: 'Longitude is required' })
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Longitude must be a valid number',
    })
    .refine((val) => val >= -180 && val <= 180, {
      message: 'Longitude must be between -180 and 180',
    }),
  radiusKm: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 10))
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Radius must be a valid number',
    })
    .refine((val) => val >= 1 && val <= 100, {
      message: 'Radius must be between 1 and 100 km',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && isFinite(val), {
      message: 'Limit must be an integer',
    })
    .refine((val) => val >= 1 && val <= 50, {
      message: 'Limit must be an integer between 1 and 50',
    }),
});

export type NearbyRecyclersQuery = z.infer<typeof nearbyRecyclersQuerySchema>;
