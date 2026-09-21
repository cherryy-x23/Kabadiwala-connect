import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app';
import { User } from '../src/models/User';
import { CollectorProfile } from '../src/models/CollectorProfile';
import { RecyclerProfile } from '../src/models/RecyclerProfile';
import { Material } from '../src/models/Material';
import { WasteItem } from '../src/models/WasteItem';
import { HandoverRequest } from '../src/models/HandoverRequest';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase4aTests() {
  console.log('🧪 Starting Phase 4A Core Handover Request Workflow Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5996;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 24; // Functional Phase 4A unit & integration tests
  const allResponsesToCheckForPasswordHash: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Users:
    // Collector 1
    const collector1 = await User.create({
      name: 'Ravi Kumar (Collector 1)',
      email: 'collector1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector1._id });

    // Collector 2
    const collector2 = await User.create({
      name: 'Sita Sharma (Collector 2)',
      email: 'collector2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
    });
    await CollectorProfile.create({ user: collector2._id });

    // Recycler 1
    const recyclerUser1 = await User.create({
      name: 'EcoGreen Recyclers (Recycler 1)',
      email: 'recycler1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile1 = await RecyclerProfile.create({
      user: recyclerUser1._id,
      organizationName: 'EcoGreen Recyclers Pvt Ltd',
      businessName: 'EcoGreen Recyclers',
      registrationId: 'REG-HYD-001',
      facilityType: 'authorized_dismantler',
      location: 'Cherlapally, Hyderabad',
      address: 'Plot 42, IDA Cherlapally, Hyderabad, Telangana',
      capacityKgPerDay: 2500,
      verificationStatus: 'verified',
    });

    // Recycler 2
    const recyclerUser2 = await User.create({
      name: 'Apex Waste Solutions (Recycler 2)',
      email: 'recycler2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
    });
    const recyclerProfile2 = await RecyclerProfile.create({
      user: recyclerUser2._id,
      organizationName: 'Apex Solutions Pvt Ltd',
      businessName: 'Apex Waste Solutions',
      registrationId: 'REG-HYD-002',
      facilityType: 'authorized_recycler',
      location: 'Nacharam, Hyderabad',
      address: 'Plot 88, IDA Nacharam, Hyderabad, Telangana',
      capacityKgPerDay: 5000,
      verificationStatus: 'verified',
    });

    // Materials
    const copper = await Material.create({
      name: 'Copper Wire Grade A',
      category: 'Metals',
      pricePerKg: 450,
      unit: 'kg',
      isActive: true,
    });

    const battery = await Material.create({
      name: 'Lithium-ion Battery Pack',
      category: 'Batteries',
      pricePerKg: 180,
      unit: 'kg',
      isActive: true,
    });

    const pcb = await Material.create({
      name: 'High-Grade Computer PCBs',
      category: 'Circuit Boards',
      pricePerKg: 250,
      unit: 'kg',
      isActive: true,
    });

    // Waste Items for Collector 1
    const wasteC1_1 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: copper._id,
      quantityKg: 10,
      estimatedPricePerKg: 450,
      estimatedValue: 4500,
      status: 'available',
    });

    const wasteC1_2 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: battery._id,
      quantityKg: 5,
      estimatedPricePerKg: 180,
      estimatedValue: 900,
      status: 'available',
    });

    const wasteC1_3 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: pcb._id,
      quantityKg: 8,
      estimatedPricePerKg: 250,
      estimatedValue: 2000,
      status: 'available',
    });

    // Waste Item for Collector 2
    const wasteC2_1 = await WasteItem.create({
      collectorId: collector2._id,
      materialId: copper._id,
      quantityKg: 20,
      estimatedPricePerKg: 450,
      estimatedValue: 9000,
      status: 'available',
    });

    // Start Express server on test port
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    // Helper login to get cookies
    async function login(email: string): Promise<string> {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'DemoPassword123!' }),
      });
      const data = await res.json();
      allResponsesToCheckForPasswordHash.push(data);
      const cookie = extractTokenCookie(res);
      if (!cookie) throw new Error(`Failed to login as ${email}`);
      return cookie;
    }

    const c1Cookie = await login('collector1@demo.com');
    const c2Cookie = await login('collector2@demo.com');
    const r1Cookie = await login('recycler1@demo.com');
    const r2Cookie = await login('recycler2@demo.com');

    // -------------------------------------------------------------
    // Test 1: Collector can create handover request
    // -------------------------------------------------------------
    const createRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [wasteC1_1._id.toString(), wasteC1_2._id.toString()],
        requestedDate: '2026-09-25',
        notes: 'Please arrange pickup at 10 AM',
        collectorMessage: 'Fragile lithium batteries inside',
      }),
    });
    const createData = await createRes.json();
    allResponsesToCheckForPasswordHash.push(createData);

    const requestId1 = createData.data?.request?.id || createData.data?.request?._id;
    if (createRes.status === 201 && createData.success && requestId1) {
      console.log('✅ Test 1 Passed: Collector can create handover request');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Could not create handover request', createData);
    }

    // -------------------------------------------------------------
    // Test 2: Request status starts as pending
    // -------------------------------------------------------------
    if (createData.data?.request?.status === 'pending') {
      console.log('✅ Test 2 Passed: Request status starts as pending');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Initial status is not pending', createData);
    }

    // -------------------------------------------------------------
    // Test 3: Server calculates totalQuantityKg correctly
    // -------------------------------------------------------------
    // wasteC1_1 (10kg) + wasteC1_2 (5kg) = 15kg
    if (createData.data?.request?.totalQuantityKg === 15) {
      console.log('✅ Test 3 Passed: Server correctly calculates totalQuantityKg (15kg)');
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed: totalQuantityKg mismatch', createData.data?.request?.totalQuantityKg);
    }

    // -------------------------------------------------------------
    // Test 4: Server calculates total estimatedValue correctly
    // -------------------------------------------------------------
    // 4500 + 900 = 5400
    if (createData.data?.request?.estimatedValue === 5400) {
      console.log('✅ Test 4 Passed: Server correctly calculates estimatedValue (₹5400)');
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: estimatedValue mismatch', createData.data?.request?.estimatedValue);
    }

    // -------------------------------------------------------------
    // Test 5 & 6: Client cannot override totalQuantityKg or estimatedValue
    // -------------------------------------------------------------
    const spoofRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [wasteC1_3._id.toString()], // 8kg, ₹2000
        totalQuantityKg: 99999, // Attempted spoof
        estimatedValue: 1, // Attempted spoof
        status: 'completed', // Attempted spoof
        collectorId: collector2._id.toString(), // Attempted spoof
      }),
    });
    const spoofData = await spoofRes.json();
    allResponsesToCheckForPasswordHash.push(spoofData);

    if (spoofRes.status === 400 && !spoofData.success) {
      console.log('✅ Tests 5 & 6 Passed: Client cannot override totalQuantityKg, estimatedValue, collectorId, or status (Rejected with 400)');
      passedTests += 2;
    } else {
      console.error('❌ Tests 5 & 6 Failed: Client override was not prevented', spoofData);
    }

    // Create a legitimate second request for wasteC1_3 to use in rejection tests
    const req2Res = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [wasteC1_3._id.toString()],
        notes: 'Second request for PCB boards',
      }),
    });
    const req2Data = await req2Res.json();
    allResponsesToCheckForPasswordHash.push(req2Data);
    const requestId2 = req2Data.data?.request?.id || req2Data.data?.request?._id;

    // -------------------------------------------------------------
    // Test 7: Collector cannot use another collector's waste
    // -------------------------------------------------------------
    const crossWasteRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile1._id.toString(),
        wasteItemIds: [wasteC2_1._id.toString()], // Belongs to collector 2!
      }),
    });
    const crossWasteData = await crossWasteRes.json();
    allResponsesToCheckForPasswordHash.push(crossWasteData);

    if (crossWasteRes.status === 403 && !crossWasteData.success) {
      console.log("✅ Test 7 Passed: Collector cannot use another collector's waste (403 Forbidden)");
      passedTests++;
    } else {
      console.error("❌ Test 7 Failed: Allowed unauthorized collector's waste", crossWasteData);
    }

    // -------------------------------------------------------------
    // Test 8 & 24: Collector cannot use already requested active waste (duplicate active request rejected)
    // -------------------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile2._id.toString(),
        wasteItemIds: [wasteC1_1._id.toString()], // Already in requestId1 ('pending')
      }),
    });
    const dupData = await dupRes.json();
    allResponsesToCheckForPasswordHash.push(dupData);

    if (dupRes.status === 400 && !dupData.success) {
      console.log('✅ Tests 8 & 24 Passed: Duplicate active request for already requested waste is rejected (400)');
      passedTests += 2;
    } else {
      console.error('❌ Tests 8 & 24 Failed: Allowed duplicate active request on same waste', dupData);
    }

    // -------------------------------------------------------------
    // Test 9: Collector cannot create request for invalid recycler
    // -------------------------------------------------------------
    const fakeRecyclerId = new mongoose.Types.ObjectId().toString();
    const fakeRecyclerRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c1Cookie,
      },
      body: JSON.stringify({
        recyclerId: fakeRecyclerId,
        wasteItemIds: [wasteC1_3._id.toString()],
      }),
    });
    const fakeRecyclerData = await fakeRecyclerRes.json();
    allResponsesToCheckForPasswordHash.push(fakeRecyclerData);

    if (fakeRecyclerRes.status === 400 && !fakeRecyclerData.success) {
      console.log('✅ Test 9 Passed: Collector cannot create request for non-existent recycler (400)');
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: Handled invalid recycler incorrectly', fakeRecyclerData);
    }

    // -------------------------------------------------------------
    // Test 10: Collector can view own requests
    // -------------------------------------------------------------
    const myRequestsRes = await fetch(`${baseUrl}/requests/my`, {
      headers: { Cookie: c1Cookie },
    });
    const myRequestsData = await myRequestsRes.json();
    allResponsesToCheckForPasswordHash.push(myRequestsData);

    if (
      myRequestsRes.status === 200 &&
      myRequestsData.success &&
      Array.isArray(myRequestsData.data?.requests) &&
      myRequestsData.data.requests.length >= 2
    ) {
      console.log('✅ Test 10 Passed: Collector can view own requests');
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Could not get collector requests', myRequestsData);
    }

    // -------------------------------------------------------------
    // Test 11: Collector cannot view another collector's request
    // -------------------------------------------------------------
    const c2ViewC1Res = await fetch(`${baseUrl}/requests/${requestId1}`, {
      headers: { Cookie: c2Cookie }, // Collector 2 trying to view Collector 1's request
    });
    const c2ViewC1Data = await c2ViewC1Res.json();
    allResponsesToCheckForPasswordHash.push(c2ViewC1Data);

    if (c2ViewC1Res.status === 403 && !c2ViewC1Data.success) {
      console.log("✅ Test 11 Passed: Collector cannot view another collector's request (403)");
      passedTests++;
    } else {
      console.error("❌ Test 11 Failed: Collector viewed another collector's request", c2ViewC1Data);
    }

    // -------------------------------------------------------------
    // Test 12: Recycler can view incoming requests
    // -------------------------------------------------------------
    const r1IncomingRes = await fetch(`${baseUrl}/requests/incoming`, {
      headers: { Cookie: r1Cookie },
    });
    const r1IncomingData = await r1IncomingRes.json();
    allResponsesToCheckForPasswordHash.push(r1IncomingData);

    if (
      r1IncomingRes.status === 200 &&
      r1IncomingData.success &&
      Array.isArray(r1IncomingData.data?.requests) &&
      r1IncomingData.data.requests.some((r: any) => r.id === requestId1 || r._id === requestId1)
    ) {
      console.log('✅ Test 12 Passed: Recycler can view incoming requests');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Recycler could not view incoming requests', r1IncomingData);
    }

    // -------------------------------------------------------------
    // Test 13: Recycler cannot view another recycler's request
    // -------------------------------------------------------------
    const r2ViewR1Res = await fetch(`${baseUrl}/requests/${requestId1}`, {
      headers: { Cookie: r2Cookie }, // Recycler 2 trying to view request addressed to Recycler 1
    });
    const r2ViewR1Data = await r2ViewR1Res.json();
    allResponsesToCheckForPasswordHash.push(r2ViewR1Data);

    if (r2ViewR1Res.status === 403 && !r2ViewR1Data.success) {
      console.log("✅ Test 13 Passed: Recycler cannot view another recycler's request (403)");
      passedTests++;
    } else {
      console.error("❌ Test 13 Failed: Recycler viewed another recycler's request", r2ViewR1Data);
    }

    // -------------------------------------------------------------
    // Test 15: Non-target recycler cannot accept
    // -------------------------------------------------------------
    const r2AcceptR1Res = await fetch(`${baseUrl}/requests/${requestId1}/accept`, {
      method: 'POST',
      headers: { Cookie: r2Cookie },
    });
    const r2AcceptR1Data = await r2AcceptR1Res.json();
    allResponsesToCheckForPasswordHash.push(r2AcceptR1Data);

    if (r2AcceptR1Res.status === 403 && !r2AcceptR1Data.success) {
      console.log('✅ Test 15 Passed: Non-target recycler cannot accept request (403)');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Non-target recycler was able to accept', r2AcceptR1Data);
    }

    // -------------------------------------------------------------
    // Test 14: Target recycler can accept pending request
    // -------------------------------------------------------------
    const r1AcceptRes = await fetch(`${baseUrl}/requests/${requestId1}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const r1AcceptData = await r1AcceptRes.json();
    allResponsesToCheckForPasswordHash.push(r1AcceptData);

    if (
      r1AcceptRes.status === 200 &&
      r1AcceptData.success &&
      r1AcceptData.data?.request?.status === 'accepted'
    ) {
      console.log('✅ Test 14 Passed: Target recycler can accept pending request (status -> accepted)');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Target recycler could not accept request', r1AcceptData);
    }

    // -------------------------------------------------------------
    // Test 16: Target recycler can reject pending request (on requestId2)
    // -------------------------------------------------------------
    const r1RejectRes = await fetch(`${baseUrl}/requests/${requestId2}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({
        reason: 'Currently at full capacity for circuit boards',
      }),
    });
    const r1RejectData = await r1RejectRes.json();
    allResponsesToCheckForPasswordHash.push(r1RejectData);

    if (
      r1RejectRes.status === 200 &&
      r1RejectData.success &&
      r1RejectData.data?.request?.status === 'rejected'
    ) {
      console.log('✅ Test 16 Passed: Target recycler can reject pending request with reason');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed: Target recycler could not reject request', r1RejectData);
    }

    // -------------------------------------------------------------
    // Test 17: Invalid status transition is rejected (e.g. rejected -> accepted)
    // -------------------------------------------------------------
    const invalidTransitionRes = await fetch(`${baseUrl}/requests/${requestId2}/accept`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const invalidTransitionData = await invalidTransitionRes.json();
    allResponsesToCheckForPasswordHash.push(invalidTransitionData);

    if (invalidTransitionRes.status === 400 && !invalidTransitionData.success) {
      console.log('✅ Test 17 Passed: Invalid status transition (rejected -> accepted) is rejected with 400');
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed: Allowed invalid status transition', invalidTransitionData);
    }

    // -------------------------------------------------------------
    // Test 19: Past scheduled date is rejected
    // -------------------------------------------------------------
    const pastScheduleRes = await fetch(`${baseUrl}/requests/${requestId1}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({
        scheduledDate: '2020-01-01',
      }),
    });
    const pastScheduleData = await pastScheduleRes.json();
    allResponsesToCheckForPasswordHash.push(pastScheduleData);

    if (pastScheduleRes.status === 400 && !pastScheduleData.success) {
      console.log('✅ Test 19 Passed: Past scheduled date is rejected (400)');
      passedTests++;
    } else {
      console.error('❌ Test 19 Failed: Past scheduled date was accepted', pastScheduleData);
    }

    // -------------------------------------------------------------
    // Test 18: Accepted request can be scheduled with future date
    // -------------------------------------------------------------
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const validScheduleDate = futureDate.toISOString().split('T')[0];

    const scheduleRes = await fetch(`${baseUrl}/requests/${requestId1}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({
        scheduledDate: validScheduleDate,
      }),
    });
    const scheduleData = await scheduleRes.json();
    allResponsesToCheckForPasswordHash.push(scheduleData);

    if (
      scheduleRes.status === 200 &&
      scheduleData.success &&
      scheduleData.data?.request?.status === 'scheduled'
    ) {
      console.log('✅ Test 18 Passed: Accepted request can be scheduled (status -> scheduled)');
      passedTests++;
    } else {
      console.error('❌ Test 18 Failed: Could not schedule accepted request', scheduleData);
    }

    // -------------------------------------------------------------
    // Test 23: Cancellation after scheduled is rejected
    // -------------------------------------------------------------
    const cancelScheduledRes = await fetch(`${baseUrl}/requests/${requestId1}/cancel`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const cancelScheduledData = await cancelScheduledRes.json();
    allResponsesToCheckForPasswordHash.push(cancelScheduledData);

    if (cancelScheduledRes.status === 400 && !cancelScheduledData.success) {
      console.log('✅ Test 23 Passed: Cancellation after scheduled is rejected with 400');
      passedTests++;
    } else {
      console.error('❌ Test 23 Failed: Allowed cancellation of scheduled request', cancelScheduledData);
    }

    // -------------------------------------------------------------
    // Test 20: Scheduled request can move to in_transit
    // -------------------------------------------------------------
    const inTransitRes = await fetch(`${baseUrl}/requests/${requestId1}/in-transit`, {
      method: 'POST',
      headers: { Cookie: c1Cookie }, // Collector marks in-transit
    });
    const inTransitData = await inTransitRes.json();
    allResponsesToCheckForPasswordHash.push(inTransitData);

    if (
      inTransitRes.status === 200 &&
      inTransitData.success &&
      inTransitData.data?.request?.status === 'in_transit'
    ) {
      console.log('✅ Test 20 Passed: Scheduled request can move to in_transit');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: Could not move scheduled request to in_transit', inTransitData);
    }

    // -------------------------------------------------------------
    // Test 21: Unauthorized user cannot move request status
    // -------------------------------------------------------------
    const unauthMoveRes = await fetch(`${baseUrl}/requests/${requestId1}/in-transit`, {
      method: 'POST',
      headers: { Cookie: c2Cookie }, // Collector 2 (unrelated user)
    });
    const unauthMoveData = await unauthMoveRes.json();
    allResponsesToCheckForPasswordHash.push(unauthMoveData);

    if (unauthMoveRes.status === 403 && !unauthMoveData.success) {
      console.log('✅ Test 21 Passed: Unauthorized user cannot move request status (403)');
      passedTests++;
    } else {
      console.error('❌ Test 21 Failed: Unauthorized user changed status', unauthMoveData);
    }

    // -------------------------------------------------------------
    // Test 22: Collector can cancel allowed request (create new request and cancel while pending)
    // -------------------------------------------------------------
    // Create new request for wasteC2_1 from Collector 2
    const c2ReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: c2Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile2._id.toString(),
        wasteItemIds: [wasteC2_1._id.toString()],
        notes: 'Testing cancellation flow',
      }),
    });
    const c2ReqData = await c2ReqRes.json();
    allResponsesToCheckForPasswordHash.push(c2ReqData);
    const requestId3 = c2ReqData.data?.request?.id || c2ReqData.data?.request?._id;

    const cancelRes = await fetch(`${baseUrl}/requests/${requestId3}/cancel`, {
      method: 'POST',
      headers: { Cookie: c2Cookie },
    });
    const cancelData = await cancelRes.json();
    allResponsesToCheckForPasswordHash.push(cancelData);

    if (
      cancelRes.status === 200 &&
      cancelData.success &&
      cancelData.data?.request?.status === 'cancelled'
    ) {
      console.log('✅ Test 22 Passed: Collector can cancel allowed (pending) request');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Could not cancel pending request', cancelData);
    }

    // -------------------------------------------------------------
    // Test 29: passwordHash is never exposed in any API responses
    // -------------------------------------------------------------
    let passwordHashExposed = false;
    const jsonStrings = allResponsesToCheckForPasswordHash.map((r) => JSON.stringify(r));
    for (const json of jsonStrings) {
      if (json.includes('passwordHash') || json.includes('$2a$') || json.includes('$2b$')) {
        passwordHashExposed = true;
        break;
      }
    }

    if (!passwordHashExposed) {
      console.log('✅ Test 29 Passed: passwordHash is NEVER exposed in any API response body');
    } else {
      console.error('❌ Test 29 Failed: passwordHash was found leaked in API response!');
      throw new Error('Security violation: passwordHash exposed');
    }

    console.log(`\n🎉 Phase 4A Core Handover Request Tests Passed: ${passedTests}/${totalTests}`);

    if (passedTests !== totalTests) {
      throw new Error(`Only ${passedTests}/${totalTests} tests passed`);
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase4aTests()
  .then(() => {
    console.log('All Phase 4A tests finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
