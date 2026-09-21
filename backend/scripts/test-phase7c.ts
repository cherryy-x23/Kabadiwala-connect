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
import { HandoverRecord } from '../src/models/HandoverRecord';
import { Transaction } from '../src/models/Transaction';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase7cTests() {
  console.log('🧪 Starting Phase 7C Completion + Digital Handover + Transaction Integration Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5995;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 22;

  try {
    // 0. In-memory MongoDB
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
      acceptedMaterials: ['Printed Circuit Boards (Grade A)', 'Copper Wire & Cables'],
      operatingHours: '9 AM - 6 PM, Mon-Sat',
    });

    // Seed material
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

    // Start server
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    // --- TEST 1: Collector Login ---
    const colLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ravi@demo.com', password: 'demo123' }),
    });
    const colCookie = extractTokenCookie(colLoginRes);
    if (colLoginRes.status === 200 && colCookie) {
      console.log('✅ Test 1 Passed: Collector login issued HttpOnly token cookie');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Collector login failed', colLoginRes.status);
    }

    // --- TEST 2: Recycler Login ---
    const recLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'greencycle@demo.com', password: 'demo123' }),
    });
    const recCookie = extractTokenCookie(recLoginRes);
    if (recLoginRes.status === 200 && recCookie) {
      console.log('✅ Test 2 Passed: Recycler login issued HttpOnly token cookie');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: Recycler login failed', recLoginRes.status);
    }

    // --- TEST 3: Create Waste Item (correct route: /waste) ---
    const createWasteRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        materialId: pcbMaterial._id.toString(),
        quantityKg: 20,
        notes: 'Grade A server motherboards',
      }),
    });
    const createWasteData = await createWasteRes.json();
    const wasteItem = createWasteData.data?.wasteItem;
    const wasteItemId = wasteItem?.id || wasteItem?._id;
    const expectedValue = 20 * 350; // 7000
    if (createWasteRes.status === 201 && wasteItemId && wasteItem?.status === 'available' && wasteItem?.estimatedValue === expectedValue) {
      console.log(`✅ Test 3 Passed: Waste item created (20 kg, ₹${wasteItem.estimatedValue}, status=available)`);
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed: Could not create waste item', createWasteData);
    }

    // --- TEST 4: Create Handover Request (POST /requests) ---
    const createReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: colCookie!,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [wasteItemId],
        notes: 'Ready for scheduled facility drop-off',
      }),
    });
    const createReqData = await createReqRes.json();
    const createdRequest = createReqData.data?.request;
    const requestId = createdRequest?.id || createdRequest?._id;
    if (createReqRes.status === 201 && requestId && createdRequest?.status === 'pending') {
      console.log(`✅ Test 4 Passed: Handover request created (status=pending, id=${requestId?.toString().slice(-6)})`);
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: Handover request creation failed', createReqData);
    }

    // --- TEST 5: Accept Request (POST /:id/accept) ---
    const acceptRes = await fetch(`${baseUrl}/requests/${requestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ notes: 'Accepted for intake' }),
    });
    const acceptData = await acceptRes.json();
    if (acceptRes.status === 200 && acceptData.data?.request?.status === 'accepted') {
      console.log('✅ Test 5 Passed: Recycler accepted request (status=accepted)');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed: Could not accept request', acceptRes.status, acceptData?.message);
    }

    // --- TEST 6: Schedule Request (POST /:id/schedule) ---
    const schedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const schedRes = await fetch(`${baseUrl}/requests/${requestId}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ scheduledDate: schedDate, notes: 'Scheduled for tomorrow morning' }),
    });
    const schedData = await schedRes.json();
    if (schedRes.status === 200 && schedData.data?.request?.status === 'scheduled') {
      console.log('✅ Test 6 Passed: Handover scheduled (status=scheduled)');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: Could not schedule request', schedRes.status, schedData?.message);
    }

    // --- TEST 7: Mark In-Transit (POST /:id/in-transit) ---
    const transitRes = await fetch(`${baseUrl}/requests/${requestId}/in-transit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ notes: 'Dispatched to facility' }),
    });
    const transitData = await transitRes.json();
    if (transitRes.status === 200 && transitData.data?.request?.status === 'in_transit') {
      console.log('✅ Test 7 Passed: Request marked in_transit');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Could not mark request in_transit', transitRes.status, transitData?.message);
    }

    // --- TEST 8: Complete Handover (POST /:id/complete) ---
    const completeRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ notes: 'Weighed and verified at facility scale #2' }),
    });
    const completeData = await completeRes.json();
    const reqStatus = completeData.data?.request?.status;
    const handoverRecord = completeData.data?.handoverRecord;
    const transaction = completeData.data?.transaction;

    if (completeRes.status === 200 && reqStatus === 'completed' && handoverRecord && transaction) {
      console.log('✅ Test 8 Passed: Handover completed; created Digital Handover Record & Settlement Transaction');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Completion failed', completeRes.status, completeData?.message);
    }

    // --- TEST 9: Digital Handover Record Verification ---
    const ref = handoverRecord?.handoverReference;
    const isRefFormatValid = typeof ref === 'string' && /^KBC-\d{4}-[A-Z0-9]+$/.test(ref);
    const isValuationCorrect = handoverRecord?.finalValue === expectedValue; // 20 * 350 = 7000
    const isWeightCorrect = handoverRecord?.totalQuantityKg === 20;

    if (isRefFormatValid && isValuationCorrect && isWeightCorrect) {
      console.log(`✅ Test 9 Passed: HandoverRecord valid: ${ref}, 20 kg, ₹${expectedValue} final valuation`);
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: HandoverRecord fields invalid', {
        ref, refValid: isRefFormatValid,
        finalValue: handoverRecord?.finalValue, expected: expectedValue,
        totalQuantityKg: handoverRecord?.totalQuantityKg
      });
    }

    // --- TEST 10: Transaction Settlement Verification ---
    const txnRef = transaction?.transactionReference;
    const isTxnRefFormat = typeof txnRef === 'string' && /^TXN-\d{4}-[A-Z0-9]+$/.test(txnRef);
    const isTxnAmountCorrect = transaction?.amount === expectedValue;
    const isTxnStatusCompleted = transaction?.status === 'completed';
    const isPaymentSimulated = transaction?.paymentMethod === 'simulated_settlement';

    if (isTxnRefFormat && isTxnAmountCorrect && isTxnStatusCompleted && isPaymentSimulated) {
      console.log(`✅ Test 10 Passed: Settlement Transaction: ${txnRef}, ₹${expectedValue}, simulated_settlement, status=completed`);
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Transaction fields invalid', {
        txnRef, isTxnRefFormat,
        amount: transaction?.amount, expected: expectedValue,
        status: transaction?.status,
        paymentMethod: transaction?.paymentMethod,
      });
    }

    // --- TEST 11: Waste Item transitioned to handed_over ---
    const updatedWaste = await WasteItem.findById(wasteItemId);
    if (updatedWaste?.status === 'handed_over') {
      console.log('✅ Test 11 Passed: WasteItem transitioned to handed_over');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed: WasteItem status is', updatedWaste?.status);
    }

    // --- TEST 12: Double Completion Protection (409 or 400) ---
    const doubleCompleteRes = await fetch(`${baseUrl}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie!,
      },
      body: JSON.stringify({ notes: 'Attempt duplicate completion' }),
    });
    if (doubleCompleteRes.status === 400 || doubleCompleteRes.status === 409) {
      console.log(`✅ Test 12 Passed: Double completion rejected with status ${doubleCompleteRes.status}`);
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: Expected 400/409 on duplicate, got', doubleCompleteRes.status);
    }

    // --- TEST 13: GET /handover-records/my (Collector) ---
    const colHandoversRes = await fetch(`${baseUrl}/handover-records/my`, {
      method: 'GET',
      headers: { Cookie: colCookie! },
    });
    const colHandoversData = await colHandoversRes.json();
    const myRecords = colHandoversData.data?.records || [];
    if (colHandoversRes.status === 200 && myRecords.length >= 1 && myRecords[0].handoverReference === ref) {
      console.log('✅ Test 13 Passed: GET /handover-records/my returned collector record with correct reference');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed:', colHandoversData?.message, 'records:', myRecords.length, 'ref match:', myRecords[0]?.handoverReference === ref);
    }

    // --- TEST 14: GET /handover-records/incoming (Recycler) ---
    const recHandoversRes = await fetch(`${baseUrl}/handover-records/incoming`, {
      method: 'GET',
      headers: { Cookie: recCookie! },
    });
    const recHandoversData = await recHandoversRes.json();
    const incomingRecords = recHandoversData.data?.records || [];
    if (recHandoversRes.status === 200 && incomingRecords.length >= 1 && incomingRecords[0].handoverReference === ref) {
      console.log('✅ Test 14 Passed: GET /handover-records/incoming returned recycler record');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed:', recHandoversData?.message, 'incoming records:', incomingRecords.length);
    }

    // --- TEST 15: Lookup HandoverRecord by Record ID and Request ID ---
    const recordId = handoverRecord?.id || handoverRecord?._id;
    const lookupByIdRes = await fetch(`${baseUrl}/handover-records/${recordId}`, {
      headers: { Cookie: colCookie! },
    });
    const lookupByReqRes = await fetch(`${baseUrl}/handover-records/${requestId}`, {
      headers: { Cookie: colCookie! },
    });
    if (lookupByIdRes.status === 200 && lookupByReqRes.status === 200) {
      console.log('✅ Test 15 Passed: GET /handover-records/:id resolves by both Record ID and Handover Request ID');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Lookup status by Record ID:', lookupByIdRes.status, '/ by Request ID:', lookupByReqRes.status);
    }

    // --- TEST 16: GET /transactions/my (Collector) ---
    const colTxnsRes = await fetch(`${baseUrl}/transactions/my`, {
      method: 'GET',
      headers: { Cookie: colCookie! },
    });
    const colTxnsData = await colTxnsRes.json();
    const myTxns = colTxnsData.data?.transactions || [];
    if (colTxnsRes.status === 200 && myTxns.length >= 1 && myTxns[0].transactionReference === txnRef) {
      console.log('✅ Test 16 Passed: GET /transactions/my returned collector transaction with correct reference');
      passedTests++;
    } else {
      console.error('❌ Test 16 Failed:', colTxnsData?.message, 'txns:', myTxns.length, 'ref match:', myTxns[0]?.transactionReference === txnRef);
    }

    // --- TEST 17: GET /transactions/incoming (Recycler) ---
    const recTxnsRes = await fetch(`${baseUrl}/transactions/incoming`, {
      method: 'GET',
      headers: { Cookie: recCookie! },
    });
    const recTxnsData = await recTxnsRes.json();
    const incomingTxns = recTxnsData.data?.transactions || [];
    if (recTxnsRes.status === 200 && incomingTxns.length >= 1 && incomingTxns[0].transactionReference === txnRef) {
      console.log('✅ Test 17 Passed: GET /transactions/incoming returned recycler transaction');
      passedTests++;
    } else {
      console.error('❌ Test 17 Failed:', recTxnsData?.message, 'incoming txns:', incomingTxns.length);
    }

    // --- TEST 18: Lookup Transaction by Transaction ID and Handover Request ID ---
    const transactionId = transaction?.id || transaction?._id;
    const lookupTxnByIdRes = await fetch(`${baseUrl}/transactions/${transactionId}`, {
      headers: { Cookie: colCookie! },
    });
    const lookupTxnByReqRes = await fetch(`${baseUrl}/transactions/${requestId}`, {
      headers: { Cookie: colCookie! },
    });
    if (lookupTxnByIdRes.status === 200 && lookupTxnByReqRes.status === 200) {
      console.log('✅ Test 18 Passed: GET /transactions/:id resolves by Transaction ID and Handover Request ID');
      passedTests++;
    } else {
      console.error('❌ Test 18 Failed: Lookup by Transaction ID:', lookupTxnByIdRes.status, '/ by Request ID:', lookupTxnByReqRes.status);
    }

    // --- TEST 19: Security - No Sensitive Data Leakage in Responses ---
    const recordPayload = await lookupByIdRes.json();
    const txnPayload = await lookupTxnByIdRes.json();
    const strRecord = JSON.stringify(recordPayload);
    const strTxn = JSON.stringify(txnPayload);

    const leaksPassword = strRecord.includes('passwordHash') || strTxn.includes('passwordHash');
    const leaksBcryptHash = strRecord.includes('$2a$') || strTxn.includes('$2a$');

    if (!leaksPassword && !leaksBcryptHash) {
      console.log('✅ Test 19 Passed: HandoverRecord & Transaction responses contain zero password/hash leaks');
      passedTests++;
    } else {
      console.error('❌ Test 19 Failed: Sensitive credentials leaked in API response');
    }

    // --- TEST 20: Frontend API Client Completeness Verification ---
    const handoversApiPath = path.resolve(__dirname, '../../lib/api/handovers.ts');
    const transactionsApiPath = path.resolve(__dirname, '../../lib/api/transactions.ts');
    const requestsApiPath = path.resolve(__dirname, '../../lib/api/requests.ts');

    const handoversApiCode = fs.readFileSync(handoversApiPath, 'utf8');
    const transactionsApiCode = fs.readFileSync(transactionsApiPath, 'utf8');
    const requestsApiCode = fs.readFileSync(requestsApiPath, 'utf8');

    const hasHandoversMethods =
      handoversApiCode.includes('getMyHandoverRecords') &&
      handoversApiCode.includes('getIncomingHandoverRecords') &&
      handoversApiCode.includes('getHandoverRecordById');

    const hasTransactionsMethods =
      transactionsApiCode.includes('getMyTransactions') &&
      transactionsApiCode.includes('getIncomingTransactions') &&
      transactionsApiCode.includes('getTransactionById');

    const hasCompleteMethod = requestsApiCode.includes('completeRequest');

    if (hasHandoversMethods && hasTransactionsMethods && hasCompleteMethod) {
      console.log('✅ Test 20 Passed: All Phase 7C frontend API client methods are implemented with typed contracts');
      passedTests++;
    } else {
      console.error('❌ Test 20 Failed: Missing required methods in frontend API clients');
    }

    // --- TEST 21: WasteItem Status Transition and Active Inventory Exclusion ---
    const dbWaste = await WasteItem.findById(wasteItemId);
    const wasteDetailRes = await fetch(`${baseUrl}/waste/${wasteItemId}`, {
      headers: { Cookie: colCookie! },
    });
    const wasteDetailJson = await wasteDetailRes.json();
    const activeInventoryRes = await fetch(`${baseUrl}/waste/my?status=available`, {
      headers: { Cookie: colCookie! },
    });
    const activeInventoryJson = await activeInventoryRes.json();
    const activeWasteList = activeInventoryJson.data?.wasteItems || [];
    const isExcludedFromActive = !activeWasteList.some((w: any) => (w.id || w._id) === wasteItemId);

    if (
      dbWaste?.status === 'handed_over' &&
      wasteDetailRes.status === 200 &&
      wasteDetailJson.data?.wasteItem?.status === 'handed_over' &&
      isExcludedFromActive
    ) {
      console.log('✅ Test 21 Passed: WasteItem status="handed_over" in DB/API and excluded from active available inventory');
      passedTests++;
    } else {
      console.error('❌ Test 21 Failed: WasteItem status verification failed', {
        dbStatus: dbWaste?.status,
        apiStatus: wasteDetailJson.data?.wasteItem?.status,
        excludedFromActive: isExcludedFromActive,
      });
    }

    // --- TEST 22: Zero Duplicate HandoverRecords and Zero Duplicate Transactions ---
    const totalRecords = await HandoverRecord.countDocuments({ handoverRequestId: requestId });
    const totalTxns = await Transaction.countDocuments({ handoverRequestId: requestId });
    if (totalRecords === 1 && totalTxns === 1) {
      console.log('✅ Test 22 Passed: Idempotency verified — exactly 1 HandoverRecord and 1 Transaction in database');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Duplicate documents detected in DB', { totalRecords, totalTxns });
    }

    console.log(`\n==================================================`);
    console.log(`🏁 Phase 7C Results: ${passedTests}/${totalTests} Tests Passed`);
    console.log(`==================================================\n`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL PHASE 7C INTEGRATION TESTS PASSED!\n');
    } else {
      process.exitCode = 1;
    }
  } catch (error: any) {
    console.error('💥 Test suite encountered fatal error:', error.message);
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

runPhase7cTests();
