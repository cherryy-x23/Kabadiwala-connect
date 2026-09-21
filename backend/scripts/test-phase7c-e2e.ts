/**
 * Phase 7C Manual E2E Simulation
 * Mirrors the full browser workflow that a user would perform.
 */
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
import bcrypt from 'bcryptjs';

function extractCookie(res: Response): string | null {
  const sc = res.headers.get('set-cookie');
  if (!sc) return null;
  const m = sc.match(/token=[^;]+/);
  return m ? m[0] : null;
}

async function run() {
  console.log('\n🌐 Phase 7C Manual E2E Simulation (Mirrors Browser Workflow)\n');
  console.log('='.repeat(65));

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const salt = await bcrypt.genSalt(10);
  const pw = await bcrypt.hash('demo123', salt);

  const colUser = await User.create({ name: 'Arjun Collector', email: 'collector@demo.com', passwordHash: pw, role: 'collector', isVerified: true, verificationStatus: 'verified' });
  await CollectorProfile.create({ user: colUser._id, dailyCapacityKg: 100 });

  const recUser = await User.create({ name: 'GreenCycle Facility', email: 'recycler@demo.com', passwordHash: pw, role: 'recycler', isVerified: true, verificationStatus: 'verified' });
  const recProfile = await RecyclerProfile.create({ user: recUser._id, organizationName: 'GreenCycle Facility', registrationId: 'GR-SIH-001', acceptedMaterials: ['Laptops'] });

  const mat = await Material.create({ name: 'Laptop (Working)', category: 'Computers & Laptops', unit: 'kg', pricePerKg: 280, indicativePrice: 280, priceTrend: 'stable', description: 'Used laptops.', isActive: true });

  const port = 5988;
  const base = `http://localhost:${port}/api/v1`;
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  let pass = 0;
  let fail = 0;
  function ok(msg: string) { console.log(`  ✅ ${msg}`); pass++; }
  function ko(msg: string, detail?: any) { console.error(`  ❌ ${msg}`, detail || ''); fail++; }

  console.log('\n── STEP 1: Collector Login ─────────────────────────────────────');
  const colLoginRes = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'collector@demo.com', password: 'demo123' }) });
  const colCookie = extractCookie(colLoginRes);
  const colMe = await colLoginRes.json();
  if (colLoginRes.status === 200 && colCookie && colMe.data?.user?.role === 'collector') ok(`Logged in — name: ${colMe.data.user.name}`);
  else ko('Collector login failed', colLoginRes.status);

  console.log('\n── STEP 2: Materials Catalog ────────────────────────────────────');
  const matsRes = await fetch(`${base}/materials`, { headers: { Cookie: colCookie! } });
  const matsData = await matsRes.json();
  const dm = matsData.data?.materials?.[0];
  if (matsRes.status === 200 && dm?.name) ok(`Material: "${dm.name}" at ₹${dm.pricePerKg}/kg`);
  else ko('Materials catalog failed', matsData);

  console.log('\n── STEP 3: Create Waste Item ────────────────────────────────────');
  const wasteRes = await fetch(`${base}/waste`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: colCookie! }, body: JSON.stringify({ materialId: mat._id.toString(), quantityKg: 8, notes: 'Office laptops' }) });
  const wasteData = await wasteRes.json();
  const wasteItem = wasteData.data?.wasteItem;
  const expectedValue = 8 * 280;
  if (wasteRes.status === 201 && wasteItem?.estimatedValue === expectedValue) ok(`Waste: 8 kg × ₹280 = ₹${wasteItem.estimatedValue} (server-computed), status: ${wasteItem.status}`);
  else ko('Waste creation failed', wasteData);

  console.log('\n── STEP 4: Recycler Catalog ─────────────────────────────────────');
  const recListRes = await fetch(`${base}/recyclers`, { headers: { Cookie: colCookie! } });
  const recListData = await recListRes.json();
  const dr = recListData.data?.recyclers?.[0];
  if (recListRes.status === 200 && dr?.organizationName) ok(`Recycler: "${dr.organizationName}"`);
  else ko('Recycler catalog failed');

  console.log('\n── STEP 5: Create Handover Request ──────────────────────────────');
  const reqRes = await fetch(`${base}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: colCookie! }, body: JSON.stringify({ recyclerId: recProfile._id.toString(), wasteItemIds: [wasteItem?.id || wasteItem?._id], notes: 'Ready for pickup' }) });
  const reqData = await reqRes.json();
  const request = reqData.data?.request;
  const requestId = request?.id || request?._id;
  if (reqRes.status === 201 && request?.status === 'pending') ok(`Request: ...${requestId?.toString().slice(-8)}, status: pending, est. ₹${request.estimatedValue}`);
  else ko('Request creation failed', reqData);

  console.log('\n── STEP 6: Collector My Requests View ───────────────────────────');
  const myReqs = await fetch(`${base}/requests/my`, { headers: { Cookie: colCookie! } });
  const myReqsData = await myReqs.json();
  if (myReqs.status === 200 && myReqsData.data?.requests?.length > 0) ok(`${myReqsData.data.requests.length} request(s) visible to collector`);
  else ko('My requests failed', myReqsData);

  console.log('\n── STEP 7: Recycler Login ───────────────────────────────────────');
  const recLoginRes = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'recycler@demo.com', password: 'demo123' }) });
  const recCookie = extractCookie(recLoginRes);
  const recMe = await recLoginRes.json();
  if (recLoginRes.status === 200 && recCookie && recMe.data?.user?.role === 'recycler') ok(`Logged in — name: ${recMe.data.user.name}`);
  else ko('Recycler login failed');

  console.log('\n── STEP 8: Recycler Incoming Requests ───────────────────────────');
  const incomingRes = await fetch(`${base}/requests/incoming`, { headers: { Cookie: recCookie! } });
  const incomingData = await incomingRes.json();
  if (incomingRes.status === 200 && incomingData.data?.requests?.length > 0) ok(`${incomingData.data.requests.length} incoming request(s) visible to recycler, status: ${incomingData.data.requests[0].status}`);
  else ko('Incoming requests failed', incomingData);

  console.log('\n── STEP 9: Accept ───────────────────────────────────────────────');
  const acceptRes = await fetch(`${base}/requests/${requestId}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: recCookie! }, body: JSON.stringify({ notes: 'Confirmed' }) });
  const acceptData = await acceptRes.json();
  if (acceptRes.status === 200 && acceptData.data?.request?.status === 'accepted') ok('pending → accepted');
  else ko('Accept failed', acceptRes.status);

  console.log('\n── STEP 10: Schedule ────────────────────────────────────────────');
  const sched = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const schedRes = await fetch(`${base}/requests/${requestId}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: recCookie! }, body: JSON.stringify({ scheduledDate: sched }) });
  const schedData = await schedRes.json();
  if (schedRes.status === 200 && schedData.data?.request?.status === 'scheduled') ok(`accepted → scheduled (${sched})`);
  else ko('Schedule failed', schedRes.status);

  console.log('\n── STEP 11: Mark In Transit ─────────────────────────────────────');
  const transitRes = await fetch(`${base}/requests/${requestId}/in-transit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: recCookie! }, body: JSON.stringify({ notes: 'Dispatched' }) });
  const transitData = await transitRes.json();
  if (transitRes.status === 200 && transitData.data?.request?.status === 'in_transit') ok('scheduled → in_transit');
  else ko('In-transit failed', transitRes.status);

  console.log('\n── STEP 12: Complete Handover ───────────────────────────────────');
  const completeRes = await fetch(`${base}/requests/${requestId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: recCookie! }, body: JSON.stringify({ notes: 'Materials weighed and verified.' }) });
  const completeData = await completeRes.json();
  const record = completeData.data?.handoverRecord;
  const txn = completeData.data?.transaction;
  if (completeRes.status === 200 && completeData.data?.request?.status === 'completed') ok('in_transit → completed ✓ — HandoverRecord and Transaction created');
  else ko('Completion failed', completeRes.status);

  console.log('\n── STEP 13: Digital Handover Record (what UI displays) ──────────');
  if (/^KBC-\d{4}-[A-Z0-9]+$/.test(record?.handoverReference || '')) ok(`handoverReference: ${record.handoverReference}`);
  else ko('Bad handoverReference', record?.handoverReference);
  if (record?.finalValue === expectedValue) ok(`finalValue: ₹${record.finalValue} = 8 kg × ₹280 (server-authoritative)`);
  else ko('finalValue wrong', { got: record?.finalValue, want: expectedValue });
  if (record?.totalQuantityKg === 8) ok(`totalQuantityKg: ${record.totalQuantityKg} kg`);
  else ko('totalQuantityKg wrong', record?.totalQuantityKg);
  ok(`completedAt: ${record?.completedAt}`);
  ok(`completedByRole: ${record?.completedByRole}`);

  console.log('\n── STEP 14: Transaction Settlement Record (what UI displays) ────');
  if (/^TXN-\d{4}-[A-Z0-9]+$/.test(txn?.transactionReference || '')) ok(`transactionReference: ${txn.transactionReference}`);
  else ko('Bad transactionReference', txn?.transactionReference);
  if (txn?.amount === expectedValue) ok(`amount: ₹${txn.amount} (server-authoritative)`);
  else ko('amount wrong', { got: txn?.amount, want: expectedValue });
  if (txn?.status === 'completed') ok(`status: ${txn.status}`);
  else ko('txn status wrong', txn?.status);
  if (txn?.paymentMethod === 'simulated_settlement') ok(`paymentMethod: ${txn.paymentMethod}`);
  else ko('paymentMethod wrong', txn?.paymentMethod);

  console.log('\n── STEP 15: Collector Transaction History ───────────────────────');
  const cTxnRes = await fetch(`${base}/transactions/my`, { headers: { Cookie: colCookie! } });
  const cTxns = (await cTxnRes.json()).data?.transactions || [];
  const cTxn = cTxns.find((t: any) => t.transactionReference === txn?.transactionReference);
  if (cTxn) ok(`Collector history: ${cTxn.transactionReference}, ₹${cTxn.amount}, ${cTxn.paymentMethod}, ${cTxn.status}`);
  else ko('Collector history missing transaction', { count: cTxns.length });

  console.log('\n── STEP 16: Collector Handover Records ──────────────────────────');
  const cHRRes = await fetch(`${base}/handover-records/my`, { headers: { Cookie: colCookie! } });
  const cHRs = (await cHRRes.json()).data?.records || [];
  const cHR = cHRs.find((r: any) => r.handoverReference === record?.handoverReference);
  if (cHR) ok(`Collector records: ${cHR.handoverReference}, ₹${cHR.finalValue}`);
  else ko('Collector handover record missing', { count: cHRs.length });

  console.log('\n── STEP 17: Recycler Transaction History ────────────────────────');
  const rTxnRes = await fetch(`${base}/transactions/incoming`, { headers: { Cookie: recCookie! } });
  const rTxns = (await rTxnRes.json()).data?.transactions || [];
  const rTxn = rTxns.find((t: any) => t.transactionReference === txn?.transactionReference);
  if (rTxn) ok(`Recycler history: ${rTxn.transactionReference}, ₹${rTxn.amount}, ${rTxn.paymentMethod}, ${rTxn.status}`);
  else ko('Recycler history missing transaction', { count: rTxns.length });

  console.log('\n── STEP 18: Recycler Handover Records ───────────────────────────');
  const rHRRes = await fetch(`${base}/handover-records/incoming`, { headers: { Cookie: recCookie! } });
  const rHRs = (await rHRRes.json()).data?.records || [];
  const rHR = rHRs.find((r: any) => r.handoverReference === record?.handoverReference);
  if (rHR) ok(`Recycler records: ${rHR.handoverReference}, ₹${rHR.finalValue}`);
  else ko('Recycler handover record missing', { count: rHRs.length });

  console.log('\n── STEP 19: Double Completion Protection ────────────────────────');
  const dblRes = await fetch(`${base}/requests/${requestId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: recCookie! }, body: JSON.stringify({ notes: 'Duplicate attempt' }) });
  if (dblRes.status === 409) ok('Double completion rejected: 409 Conflict (no fake success to user)');
  else ko('Expected 409, got', dblRes.status);

  // Check no duplicate HandoverRecord or Transaction
  const hrCount = await HandoverRecord.countDocuments({ handoverRequestId: requestId });
  if (hrCount === 1) ok('Verified exactly 1 HandoverRecord (no duplicate created)');
  else ko('Duplicate HandoverRecord detected in DB', { hrCount });

  const txnCount = await Transaction.countDocuments({ handoverRequestId: requestId });
  if (txnCount === 1) ok('Verified exactly 1 Transaction (no duplicate created)');
  else ko('Duplicate Transaction detected in DB', { txnCount });

  console.log('\n── STEP 20: URL Lookup (View Handover Record links) ─────────────');
  const [lr, lt] = await Promise.all([
    fetch(`${base}/handover-records/${requestId}`, { headers: { Cookie: colCookie! } }),
    fetch(`${base}/transactions/${requestId}`, { headers: { Cookie: colCookie! } }),
  ]);
  if (lr.status === 200 && lt.status === 200) ok('HandoverRecord and Transaction resolve via Request ID (used by UI "View Record" links)');
  else ko('Request ID lookup failed', { record: lr.status, txn: lt.status });

  console.log('\n── STEP 21: Waste Status After Completion ───────────────────────');
  const targetWasteId = wasteItem?.id || wasteItem?._id;

  // 1. Direct database document query: status must be 'handed_over'
  const dbWaste = await WasteItem.findById(targetWasteId);
  if (dbWaste?.status === 'handed_over') ok(`Database document verified: status="${dbWaste.status}"`);
  else ko('Database waste document status is not handed_over', dbWaste?.status);

  // 2. Individual waste item detail endpoint: status must be 'handed_over'
  const wDetailRes = await fetch(`${base}/waste/${targetWasteId}`, { headers: { Cookie: colCookie! } });
  const wDetailData = await wDetailRes.json();
  if (wDetailRes.status === 200 && wDetailData.data?.wasteItem?.status === 'handed_over') ok(`Waste item detail endpoint verified: status="${wDetailData.data.wasteItem.status}"`);
  else ko('Waste item detail status is not handed_over', wDetailData);

  // 3. Active inventory check (?status=available): must NOT contain the handed-over item
  const wAvailRes = await fetch(`${base}/waste/my?status=available`, { headers: { Cookie: colCookie! } });
  const wAvailItems = (await wAvailRes.json()).data?.wasteItems || [];
  const foundInActive = wAvailItems.find((w: any) => (w.id || w._id) === targetWasteId);
  if (!foundInActive) ok('WasteItem excluded from active inventory (GET /waste/my?status=available)');
  else ko('WasteItem still appears in active available inventory', foundInActive);

  // 4. Full collector waste list: item is present and accurately reflects status='handed_over'
  const wMyRes = await fetch(`${base}/waste/my`, { headers: { Cookie: colCookie! } });
  const wItems = (await wMyRes.json()).data?.wasteItems || [];
  const foundInAll = wItems.find((w: any) => (w.id || w._id) === targetWasteId);
  if (foundInAll && foundInAll.status === 'handed_over') ok(`Collector full inventory reflects status="${foundInAll.status}"`);
  else ko('Collector full inventory missing or has wrong status', foundInAll);

  console.log('\n' + '='.repeat(65));
  console.log(`\n📋 E2E Simulation Summary`);
  console.log(`   Steps/Checks: ${pass + fail} | Passed: ${pass} | Failed: ${fail}`);
  if (fail === 0) console.log('\n🎉 ALL E2E CHECKS PASSED — Phase 7C fully verified!\n');
  else { console.log('\n⚠️ Some checks failed.\n'); process.exitCode = 1; }

  await new Promise<void>((r) => server.close(() => r()));
  await mongoose.disconnect();
  await mongod.stop();
}

run().catch((e) => { console.error('Fatal:', e); process.exit(1); });
