export const USER_ROLES = ['collector', 'recycler', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const PRICE_TRENDS = ['up', 'down', 'stable'] as const;
export type PriceTrend = typeof PRICE_TRENDS[number];

export const MATERIAL_STATUSES = ['active', 'inactive'] as const;
export type MaterialStatus = typeof MATERIAL_STATUSES[number];
