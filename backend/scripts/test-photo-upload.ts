(process.env as any).NODE_ENV = 'test';

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
import { Notification } from '../src/models/Notification';
import bcrypt from 'bcryptjs';

function extractTokenCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/token=[^;]+/);
  return match ? match[0] : null;
}

async function runPhotoUploadTests() {
  console.log('🧪 Starting E-Waste Photo Upload Test Suite...\n');

  let mongod: MongoMemoryServer | null = null;
  let server: http.Server | null = null;
  const testPort = 5994;
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  let passedTests = 0;
  const totalTests = 14;

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
      email: 'collector1@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
      verificationStatus: 'verified',
    });
    await CollectorProfile.create({ user: collector1._id });

    // Collector 2
    const collector2 = await User.create({
      name: 'Sita Sharma (Collector 2)',
      email: 'collector2@demo.com',
      passwordHash: demoPasswordHash,
      role: 'collector',
      isVerified: true,
      verificationStatus: 'verified',
    });
    await CollectorProfile.create({ user: collector2._id });

    // Recycler
    const recyclerUser = await User.create({
      name: 'GreenCycle Recycling',
      email: 'recycler@demo.com',
      passwordHash: demoPasswordHash,
      role: 'recycler',
      isVerified: true,
      verificationStatus: 'verified',
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

    // Seed Material
    const material = await Material.create({
      name: 'Laptop Scrap',
      category: 'Computers',
      pricePerKg: 110,
      indicativePrice: 110,
      unit: 'per kg',
      priceTrend: 'up',
      isActive: true,
    });

    server = app.listen(testPort);

    // Authenticate Collector 1
    const loginCol1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector1@demo.com',
        password: 'DemoPassword123!',
      }),
    });
    const col1Cookie = extractTokenCookie(loginCol1Res);
    if (!col1Cookie) throw new Error('Failed to obtain auth cookie for Collector 1');

    // Authenticate Collector 2
    const loginCol2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'collector2@demo.com',
        password: 'DemoPassword123!',
      }),
    });
    const col2Cookie = extractTokenCookie(loginCol2Res);
    if (!col2Cookie) throw new Error('Failed to obtain auth cookie for Collector 2');

    // Authenticate Recycler
    const loginRecRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recycler@demo.com',
        password: 'DemoPassword123!',
      }),
    });
    const recCookie = extractTokenCookie(loginRecRes);
    if (!recCookie) throw new Error('Failed to obtain auth cookie for Recycler');

    // -------------------------------------------------------------
    // Test 1: Collector can create waste without a photo (JSON)
    // -------------------------------------------------------------
    const createNoPhotoRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: col1Cookie,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 10,
        notes: 'Old laptops without battery',
      }),
    });
    const createNoPhotoJson = await createNoPhotoRes.json();
    const itemWithoutPhoto = createNoPhotoJson.data?.wasteItem;

    if (
      createNoPhotoRes.status === 201 &&
      createNoPhotoJson.success === true &&
      itemWithoutPhoto?.quantityKg === 10 &&
      itemWithoutPhoto?.estimatedValue === 1100 &&
      (!itemWithoutPhoto.photo || !itemWithoutPhoto.photo.url)
    ) {
      console.log('✅ 1. Collector can create waste without a photo (JSON)');
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: ${JSON.stringify(createNoPhotoJson)}`);
    }

    // -------------------------------------------------------------
    // Test 2: Collector can create waste with a valid image (multipart/form-data)
    // -------------------------------------------------------------
    // Create a 10KB mock JPEG buffer
    const mockJpgBuffer = Buffer.alloc(10 * 1024, 0xff);
    const formWithPhoto = new FormData();
    formWithPhoto.append('materialId', material._id.toString());
    formWithPhoto.append('quantityKg', '15');
    formWithPhoto.append('notes', '15kg mixed motherboard scrap');
    formWithPhoto.append('photo', new Blob([mockJpgBuffer], { type: 'image/jpeg' }), 'motherboards.jpg');

    const createWithPhotoRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        Cookie: col1Cookie,
      },
      body: formWithPhoto,
    });
    const createWithPhotoJson = await createWithPhotoRes.json();
    const itemWithPhoto = createWithPhotoJson.data?.wasteItem;

    if (
      createWithPhotoRes.status === 201 &&
      createWithPhotoJson.success === true &&
      itemWithPhoto?.quantityKg === 15 &&
      itemWithPhoto?.estimatedValue === 1650 &&
      itemWithPhoto?.photo?.url &&
      itemWithPhoto?.photo?.publicId
    ) {
      console.log('✅ 2. Collector can create waste with a valid image');
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: ${JSON.stringify(createWithPhotoJson)}`);
    }

    // -------------------------------------------------------------
    // Test 3: Returned WasteItem contains photo information
    // -------------------------------------------------------------
    const getWasteByIdRes = await fetch(`${baseUrl}/waste/${itemWithPhoto.id}`, {
      method: 'GET',
      headers: {
        Cookie: col1Cookie,
      },
    });
    const getWasteByIdJson = await getWasteByIdRes.json();
    const fetchedItem = getWasteByIdJson.data?.wasteItem;

    if (
      getWasteByIdRes.status === 200 &&
      fetchedItem?.photo?.url === itemWithPhoto.photo.url &&
      fetchedItem?.photo?.publicId === itemWithPhoto.photo.publicId
    ) {
      console.log('✅ 3. Returned WasteItem contains photo information when retrieved');
      passedTests++;
    } else {
      throw new Error(`Test 3 Failed: ${JSON.stringify(getWasteByIdJson)}`);
    }

    // -------------------------------------------------------------
    // Test 4: Invalid file type is rejected (e.g. text or executable)
    // -------------------------------------------------------------
    const formInvalidType = new FormData();
    formInvalidType.append('materialId', material._id.toString());
    formInvalidType.append('quantityKg', '5');
    formInvalidType.append('photo', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'notes.txt');

    const invalidTypeRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        Cookie: col1Cookie,
      },
      body: formInvalidType,
    });
    const invalidTypeJson = await invalidTypeRes.json();

    if (
      invalidTypeRes.status === 400 &&
      invalidTypeJson.success === false &&
      invalidTypeJson.message?.includes('Only JPG, PNG and WEBP')
    ) {
      console.log('✅ 4. Invalid file type rejected with 400 status');
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: ${JSON.stringify(invalidTypeJson)}`);
    }

    // -------------------------------------------------------------
    // Test 5: File larger than 5MB limit is rejected
    // -------------------------------------------------------------
    // 6MB buffer
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0x00);
    const formLargeFile = new FormData();
    formLargeFile.append('materialId', material._id.toString());
    formLargeFile.append('quantityKg', '5');
    formLargeFile.append('photo', new Blob([largeBuffer], { type: 'image/jpeg' }), 'huge-photo.jpg');

    const largeFileRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        Cookie: col1Cookie,
      },
      body: formLargeFile,
    });
    const largeFileJson = await largeFileRes.json();

    if (
      largeFileRes.status === 400 &&
      largeFileJson.success === false &&
      largeFileJson.message?.includes('5MB')
    ) {
      console.log('✅ 5. File larger than 5MB rejected with 400 status');
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: ${JSON.stringify(largeFileJson)}`);
    }

    // -------------------------------------------------------------
    // Test 6: Unauthenticated upload is rejected
    // -------------------------------------------------------------
    const formUnauth = new FormData();
    formUnauth.append('materialId', material._id.toString());
    formUnauth.append('quantityKg', '5');
    formUnauth.append('photo', new Blob([mockJpgBuffer], { type: 'image/jpeg' }), 'sample.jpg');

    const unauthRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      body: formUnauth,
    });
    const unauthJson = await unauthRes.json();

    if (unauthRes.status === 401 && unauthJson.success === false) {
      console.log('✅ 6. Unauthenticated upload rejected with 401 status');
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: ${JSON.stringify(unauthJson)}`);
    }

    // -------------------------------------------------------------
    // Test 7: Another user cannot modify or view another collector's private waste
    // -------------------------------------------------------------
    const crossUserRes = await fetch(`${baseUrl}/waste/${itemWithPhoto.id}`, {
      method: 'GET',
      headers: {
        Cookie: col2Cookie,
      },
    });
    const crossUserJson = await crossUserRes.json();

    if (crossUserRes.status === 403 && crossUserJson.success === false) {
      console.log('✅ 7. Another user cannot access or view private waste item');
      passedTests++;
    } else {
      throw new Error(`Test 7 Failed: ${JSON.stringify(crossUserJson)}`);
    }

    // -------------------------------------------------------------
    // Test 8: Client cannot inject arbitrary photo metadata into request body
    // -------------------------------------------------------------
    const injectPhotoRes = await fetch(`${baseUrl}/waste`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: col1Cookie,
      },
      body: JSON.stringify({
        materialId: material._id.toString(),
        quantityKg: 10,
        photo: { url: 'https://attacker.com/malicious.jpg', publicId: 'fake-id' },
      }),
    });
    const injectPhotoJson = await injectPhotoRes.json();

    if (injectPhotoRes.status === 400 && injectPhotoJson.success === false) {
      console.log('✅ 8. Client cannot directly inject arbitrary photo metadata in body');
      passedTests++;
    } else {
      throw new Error(`Test 8 Failed: ${JSON.stringify(injectPhotoJson)}`);
    }

    // -------------------------------------------------------------
    // Test 9: Collector can send Handover Request with photo-enabled WasteItem
    // -------------------------------------------------------------
    const createReqRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: col1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [itemWithPhoto.id],
        requestedDate: '2026-09-30',
        collectorMessage: 'Please inspect high-grade scrap photos before pickup.',
      }),
    });
    const createReqJson = await createReqRes.json();
    const createdRequest = createReqJson.data?.request;

    if (
      createReqRes.status === 201 &&
      createReqJson.success === true &&
      createdRequest?.totalQuantityKg === 15 &&
      createdRequest?.estimatedValue === 1650 &&
      createdRequest?.status === 'pending'
    ) {
      console.log('✅ 9. Handover request created successfully with photo-enabled WasteItem');
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: ${JSON.stringify(createReqJson)}`);
    }

    // -------------------------------------------------------------
    // Test 10: Recycler can view photo in populated request details
    // -------------------------------------------------------------
    const recyclerGetReqRes = await fetch(`${baseUrl}/requests/${createdRequest.id}`, {
      method: 'GET',
      headers: {
        Cookie: recCookie,
      },
    });
    const recyclerGetReqJson = await recyclerGetReqRes.json();
    const populatedReq = recyclerGetReqJson.data?.request;
    const populatedItem = populatedReq?.wasteItemIds?.[0];

    if (
      recyclerGetReqRes.status === 200 &&
      populatedItem &&
      populatedItem.photo?.url === itemWithPhoto.photo.url &&
      populatedItem.photo?.publicId === itemWithPhoto.photo.publicId
    ) {
      console.log('✅ 10. Recycler can view photo in populated request details');
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: ${JSON.stringify(recyclerGetReqJson)}`);
    }

    // -------------------------------------------------------------
    // Test 11: Handover request with items lacking photos works identically
    // -------------------------------------------------------------
    const createReqNoPhotoRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: col1Cookie,
      },
      body: JSON.stringify({
        recyclerId: recyclerProfile._id.toString(),
        wasteItemIds: [itemWithoutPhoto.id],
        requestedDate: '2026-10-01',
      }),
    });
    const createReqNoPhotoJson = await createReqNoPhotoRes.json();
    const noPhotoRequest = createReqNoPhotoJson.data?.request;

    if (
      createReqNoPhotoRes.status === 201 &&
      createReqNoPhotoJson.success === true &&
      noPhotoRequest?.totalQuantityKg === 10
    ) {
      console.log('✅ 11. Handover request with non-photo item works seamlessly');
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: ${JSON.stringify(createReqNoPhotoJson)}`);
    }

    // -------------------------------------------------------------
    // Test 12: Existing handover workflow progression (accept -> schedule -> in_transit -> complete)
    // -------------------------------------------------------------
    // 12a. Recycler accepts
    const acceptRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/accept`, {
      method: 'POST',
      headers: { Cookie: recCookie },
    });
    if (acceptRes.status !== 200) throw new Error('Accept failed');

    // 12b. Recycler schedules
    const scheduleRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie,
      },
      body: JSON.stringify({ scheduledDate: '2026-09-29' }),
    });
    if (scheduleRes.status !== 200) throw new Error('Schedule failed');

    // 12c. Mark In-Transit
    const inTransitRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/in-transit`, {
      method: 'POST',
      headers: { Cookie: col1Cookie },
    });
    if (inTransitRes.status !== 200) throw new Error('In-transit failed');

    // 12d. Complete Request
    const completeRes = await fetch(`${baseUrl}/requests/${createdRequest.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recCookie,
      },
      body: JSON.stringify({ notes: 'Items received and verified against photos.' }),
    });
    const completeJson = await completeRes.json();

    if (
      completeRes.status === 200 &&
      completeJson.success === true &&
      completeJson.data?.request?.status === 'completed'
    ) {
      console.log('✅ 12. Full handover lifecycle works seamlessly with photo-enabled item');
      passedTests++;
    } else {
      throw new Error(`Test 12 Failed: ${JSON.stringify(completeJson)}`);
    }

    // -------------------------------------------------------------
    // Test 13: Digital Handover Record & Transaction created correctly
    // -------------------------------------------------------------
    const record = await HandoverRecord.findOne({ handoverRequestId: createdRequest.id });
    const transaction = await Transaction.findOne({ handoverRequestId: createdRequest.id });

    if (
      record &&
      record.finalValue === 1650 &&
      record.totalQuantityKg === 15 &&
      transaction &&
      transaction.amount === 1650 &&
      transaction.status === 'completed'
    ) {
      console.log('✅ 13. Digital Handover Record and Transaction settled correctly');
      passedTests++;
    } else {
      throw new Error('Test 13 Failed: Record or Transaction not found or incorrect amount');
    }

    // -------------------------------------------------------------
    // Test 14: Notifications generated correctly
    // -------------------------------------------------------------
    const notifications = await Notification.find({
      $or: [{ userId: collector1._id }, { userId: recyclerUser._id }],
    });

    if (notifications.length > 0) {
      console.log('✅ 14. Notifications generated throughout the photo-enabled workflow');
      passedTests++;
    } else {
      throw new Error('Test 14 Failed: No notifications found');
    }

    console.log(`\n🎉 All ${passedTests}/${totalTests} Photo Upload tests passed successfully!`);
  } catch (err: any) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runPhotoUploadTests();
