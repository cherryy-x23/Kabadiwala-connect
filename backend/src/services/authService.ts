import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { CollectorProfile } from '../models/CollectorProfile';
import { RecyclerProfile } from '../models/RecyclerProfile';
import { RegisterInput, LoginInput } from '../validators/authValidators';
import { generateToken } from '../utils/token';
import { UserRole } from '../config/constants';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  phone?: string;
  location?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export const registerUser = async (
  input: RegisterInput
): Promise<{ user: SafeUser; token: string }> => {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Check for duplicate email
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AuthError('An account with this email already exists.', 409);
  }

  // Hash password securely with bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(input.password, salt);

  // Create user
  const user = await User.create({
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: input.role,
    phone: input.phone || undefined,
    location: input.location || '',
    verificationStatus: 'pending',
    isVerified: false,
    isActive: true,
  });

  // Create associated role profile
  if (input.role === 'collector') {
    await CollectorProfile.create({
      user: user._id,
      totalCollected: 0,
      totalEarnings: 0,
      completedHandovers: 0,
    });
  } else if (input.role === 'recycler') {
    await RecyclerProfile.create({
      user: user._id,
      organizationName: input.name.trim(),
      registrationId: `REG-${Date.now()}`,
      acceptedMaterials: [],
      processingCategories: [],
      totalProcessed: 0,
      completedHandoversCount: 0,
    });
  }

  const token = generateToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const safeUser: SafeUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified || user.verificationStatus === 'verified',
    phone: user.phone,
    location: user.location,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { user: safeUser, token };
};

export const loginUser = async (
  input: LoginInput
): Promise<{ user: SafeUser; token: string }> => {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Find user by normalized email
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    // Generic error message to prevent account enumeration
    throw new AuthError('Invalid email or password', 401);
  }

  // Compare password hash
  const isMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!isMatch) {
    throw new AuthError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AuthError('Your account has been deactivated. Please contact support.', 401);
  }

  const token = generateToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const safeUser: SafeUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified || user.verificationStatus === 'verified',
    phone: user.phone,
    location: user.location,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { user: safeUser, token };
};

export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AuthError('User account not found', 404);
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified || user.verificationStatus === 'verified',
    phone: user.phone,
    location: user.location,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
