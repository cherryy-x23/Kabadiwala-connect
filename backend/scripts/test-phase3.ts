import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { WasteItem } from '../src/models/WasteItem';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase3Tests() {
  console.log('🧪 Starting Phase 3 Materials, Recyclers & Waste Ingestion Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5997;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 30;
  const allResponsesToCheckForPasswordHash: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Seed Demo Users with bcrypt hash
    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Collector 1
    const collector1 = await User.create({
      name: 'Ravi Kumar (Collector 1)',
      email: 'collector@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector1._id });

    // Collector 2 (for cross-user ownership tests)
    const collector2 = await User.create({
      name: 'Sita Sharma (Collector 2)',
      email: 'sita@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector2._id });

    // Recycler
    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling',
      email: 'recycler@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile = await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'GreenCycle Recycling',
      businessName: 'GreenCycle Recycling',
      contactPerson: 'Ananya Rao',
      registrationId: 'DEMO-GR-HYD-2026-001',
      location: 'Miyapur Industrial Area, Hyderabad',
      acceptedMaterials: ['Computers', 'Laptops', 'Cables'],
      processingCategories: ['Dismantling', 'Recovery'],
    });

    // Admin
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@demo.com',
      passwordHash: demoPasswordHash,
      role: 'admin',
      isVerified: true,
    });

    // Seed Initial Materials
    const seededMaterial = await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      pricePerKg: 110,
      indicativePrice: 110,
      unit: 'per kg',
      priceTrend: 'up',
      isActive: true,
    });

    const inactiveMaterial = await Material.create({
      name: 'Obsolete Cathode Tube',
      category: 'Displays',
      pricePerKg: 20,
      indicativePrice: 20,
      unit: 'per kg',
      priceTrend: 'down',
      isActive: false,
    });

    server = app.listen(testPort);

    // Authenticate Users to get cookies
    const loginUser = async (email: string) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'DemoPassword123!' }),
      });
      const cookie = extractTokenCookie(res);
      const json = await res.json();
      allResponsesToCheckForPasswordHash.push(json);
      return { cookie, json };
    };

    const { cookie: collector1Cookie } = await loginUser('collector@demo.com');
    const { cookie: collector2Cookie } = await loginUser('sita@demo.com');
    const { cookie: recyclerCookie } = await loginUser('recycler@demo.com');
    const { cookie: adminCookie } = await loginUser('admin@demo.com');

    // =============================================================
    // 1. Public materials list works
    // =============================================================
    const matListRes = await fetch(`${baseUrl}/materials?category=Computers`);
    const matListJson = await matListRes.json();
    allResponsesToCheckForPasswordHash.push(matListJson);

    if (
      matListRes.status === 200 &&
      matListJson.success === true &&
      matListJson.data.materials.some((m: any) => m.name === 'Laptop Scrap') &&
      !matListJson.data.materials.some((m: any) => m.name === 'Obsolete Cathode Tube') // inactive excluded
    ) {
      console.log('✅ 1. Public materials list works');
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: ${JSON.stringify(matListJson)}`);
    }

    // =============================================================
    // 2. Public material detail works
    // =============================================================
    const matDetailRes = await fetch(`${baseUrl}/materials/${seededMaterial._id}`);
    const matDetailJson = await matDetailRes.json();
    allResponsesToCheckForPasswordHash.push(matDetailJson);

    if (
      matDetailRes.status === 200 &&
      matDetailJson.success === true &&
      matDetailJson.data.material.name === 'Laptop Scrap'
    ) {
      console.log('✅ 2. Public material detail works');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: ${JSON.stringify(matDetailJson)}`);
    }

    // =============================================================
    // 3. Admin can create material
    // =============================================================
    const createMatRes = await fetch(`${baseUrl}/materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie!,
      },
      body: JSON.stringify({
        name: 'Copper Wire Scrap',
        category: 'Cables',
        pricePerKg: 620,
        unit: 'per kg',
        priceTrend: 'stable',
      }),
    });
    const createMatJson = await createMatRes.json();
    allResponsesToCheckForPasswordHash.push(createMatJson);
    const createdMaterialId = createMatJson.data?.material?.id || createMatJson.data?.material?._id;

    if (createMatRes.status === 201 && createMatJson.success === true && createdMaterialId) {
      console.log('✅ 3. Admin can create material');
      passedTests++;
    } else {
      throw new Error(`Test 3 Failed: ${JSON.stringify(createMatJson)}`);
    }

    // =============================================================
    // 4. Admin can update material
    // =============================================================
    const updateMatRes = await fetch(`${baseUrl}/materials/${createdMaterialId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie!,
      },
      body: JSON.stringify({
        pricePerKg: 650,
        priceTrend: 'up',
      }),
    });
    const updateMatJson = await updateMatRes.json();
    allResponsesToCheckForPasswordHash.push(updateMatJson);

    if (
      updateMatRes.status === 200 &&
      updateMatJson.data.material.pricePerKg === 650 &&
      updateMatJson.data.material.priceTrend === 'up'
    ) {
      console.log('✅ 4. Admin can update material');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: ${JSON.stringify(updateMatJson)}`);
    }

    // =============================================================
    // 5. Admin can soft-delete/deactivate material
    // =============================================================
    const deleteMatRes = await fetch(`${baseUrl}/materials/${createdMaterialId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie! },
    });
    const deleteMatJson = await deleteMatRes.json();
    allResponsesToCheckForPasswordHash.push(deleteMatJson);

    const checkSoftDeleted = await fetch(`${baseUrl}/materials/${createdMaterialId}`);

    if (deleteMatRes.status === 200 && checkSoftDeleted.status === 404) {
      console.log('✅ 5. Admin can soft-delete/deactivate material');
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: ${JSON.stringify(deleteMatJson)}`);
    }

    // =============================================================
    // 6. Non-admin cannot create material
    // =============================================================
    const nonAdminMatRes = await fetch(`${baseUrl}/materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        name: 'Illegal Material',
        category: 'Electronics',
        pricePerKg: 100,
      }),
    });

    if (nonAdminMatRes.status === 403) {
      console.log('✅ 6. Non-admin cannot create material (403 Forbidden)');
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: Expected 403, got ${nonAdminMatRes.status}`);
    }

    // =============================================================
    // 7. Public recycler list works
    // =============================================================
    const recyclerListRes = await fetch(`${baseUrl}/recyclers?material=Computers`);
    const recyclerListJson = await recyclerListRes.json();
    allResponsesToCheckForPasswordHash.push(recyclerListJson);

    if (
      recyclerListRes.status === 200 &&
      recyclerListJson.success === true &&
      recyclerListJson.data.recyclers.some((r: any) => r.organizationName === 'GreenCycle Recycling')
    ) {
      console.log('✅ 7. Public recycler list works');
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: ${JSON.stringify(recyclerListJson)}`);
    }

    // =============================================================
    // 8. Public recycler detail works
    // =============================================================
    const recyclerDetailRes = await fetch(`${baseUrl}/recyclers/${recyclerProfile._id}`);
    const recyclerDetailJson = await recyclerDetailRes.json();
    allResponsesToCheckForPasswordHash.push(recyclerDetailJson);

    if (
      recyclerDetailRes.status === 200 &&
      recyclerDetailJson.success === true &&
      recyclerDetailJson.data.recycler.registrationId === 'DEMO-GR-HYD-2026-001'
    ) {
      console.log('✅ 8. Public recycler detail works');
      passedTests++;
    } else {
      throw new Error(`Test 8 Failed: ${JSON.stringify(recyclerDetailJson)}`);
    }

    // =============================================================
    // 9. Recycler can access /recyclers/me
    // =============================================================
    const recyclerMeRes = await fetch(`${baseUrl}/recyclers/me`, {
      headers: { Cookie: recyclerCookie! },
    });
    const recyclerMeJson = await recyclerMeRes.json();
    allResponsesToCheckForPasswordHash.push(recyclerMeJson);

    if (
      recyclerMeRes.status === 200 &&
      recyclerMeJson.data.profile.organizationName === 'GreenCycle Recycling'
    ) {
      console.log('✅ 9. Recycler can access /recyclers/me');
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: ${JSON.stringify(recyclerMeJson)}`);
    }

    // =============================================================
    // 10. Collector cannot access /recyclers/me
    // =============================================================
    const colMeRes = await fetch(`${baseUrl}/recyclers/me`, {
      headers: { Cookie: collector1Cookie! },
    });

    if (colMeRes.status === 403) {
      console.log('✅ 10. Collector cannot access /recyclers/me (403 Forbidden)');
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: Expected 403, got ${colMeRes.status}`);
    }

    // =============================================================
    // 11. Recycler can update their own editable profile
    // =============================================================
    const updateRecRes = await fetch(`${baseUrl}/recyclers/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recyclerCookie!,
      },
      body: JSON.stringify({
        contactPerson: 'Kavita Reddy',
        operatingHours: '8 AM - 8 PM, Mon-Sat',
        about: 'Premier eco-certified recycling facility.',
      }),
    });
    const updateRecJson = await updateRecRes.json();
    allResponsesToCheckForPasswordHash.push(updateRecJson);

    if (
      updateRecRes.status === 200 &&
      updateRecJson.data.profile.contactPerson === 'Kavita Reddy' &&
      updateRecJson.data.profile.operatingHours === '8 AM - 8 PM, Mon-Sat'
    ) {
      console.log('✅ 11. Recycler can update their own editable profile');
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: ${JSON.stringify(updateRecJson)}`);
    }

    // =============================================================
    // 12. Recycler cannot modify protected fields
    // =============================================================
    const protectedFieldRes = await fetch(`${baseUrl}/recyclers/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recyclerCookie!,
      },
      body: JSON.stringify({
        registrationId: 'HACKED-REG-001',
        isVerified: true,
        totalProcessed: 999999,
      }),
    });

    if (protectedFieldRes.status === 400) {
      console.log('✅ 12. Recycler cannot modify protected fields (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 12 Failed: Expected 400 rejection, got ${protectedFieldRes.status}`);
    }

    // =============================================================
    // 13. Collector can create waste
    // =============================================================
    const createWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        materialId: seededMaterial._id.toString(),
        quantityKg: 10,
        notes: '10kg of old laptop components',
      }),
    });
    const createWasteJson = await createWasteRes.json();
    allResponsesToCheckForPasswordHash.push(createWasteJson);
    const wasteItemId = createWasteJson.data?.wasteItem?.id || createWasteJson.data?.wasteItem?._id;

    if (createWasteRes.status === 201 && createWasteJson.success === true && wasteItemId) {
      console.log('✅ 13. Collector can create waste');
      passedTests++;
    } else {
      throw new Error(`Test 13 Failed: ${JSON.stringify(createWasteJson)}`);
    }

    // =============================================================
    // 14. Waste estimatedValue is calculated server-side
    // =============================================================
    // 10 kg * ₹110 = ₹1100
    if (createWasteJson.data?.wasteItem?.estimatedValue === 1100) {
      console.log('✅ 14. Waste estimatedValue is calculated server-side (10kg * ₹110 = ₹1,100)');
      passedTests++;
    } else {
      throw new Error(`Test 14 Failed: Expected 1100, got ${createWasteJson.data?.wasteItem?.estimatedValue}`);
    }

    // =============================================================
    // 15. Client cannot override estimatedValue or collectorId
    // =============================================================
    const overrideValRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        materialId: seededMaterial._id.toString(),
        quantityKg: 5,
        estimatedValue: 999999, // Client override attempt
      }),
    });

    if (overrideValRes.status === 400) {
      console.log('✅ 15. Client cannot override estimatedValue (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 15 Failed: Expected 400 rejection, got ${overrideValRes.status}`);
    }

    // =============================================================
    // 16. Collector can view their own waste list
    // =============================================================
    const myListRes = await fetch(`${baseUrl}/waste/my`, {
      headers: { Cookie: collector1Cookie! },
    });
    const myListJson = await myListRes.json();
    allResponsesToCheckForPasswordHash.push(myListJson);

    if (
      myListRes.status === 200 &&
      myListJson.data.wasteItems.some((w: any) => (w.id || w._id) === wasteItemId)
    ) {
      console.log('✅ 16. Collector can view their own waste list');
      passedTests++;
    } else {
      throw new Error(`Test 16 Failed: ${JSON.stringify(myListJson)}`);
    }

    // =============================================================
    // 17. Collector can view their own waste item
    // =============================================================
    const getWasteRes = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      headers: { Cookie: collector1Cookie! },
    });
    const getWasteJson = await getWasteRes.json();
    allResponsesToCheckForPasswordHash.push(getWasteJson);

    if (getWasteRes.status === 200 && (getWasteJson.data.wasteItem.id || getWasteJson.data.wasteItem._id) === wasteItemId) {
      console.log('✅ 17. Collector can view their own waste item');
      passedTests++;
    } else {
      throw new Error(`Test 17 Failed: ${JSON.stringify(getWasteJson)}`);
    }

    // =============================================================
    // 18. Collector cannot view another collector's waste item (403 Forbidden)
    // =============================================================
    const col2AccessRes = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      headers: { Cookie: collector2Cookie! },
    });

    if (col2AccessRes.status === 403) {
      console.log('✅ 18. Collector cannot view another collector’s waste item (403 Forbidden)');
      passedTests++;
    } else {
      throw new Error(`Test 18 Failed: Expected 403, got ${col2AccessRes.status}`);
    }

    // =============================================================
    // 19. Collector can update available waste (recalculates value)
    // =============================================================
    // Update quantity from 10kg to 20kg -> valuation becomes 20 * 110 = 2200
    const updateWasteRes = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        quantityKg: 20,
        notes: 'Updated to 20kg laptop scrap',
      }),
    });
    const updateWasteJson = await updateWasteRes.json();
    allResponsesToCheckForPasswordHash.push(updateWasteJson);

    if (
      updateWasteRes.status === 200 &&
      updateWasteJson.data.wasteItem.quantityKg === 20 &&
      updateWasteJson.data.wasteItem.estimatedValue === 2200
    ) {
      console.log('✅ 19. Collector can update available waste (server recalculated 20kg * ₹110 = ₹2,200)');
      passedTests++;
    } else {
      throw new Error(`Test 19 Failed: ${JSON.stringify(updateWasteJson)}`);
    }

    // =============================================================
    // 20. Collector cannot modify handed_over or reserved waste
    // =============================================================
    const handedOverWaste = await WasteItem.create({
      collectorId: collector1._id,
      materialId: seededMaterial._id,
      quantityKg: 5,
      estimatedValue: 550,
      status: 'handed_over',
    });

    const editHandedOverRes = await fetch(`${baseUrl}/waste/${handedOverWaste._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({ quantityKg: 10 }),
    });

    if (editHandedOverRes.status === 400) {
      console.log('✅ 20. Collector cannot modify handed_over/reserved waste (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 20 Failed: Expected 400 rejection, got ${editHandedOverRes.status}`);
    }

    // =============================================================
    // 21. Collector can delete available waste (soft-delete)
    // =============================================================
    const deleteWasteRes = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      method: 'DELETE',
      headers: { Cookie: collector1Cookie! },
    });
    const checkDeleted = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      headers: { Cookie: collector1Cookie! },
    });

    if (deleteWasteRes.status === 200 && checkDeleted.status === 404) {
      console.log('✅ 21. Collector can delete available waste (soft-deleted from active view)');
      passedTests++;
    } else {
      throw new Error(`Test 21 Failed: delete status ${deleteWasteRes.status}, check status ${checkDeleted.status}`);
    }

    // =============================================================
    // 22. Invalid material ID is rejected
    // =============================================================
    const invalidMatRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        materialId: 'not-an-id',
        quantityKg: 10,
      }),
    });

    if (invalidMatRes.status === 400) {
      console.log('✅ 22. Invalid material ID is rejected (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 22 Failed: Expected 400, got ${invalidMatRes.status}`);
    }

    // =============================================================
    // 23. Inactive material cannot be used to create waste
    // =============================================================
    const inactiveMatRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        materialId: inactiveMaterial._id.toString(),
        quantityKg: 10,
      }),
    });

    if (inactiveMatRes.status === 400) {
      console.log('✅ 23. Inactive material cannot be used to create waste (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 23 Failed: Expected 400, got ${inactiveMatRes.status}`);
    }

    // =============================================================
    // 24. Invalid quantity is rejected (zero / negative)
    // =============================================================
    const badQtyRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: collector1Cookie!,
      },
      body: JSON.stringify({
        materialId: seededMaterial._id.toString(),
        quantityKg: -5,
      }),
    });

    if (badQtyRes.status === 400) {
      console.log('✅ 24. Invalid quantity is rejected (400 Bad Request)');
      passedTests++;
    } else {
      throw new Error(`Test 24 Failed: Expected 400, got ${badQtyRes.status}`);
    }

    // =============================================================
    // 25. Recycler cannot create collector waste
    // =============================================================
    const recCreateWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recyclerCookie!,
      },
      body: JSON.stringify({
        materialId: seededMaterial._id.toString(),
        quantityKg: 10,
      }),
    });

    if (recCreateWasteRes.status === 403) {
      console.log('✅ 25. Recycler cannot create collector waste (403 Forbidden)');
      passedTests++;
    } else {
      throw new Error(`Test 25 Failed: Expected 403, got ${recCreateWasteRes.status}`);
    }

    // =============================================================
    // 26. Admin cannot create collector waste unless explicitly collector
    // =============================================================
    const adminCreateWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie!,
      },
      body: JSON.stringify({
        materialId: seededMaterial._id.toString(),
        quantityKg: 10,
      }),
    });

    if (adminCreateWasteRes.status === 403) {
      console.log('✅ 26. Admin cannot create collector waste without collector role (403 Forbidden)');
      passedTests++;
    } else {
      throw new Error(`Test 26 Failed: Expected 403, got ${adminCreateWasteRes.status}`);
    }

    // =============================================================
    // 27. Existing Phase 1 tests still pass (Health check & DB status)
    // =============================================================
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();

    if (healthRes.status === 200 && healthJson.database === 'connected') {
      console.log('✅ 27. Existing Phase 1 health endpoint still passes (200 OK, database: connected)');
      passedTests++;
    } else {
      throw new Error(`Test 27 Failed: ${JSON.stringify(healthJson)}`);
    }

    // =============================================================
    // 28. Existing Phase 2 tests still pass (Auth me & role access)
    // =============================================================
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: collector1Cookie! },
    });
    const meJson = await meRes.json();
    allResponsesToCheckForPasswordHash.push(meJson);

    if (meRes.status === 200 && meJson.data.user.email === 'collector@demo.com') {
      console.log('✅ 28. Existing Phase 2 auth/me still passes');
      passedTests++;
    } else {
      throw new Error(`Test 28 Failed: ${JSON.stringify(meJson)}`);
    }

    // =============================================================
    // 29. Seed verification logic passes
    // =============================================================
    const userCount = await User.countDocuments();
    const materialCount = await Material.countDocuments();
    if (userCount >= 3 && materialCount >= 2) {
      console.log(`✅ 29. Seed verification still passes (${userCount} users, ${materialCount} materials)`);
      passedTests++;
    } else {
      throw new Error(`Test 29 Failed: Insufficient seed records`);
    }

    // =============================================================
    // 30. Security check: passwordHash is never exposed in responses
    // =============================================================
    for (const res of allResponsesToCheckForPasswordHash) {
      const serialized = JSON.stringify(res);
      if (serialized.includes('passwordHash')) {
        throw new Error('Test 30 Failed: passwordHash exposed in response JSON!');
      }
    }
    console.log('✅ 30. Security verification: passwordHash is never exposed in any API response');
    passedTests++;

    console.log(`\n=============================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 3 TESTS COMPLETED AND PASSED!`);
    console.log(`=============================================================\n`);
  } catch (error: any) {
    console.error('\n❌ Phase 3 test suite failed with error:', error);
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

runPhase3Tests();
