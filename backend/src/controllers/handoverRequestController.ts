import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { HandoverRequest } from '../models/HandoverRequest';
import { WasteItem } from '../models/WasteItem';
import { RecyclerProfile } from '../models/RecyclerProfile';
import { HandoverRecord, generateHandoverReference } from '../models/HandoverRecord';
import { Transaction, generateTransactionReference } from '../models/Transaction';
import {
  createHandoverRequestSchema,
  scheduleRequestSchema,
  rejectRequestSchema,
  completeRequestSchema,
} from '../validators/handoverRequestValidators';
import { safeCreateNotification } from '../services/notificationService';

export const createRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const validatedData = createHandoverRequestSchema.parse(req.body);

    // 1. Verify Recycler exists
    const recycler = await RecyclerProfile.findOne({
      $or: [
        { _id: validatedData.recyclerId },
        { user: validatedData.recyclerId },
      ],
    });

    if (!recycler) {
      res.status(400).json({
        success: false,
        message: 'Selected recycler facility was not found',
      });
      return;
    }

    // 2. Fetch and verify selected waste items
    const wasteItems = await WasteItem.find({
      _id: { $in: validatedData.wasteItemIds },
      isDeleted: false,
    });

    if (wasteItems.length !== validatedData.wasteItemIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more selected waste items do not exist or have been deleted',
      });
      return;
    }

    // 3. Verify ALL waste items belong to authenticated collector
    const unauthorizedWaste = wasteItems.some(
      (w) => w.collectorId.toString() !== req.user!.id
    );
    if (unauthorizedWaste) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you do not own all of the selected waste items',
      });
      return;
    }

    // 4. Verify all waste items are currently available
    const unavailableWaste = wasteItems.some((w) => w.status !== 'available');
    if (unavailableWaste) {
      res.status(400).json({
        success: false,
        message: 'One or more selected waste items are not available for handover',
      });
      return;
    }

    // 5. Prevent duplicate active requests for any of these waste items
    const existingActiveRequest = await HandoverRequest.findOne({
      wasteItemIds: { $in: validatedData.wasteItemIds },
      status: { $in: ['pending', 'accepted', 'scheduled', 'in_transit'] },
    });

    if (existingActiveRequest) {
      res.status(400).json({
        success: false,
        message:
          'One or more selected waste items are already part of an active handover request',
      });
      return;
    }

    // 6. Calculate total quantity and estimated value server-side
    const totalQuantityKg =
      Math.round(wasteItems.reduce((acc, item) => acc + item.quantityKg, 0) * 100) / 100;
    const estimatedValue =
      Math.round(wasteItems.reduce((acc, item) => acc + item.estimatedValue, 0) * 100) / 100;

    const materialIds = Array.from(
      new Set(wasteItems.map((item) => item.materialId.toString()))
    ).map((id) => new mongoose.Types.ObjectId(id));

    // 7. Create HandoverRequest with initial 'pending' status
    const handoverRequest = await HandoverRequest.create({
      collectorId: req.user.id,
      recyclerId: recycler._id,
      recyclerUserId: recycler.user,
      wasteItemIds: validatedData.wasteItemIds,
      materialIds,
      totalQuantityKg,
      estimatedValue,
      requestedDate: validatedData.requestedDate
        ? new Date(validatedData.requestedDate)
        : undefined,
      notes: validatedData.notes,
      collectorMessage: validatedData.collectorMessage,
      status: 'pending',
    });

    // Notify assigned recycler of incoming request
    await safeCreateNotification({
      userId: recycler.user,
      type: 'request_created',
      title: 'New Handover Request',
      message: 'You have received a new e-waste handover request.',
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: handoverRequest._id,
      eventKey: `request_created:${handoverRequest._id}:${recycler.user}`,
      metadata: {
        requestId: handoverRequest._id.toString(),
        status: 'pending',
        totalQuantityKg: handoverRequest.totalQuantityKg,
        estimatedValue: handoverRequest.estimatedValue,
        collectorId: req.user.id,
      },
    });

    const populated = await HandoverRequest.findById(handoverRequest._id)
      .populate(
        'recyclerId',
        'organizationName businessName location address contactPerson registrationId operatingHours'
      )
      .populate({
        path: 'wasteItemIds',
        populate: {
          path: 'materialId',
          select: 'name category pricePerKg unit',
        },
      });

    res.status(201).json({
      success: true,
      message: 'Handover request created successfully',
      data: {
        request: populated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMyCollectorRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const requests = await HandoverRequest.find({ collectorId: req.user.id })
      .populate(
        'recyclerId',
        'organizationName businessName location address contactPerson registrationId operatingHours'
      )
      .populate({
        path: 'wasteItemIds',
        populate: {
          path: 'materialId',
          select: 'name category pricePerKg unit',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Collector handover requests retrieved successfully',
      data: {
        requests,
        count: requests.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getIncomingRecyclerRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const requests = await HandoverRequest.find({ recyclerUserId: req.user.id })
      .populate('collectorId', 'name email phone location avatar')
      .populate({
        path: 'wasteItemIds',
        populate: {
          path: 'materialId',
          select: 'name category pricePerKg unit',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Incoming recycler requests retrieved successfully',
      data: {
        requests,
        count: requests.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getRequestById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id)
      .populate('collectorId', 'name email phone location avatar')
      .populate(
        'recyclerId',
        'organizationName businessName location address contactPerson registrationId operatingHours'
      )
      .populate({
        path: 'wasteItemIds',
        populate: {
          path: 'materialId',
          select: 'name category pricePerKg unit',
        },
      });

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Ownership & Access check
    const isCollector = request.collectorId._id.toString() === req.user.id;
    const isRecycler = request.recyclerUserId.toString() === req.user.id;

    if (!isCollector && !isRecycler && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied: you are not authorized to view this request',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Handover request retrieved successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const acceptRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Only target recycler can accept
    if (request.recyclerUserId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: only the assigned recycler can accept this request',
      });
      return;
    }

    // State machine check: only 'pending' -> 'accepted'
    if (request.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot accept request with status '${request.status}'. Only pending requests can be accepted.`,
      });
      return;
    }

    request.status = 'accepted';
    await request.save();

    // Notify collector of acceptance
    await safeCreateNotification({
      userId: request.collectorId,
      type: 'request_accepted',
      title: 'Handover Request Accepted',
      message: 'Your handover request has been accepted by the recycler.',
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: request._id,
      eventKey: `request_accepted:${request._id}:${request.collectorId}`,
      metadata: {
        requestId: request._id.toString(),
        status: 'accepted',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Handover request accepted successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const rejectRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Only target recycler can reject
    if (request.recyclerUserId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: only the assigned recycler can reject this request',
      });
      return;
    }

    // State machine check: only 'pending' -> 'rejected'
    if (request.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot reject request with status '${request.status}'. Only pending requests can be rejected.`,
      });
      return;
    }

    const validatedData = rejectRequestSchema.parse(req.body);

    request.status = 'rejected';
    if (validatedData.reason || validatedData.recyclerMessage) {
      request.recyclerMessage = validatedData.reason || validatedData.recyclerMessage;
    }
    await request.save();

    // Notify collector of rejection
    await safeCreateNotification({
      userId: request.collectorId,
      type: 'request_rejected',
      title: 'Handover Request Rejected',
      message:
        request.recyclerMessage || 'Your handover request was rejected by the recycler.',
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: request._id,
      eventKey: `request_rejected:${request._id}:${request.collectorId}`,
      metadata: {
        requestId: request._id.toString(),
        status: 'rejected',
        reason: request.recyclerMessage,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Handover request rejected successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const scheduleRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Only target recycler can schedule
    if (request.recyclerUserId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: only the assigned recycler can schedule this request',
      });
      return;
    }

    // State machine check: only 'accepted' -> 'scheduled'
    if (request.status !== 'accepted') {
      res.status(400).json({
        success: false,
        message: `Cannot schedule request with status '${request.status}'. Only accepted requests can be scheduled.`,
      });
      return;
    }

    const validatedData = scheduleRequestSchema.parse(req.body);

    request.scheduledDate = new Date(validatedData.scheduledDate);
    request.status = 'scheduled';
    await request.save();

    // Notify collector of scheduled date
    const dateFormatted = request.scheduledDate.toISOString().split('T')[0];
    await safeCreateNotification({
      userId: request.collectorId,
      type: 'request_scheduled',
      title: 'Handover Request Scheduled',
      message: `Your handover request has been scheduled for pickup on ${dateFormatted}.`,
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: request._id,
      eventKey: `request_scheduled:${request._id}:${request.collectorId}`,
      metadata: {
        requestId: request._id.toString(),
        status: 'scheduled',
        scheduledDate: request.scheduledDate,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Handover request scheduled successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const inTransitRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Either collector or assigned recycler can mark in-transit
    const isCollector = request.collectorId.toString() === req.user.id;
    const isRecycler = request.recyclerUserId.toString() === req.user.id;

    if (!isCollector && !isRecycler) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you are not associated with this handover request',
      });
      return;
    }

    // State machine check: only 'scheduled' -> 'in_transit'
    if (request.status !== 'scheduled') {
      res.status(400).json({
        success: false,
        message: `Cannot move to in_transit from '${request.status}'. Only scheduled requests can be moved to in_transit.`,
      });
      return;
    }

    request.status = 'in_transit';
    await request.save();

    // Notify the other participant
    const targetUserId = isCollector ? request.recyclerUserId : request.collectorId;
    await safeCreateNotification({
      userId: targetUserId,
      type: 'request_in_transit',
      title: 'Handover In Transit',
      message: 'The e-waste pickup is now in transit.',
      relatedEntityType: 'HandoverRequest',
      relatedEntityId: request._id,
      eventKey: `request_in_transit:${request._id}:${targetUserId}`,
      metadata: {
        requestId: request._id.toString(),
        status: 'in_transit',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Handover request marked in-transit successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const cancelRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    const request = await HandoverRequest.findById(id);

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // Only owning collector can cancel
    if (request.collectorId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: only the collector who created this request can cancel it',
      });
      return;
    }

    // State machine check: only 'pending' or 'accepted' can be cancelled
    if (request.status !== 'pending' && request.status !== 'accepted') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel request with status '${request.status}'. Only pending or accepted requests can be cancelled.`,
      });
      return;
    }

    request.status = 'cancelled';
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Handover request cancelled successfully',
      data: {
        request,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const completeRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
      return;
    }

    // 1. Check idempotency: Has a HandoverRecord already been created?
    const existingRecord = await HandoverRecord.findOne({ handoverRequestId: id });
    if (existingRecord) {
      res.status(409).json({
        success: false,
        message: 'Request has already been completed',
      });
      return;
    }

    // 2. Find request
    const request = await HandoverRequest.findById(id);
    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Handover request not found',
      });
      return;
    }

    // 3. Verify user authorization (must be either the creator collector or the assigned recycler)
    const isCollector = request.collectorId.toString() === req.user.id;
    const isRecycler = request.recyclerUserId.toString() === req.user.id;

    if (!isCollector && !isRecycler) {
      res.status(403).json({
        success: false,
        message: 'Access denied: only the associated collector or assigned recycler can complete this request',
      });
      return;
    }

    // 4. Validate status: ONLY in_transit requests can be completed
    if (request.status === 'completed') {
      res.status(409).json({
        success: false,
        message: 'Request has already been completed',
      });
      return;
    }

    if (request.status !== 'in_transit') {
      res.status(400).json({
        success: false,
        message: `Cannot complete request with status '${request.status}'. Only in_transit requests can be completed.`,
      });
      return;
    }

    // 5. Validate client payload (strictly prevent financial/identity overrides)
    const validatedData = completeRequestSchema.parse(req.body);

    // 6. Verify associated waste items exist and are not already handed over
    const wasteItems = await WasteItem.find({
      _id: { $in: request.wasteItemIds },
      isDeleted: false,
    });

    if (wasteItems.length !== request.wasteItemIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more associated waste items could not be found or have been deleted',
      });
      return;
    }

    const alreadyHandedOver = wasteItems.some((w) => w.status === 'handed_over');
    if (alreadyHandedOver) {
      res.status(400).json({
        success: false,
        message: 'One or more associated waste items have already been handed over',
      });
      return;
    }

    // 7. Atomic status transition: in_transit -> completed
    const updatedRequest = await HandoverRequest.findOneAndUpdate(
      { _id: id, status: 'in_transit' },
      { $set: { status: 'completed' } },
      { new: true }
    );

    if (!updatedRequest) {
      // Concurrency check in case another worker completed it in between
      const checkRecord = await HandoverRecord.findOne({ handoverRequestId: id });
      if (checkRecord) {
        res.status(409).json({
          success: false,
          message: 'Request has already been completed',
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: `Cannot complete request with status '${request.status}'. Only in_transit requests can be completed.`,
      });
      return;
    }

    // 8. Calculate final value from trusted snapshot data
    const finalValue = request.estimatedValue;
    const handoverReference = generateHandoverReference();
    const transactionReference = generateTransactionReference();

    // 9. Create HandoverRecord (permanent immutable digital proof)
    const handoverRecord = await HandoverRecord.create({
      handoverRequestId: request._id,
      collectorId: request.collectorId,
      recyclerId: request.recyclerId,
      recyclerUserId: request.recyclerUserId,
      wasteItemIds: request.wasteItemIds,
      materialIds: request.materialIds,
      totalQuantityKg: request.totalQuantityKg,
      finalValue,
      completedAt: new Date(),
      handoverReference,
      collectorConfirmation: isCollector ? true : (validatedData.collectorConfirmation ?? true),
      recyclerConfirmation: isRecycler ? true : (validatedData.recyclerConfirmation ?? true),
      notes: validatedData.notes,
      completedBy: req.user.id,
      completedByRole: isCollector ? 'collector' : 'recycler',
    });

    // 10. Create Transaction record (financial historical record)
    const transaction = await Transaction.create({
      handoverRecordId: handoverRecord._id,
      handoverRequestId: request._id,
      collectorId: request.collectorId,
      recyclerId: request.recyclerId,
      recyclerUserId: request.recyclerUserId,
      amount: finalValue,
      currency: 'INR',
      status: 'completed',
      transactionReference,
      transactionDate: new Date(),
      paymentMethod: 'simulated_settlement',
      notes: validatedData.notes,
    });

    // 11. Finalize associated waste items: available -> handed_over
    await WasteItem.updateMany(
      { _id: { $in: request.wasteItemIds } },
      { $set: { status: 'handed_over' } }
    );

    // 12. Notify the other participant of handover completion
    const otherUserId = isCollector ? request.recyclerUserId : request.collectorId;
    await safeCreateNotification({
      userId: otherUserId,
      type: 'request_completed',
      title: 'Handover Completed',
      message: `Handover request has been completed successfully with reference ${handoverReference}.`,
      relatedEntityType: 'HandoverRecord',
      relatedEntityId: handoverRecord._id,
      eventKey: `request_completed:${request._id}:${otherUserId}`,
      metadata: {
        requestId: request._id.toString(),
        handoverRecordId: handoverRecord._id.toString(),
        status: 'completed',
        handoverReference,
        totalQuantityKg: handoverRecord.totalQuantityKg,
        finalValue: handoverRecord.finalValue,
      },
    });

    // 13. Notify collector of transaction/earnings record
    await safeCreateNotification({
      userId: request.collectorId,
      type: 'transaction_created',
      title: 'Payment / Earnings Recorded',
      message: `Transaction ${transactionReference} for ₹${finalValue} has been recorded.`,
      relatedEntityType: 'Transaction',
      relatedEntityId: transaction._id,
      eventKey: `transaction_created:${transaction._id}:${request.collectorId}`,
      metadata: {
        requestId: request._id.toString(),
        transactionId: transaction._id.toString(),
        amount: finalValue,
        currency: 'INR',
        transactionReference,
        handoverRecordId: handoverRecord._id.toString(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Handover request completed successfully',
      data: {
        request: updatedRequest,
        handoverRecord,
        transaction,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

