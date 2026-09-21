import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import path from 'path';
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

async function runPhase7bTests() {
  console.log('🧪 Starting Phase 7B Real Waste + Handover Workflow Integration Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5994;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 20;

  try {
    // 0. Set up in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('demo123', salt);

    // Seed collector
    const collectorUser = await User.create({
      name: 'Ravi Kumar',
      email: 'ravi@demo.com',
      passwordHash,
      role: 'collector',
      phone: '+91 9876543210',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await CollectorProfile.create({
      user: collectorUser._id,
      dailyCapacityKg: 50,
      serviceAreas: ['Charminar', 'Koti'],
    });

    // Seed recycler
    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling',
      email: 'greencycle@demo.com',
      passwordHash,
      role: 'recycler',
      phone: '+91 9876543211',
      isVerified: true,
      verificationStatus: 'verified',
    });

    const recyclerProfile = await RecyclerProfile.create({
      user: recyclerUser._id,
      organizationName: 'GreenCycle Facility',
      registrationId: 'GR-HYD-2026-001',
      acceptedMaterials: ['Printed Circuit Boards (Grade A)', 'Copper Wire & Cables', 'Lithium Batteries'],
      operatingHours: '9 AM - 6 PM, Mon-Sat',
    });

    // Seed another collector (for cross-user ownership tests)
    const otherCollector = await User.create({
      name: 'Other Collector',
      email: 'other@demo.com',
      passwordHash,
      role: 'collector',
      phone: '+91 9876543299',
      isVerified: true,
      verificationStatus: 'verified',
    });

    // Seed test materials
    const pcbMaterial = await Material.create({
      name: 'Printed Circuit Boards (Grade A)',
      category: 'Computers & Laptops',
      unit: 'kg',
      pricePerKg: 350,
      indicativePrice: 350,
      priceTrend: 'up',
      description: 'Computer and server motherboards.',
      isActive: true,
    });

    const copperMaterial = await Material.create({
      name: 'Copper Wire & Cables',
      category: 'Cables & Wires',
      unit: 'kg',
      pricePerKg: 420,
      indicativePrice: 420,
      priceTrend: 'up',
      description: 'Insulated copper cables.',
      isActive: true,
    });

    // Start Express server
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    console.log(`🚀 Test server listening on ${baseUrl}\n`);

    // =========================================================================
    // Test 1: Collector Authentication & Token Cookie
    // =========================================================================
    const colLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ravi@demo.com', password: 'demo123' }),
    });
    const colCookie = extractTokenCookie(colLoginRes);
    if (colLoginRes.status === 200 && colCookie) {
      console.log('✅ Test 1 Passed: Collector authenticated via HttpOnly cookie');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Collector login failed');
    }

    // =========================================================================
    // Test 2: Recycler Authentication & Token Cookie
    // =========================================================================
    const recLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'greencycle@demo.com', password: 'demo123' }),
    });
    const recCookie = extractTokenCookie(recLoginRes);
    if (recLoginRes.status === 200 && recCookie) {
      console.log('✅ Test 2 Passed: Recycler authenticated via HttpOnly cookie');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Recycler login failed');
    }

    // =========================================================================
    // Test 3: Other Collector Authentication
    // =========================================================================
    const otherLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other@demo.com', password: 'demo123' }),
    });
    const otherCookie = extractTokenCookie(otherLoginRes);
    if (otherLoginRes.status === 200 && otherCookie) {
      console.log('✅ Test 3 Passed: Other collector authenticated');
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed: Other collector login failed');
    }

    // =========================================================================
    // Test 4: Collector creates Waste Item 1 (Server-side Valuation)
    // =========================================================================
    const createWaste1Res = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        materialId: pcbMaterial._id.toString(),
        quantityKg: 10,
        notes: 'Motherboards sorted into collection bin',
      }),
    });
    const waste1Data = await createWaste1Res.json();
    const waste1 = waste1Data?.data?.wasteItem;

    if (
      createWaste1Res.status === 201 &&
      waste1 &&
      waste1.quantityKg === 10 &&
      waste1.estimatedValue === 3500 && // 10 kg * 350/kg
      waste1.status === 'available'
    ) {
      console.log(`✅ Test 4 Passed: Waste item 1 created with server-computed valuation (₹${waste1.estimatedValue})`);
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: Waste item 1 creation failed', waste1Data);
    }

    // =========================================================================
    // Test 5: Client-side tampering with estimatedValue or status is strictly rejected
    // =========================================================================
    const tamperRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        materialId: pcbMaterial._id.toString(),
        quantityKg: 5,
        estimatedValue: 999999, // Attempting to spoof valuation
      }),
    });
    if (tamperRes.status === 400) {
      console.log('✅ Test 5 Passed: Tampering with estimatedValue rejected by validator');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed: Server accepted client-provided estimatedValue');
    }

    // =========================================================================
    // Test 6: Collector creates Waste Item 2
    // =========================================================================
    const createWaste2Res = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        materialId: copperMaterial._id.toString(),
        quantityKg: 15,
        notes: 'Stripped copper wire',
      }),
    });
    const waste2Data = await createWaste2Res.json();
    const waste2 = waste2Data?.data?.wasteItem;

    if (
      createWaste2Res.status === 201 &&
      waste2 &&
      waste2.quantityKg === 15 &&
      waste2.estimatedValue === 6300 && // 15 kg * 420/kg
      waste2.status === 'available'
    ) {
      console.log(`✅ Test 6 Passed: Waste item 2 created with server-computed valuation (₹${waste2.estimatedValue})`);
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Waste item 2 creation failed', waste2Data);
    }

    // =========================================================================
    // Test 7: Collector Views Own Inventory
    // =========================================================================
    const myWasteRes = await fetch(`${baseUrl}/waste/my`, {
      headers: { Cookie: colCookie! },
    });
    const myWasteData = await myWasteRes.json();
    const items = myWasteData?.data?.wasteItems || [];

    if (myWasteRes.status === 200 && items.length === 2 && items[0].materialId?.name) {
      console.log(`✅ Test 7 Passed: Collector inventory retrieved (${items.length} items, material populated)`);
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Could not retrieve collector waste items', myWasteData);
    }

    // =========================================================================
    // Test 8: Validation: Handover request requires at least 1 waste item
    // =========================================================================
    const emptyReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [],
      }),
    });
    if (emptyReqRes.status === 400) {
      console.log('✅ Test 8 Passed: Empty waste items list rejected');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Request accepted with 0 waste items');
    }

    // =========================================================================
    // Test 9: Authorization: Cannot request handover of someone else's waste
    // =========================================================================
    const stealReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: otherCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [waste1.id],
      }),
    });
    if (stealReqRes.status === 403) {
      console.log("✅ Test 9 Passed: Request with unowned waste items rejected with 403 Forbidden");
      passedTests++;
    } else {
      console.error("❌ Test 9 Failed: Another collector was allowed to request someone else's waste");
    }

    // =========================================================================
    // Test 10: Collector creates Handover Request with both waste items
    // =========================================================================
    const createReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [waste1.id, waste2.id],
        requestedDate: '2026-09-25',
        notes: 'Handover batch 1',
        collectorMessage: 'Available in the morning slot.',
      }),
    });
    const reqData = await createReqRes.json();
    const createdRequest = reqData?.data?.request;

    if (
      createReqRes.status === 201 &&
      createdRequest &&
      createdRequest.status === 'pending' &&
      createdRequest.totalQuantityKg === 25 && // 10 + 15
      createdRequest.estimatedValue === 9800 // 3500 + 6300
    ) {
      console.log(
        `✅ Test 10 Passed: Handover request created (Total: ${createdRequest.totalQuantityKg} kg, Est: ₹${createdRequest.estimatedValue}, Status: ${createdRequest.status})`
      );
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Handover request creation failed', reqData);
    }

    // =========================================================================
    // Test 11: Waste items in active requests cannot be requested again (Duplicate Prevention)
    // =========================================================================
    const dupReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [waste1.id],
      }),
    });
    const dupReqData = await dupReqRes.json();
    if (
      dupReqRes.status === 400 &&
      dupReqData.message?.includes('already part of an active handover request')
    ) {
      console.log("✅ Test 11 Passed: Duplicate request for active waste item correctly rejected (400 Bad Request)");
      passedTests++;
    } else {
      console.error("❌ Test 11 Failed: Duplicate request was unexpectedly accepted or gave wrong error", dupReqData);
    }

    // =========================================================================
    // Test 12: Recycler views Incoming Requests
    // =========================================================================
    const incomingRes = await fetch(`${baseUrl}/requests/incoming`, {
      headers: { Cookie: recCookie! },
    });
    const incomingData = await incomingRes.json();
    const incomingList = incomingData?.data?.requests || [];

    if (
      incomingRes.status === 200 &&
      incomingList.length > 0 &&
      incomingList[0].id === createdRequest.id &&
      incomingList[0].collectorId?.name === 'Ravi Kumar'
    ) {
      console.log('✅ Test 12 Passed: Recycler views incoming requests with collector populated');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Could not retrieve incoming requests for recycler', incomingData);
    }

    // =========================================================================
    // Test 13: Recycler Accepts Handover Request
    // =========================================================================
    const acceptRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/accept`, {
      method: 'POST',
      headers: { Cookie: recCookie! },
    });
    const acceptData = await acceptRes.json();
    const acceptedRequest = acceptData?.data?.request;

    if (acceptRes.status === 200 && acceptedRequest?.status === 'accepted') {
      console.log("✅ Test 13 Passed: Recycler accepted request (status: 'accepted')");
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Request accept failed', acceptData);
    }

    // =========================================================================
    // Test 14: Recycler Schedules Handover Pickup Date
    // =========================================================================
    const scheduleDateStr = '2026-09-28';
    const scheduleRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ scheduledDate: scheduleDateStr }),
    });
    const scheduleData = await scheduleRes.json();
    const scheduledRequest = scheduleData?.data?.request;

    if (
      scheduleRes.status === 200 &&
      scheduledRequest?.status === 'scheduled' &&
      scheduledRequest?.scheduledDate?.startsWith(scheduleDateStr)
    ) {
      console.log(`✅ Test 14 Passed: Handover scheduled for ${scheduleDateStr} (status: 'scheduled')`);
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Request schedule failed', scheduleData);
    }

    // =========================================================================
    // Test 15: Mark Request In-Transit
    // =========================================================================
    const inTransitRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/in-transit`, {
      method: 'POST',
      headers: { Cookie: colCookie! },
    });
    const inTransitData = await inTransitRes.json();
    const inTransitRequest = inTransitData?.data?.request;

    if (inTransitRes.status === 200 && inTransitRequest?.status === 'in_transit') {
      console.log("✅ Test 15 Passed: Handover request marked 'in_transit'");
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Mark in-transit failed', inTransitData);
    }

    // =========================================================================
    // Test 16: Access Control: Unauthorized user cannot view request details
    // =========================================================================
    const unauthGetRes = await fetch(`${baseUrl}/requests/${createdRequest.id}`, {
      headers: { Cookie: otherCookie! },
    });
    if (unauthGetRes.status === 403) {
      console.log('✅ Test 16 Passed: Unauthorized user blocked with 403 from viewing request');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed: Unauthorized user was able to access request details');
    }

    // =========================================================================
    // Test 17: Cancel Flow: Collector cancels pending request, items released
    // =========================================================================
    const wasteCancelItem = await WasteItem.create({
      collectorId: collectorUser._id,
      materialId: pcbMaterial._id,
      quantityKg: 8,
      estimatedValue: 2800,
      status: 'available',
      isDeleted: false,
    });

    const cancelReqCreateRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [wasteCancelItem._id.toString()],
      }),
    });
    const cancelReqData = await cancelReqCreateRes.json();
    const cancelReqId = cancelReqData.data.request.id;

    const doCancelRes = await fetch(`${baseUrl}/requests/${cancelReqId}/cancel`, {
      method: 'POST',
      headers: { Cookie: colCookie! },
    });
    const doCancelData = await doCancelRes.json();
    const releasedWaste = await WasteItem.findById(wasteCancelItem._id);

    if (
      doCancelRes.status === 200 &&
      doCancelData.data.request.status === 'cancelled' &&
      releasedWaste?.status === 'available'
    ) {
      console.log("✅ Test 17 Passed: Collector cancelled request; waste items released back to 'available'");
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed: Cancel flow failed', doCancelData);
    }

    // =========================================================================
    // Test 18: Reject Flow: Recycler rejects request, items released
    // =========================================================================
    const wasteRejectItem = await WasteItem.create({
      collectorId: collectorUser._id,
      materialId: copperMaterial._id,
      quantityKg: 12,
      estimatedValue: 5040,
      status: 'available',
      isDeleted: false,
    });

    const rejectReqCreateRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [wasteRejectItem._id.toString()],
      }),
    });
    const rejectReqData = await rejectReqCreateRes.json();
    const rejectReqId = rejectReqData.data.request.id;

    const doRejectRes = await fetch(`${baseUrl}/requests/${rejectReqId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ reason: 'Capacity constraints' }),
    });
    const doRejectData = await doRejectRes.json();
    const rejectedWaste = await WasteItem.findById(wasteRejectItem._id);

    if (
      doRejectRes.status === 200 &&
      doRejectData.data.request.status === 'rejected' &&
      rejectedWaste?.status === 'available'
    ) {
      console.log("✅ Test 18 Passed: Recycler rejected request; waste items released back to 'available'");
      passedTests++;
    } else {
      console.error('❌ Test 18 Failed: Reject flow failed', doRejectData);
    }

    // =========================================================================
    // Test 19: Zero LocalStorage Token Policy Verification
    // =========================================================================
    const authContextPath = path.resolve(__dirname, '../../lib/authContext.tsx');
    const apiClientPath = path.resolve(__dirname, '../../lib/apiClient.ts');
    const authCode = fs.readFileSync(authContextPath, 'utf8');
    const clientCode = fs.readFileSync(apiClientPath, 'utf8');

    const usesLocalStorageTokens =
      authCode.includes("localStorage.setItem('token'") ||
      authCode.includes('localStorage.getItem("token"') ||
      clientCode.includes("localStorage.getItem('token'");

    if (!usesLocalStorageTokens && clientCode.includes("credentials: 'include'")) {
      console.log('✅ Test 19 Passed: Zero LocalStorage token policy strictly enforced');
      passedTests++;
    } else {
      console.error('❌ Test 19 Failed: Detected localStorage token usage in frontend client');
    }

    // =========================================================================
    // Test 20: Frontend Waste & Requests API Clients exist and export typed methods
    // =========================================================================
    const wasteApiPath = path.resolve(__dirname, '../../lib/api/waste.ts');
    const requestsApiPath = path.resolve(__dirname, '../../lib/api/requests.ts');
    const wasteApiCode = fs.readFileSync(wasteApiPath, 'utf8');
    const requestsApiCode = fs.readFileSync(requestsApiPath, 'utf8');

    const hasWasteMethods =
      wasteApiCode.includes('createWasteItem') &&
      wasteApiCode.includes('getMyWasteItems') &&
      wasteApiCode.includes('getWasteItemById');

    const hasRequestMethods =
      requestsApiCode.includes('createRequest') &&
      requestsApiCode.includes('getMyRequests') &&
      requestsApiCode.includes('getIncomingRequests') &&
      requestsApiCode.includes('acceptRequest') &&
      requestsApiCode.includes('rejectRequest') &&
      requestsApiCode.includes('scheduleRequest') &&
      requestsApiCode.includes('markRequestInTransit') &&
      requestsApiCode.includes('cancelRequest');

    if (hasWasteMethods && hasRequestMethods) {
      console.log('✅ Test 20 Passed: Frontend waste and requests API clients fully implemented with typed contracts');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: Missing required methods in API clients');
    }

    console.log(`\n==================================================`);
    console.log(`🏁 Phase 7B Results: ${passedTests}/${totalTests} Tests Passed`);
    console.log(`==================================================\n`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL PHASE 7B INTEGRATION TESTS PASSED!\n');
    } else {
      process.exitCode = 1;
    }
  } catch (error: any) {
    console.error('💥 Test suite encountered fatal error:', error);
    process.exitCode = 1;
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

runPhase7bTests();
