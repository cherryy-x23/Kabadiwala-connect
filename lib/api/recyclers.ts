import { apiClient, ApiResponse } from '../apiClient';
import { Recycler } from '@/data/mockData';

export interface BackendRecycler {
  id: string;
  organizationName: string;
  businessName?: string;
  registrationId: string;
  location?: string;
  address?: string;
  acceptedMaterials: string[];
  processingCategories?: string[];
  operatingHours?: string;
  about?: string;
  description?: string;
  isVerified?: boolean;
  verificationStatus?: string;
  distance?: number;
  hasLocation?: boolean;
  locationCoordinates?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    rating?: number;
    avatar?: string;
  };
}

export interface NearbyRecycler {
  id: string;
  businessName: string;
  address: string;
  description: string;
  isVerified: boolean;
  hasLocation: boolean;
  distanceKm: number;
  locationCoordinates?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface NearbyQueryParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

export const recyclersApi = {
  /**
   * Fetch recyclers directory from backend (public catalog)
   */
  getRecyclers: async (material?: string): Promise<Recycler[]> => {
    const query = material ? `?material=${encodeURIComponent(material)}` : '';
    const res = await apiClient.get<ApiResponse<{ recyclers: BackendRecycler[]; count: number }>>(
      `/recyclers${query}`
    );

    const backendList = res.data?.recyclers || [];

    // Map backend recycler documents into the frontend Recycler interface
    return backendList.map((r) => ({
      id: r.id,
      name: r.businessName || r.organizationName || 'Authorized Recycler',
      registrationId: r.registrationId || 'REG-HYD-2026',
      location: r.address || r.location || 'Hyderabad',
      phone: r.user?.phone || '',
      email: r.user?.email || '',
      distance: r.distance ?? 0,
      acceptedMaterials: r.acceptedMaterials || [],
      operatingHours: r.operatingHours || '9 AM - 6 PM, Mon-Sat',
      verified: Boolean(r.isVerified || r.verificationStatus === 'verified'),
      rating: r.user?.rating || 4.8,
      processingCategories: r.processingCategories || ['E-waste Dismantling'],
      about: r.description || r.about || 'Authorized e-waste processing facility.',
    }));
  },

  /**
   * Fetch nearby verified recyclers using geospatial coordinates (authenticated collector discovery)
   */
  getNearbyRecyclers: async (params: NearbyQueryParams): Promise<NearbyRecycler[]> => {
    const q = new URLSearchParams();
    q.set('latitude', String(params.latitude));
    q.set('longitude', String(params.longitude));
    if (params.radiusKm) q.set('radiusKm', String(params.radiusKm));
    if (params.limit) q.set('limit', String(params.limit));

    const res = await apiClient.get<ApiResponse<NearbyRecycler[]>>(
      `/recyclers/nearby?${q.toString()}`
    );

    return res.data || [];
  },

  /**
   * Get single recycler details by ID from backend
   */
  getRecyclerById: async (id: string): Promise<BackendRecycler> => {
    const res = await apiClient.get<ApiResponse<{ recycler: BackendRecycler }>>(`/recyclers/${id}`);
    return res.data?.recycler || (res.data as any);
  },

  /**
   * Get authenticated recycler's own profile including configured location
   */
  getMyProfile: async (): Promise<BackendRecycler> => {
    const res = await apiClient.get<ApiResponse<{ profile: BackendRecycler }>>('/recyclers/me');
    return (res.data as any)?.profile || (res.data as any);
  },

  /**
   * Set or update recycler's facility location coordinates
   */
  updateMyLocation: async (coords: {
    latitude: number;
    longitude: number;
  }): Promise<{ hasLocation: boolean; locationCoordinates?: any }> => {
    const res = await apiClient.patch<ApiResponse<{ hasLocation: boolean; locationCoordinates?: any }>>(
      '/recyclers/me/location',
      coords
    );
    return res.data || { hasLocation: true };
  },

  /**
   * Clear recycler's facility location
   */
  clearMyLocation: async (): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>('/recyclers/me/location');
  },
};
