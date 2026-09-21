import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { HandoverRecord } from '../models/HandoverRecord';

export const getMyCollectorHandoverRecords = async (
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

    const records = await HandoverRecord.find({ collectorId: req.user.id })
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
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Collector handover records retrieved successfully',
      data: {
        records,
        count: records.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getIncomingRecyclerHandoverRecords = async (
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

    const records = await HandoverRecord.find({ recyclerUserId: req.user.id })
      .populate('collectorId', 'name email phone location avatar')
      .populate({
        path: 'wasteItemIds',
        populate: {
          path: 'materialId',
          select: 'name category pricePerKg unit',
        },
      })
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Recycler handover records retrieved successfully',
      data: {
        records,
        count: records.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getHandoverRecordById = async (
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
        message: 'Invalid record ID format',
      });
      return;
    }

    let record = await HandoverRecord.findById(id)
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

    if (!record) {
      record = await HandoverRecord.findOne({ handoverRequestId: id })
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
    }

    if (!record) {
      res.status(404).json({
        success: false,
        message: 'Handover record not found',
      });
      return;
    }

    const isCollector =
      (record.collectorId as any)?._id?.toString() === req.user.id ||
      record.collectorId?.toString() === req.user.id;
    const isRecycler = record.recyclerUserId?.toString() === req.user.id;

    if (!isCollector && !isRecycler && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied: you are not authorized to view this handover record',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Handover record retrieved successfully',
      data: {
        record,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
