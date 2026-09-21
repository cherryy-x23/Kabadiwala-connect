import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import bcrypt from 'bcryptjs';

async function runVerification() {
  console.log('🧪 Starting Phase 1 automated verification test suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;

  try {
    // 1. Start In-Memory MongoDB instance
    console.log('1️⃣ Starting in-memory MongoDB server for testing...');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    console.log(`   Connected to in-memory MongoDB at: ${uri}`);

    // 2. Connect via Mongoose
    console.log('\n2️⃣ Testing Mongoose connection...');
    await mongoose.connect(uri);
    console.log('   ✅ MongoDB connection successfully established!');
    console.log(`   Mongoose readyState: ${mongoose.connection.readyState} (1 = connected)`);

    // 3. Test Seeding
    console.log('\n3️⃣ Testing Database Seeding...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('DemoPassword123!', salt);

    const collector = await User.create({
      name: 'Ravi Kumar (Demo Collector)',
      email: 'collector@demo.com',
      phone: '+91 9876543210',
      passwordHash,
      role: 'collector',
      location: 'Charminar, Hyderabad',
      verificationStatus: 'verified',
      isActive: true,
    });

    await CollectorProfile.create({
      user: collector._id,
      totalCollected: 1284,
      totalEarnings: 48650,
      completedHandovers: 27,
      notificationPreferences: {
        emailNotifications: true,
        priceAlerts: true,
        weeklySummary: true,
      },
    });

    const recycler = await User.create({
      name: 'GreenCycle Recycling (Demo Recycler)',
      email: 'recycler@demo.com',
      phone: '+91 9876543211',
      passwordHash,
      role: 'recycler',
      location: 'Miyapur Industrial Area, Hyderabad',
      verificationStatus: 'verified',
      isActive: true,
    });

    await RecyclerProfile.create({
      user: recycler._id,
      organizationName: 'GreenCycle Recycling (Demo Recycler)',
      contactPerson: 'Ananya Rao',
      registrationId: 'DEMO-GR-HYD-2026-001',
      acceptedMaterials: ['Computers', 'Laptops', 'Mobile Phones', 'Cables'],
      processingCategories: ['E-waste Dismantling', 'Material Recovery', 'Precious Metal Extraction'],
      operatingHours: '9 AM - 6 PM, Mon-Sat',
      about: 'Development demo facility.',
      totalProcessed: 3420,
      completedHandoversCount: 156,
      settings: {
        emailNotifications: true,
        incomingRequestAlerts: true,
      },
    });

    const admin = await User.create({
      name: 'Platform Admin (Demo)',
      email: 'admin@demo.com',
      phone: '+91 9876543299',
      passwordHash,
      role: 'admin',
      location: 'Hyderabad',
      verificationStatus: 'verified',
      isActive: true,
    });

    await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      indicativePrice: 110,
      unit: 'per kg',
      priceTrend: 'up',
      description: 'Used laptops',
      status: 'active',
    });

    await Material.create({
      name: 'Copper Cable',
      category: 'Cables',
      indicativePrice: 620,
      unit: 'per kg',
      priceTrend: 'stable',
      description: 'Copper cables',
      status: 'active',
    });

    // Verify Counts and Queries
    const userCount = await User.countDocuments();
    const collectorProfiles = await CollectorProfile.countDocuments();
    const recyclerProfiles = await RecyclerProfile.countDocuments();
    const materialsCount = await Material.countDocuments();

    console.log(`   ✅ Users seeded: ${userCount} (Collector: ${collector.email}, Recycler: ${recycler.email}, Admin: ${admin.email})`);
    console.log(`   ✅ Collector profiles seeded: ${collectorProfiles}`);
    console.log(`   ✅ Recycler profiles seeded: ${recyclerProfiles}`);
    console.log(`   ✅ Materials seeded: ${materialsCount}`);

    // Verify password exclusion in serialization
    const userObj = collector.toJSON();
    if ((userObj as any).passwordHash) {
      throw new Error('FAILED: passwordHash is exposed in toJSON()!');
    }
    console.log('   ✅ Security check: passwordHash is stripped in user JSON output.');

    // 4. Start Express server on test port 5999
    console.log('\n4️⃣ Testing Express Server & Endpoints...');
    const testPort = 5999;
    server = app.listen(testPort);
    console.log(`   Server listening on port ${testPort}`);

    // 5. Test GET /api/v1/health
    const healthRes = await fetch(`http://localhost:${testPort}/api/v1/health`);
    const healthJson = await healthRes.json();
    console.log(`   HTTP Status: ${healthRes.status}`);
    console.log('   Response body:', JSON.stringify(healthJson, null, 2));

    if (healthRes.status !== 200 || healthJson.database !== 'connected' || !healthJson.success) {
      throw new Error(`Health check failed! Expected 200 & database: 'connected', got: ${JSON.stringify(healthJson)}`);
    }
    console.log('   ✅ Health endpoint verified successfully!');

    // 6. Test 404 handler
    const notFoundRes = await fetch(`http://localhost:${testPort}/api/v1/nonexistent`);
    const notFoundJson = await notFoundRes.json();
    if (notFoundRes.status !== 404 || notFoundJson.success !== false) {
      throw new Error('404 handler verification failed!');
    }
    console.log('   ✅ 404 Not Found handler verified successfully!');

    console.log('\n🎉 ALL PHASE 1 VERIFICATION CHECKS PASSED!\n');
  } catch (error: any) {
    console.error('\n❌ Verification failed with error:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
    console.log('🧹 Cleanup complete.');
  }
}

runVerification();
