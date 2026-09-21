import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction';

export const getMyCollectorTransactions = async (
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

    const transactions = await Transaction.find({ collectorId: req.user.id })
      .populate(
        'recyclerId',
        'organizationName businessName location address contactPerson registrationId operatingHours'
      )
      .populate('handoverRecordId', 'handoverReference completedAt totalQuantityKg finalValue')
      .sort({ transactionDate: -1 });

    res.status(200).json({
      success: true,
      message: 'Collector transactions retrieved successfully',
      data: {
        transactions,
        count: transactions.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getIncomingRecyclerTransactions = async (
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

    const transactions = await Transaction.find({ recyclerUserId: req.user.id })
      .populate('collectorId', 'name email phone location avatar')
      .populate('handoverRecordId', 'handoverReference completedAt totalQuantityKg finalValue')
      .sort({ transactionDate: -1 });

    res.status(200).json({
      success: true,
      message: 'Recycler transactions retrieved successfully',
      data: {
        transactions,
        count: transactions.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getTransactionById = async (
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
        message: 'Invalid transaction ID format',
      });
      return;
    }

    let transaction = await Transaction.findById(id)
      .populate('collectorId', 'name email phone location avatar')
      .populate(
        'recyclerId',
        'organizationName businessName location address contactPerson registrationId operatingHours'
      )
      .populate('handoverRecordId');

    if (!transaction) {
      transaction = await Transaction.findOne({
        $or: [{ handoverRecordId: id }, { handoverRequestId: id }],
      })
        .populate('collectorId', 'name email phone location avatar')
        .populate(
          'recyclerId',
          'organizationName businessName location address contactPerson registrationId operatingHours'
        )
        .populate('handoverRecordId');
    }

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    const isCollector =
      (transaction.collectorId as any)?._id?.toString() === req.user.id ||
      transaction.collectorId?.toString() === req.user.id;
    const isRecycler = transaction.recyclerUserId?.toString() === req.user.id;

    if (!isCollector && !isRecycler && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied: you are not authorized to view this transaction',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: {
        transaction,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
