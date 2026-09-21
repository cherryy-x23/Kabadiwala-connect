import mongoose, { Schema, Document, Types } from 'mongoose';
import { VERIFICATION_STATUSES, VerificationStatus } from '../config/constants';

export interface IRecyclerProfile extends Document {
  user: Types.ObjectId;
  organizationName: string;
  businessName: string;
  contactPerson?: string;
  registrationId: string;
  location?: string;
  address?: string;
  acceptedMaterials: string[];
  processingCategories: string[];
  operatingHours: string;
  about?: string;
  description?: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  locationCoordinates?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  totalProcessed: number;
  completedHandoversCount: number;
  settings: {
    emailNotifications: boolean;
    incomingRequestAlerts: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const recyclerProfileSchema = new Schema<IRecyclerProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    registrationId: {
      type: String,
      required: [true, 'Registration ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    acceptedMaterials: {
      type: [String],
      default: [],
      index: true,
    },
    processingCategories: {
      type: [String],
      default: [],
    },
    operatingHours: {
      type: String,
      default: '9 AM - 6 PM, Mon-Sat',
    },
    about: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: {
        values: VERIFICATION_STATUSES,
        message: '{VALUE} is not a valid verification status',
      },
      default: 'pending',
    },
    locationCoordinates: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      _id: false,
    },
    totalProcessed: {
      type: Number,
      default: 0,
      min: [0, 'Total processed cannot be negative'],
    },
    completedHandoversCount: {
      type: Number,
      default: 0,
      min: [0, 'Completed handovers cannot be negative'],
    },
    settings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      incomingRequestAlerts: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString();
        ret.hasLocation = Boolean(
          ret.locationCoordinates?.coordinates &&
            ret.locationCoordinates.coordinates.length === 2
        );
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString();
        ret.hasLocation = Boolean(
          ret.locationCoordinates?.coordinates &&
            ret.locationCoordinates.coordinates.length === 2
        );
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-validate hook to sync organizationName/businessName and about/description
recyclerProfileSchema.pre('validate', function (next) {
  if (!this.businessName && this.organizationName) {
    this.businessName = this.organizationName;
  }
  if (!this.organizationName && this.businessName) {
    this.organizationName = this.businessName;
  }
  if (!this.description && this.about) {
    this.description = this.about;
  }
  if (!this.about && this.description) {
    this.about = this.description;
  }
  if (this.isVerified) {
    this.verificationStatus = 'verified';
  } else if (this.verificationStatus === 'verified') {
    this.isVerified = true;
  }
  next();
});

// Geospatial 2dsphere index for location discovery
recyclerProfileSchema.index({ locationCoordinates: '2dsphere' });

export const RecyclerProfile = mongoose.model<IRecyclerProfile>(
  'RecyclerProfile',
  recyclerProfileSchema
);
