import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const isCloudinaryConfigured = (): boolean => isConfigured;

export interface UploadPhotoResult {
  url: string;
  publicId: string;
}

export const uploadPhoto = async (
  buffer: Buffer,
  _originalname: string
): Promise<UploadPhotoResult> => {
  // If credentials are not configured
  if (!isConfigured) {
    if (process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test') {
      const mockPublicId = `kabadiwala-connect/waste-items/mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        url: `https://res.cloudinary.com/mock-cloud/image/upload/v1/${mockPublicId}.jpg`,
        publicId: mockPublicId,
      };
    }
    throw new Error(
      'Photo upload is currently unavailable: Cloudinary credentials are not configured on the server.'
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'kabadiwala-connect/waste-items',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(new Error(error?.message || 'Failed to upload image to Cloudinary'));
        }
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

export const deletePhoto = async (publicId: string): Promise<void> => {
  if (!isConfigured || !publicId) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete photo ${publicId}:`, err);
  }
};
