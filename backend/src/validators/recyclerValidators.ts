import { z } from 'zod';

export const updateRecyclerProfileSchema = z.object({
  businessName: z.string().trim().min(1).optional(),
  organizationName: z.string().trim().min(1).optional(),
  contactPerson: z.string().trim().optional(),
  location: z.string().trim().optional(),
  address: z.string().trim().optional(),
  about: z.string().trim().optional(),
  description: z.string().trim().optional(),
  acceptedMaterials: z.array(z.string().trim()).optional(),
  processingCategories: z.array(z.string().trim()).optional(),
  operatingHours: z.string().trim().optional(),
  settings: z
    .object({
      emailNotifications: z.boolean().optional(),
      incomingRequestAlerts: z.boolean().optional(),
    })
    .optional(),
  // Disallowed / protected fields that must be blocked if attempted
  role: z.undefined({ invalid_type_error: 'Role cannot be updated' }),
  user: z.undefined({ invalid_type_error: 'User ID cannot be updated' }),
  registrationId: z.undefined({ invalid_type_error: 'Registration ID cannot be updated' }),
  isVerified: z.undefined({ invalid_type_error: 'Verification status cannot be self-updated' }),
  verificationStatus: z.undefined({ invalid_type_error: 'Verification status cannot be self-updated' }),
  totalProcessed: z.undefined({ invalid_type_error: 'Total processed is managed by system' }),
  completedHandoversCount: z.undefined({ invalid_type_error: 'Completed handovers is managed by system' }),
});

export type UpdateRecyclerProfileInput = z.infer<typeof updateRecyclerProfileSchema>;
