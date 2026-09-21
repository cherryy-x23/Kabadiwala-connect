import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICollectorProfile extends Document {
  user: Types.ObjectId;
  totalCollected: number;
  totalEarnings: number;
  completedHandovers: number;
  notificationPreferences: {
    emailNotifications: boolean;
    priceAlerts: boolean;
    weeklySummary: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const collectorProfileSchema = new Schema<ICollectorProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    totalCollected: {
      type: Number,
      default: 0,
      min: [0, 'Total collected cannot be negative'],
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: [0, 'Total earnings cannot be negative'],
    },
    completedHandovers: {
      type: Number,
      default: 0,
      min: [0, 'Completed handovers cannot be negative'],
    },
    notificationPreferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      priceAlerts: {
        type: Boolean,
        default: true,
      },
      weeklySummary: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const CollectorProfile = mongoose.model<ICollectorProfile>(
  'CollectorProfile',
  collectorProfileSchema
);
