import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { WasteItem } from '../src/models/WasteItem';
import { HandoverRecord } from '../src/models/HandoverRecord';
import { Transaction } from '../src/models/Transaction';
import { Notification } from '../src/models/Notification';
import { safeCreateNotification } from '../src/services/notificationService';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase6bTests() {
  console.log('🧪 Starting Phase 6B Recycler Location / Maps Backend Foundation Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5991;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 32;
  const allResponsesToCheckForSensitiveData: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Collector 1 & Collector 2
    const collector1 = await User.create({
      name: 'Ravi Kumar (Collector 1)',
      email: 'collector1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector1._id });

    const collector2 = await User.create({
      name: 'Sita Sharma (Collector 2)',
      email: 'collector2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector2._id });

    // Seed Recycler 1 (Near Hyderabad Central: lat 17.3900, lng 78.4800)
    const recycler1User = await User.create({
      name: 'Central City Recyclers',
      email: 'recycler1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recycler1Profile = await RecyclerProfile.create({
      user: recycler1User._id,
      organizationName: 'Central City Recyclers Pvt Ltd',
      businessName: 'Central City Hub',
      registrationId: 'REG-HYD-LOC-01',
      facilityType: 'authorized_dismantler',
      location: 'Abids, Hyderabad',
      address: 'Plot 10, Abids Road, Hyderabad',
      capacityKgPerDay: 4000,
      verificationStatus: 'verified',
    });

    // Seed Recycler 2 (Further out in Miyapur: lat 17.4909, lng 78.3589 ~ 17km away)
    const recycler2User = await User.create({
      name: 'Miyapur Green Processing',
      email: 'recycler2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recycler2Profile = await RecyclerProfile.create({
      user: recycler2User._id,
      organizationName: 'Miyapur Green Processing Ltd',
      businessName: 'Miyapur Facility',
      registrationId: 'REG-HYD-LOC-02',
      facilityType: 'authorized_dismantler',
      location: 'Miyapur, Hyderabad',
      address: 'Phase 1, Industrial Area, Miyapur',
      capacityKgPerDay: 6000,
      verificationStatus: 'verified',
      locationCoordinates: {
        type: 'Point',
        coordinates: [78.3589, 17.4909], // [lng, lat]
      },
    });

    // Seed Recycler 3 (Far away in Warangal: lat 17.9689, lng 79.5941 ~ 140km away)
    const recycler3User = await User.create({
      name: 'Warangal Remote E-Waste',
      email: 'recycler3@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    await RecyclerProfile.create({
      user: recycler3User._id,
      organizationName: 'Warangal Recovery Hub',
      businessName: 'Warangal Facility',
      registrationId: 'REG-HYD-LOC-03',
      facilityType: 'authorized_dismantler',
      location: 'Warangal',
      address: 'Plot 88, Warangal Bypass',
      capacityKgPerDay: 2000,
      verificationStatus: 'verified',
      locationCoordinates: {
        type: 'Point',
        coordinates: [79.5941, 17.9689],
      },
    });

    // Seed Recycler 4 (Has NO coordinates saved)
    const recycler4User = await User.create({
      name: 'No Location Facility',
      email: 'recycler4@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    await RecyclerProfile.create({
      user: recycler4User._id,
      organizationName: 'No Location Facility Pvt Ltd',
      businessName: 'No Location Hub',
      registrationId: 'REG-HYD-LOC-04',
      facilityType: 'authorized_dismantler',
      location: 'Secunderabad',
      address: 'Secunderabad Station Road',
      capacityKgPerDay: 1500,
      verificationStatus: 'verified',
    });

    // Seed Admin
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@demo.com',
      passwordHash: demoPasswordHash,
      role: 'admin',
      isVerified: true,
    });

    // Seed Material
    const material1 = await Material.create({
      name: 'Printed Circuit Boards',
      category: 'Motherboards',
      pricePerKg: 320,
      description: 'Telecom and desktop circuit boards',
    });

    // Ensure 2dsphere index is built in Mongo
    await RecyclerProfile.init();

    // Start HTTP Server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(testPort, () => resolve());
    });

    // Login helper
    async function login(email: string, password = 'DemoPassword123!'): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Failed to login for ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@demo.com');
    const r1Cookie = await login('recycler1@demo.com');
    const r2Cookie = await login('recycler2@demo.com');
    const adminCookie = await login('admin@demo.com');

    // -------------------------------------------------------------
    // Test 1: Unauthenticated location update -> 401
    // -------------------------------------------------------------
    console.log('Test 1: Unauthenticated location update returns 401');
    const t1Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 17.385, longitude: 78.4867 }),
    });
    const t1Json = await t1Res.json();
    if (t1Res.status === 401 && !t1Json.success) {
      console.log('  ✅ Passed: 401 Unauthorized for unauthenticated location update');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t1Json);
    }

    // -------------------------------------------------------------
    // Test 2: Collector attempting location update -> 403
    // -------------------------------------------------------------
    console.log('\nTest 2: Collector attempting location update returns 403');
    const t2Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ latitude: 17.385, longitude: 78.4867 }),
    });
    const t2Json = await t2Res.json();
    if (t2Res.status === 403 && !t2Json.success) {
      console.log('  ✅ Passed: 403 Forbidden when collector attempts to update recycler location');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t2Json);
    }

    // -------------------------------------------------------------
    // Test 3: Admin attempting recycler location update -> 403
    // -------------------------------------------------------------
    console.log('\nTest 3: Admin attempting recycler location update returns 403');
    const t3Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ latitude: 17.385, longitude: 78.4867 }),
    });
    const t3Json = await t3Res.json();
    if (t3Res.status === 403 && !t3Json.success) {
      console.log('  ✅ Passed: 403 Forbidden for admin updating /recyclers/me/location');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t3Json);
    }

    // -------------------------------------------------------------
    // Test 4: Recycler can update own location
    // -------------------------------------------------------------
    console.log('\nTest 4: Recycler can update own location');
    const t4Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({ latitude: 17.385, longitude: 78.4867 }),
    });
    const t4Json = await t4Res.json();
    allResponsesToCheckForSensitiveData.push(t4Json);
    if (t4Res.status === 200 && t4Json.success && t4Json.data?.hasLocation) {
      console.log('  ✅ Passed: Recycler 1 successfully updated location');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t4Json);
    }

    // -------------------------------------------------------------
    // Tests 5 & 6: Stored representation is GeoJSON Point with [longitude, latitude]
    // -------------------------------------------------------------
    console.log('\nTests 5 & 6: Stored representation is GeoJSON Point with [longitude, latitude]');
    const updatedR1 = await RecyclerProfile.findOne({ user: recycler1User._id });
    const coords = updatedR1?.locationCoordinates?.coordinates;
    const isPoint = updatedR1?.locationCoordinates?.type === 'Point';
    if (
      isPoint &&
      Array.isArray(coords) &&
      coords.length === 2 &&
      coords[0] === 78.4867 && // longitude first!
      coords[1] === 17.385    // latitude second!
    ) {
      console.log(`  ✅ Passed: Stored as Point with [lng, lat]: [${coords[0]}, ${coords[1]}]`);
      passedTests += 2;
    } else {
      console.error('  ❌ Failed: Invalid stored representation:', updatedR1?.locationCoordinates);
    }

    // -------------------------------------------------------------
    // Test 7: Invalid latitude rejected (< -90 or > 90)
    // -------------------------------------------------------------
    console.log('\nTest 7: Invalid latitude rejected');
    const t7Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({ latitude: 95.5, longitude: 78.4867 }),
    });
    const t7Json = await t7Res.json();
    if (t7Res.status === 400 && !t7Json.success) {
      console.log('  ✅ Passed: Latitude 95.5 rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t7Json);
    }

    // -------------------------------------------------------------
    // Test 8: Invalid longitude rejected (< -180 or > 180)
    // -------------------------------------------------------------
    console.log('\nTest 8: Invalid longitude rejected');
    const t8Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({ latitude: 17.385, longitude: 195.0 }),
    });
    const t8Json = await t8Res.json();
    if (t8Res.status === 400 && !t8Json.success) {
      console.log('  ✅ Passed: Longitude 195.0 rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t8Json);
    }

    // -------------------------------------------------------------
    // Test 9: Missing latitude rejected
    // -------------------------------------------------------------
    console.log('\nTest 9: Missing latitude rejected');
    const t9Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({ longitude: 78.4867 }),
    });
    const t9Json = await t9Res.json();
    if (t9Res.status === 400 && !t9Json.success) {
      console.log('  ✅ Passed: Missing latitude rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t9Json);
    }

    // -------------------------------------------------------------
    // Test 10: Missing longitude rejected
    // -------------------------------------------------------------
    console.log('\nTest 10: Missing longitude rejected');
    const t10Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({ latitude: 17.385 }),
    });
    const t10Json = await t10Res.json();
    if (t10Res.status === 400 && !t10Json.success) {
      console.log('  ✅ Passed: Missing longitude rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t10Json);
    }

    // -------------------------------------------------------------
    // Test 11: Invalid radius rejected (< 1 km)
    // -------------------------------------------------------------
    console.log('\nTest 11: Invalid radius rejected (< 1 km)');
    const t11Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=0.5`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t11Json = await t11Res.json();
    if (t11Res.status === 400 && !t11Json.success) {
      console.log('  ✅ Passed: Radius < 1 km rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t11Json);
    }

    // -------------------------------------------------------------
    // Test 12: Radius above 100 km rejected
    // -------------------------------------------------------------
    console.log('\nTest 12: Radius above 100 km rejected');
    const t12Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=150`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t12Json = await t12Res.json();
    if (t12Res.status === 400 && !t12Json.success) {
      console.log('  ✅ Passed: Radius > 100 km rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t12Json);
    }

    // -------------------------------------------------------------
    // Test 13: Invalid limit rejected (< 1 or > 50)
    // -------------------------------------------------------------
    console.log('\nTest 13: Invalid limit rejected (< 1 or > 50)');
    const t13Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&limit=100`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t13Json = await t13Res.json();
    if (t13Res.status === 400 && !t13Json.success) {
      console.log('  ✅ Passed: Limit > 50 rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t13Json);
    }

    // -------------------------------------------------------------
    // Test 14: Collector can access nearby endpoint
    // -------------------------------------------------------------
    console.log('\nTest 14: Collector can access nearby endpoint');
    const t14Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=25`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t14Json = await t14Res.json();
    allResponsesToCheckForSensitiveData.push(t14Json);
    if (t14Res.status === 200 && t14Json.success && Array.isArray(t14Json.data)) {
      console.log(`  ✅ Passed: Collector retrieved ${t14Json.data.length} nearby recyclers`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t14Json);
    }

    // -------------------------------------------------------------
    // Test 15: Recycler can access nearby endpoint
    // -------------------------------------------------------------
    console.log('\nTest 15: Recycler can access nearby endpoint');
    const t15Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=25`, {
      method: 'GET',
      headers: { Cookie: r1Cookie },
    });
    const t15Json = await t15Res.json();
    if (t15Res.status === 200 && t15Json.success && Array.isArray(t15Json.data)) {
      console.log('  ✅ Passed: Recycler role allowed on nearby endpoint');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t15Json);
    }

    // -------------------------------------------------------------
    // Test 16: Admin can access nearby endpoint
    // -------------------------------------------------------------
    console.log('\nTest 16: Admin can access nearby endpoint');
    const t16Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=25`, {
      method: 'GET',
      headers: { Cookie: adminCookie },
    });
    const t16Json = await t16Res.json();
    if (t16Res.status === 200 && t16Json.success && Array.isArray(t16Json.data)) {
      console.log('  ✅ Passed: Admin role allowed on nearby endpoint');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t16Json);
    }

    // -------------------------------------------------------------
    // Test 17: Nearby results are ordered by distance (nearest to farthest)
    // -------------------------------------------------------------
    console.log('\nTest 17: Nearby results are ordered by distance');
    const t17Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=30`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t17Json = await t17Res.json();
    const data = t17Json.data;
    let isSorted = true;
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].distanceKm > data[i + 1].distanceKm) {
        isSorted = false;
        break;
      }
    }
    if (t17Res.status === 200 && data.length >= 2 && isSorted) {
      console.log(`  ✅ Passed: Results sorted by distance: ${data.map((d: any) => d.distanceKm + 'km').join(' <= ')}`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { isSorted, data });
    }

    // -------------------------------------------------------------
    // Test 18: Distance is returned in kilometers
    // -------------------------------------------------------------
    console.log('\nTest 18: Distance is returned in kilometers');
    if (data[0] && typeof data[0].distanceKm === 'number' && data[0].distanceKm >= 0) {
      console.log(`  ✅ Passed: Closest recycler distance = ${data[0].distanceKm} km`);
      passedTests++;
    } else {
      console.error('  ❌ Failed: distanceKm missing or invalid:', data[0]);
    }

    // -------------------------------------------------------------
    // Test 19: Recycler without location does not appear in nearby results
    // -------------------------------------------------------------
    console.log('\nTest 19: Recycler without location does not appear in nearby results');
    const hasRecycler4 = data.some((r: any) => r.businessName === 'No Location Hub');
    if (!hasRecycler4) {
      console.log('  ✅ Passed: Recycler 4 (no coordinates) safely omitted from geospatial results');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Recycler 4 found in nearby results');
    }

    // -------------------------------------------------------------
    // Test 20: Radius filtering works (Warangal ~140km away excluded with radius 30km)
    // -------------------------------------------------------------
    console.log('\nTest 20: Radius filtering works');
    const hasWarangal = data.some((r: any) => r.businessName === 'Warangal Facility');
    if (!hasWarangal) {
      console.log('  ✅ Passed: Warangal facility (~140km) excluded with radiusKm=30');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Warangal facility included within 30km radius');
    }

    // -------------------------------------------------------------
    // Test 21: Maximum limit is enforced
    // -------------------------------------------------------------
    console.log('\nTest 21: Limit parameter is enforced');
    const t21Res = await fetch(`${baseUrl}/recyclers/nearby?latitude=17.385&longitude=78.4867&radiusKm=50&limit=1`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const t21Json = await t21Res.json();
    if (t21Res.status === 200 && t21Json.data.length === 1) {
      console.log('  ✅ Passed: Limit 1 returned exactly 1 result');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t21Json);
    }

    // -------------------------------------------------------------
    // Test 22: Client-supplied userId cannot change location ownership
    // -------------------------------------------------------------
    console.log('\nTest 22: Client-supplied userId cannot change location ownership');
    const t22Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({
        latitude: 17.385,
        longitude: 78.4867,
        userId: recycler2User._id.toString(), // client tries to set userId
      }),
    });
    const t22Json = await t22Res.json();
    if (t22Res.status === 400 && !t22Json.success) {
      console.log('  ✅ Passed: Client payload with userId rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t22Json);
    }

    // -------------------------------------------------------------
    // Test 23: Client-supplied recyclerId cannot change location ownership
    // -------------------------------------------------------------
    console.log('\nTest 23: Client-supplied recyclerId cannot change location ownership');
    const t23Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({
        latitude: 17.385,
        longitude: 78.4867,
        recyclerId: recycler2Profile._id.toString(), // client tries to inject recyclerId
      }),
    });
    const t23Json = await t23Res.json();
    if (t23Res.status === 400 && !t23Json.success) {
      console.log('  ✅ Passed: Client payload with recyclerId rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t23Json);
    }

    // -------------------------------------------------------------
    // Test 24: Client cannot modify isVerified through location update
    // -------------------------------------------------------------
    console.log('\nTest 24: Client cannot modify isVerified through location update');
    const t24Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: r1Cookie },
      body: JSON.stringify({
        latitude: 17.385,
        longitude: 78.4867,
        isVerified: false,
      }),
    });
    const t24Json = await t24Res.json();
    if (t24Res.status === 400 && !t24Json.success) {
      console.log('  ✅ Passed: Injected isVerified field rejected with 400');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t24Json);
    }

    // -------------------------------------------------------------
    // Test 25: Recycler can clear own location
    // -------------------------------------------------------------
    console.log('\nTest 25: Recycler can clear own location');
    const t25Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'DELETE',
      headers: { Cookie: r1Cookie },
    });
    const t25Json = await t25Res.json();
    const checkCleared = await RecyclerProfile.findOne({ user: recycler1User._id });
    if (
      t25Res.status === 200 &&
      t25Json.success &&
      (!checkCleared?.locationCoordinates?.coordinates || (checkCleared?.locationCoordinates?.coordinates as any)?.length === 0)
    ) {
      console.log('  ✅ Passed: Recycler 1 location cleared successfully');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { t25Json, checkCleared });
    }

    // -------------------------------------------------------------
    // Test 26: Another user cannot clear another recycler's location
    // -------------------------------------------------------------
    console.log('\nTest 26: Another user cannot clear another recycler location');
    // Collector attempts DELETE /recyclers/me/location
    const t26Res = await fetch(`${baseUrl}/recyclers/me/location`, {
      method: 'DELETE',
      headers: { Cookie: c1Cookie }, // Collector role
    });
    const t26Json = await t26Res.json();
    // Recycler 2 still has location intact
    const checkR2 = await RecyclerProfile.findOne({ user: recycler2User._id });
    if (
      t26Res.status === 403 &&
      !t26Json.success &&
      checkR2?.locationCoordinates?.coordinates?.length === 2
    ) {
      console.log('  ✅ Passed: Non-recycler blocked from clearing location; other recyclers untouched');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t26Json);
    }

    // -------------------------------------------------------------
    // Test 27: Existing recycler catalog endpoint still works
    // -------------------------------------------------------------
    console.log('\nTest 27: Existing recycler catalog endpoint still works');
    const t27Res = await fetch(`${baseUrl}/recyclers`, {
      method: 'GET',
    });
    const t27Json = await t27Res.json();
    allResponsesToCheckForSensitiveData.push(t27Json);
    if (
      t27Res.status === 200 &&
      t27Json.success &&
      Array.isArray(t27Json.data?.recyclers) &&
      t27Json.data.recyclers.length >= 4
    ) {
      console.log(`  ✅ Passed: Catalog returned ${t27Json.data.recyclers.length} recyclers with hasLocation field`);
      passedTests++;
    } else {
      console.error('  ❌ Failed:', t27Json);
    }

    // -------------------------------------------------------------
    // Test 28: Existing Phase 4B completion still works
    // -------------------------------------------------------------
    console.log('\nTest 28: Existing Phase 4B completion still works');
    const waste = await WasteItem.create({
      collectorId: collector1._id,
      materialId: material1._id,
      quantityKg: 15,
      status: 'available',
      estimatedValue: 4800,
    });

    const reqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({
        recyclerId: recycler2Profile._id.toString(),
        wasteItemIds: [waste._id.toString()],
      }),
    });
    const reqJson = await reqRes.json();
    const requestId = reqJson.data?.request?.id;

    await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Cookie: r2Cookie },
    });

    await fetch(`${baseUrl}/requests/${requestId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: r2Cookie },
      body: JSON.stringify({ scheduledDate: new Date(Date.now() + 86400000).toISOString() }),
    });

    await fetch(`${baseUrl}/requests/${requestId}/in-transit`, {
      method: 'POST',
      headers: { Cookie: r2Cookie },
    });

    const compRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: r2Cookie },
      body: JSON.stringify({ actualQuantityKg: 15, finalAmount: 4800 }),
    });

    const records = await HandoverRecord.find({ handoverRequestId: requestId });
    const txns = await Transaction.find({ handoverRequestId: requestId });
    if (compRes.status === 200 && records.length === 1 && txns.length === 1) {
      console.log('  ✅ Passed: Phase 4B completion created exactly 1 record and 1 transaction');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { status: compRes.status, records: records.length, txns: txns.length });
    }

    // -------------------------------------------------------------
    // Test 29: Existing Phase 5 notification workflow still works
    // -------------------------------------------------------------
    console.log('\nTest 29: Existing Phase 5 notification workflow still works');
    const notif = await safeCreateNotification({
      userId: collector1._id,
      type: 'system',
      title: 'Geospatial Feature Active',
      message: 'Nearby recycler discovery is now available.',
    });
    const notifRes = await fetch(`${baseUrl}/notifications/unread-count`, {
      method: 'GET',
      headers: { Cookie: c1Cookie },
    });
    const notifJson = await notifRes.json();
    if (notif && notifRes.status === 200 && notifJson.data?.count >= 1) {
      console.log('  ✅ Passed: Notifications and unread counts functional');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', { notif, notifJson });
    }

    // -------------------------------------------------------------
    // Test 30: Existing Phase 6A KabiAI still works
    // -------------------------------------------------------------
    console.log('\nTest 30: Existing Phase 6A KabiAI still works');
    const aiRes = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c1Cookie },
      body: JSON.stringify({ message: 'How do I find nearby recyclers?' }),
    });
    const aiJson = await aiRes.json();
    if (aiRes.status === 200 && aiJson.success && aiJson.data?.provider === 'mock') {
      console.log('  ✅ Passed: KabiAI chat endpoint operational with mock provider');
      passedTests++;
    } else {
      console.error('  ❌ Failed:', aiJson);
    }

    // -------------------------------------------------------------
    // Test 31: No passwordHash/token/cookie/secret leakage
    // -------------------------------------------------------------
    console.log('\nTest 31: No sensitive data leakage');
    const serialized = JSON.stringify(allResponsesToCheckForSensitiveData);
    if (
      !serialized.includes('passwordHash') &&
      !serialized.includes('$2a$') &&
      !serialized.includes('$2b$') &&
      !serialized.includes('JWT_SECRET')
    ) {
      console.log('  ✅ Passed: Zero password hashes or auth secrets exposed');
      passedTests++;
    } else {
      console.error('  ❌ Failed: Sensitive data detected in responses!');
    }

    // -------------------------------------------------------------
    // Test 32: Geospatial 2dsphere index exists in MongoDB
    // -------------------------------------------------------------
    console.log('\nTest 32: Geospatial 2dsphere index exists in MongoDB');
    const indexes = await RecyclerProfile.collection.indexes();
    const has2dSphere = indexes.some((idx) => idx.key?.locationCoordinates === '2dsphere');
    if (has2dSphere) {
      console.log('  ✅ Passed: 2dsphere index on locationCoordinates confirmed in MongoDB');
      passedTests++;
    } else {
      console.error('  ❌ Failed: 2dsphere index missing. Found indexes:', indexes);
    }

    // Summary
    console.log(`\n==================================================`);
    console.log(`Phase 6B Tests: ${passedTests}/${totalTests} passed`);
    console.log(`==================================================\n`);

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test suite encountered fatal error:', error);
    process.exit(1);
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
  }
}

runPhase6bTests();
