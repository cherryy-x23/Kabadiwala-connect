import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { WasteItem } from '../models/WasteItem';
import { Material } from '../models/Material';
import { createWasteSchema, updateWasteSchema } from '../validators/wasteValidators';

export const createWaste = async (
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

    const validatedData = createWasteSchema.parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(validatedData.materialId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID format',
      });
      return;
    }

    // Retrieve active material to calculate server-side valuation
    const material = await Material.findOne({
      _id: validatedData.materialId,
      isActive: true,
    });

    if (!material) {
      res.status(400).json({
        success: false,
        message: 'Selected material was not found or is currently inactive',
      });
      return;
    }

    const pricePerKg = material.pricePerKg ?? material.indicativePrice;
    const estimatedValue = Math.round(validatedData.quantityKg * pricePerKg * 100) / 100;

    const wasteItem = await WasteItem.create({
      collectorId: req.user.id,
      materialId: material._id,
      quantityKg: validatedData.quantityKg,
      estimatedValue,
      notes: validatedData.notes,
      status: 'available',
      isDeleted: false,
    });

    const populated = await WasteItem.findById(wasteItem._id).populate(
      'materialId',
      'name category pricePerKg indicativePrice unit priceTrend'
    );

    res.status(201).json({
      success: true,
      message: 'Waste item created and estimated successfully',
      data: {
        wasteItem: populated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMyWaste = async (
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

    const filterQuery: any = {
      collectorId: req.user.id,
      isDeleted: false,
    };

    if (req.query.status && typeof req.query.status === 'string') {
      filterQuery.status = req.query.status;
    }

    const items = await WasteItem.find(filterQuery)
      .populate('materialId', 'name category pricePerKg indicativePrice unit priceTrend')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Collector waste items retrieved successfully',
      data: {
        wasteItems: items,
        count: items.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getWasteById = async (
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
        message: 'Invalid waste item ID format',
      });
      return;
    }

    const wasteItem = await WasteItem.findOne({ _id: id, isDeleted: false }).populate(
      'materialId',
      'name category pricePerKg indicativePrice unit priceTrend'
    );

    if (!wasteItem) {
      res.status(404).json({
        success: false,
        message: 'Waste item not found',
      });
      return;
    }

    // Strict ownership enforcement
    if (wasteItem.collectorId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you do not have permission to view this waste item',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Waste item retrieved successfully',
      data: {
        wasteItem,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateWaste = async (
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
        message: 'Invalid waste item ID format',
      });
      return;
    }

    const wasteItem = await WasteItem.findOne({ _id: id, isDeleted: false });

    if (!wasteItem) {
      res.status(404).json({
        success: false,
        message: 'Waste item not found',
      });
      return;
    }

    if (wasteItem.collectorId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you do not have permission to update this waste item',
      });
      return;
    }

    // Cannot modify if not in available status
    if (wasteItem.status !== 'available') {
      res.status(400).json({
        success: false,
        message: `Cannot edit waste item that is already '${wasteItem.status}'`,
      });
      return;
    }

    const validatedData = updateWasteSchema.parse(req.body);

    let targetMaterialId = wasteItem.materialId;
    if (validatedData.materialId) {
      const material = await Material.findOne({
        _id: validatedData.materialId,
        isActive: true,
      });

      if (!material) {
        res.status(400).json({
          success: false,
          message: 'Selected material is invalid or inactive',
        });
        return;
      }
      targetMaterialId = material._id as any;
      wasteItem.materialId = targetMaterialId;
    }

    if (validatedData.quantityKg !== undefined) {
      wasteItem.quantityKg = validatedData.quantityKg;
    }

    if (validatedData.notes !== undefined) {
      wasteItem.notes = validatedData.notes;
    }

    // Always recalculate valuation server-side if material or quantity changed
    const materialRecord = await Material.findById(targetMaterialId);
    if (materialRecord) {
      const price = materialRecord.pricePerKg ?? materialRecord.indicativePrice;
      wasteItem.estimatedValue = Math.round(wasteItem.quantityKg * price * 100) / 100;
    }

    await wasteItem.save();

    const populated = await WasteItem.findById(wasteItem._id).populate(
      'materialId',
      'name category pricePerKg indicativePrice unit priceTrend'
    );

    res.status(200).json({
      success: true,
      message: 'Waste item updated successfully',
      data: {
        wasteItem: populated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteWaste = async (
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
        message: 'Invalid waste item ID format',
      });
      return;
    }

    const wasteItem = await WasteItem.findOne({ _id: id, isDeleted: false });

    if (!wasteItem) {
      res.status(404).json({
        success: false,
        message: 'Waste item not found',
      });
      return;
    }

    if (wasteItem.collectorId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you do not have permission to delete this waste item',
      });
      return;
    }

    if (wasteItem.status !== 'available') {
      res.status(400).json({
        success: false,
        message: `Cannot delete waste item with status '${wasteItem.status}'`,
      });
      return;
    }

    // Soft deletion to preserve referential integrity
    wasteItem.isDeleted = true;
    await wasteItem.save();

    res.status(200).json({
      success: true,
      message: 'Waste item deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
