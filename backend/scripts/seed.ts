/**
 * Development Database Seeder for Kabadiwala Connect
 *
 * NOTE: This script populates the database with DEVELOPMENT DEMO ACCOUNTS and INITIAL MATERIALS.
 * These accounts are strictly for local testing and prototyping.
 * DO NOT USE THESE CREDENTIALS IN PRODUCTION.
 */

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';

// Consistent development password for all demo accounts
const DEMO_PASSWORD = 'DemoPassword123!';

const seedDatabase = async (): Promise<void> => {
  try {
    console.log('🌱 Connecting to database for seeding...');
    await connectDB();

    console.log('🔒 Generating secure bcrypt hash for development credentials...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

    // 1. Seed Demo Collector
    console.log('👤 Seeding Demo Collector: collector@demo.com');
    await CollectorProfile.deleteMany({});
    await RecyclerProfile.deleteMany({});
    await User.deleteMany({});

    const collectorUser = await User.create({
      name: 'Ravi Kumar (Demo Collector)',
      email: 'collector@demo.com',
      phone: '+91 9876543210',
      passwordHash,
      role: 'collector',
      location: 'Charminar, Hyderabad',
      verificationStatus: 'verified',
      isVerified: true,
      isActive: true,
    });

    await CollectorProfile.create({
      user: collectorUser._id,
      totalCollected: 1284,
      totalEarnings: 48650,
      completedHandovers: 27,
      notificationPreferences: {
        emailNotifications: true,
        priceAlerts: true,
        weeklySummary: true,
      },
    });

    // 2. Seed Demo Recycler
    console.log('🏭 Seeding Demo Recycler: recycler@demo.com');
    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling (Demo Recycler)',
      email: 'recycler@demo.com',
      phone: '+91 9876543211',
      passwordHash,
      role: 'recycler',
      location: 'Miyapur Industrial Area, Hyderabad',
      verificationStatus: 'verified',
      isVerified: true,
      isActive: true,
    });

    await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'GreenCycle Recycling (Demo Recycler)',
      businessName: 'GreenCycle Recycling (Demo Recycler)',
      contactPerson: 'Ananya Rao',
      registrationId: 'DEMO-GR-HYD-2026-001',
      location: 'Miyapur Industrial Area, Hyderabad',
      address: 'Plot 42, Phase 1, Miyapur Industrial Area, Hyderabad',
      acceptedMaterials: ['Computers', 'Laptops', 'Mobile Phones', 'Cables'],
      processingCategories: ['E-waste Dismantling', 'Material Recovery', 'Precious Metal Extraction'],
      operatingHours: '9 AM - 6 PM, Mon-Sat',
      about: 'Development demo facility for testing responsible e-waste collection and material intake.',
      description: 'Development demo facility for testing responsible e-waste collection and material intake.',
      isVerified: true,
      verificationStatus: 'verified',
      locationCoordinates: {
        type: 'Point',
        coordinates: [78.3589, 17.4909],
      },
      totalProcessed: 3420,
      completedHandoversCount: 156,
      settings: {
        emailNotifications: true,
        incomingRequestAlerts: true,
      },
    });

    // 3. Seed Demo Admin
    console.log('🛡️ Seeding Demo Admin: admin@demo.com');
    await User.create({
      name: 'Platform Admin (Demo)',
      email: 'admin@demo.com',
      phone: '+91 9876543299',
      passwordHash,
      role: 'admin',
      location: 'Hyderabad',
      verificationStatus: 'verified',
      isVerified: true,
      isActive: true,
    });

    // 4. Seed Materials Catalog
    console.log('📦 Seeding Initial Materials Catalog...');
    await Material.deleteMany({});

    const materialsData = [
      {
        name: 'Laptop Scrap',
        category: 'Computers',
        pricePerKg: 110,
        indicativePrice: 110,
        unit: 'per kg',
        priceTrend: 'up' as const,
        description: 'Used and broken laptops, motherboards and components',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Copper Cable',
        category: 'Cables',
        pricePerKg: 620,
        indicativePrice: 620,
        unit: 'per kg',
        priceTrend: 'stable' as const,
        description: 'Stripped and unstripped copper wires and communication cables',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Mobile Phones',
        category: 'Mobile Devices',
        pricePerKg: 280,
        indicativePrice: 280,
        unit: 'per kg',
        priceTrend: 'down' as const,
        description: 'Old, damaged and non-functional mobile handsets and circuit boards',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Lead Battery',
        category: 'Batteries',
        pricePerKg: 95,
        indicativePrice: 95,
        unit: 'per kg',
        priceTrend: 'up' as const,
        description: 'Lead acid batteries from UPS systems and inverters',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Monitor Panel',
        category: 'Displays',
        pricePerKg: 45,
        indicativePrice: 45,
        unit: 'per kg',
        priceTrend: 'stable' as const,
        description: 'CRT displays, LCD panels and desktop monitor chassis',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Printer Circuit Board',
        category: 'Printers',
        pricePerKg: 890,
        indicativePrice: 890,
        unit: 'per kg',
        priceTrend: 'up' as const,
        description: 'High-grade printer motherboards and internal power supplies',
        isActive: true,
        status: 'active' as const,
      },
      {
        name: 'Mixed Appliances',
        category: 'Appliances',
        pricePerKg: 35,
        indicativePrice: 35,
        unit: 'per kg',
        priceTrend: 'stable' as const,
        description: 'Discarded small electronic appliances, microwaves, fans',
        isActive: true,
        status: 'active' as const,
      },
    ];

    await Material.insertMany(materialsData);

    const userCount = await User.countDocuments();
    const materialCount = await Material.countDocuments();

    console.log('\n=============================================');
    console.log('✅ Database seeded successfully!');
    console.log(`   Users created:     ${userCount}`);
    console.log(`   Materials created: ${materialCount}`);
    console.log('---------------------------------------------');
    console.log('🔑 DEMO CREDENTIALS (DEVELOPMENT ONLY):');
    console.log(`   Collector: collector@demo.com / ${DEMO_PASSWORD}`);
    console.log(`   Recycler:  recycler@demo.com  / ${DEMO_PASSWORD}`);
    console.log(`   Admin:     admin@demo.com     / ${DEMO_PASSWORD}`);
    console.log('=============================================\n');
  } catch (error: any) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

seedDatabase();
