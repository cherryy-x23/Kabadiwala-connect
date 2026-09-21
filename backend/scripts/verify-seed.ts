import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { execSync } from 'child_process';

async function testSeedDirectly() {
  console.log('🌱 Testing full seed script execution with MongoDB...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  try {
    // Run seed with the active MongoDB URI passed in env
    console.log(`   Running tsx scripts/seed.ts targeting ${uri}`);
    execSync(`npx.cmd tsx scripts/seed.ts`, {
      env: { ...process.env, MONGO_URI: uri },
      stdio: 'inherit',
    });

    // Connect to inspect the seeded documents
    await mongoose.connect(uri);

    const users = await User.find({}).lean();
    const collectors = await CollectorProfile.find({}).populate('user').lean();
    const recyclers = await RecyclerProfile.find({}).populate('user').lean();
    const materials = await Material.find({}).lean();

    console.log('\n📊 SEED VERIFICATION INSPECTION:');
    console.log(`   Total Users: ${users.length}`);
    users.forEach((u) => console.log(`     - [${u.role.toUpperCase()}] ${u.name} (${u.email})`));

    console.log(`\n   Collector Profiles: ${collectors.length}`);
    collectors.forEach((c: any) => console.log(`     - User: ${c.user?.name}, Total Collected: ${c.totalCollected}kg, Earnings: ₹${c.totalEarnings}`));

    console.log(`\n   Recycler Profiles: ${recyclers.length}`);
    recyclers.forEach((r: any) => console.log(`     - Org: ${r.organizationName}, Reg ID: ${r.registrationId}, Accepted Materials: ${r.acceptedMaterials.join(', ')}`));

    console.log(`\n   Materials Catalog: ${materials.length}`);
    materials.forEach((m) => console.log(`     - ${m.name} (${m.category}) -> ₹${m.indicativePrice}/${m.unit} [Trend: ${m.priceTrend}]`));

    if (users.length !== 3 || materials.length !== 7 || collectors.length !== 1 || recyclers.length !== 1) {
      throw new Error('Seed counts mismatch expected values!');
    }

    console.log('\n✅ SEED VERIFICATION COMPLETE & PASSED!\n');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongod.stop();
  }
}

testSeedDirectly();
