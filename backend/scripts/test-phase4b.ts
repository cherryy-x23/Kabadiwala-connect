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
import { HandoverRecord } from '../src/models/HandoverRecord';
import { Transaction } from '../src/models/Transaction';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhase4bTests() {
  console.log('🧪 Starting Phase 4B Digital Handover Record, Completion & Transaction Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5995;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalPhase4bTests = 28;
  const allResponsesToCheckForPasswordHash: any[] = [];

  try {
    // 0. Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('DemoPassword123!', salt);

    // Seed Collector 1 & 2
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

    // Seed Recycler 1 & 2
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

    // Seed Materials
    const materialPCB = await Material.create({
      name: 'High-Grade Motherboards',
      category: 'Circuit Boards',
      pricePerKg: 300,
      unit: 'kg',
      isActive: true,
    });

    const materialCopper = await Material.create({
      name: 'Insulated Copper Wire',
      category: 'Metals',
      pricePerKg: 500,
      unit: 'kg',
      isActive: true,
    });

    // Seed Waste Items
    const waste1 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: materialPCB._id,
      quantityKg: 10,
      estimatedPricePerKg: 300,
      estimatedValue: 3000,
      status: 'available',
    });

    const waste2 = await WasteItem.create({
      collectorId: collector1._id,
      materialId: materialCopper._id,
      quantityKg: 4,
      estimatedPricePerKg: 500,
      estimatedValue: 2000,
      status: 'available',
    });

    // Requests in different states for negative testing
    const pendingRequest = await HandoverRequest.create({
      collectorId: collector1._id,
      recyclerId: recyclerProfile1._id,
      recyclerUserId: recyclerUser1._id,
      wasteItemIds: [waste1._id],
      materialIds: [materialPCB._id],
      totalQuantityKg: 10,
      estimatedValue: 3000,
      status: 'pending',
    });

    const acceptedRequest = await HandoverRequest.create({
      collectorId: collector1._id,
      recyclerId: recyclerProfile1._id,
      recyclerUserId: recyclerUser1._id,
      wasteItemIds: [waste1._id],
      materialIds: [materialPCB._id],
      totalQuantityKg: 10,
      estimatedValue: 3000,
      status: 'accepted',
    });

    const scheduledRequest = await HandoverRequest.create({
      collectorId: collector1._id,
      recyclerId: recyclerProfile1._id,
      recyclerUserId: recyclerUser1._id,
      wasteItemIds: [waste1._id],
      materialIds: [materialPCB._id],
      totalQuantityKg: 10,
      estimatedValue: 3000,
      scheduledDate: new Date('2026-10-01'),
      status: 'scheduled',
    });

    // Main request to test full lifecycle
    const mainRequest = await HandoverRequest.create({
      collectorId: collector1._id,
      recyclerId: recyclerProfile1._id,
      recyclerUserId: recyclerUser1._id,
      wasteItemIds: [waste1._id, waste2._id],
      materialIds: [materialPCB._id, materialCopper._id],
      totalQuantityKg: 14,
      estimatedValue: 5000,
      scheduledDate: new Date('2026-10-01'),
      status: 'in_transit',
    });

    // Start Express server on test port
    await new Promise<void>((resolve) => {
      server = app.listen(testPort, () => resolve());
    });

    // Login helper
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
    // Test 2: pending request cannot be completed
    // -------------------------------------------------------------
    const pendingCompRes = await fetch(`${baseUrl}/requests/${pendingRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const pendingCompData = await pendingCompRes.json();
    allResponsesToCheckForPasswordHash.push(pendingCompData);

    if (pendingCompRes.status === 400 && !pendingCompData.success) {
      console.log('✅ Test 2 Passed: pending request cannot be completed (400)');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed: pending request allowed completion', pendingCompData);
    }

    // -------------------------------------------------------------
    // Test 3: accepted request cannot be completed
    // -------------------------------------------------------------
    const acceptedCompRes = await fetch(`${baseUrl}/requests/${acceptedRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const acceptedCompData = await acceptedCompRes.json();
    allResponsesToCheckForPasswordHash.push(acceptedCompData);

    if (acceptedCompRes.status === 400 && !acceptedCompData.success) {
      console.log('✅ Test 3 Passed: accepted request cannot be completed (400)');
      passedTests++;
    } else {
      console.error('❌ Test 3 Failed: accepted request allowed completion', acceptedCompData);
    }

    // -------------------------------------------------------------
    // Test 4: scheduled request cannot be completed
    // -------------------------------------------------------------
    const scheduledCompRes = await fetch(`${baseUrl}/requests/${scheduledRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const scheduledCompData = await scheduledCompRes.json();
    allResponsesToCheckForPasswordHash.push(scheduledCompData);

    if (scheduledCompRes.status === 400 && !scheduledCompData.success) {
      console.log('✅ Test 4 Passed: scheduled request cannot be completed (400)');
      passedTests++;
    } else {
      console.error('❌ Test 4 Failed: scheduled request allowed completion', scheduledCompData);
    }

    // -------------------------------------------------------------
    // Test 5: unrelated collector cannot complete
    // -------------------------------------------------------------
    const c2CompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: c2Cookie }, // Collector 2
    });
    const c2CompData = await c2CompRes.json();
    allResponsesToCheckForPasswordHash.push(c2CompData);

    if (c2CompRes.status === 403 && !c2CompData.success) {
      console.log('✅ Test 5 Passed: unrelated collector cannot complete (403)');
      passedTests++;
    } else {
      console.error('❌ Test 5 Failed: unrelated collector allowed completion', c2CompData);
    }

    // -------------------------------------------------------------
    // Test 6: unrelated recycler cannot complete
    // -------------------------------------------------------------
    const r2CompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: r2Cookie }, // Recycler 2
    });
    const r2CompData = await r2CompRes.json();
    allResponsesToCheckForPasswordHash.push(r2CompData);

    if (r2CompRes.status === 403 && !r2CompData.success) {
      console.log('✅ Test 6 Passed: unrelated recycler cannot complete (403)');
      passedTests++;
    } else {
      console.error('❌ Test 6 Failed: unrelated recycler allowed completion', r2CompData);
    }

    // -------------------------------------------------------------
    // Tests 18, 19, 20, 21: Client cannot override finalValue, amount, handoverReference, or transactionReference
    // -------------------------------------------------------------
    const spoofCompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({
        finalValue: 999999,
        amount: 999999,
        handoverReference: 'FAKE-REF-001',
        transactionReference: 'FAKE-TXN-001',
        totalQuantityKg: 1000,
      }),
    });
    const spoofCompData = await spoofCompRes.json();
    allResponsesToCheckForPasswordHash.push(spoofCompData);

    if (spoofCompRes.status === 400 && !spoofCompData.success) {
      console.log('✅ Tests 18-21 Passed: Client cannot override finalValue, amount, handoverReference, or transactionReference (400)');
      passedTests += 4;
    } else {
      console.error('❌ Tests 18-21 Failed: Spoofed completion payload was not rejected', spoofCompData);
    }

    // -------------------------------------------------------------
    // Test 1: in_transit request can be completed
    // -------------------------------------------------------------
    const validCompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({
        notes: 'Handover verified and weighed accurately at facility.',
        recyclerConfirmation: true,
      }),
    });
    const validCompData = await validCompRes.json();
    allResponsesToCheckForPasswordHash.push(validCompData);

    if (validCompRes.status === 200 && validCompData.success) {
      console.log('✅ Test 1 Passed: in_transit request can be completed');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Valid completion failed', validCompData);
    }

    const createdRecordId = validCompData.data?.handoverRecord?.id || validCompData.data?.handoverRecord?._id;
    const createdTxnId = validCompData.data?.transaction?.id || validCompData.data?.transaction?._id;
    const handoverRef = validCompData.data?.handoverRecord?.handoverReference;
    const txnRef = validCompData.data?.transaction?.transactionReference;

    // -------------------------------------------------------------
    // Test 7: completion creates exactly one HandoverRecord
    // -------------------------------------------------------------
    const countRecords = await HandoverRecord.countDocuments({ handoverRequestId: mainRequest._id });
    if (countRecords === 1 && createdRecordId) {
      console.log('✅ Test 7 Passed: completion creates exactly one HandoverRecord');
      passedTests++;
    } else {
      console.error('❌ Test 7 Failed: Expected 1 HandoverRecord, found:', countRecords);
    }

    // -------------------------------------------------------------
    // Test 8: completion creates exactly one Transaction
    // -------------------------------------------------------------
    const countTxns = await Transaction.countDocuments({ handoverRequestId: mainRequest._id });
    if (countTxns === 1 && createdTxnId) {
      console.log('✅ Test 8 Passed: completion creates exactly one Transaction');
      passedTests++;
    } else {
      console.error('❌ Test 8 Failed: Expected 1 Transaction, found:', countTxns);
    }

    // -------------------------------------------------------------
    // Test 9: HandoverRecord has unique reference format
    // -------------------------------------------------------------
    if (handoverRef && /^KBC-\d{4}-[A-Z0-9]+$/.test(handoverRef)) {
      console.log(`✅ Test 9 Passed: HandoverRecord has unique reference (${handoverRef})`);
      passedTests++;
    } else {
      console.error('❌ Test 9 Failed: Invalid handoverReference format:', handoverRef);
    }

    // -------------------------------------------------------------
    // Test 10: Transaction has unique reference format
    // -------------------------------------------------------------
    if (txnRef && /^TXN-\d{4}-[A-Z0-9]+$/.test(txnRef)) {
      console.log(`✅ Test 10 Passed: Transaction has unique reference (${txnRef})`);
      passedTests++;
    } else {
      console.error('❌ Test 10 Failed: Invalid transactionReference format:', txnRef);
    }

    // -------------------------------------------------------------
    // Test 11: Request becomes completed
    // -------------------------------------------------------------
    const checkReqDb = await HandoverRequest.findById(mainRequest._id);
    if (checkReqDb?.status === 'completed') {
      console.log('✅ Test 11 Passed: Request status becomes completed');
      passedTests++;
    } else {
      console.error('❌ Test 11 Failed: Request status is not completed:', checkReqDb?.status);
    }

    // -------------------------------------------------------------
    // Test 12: WasteItems become handed_over
    // -------------------------------------------------------------
    const checkWaste1 = await WasteItem.findById(waste1._id);
    const checkWaste2 = await WasteItem.findById(waste2._id);
    if (checkWaste1?.status === 'handed_over' && checkWaste2?.status === 'handed_over') {
      console.log('✅ Test 12 Passed: All associated WasteItems transitioned to handed_over');
      passedTests++;
    } else {
      console.error('❌ Test 12 Failed: WasteItems status mismatch:', checkWaste1?.status, checkWaste2?.status);
    }

    // -------------------------------------------------------------
    // Test 13: Completed request cannot be cancelled
    // -------------------------------------------------------------
    const cancelCompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/cancel`, {
      method: 'POST',
      headers: { Cookie: c1Cookie },
    });
    const cancelCompData = await cancelCompRes.json();
    allResponsesToCheckForPasswordHash.push(cancelCompData);

    if (cancelCompRes.status === 400 && !cancelCompData.success) {
      console.log('✅ Test 13 Passed: Completed request cannot be cancelled (400)');
      passedTests++;
    } else {
      console.error('❌ Test 13 Failed: Allowed cancellation of completed request', cancelCompData);
    }

    // -------------------------------------------------------------
    // Test 14: Completed request cannot be rescheduled
    // -------------------------------------------------------------
    const reschedRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: r1Cookie,
      },
      body: JSON.stringify({ scheduledDate: '2026-10-15' }),
    });
    const reschedData = await reschedRes.json();
    allResponsesToCheckForPasswordHash.push(reschedData);

    if (reschedRes.status === 400 && !reschedData.success) {
      console.log('✅ Test 14 Passed: Completed request cannot be rescheduled (400)');
      passedTests++;
    } else {
      console.error('❌ Test 14 Failed: Allowed rescheduling of completed request', reschedData);
    }

    // -------------------------------------------------------------
    // Test 15: Completed request cannot be rejected
    // -------------------------------------------------------------
    const rejectCompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/reject`, {
      method: 'POST',
      headers: { Cookie: r1Cookie },
    });
    const rejectCompData = await rejectCompRes.json();
    allResponsesToCheckForPasswordHash.push(rejectCompData);

    if (rejectCompRes.status === 400 && !rejectCompData.success) {
      console.log('✅ Test 15 Passed: Completed request cannot be rejected (400)');
      passedTests++;
    } else {
      console.error('❌ Test 15 Failed: Allowed rejection of completed request', rejectCompData);
    }

    // -------------------------------------------------------------
    // Tests 16 & 17: Double-completion / Duplicate completion does NOT create duplicate records
    // -------------------------------------------------------------
    const dupCompRes = await fetch(`${baseUrl}/requests/${mainRequest._id}/complete`, {
      method: 'POST',
      headers: { Cookie: c1Cookie }, // Collector trying to complete again
    });
    const dupCompData = await dupCompRes.json();
    allResponsesToCheckForPasswordHash.push(dupCompData);

    const countRecordsAfterDup = await HandoverRecord.countDocuments({ handoverRequestId: mainRequest._id });
    const countTxnsAfterDup = await Transaction.countDocuments({ handoverRequestId: mainRequest._id });

    if (
      dupCompRes.status === 409 &&
      !dupCompData.success &&
      countRecordsAfterDup === 1 &&
      countTxnsAfterDup === 1
    ) {
      console.log('✅ Tests 16 & 17 Passed: Completed request cannot be completed again (409 Conflict) and does not duplicate records');
      passedTests += 2;
    } else {
      console.error('❌ Tests 16 & 17 Failed: Duplicate completion allowed or duplicate records created', {
        status: dupCompRes.status,
        records: countRecordsAfterDup,
        txns: countTxnsAfterDup,
      });
    }

    // -------------------------------------------------------------
    // Test 22: Collector can view own handover records
    // -------------------------------------------------------------
    const myRecordsRes = await fetch(`${baseUrl}/handover-records/my`, {
      headers: { Cookie: c1Cookie },
    });
    const myRecordsData = await myRecordsRes.json();
    allResponsesToCheckForPasswordHash.push(myRecordsData);

    if (
      myRecordsRes.status === 200 &&
      myRecordsData.success &&
      Array.isArray(myRecordsData.data?.records) &&
      myRecordsData.data.records.some((r: any) => (r.id === createdRecordId || r._id === createdRecordId))
    ) {
      console.log('✅ Test 22 Passed: Collector can view own handover records');
      passedTests++;
    } else {
      console.error('❌ Test 22 Failed: Could not get collector handover records', myRecordsData);
    }

    // -------------------------------------------------------------
    // Test 23: Recycler can view their incoming handover records
    // -------------------------------------------------------------
    const r1RecordsRes = await fetch(`${baseUrl}/handover-records/incoming`, {
      headers: { Cookie: r1Cookie },
    });
    const r1RecordsData = await r1RecordsRes.json();
    allResponsesToCheckForPasswordHash.push(r1RecordsData);

    if (
      r1RecordsRes.status === 200 &&
      r1RecordsData.success &&
      Array.isArray(r1RecordsData.data?.records) &&
      r1RecordsData.data.records.some((r: any) => (r.id === createdRecordId || r._id === createdRecordId))
    ) {
      console.log('✅ Test 23 Passed: Recycler can view their handover records');
      passedTests++;
    } else {
      console.error('❌ Test 23 Failed: Recycler could not view incoming handover records', r1RecordsData);
    }

    // -------------------------------------------------------------
    // Test 24: Unrelated user cannot view handover record
    // -------------------------------------------------------------
    const unauthRecordRes = await fetch(`${baseUrl}/handover-records/${createdRecordId}`, {
      headers: { Cookie: c2Cookie }, // Collector 2 (unrelated)
    });
    const unauthRecordData = await unauthRecordRes.json();
    allResponsesToCheckForPasswordHash.push(unauthRecordData);

    if (unauthRecordRes.status === 403 && !unauthRecordData.success) {
      console.log('✅ Test 24 Passed: Unrelated user cannot view handover record (403)');
      passedTests++;
    } else {
      console.error('❌ Test 24 Failed: Unrelated user viewed handover record', unauthRecordData);
    }

    // -------------------------------------------------------------
    // Test 25: Collector can view own transactions
    // -------------------------------------------------------------
    const myTxnsRes = await fetch(`${baseUrl}/transactions/my`, {
      headers: { Cookie: c1Cookie },
    });
    const myTxnsData = await myTxnsRes.json();
    allResponsesToCheckForPasswordHash.push(myTxnsData);

    if (
      myTxnsRes.status === 200 &&
      myTxnsData.success &&
      Array.isArray(myTxnsData.data?.transactions) &&
      myTxnsData.data.transactions.some((t: any) => (t.id === createdTxnId || t._id === createdTxnId))
    ) {
      console.log('✅ Test 25 Passed: Collector can view own transactions');
      passedTests++;
    } else {
      console.error('❌ Test 25 Failed: Collector could not view own transactions', myTxnsData);
    }

    // -------------------------------------------------------------
    // Test 26: Recycler can view their incoming transactions
    // -------------------------------------------------------------
    const r1TxnsRes = await fetch(`${baseUrl}/transactions/incoming`, {
      headers: { Cookie: r1Cookie },
    });
    const r1TxnsData = await r1TxnsRes.json();
    allResponsesToCheckForPasswordHash.push(r1TxnsData);

    if (
      r1TxnsRes.status === 200 &&
      r1TxnsData.success &&
      Array.isArray(r1TxnsData.data?.transactions) &&
      r1TxnsData.data.transactions.some((t: any) => (t.id === createdTxnId || t._id === createdTxnId))
    ) {
      console.log('✅ Test 26 Passed: Recycler can view their transactions');
      passedTests++;
    } else {
      console.error('❌ Test 26 Failed: Recycler could not view incoming transactions', r1TxnsData);
    }

    // -------------------------------------------------------------
    // Test 27: Unrelated user cannot view transaction
    // -------------------------------------------------------------
    const unauthTxnRes = await fetch(`${baseUrl}/transactions/${createdTxnId}`, {
      headers: { Cookie: r2Cookie }, // Recycler 2 (unrelated)
    });
    const unauthTxnData = await unauthTxnRes.json();
    allResponsesToCheckForPasswordHash.push(unauthTxnData);

    if (unauthTxnRes.status === 403 && !unauthTxnData.success) {
      console.log('✅ Test 27 Passed: Unrelated user cannot view transaction (403)');
      passedTests++;
    } else {
      console.error('❌ Test 27 Failed: Unrelated user viewed transaction', unauthTxnData);
    }

    // -------------------------------------------------------------
    // Test 28: passwordHash never appears in any API response
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
      console.log('✅ Test 28 Passed: passwordHash is NEVER exposed in any API response body');
      passedTests++;
    } else {
      console.error('❌ Test 28 Failed: passwordHash leaked in API response!');
      throw new Error('Security violation: passwordHash exposed');
    }

    console.log(`\n🎉 Phase 4B Digital Handover Record, Completion & Transaction Tests Passed: ${passedTests}/${totalPhase4bTests}`);

    if (passedTests !== totalPhase4bTests) {
      throw new Error(`Only ${passedTests}/${totalPhase4bTests} Phase 4B tests passed`);
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

runPhase4bTests()
  .then(() => {
    console.log('All Phase 4B tests finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Phase 4B test run failed:', err);
    process.exit(1);
  });
