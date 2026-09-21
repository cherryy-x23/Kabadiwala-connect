import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RecyclerProfile } from '../models/RecyclerProfile';
import { updateRecyclerProfileSchema } from '../validators/recyclerValidators';
import {
  updateLocationSchema,
  nearbyRecyclersQuerySchema,
} from '../validators/recyclerLocationValidators';

export const getAllRecyclers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { material } = req.query;
    const filter: any = {};

    if (material && typeof material === 'string') {
      filter.acceptedMaterials = {
        $regex: new RegExp(material.trim(), 'i'),
      };
    }

    const recyclers = await RecyclerProfile.find(filter)
      .populate('user', 'name email phone location avatar isVerified verificationStatus rating')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Recyclers retrieved successfully',
      data: {
        recyclers,
        count: recyclers.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getRecyclerById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    let filter: any = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter = { $or: [{ _id: id }, { user: id }] };
    } else {
      filter = { registrationId: id };
    }

    const recycler = await RecyclerProfile.findOne(filter).populate(
      'user',
      'name email phone location avatar isVerified verificationStatus rating'
    );

    if (!recycler) {
      res.status(404).json({
        success: false,
        message: 'Recycler facility not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Recycler facility details retrieved successfully',
      data: {
        recycler,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMyRecyclerProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const profile = await RecyclerProfile.findOne({ user: req.user.id }).populate(
      'user',
      'name email phone location avatar isVerified verificationStatus rating'
    );

    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Recycler profile not found for this account',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Recycler profile retrieved successfully',
      data: {
        profile,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateMyRecyclerProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Explicitly validate and reject unauthorized fields
    const validatedData = updateRecyclerProfileSchema.parse(req.body);

    const profile = await RecyclerProfile.findOne({ user: req.user.id });
    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Recycler profile not found',
      });
      return;
    }

    if (validatedData.businessName || validatedData.organizationName) {
      const name = validatedData.businessName || validatedData.organizationName;
      profile.businessName = name!;
      profile.organizationName = name!;
    }
    if (validatedData.contactPerson !== undefined) profile.contactPerson = validatedData.contactPerson;
    if (validatedData.location !== undefined) profile.location = validatedData.location;
    if (validatedData.address !== undefined) profile.address = validatedData.address;
    if (validatedData.about !== undefined || validatedData.description !== undefined) {
      const desc = validatedData.about ?? validatedData.description;
      profile.about = desc;
      profile.description = desc;
    }
    if (validatedData.acceptedMaterials !== undefined) profile.acceptedMaterials = validatedData.acceptedMaterials;
    if (validatedData.processingCategories !== undefined) profile.processingCategories = validatedData.processingCategories;
    if (validatedData.operatingHours !== undefined) profile.operatingHours = validatedData.operatingHours;
    if (validatedData.settings) {
      profile.settings = {
        ...profile.settings,
        ...validatedData.settings,
      };
    }

    await profile.save();

    const populated = await RecyclerProfile.findById(profile._id).populate(
      'user',
      'name email phone location avatar isVerified verificationStatus rating'
    );

    res.status(200).json({
      success: true,
      message: 'Recycler profile updated successfully',
      data: {
        profile: populated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateMyLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = updateLocationSchema.parse(req.body);
    const { latitude, longitude } = validatedData;

    const profile = await RecyclerProfile.findOne({ user: req.user.id });
    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Recycler profile not found',
      });
      return;
    }

    // Convert server-side to GeoJSON Point format: [longitude, latitude]
    profile.locationCoordinates = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Recycler location updated successfully',
      data: {
        hasLocation: true,
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        locationCoordinates: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const clearMyLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const profile = await RecyclerProfile.findOne({ user: req.user.id });
    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Recycler profile not found',
      });
      return;
    }

    await RecyclerProfile.updateOne(
      { _id: profile._id },
      { $unset: { locationCoordinates: 1 } }
    );

    res.status(200).json({
      success: true,
      message: 'Recycler location removed successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

export const getNearbyRecyclers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { latitude, longitude, radiusKm, limit } = nearbyRecyclersQuerySchema.parse(
      req.query
    );

    const radiusMeters = radiusKm * 1000;

    // Execute MongoDB $geoNear aggregation using the 2dsphere index on locationCoordinates
    const results = await RecyclerProfile.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude], // [lng, lat]
          },
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          key: 'locationCoordinates',
        },
      },
      {
        $limit: limit,
      },
    ]);

    const formattedRecyclers = results.map((r) => {
      const distanceKm = Number((r.distanceMeters / 1000).toFixed(2));
      return {
        id: r._id.toString(),
        businessName: r.businessName || r.organizationName,
        address: r.address || r.location || '',
        description: r.description || r.about || '',
        isVerified: Boolean(r.isVerified),
        hasLocation: true,
        distanceKm,
        locationCoordinates: r.locationCoordinates,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Nearby recyclers retrieved successfully',
      data: formattedRecyclers,
      meta: {
        latitude,
        longitude,
        radiusKm,
        count: formattedRecyclers.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
