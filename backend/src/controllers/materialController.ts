import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Material } from '../models/Material';
import { createMaterialSchema, updateMaterialSchema } from '../validators/materialValidators';

export const getAllMaterials = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, search } = req.query;
    const filter: any = { isActive: true };

    if (category && typeof category === 'string') {
      filter.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    if (search && typeof search === 'string') {
      filter.name = new RegExp(search.trim(), 'i');
    }

    const materials = await Material.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: 'Materials retrieved successfully',
      data: {
        materials,
        count: materials.length,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMaterialById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID format',
      });
      return;
    }

    const material = await Material.findOne({ _id: id, isActive: true });

    if (!material) {
      res.status(404).json({
        success: false,
        message: 'Material not found or has been deactivated',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Material retrieved successfully',
      data: {
        material,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const createMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = createMaterialSchema.parse(req.body);

    const existing = await Material.findOne({
      name: new RegExp(`^${validatedData.name}$`, 'i'),
    });

    if (existing) {
      if (!existing.isActive) {
        // Reactivate previously soft-deleted material with updated values
        existing.isActive = true;
        existing.status = 'active';
        existing.category = validatedData.category;
        existing.pricePerKg = validatedData.pricePerKg || validatedData.indicativePrice!;
        existing.indicativePrice = existing.pricePerKg;
        existing.unit = validatedData.unit || 'per kg';
        existing.priceTrend = validatedData.priceTrend || 'stable';
        if (validatedData.description) existing.description = validatedData.description;
        await existing.save();

        res.status(200).json({
          success: true,
          message: 'Material reactivated and updated successfully',
          data: {
            material: existing,
          },
        });
        return;
      }

      res.status(409).json({
        success: false,
        message: 'A material with this name already exists',
      });
      return;
    }

    const price = validatedData.pricePerKg ?? validatedData.indicativePrice!;
    const material = await Material.create({
      name: validatedData.name,
      category: validatedData.category,
      pricePerKg: price,
      indicativePrice: price,
      unit: validatedData.unit,
      priceTrend: validatedData.priceTrend,
      description: validatedData.description,
      isActive: true,
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      data: {
        material,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID format',
      });
      return;
    }

    const validatedData = updateMaterialSchema.parse(req.body);

    const material = await Material.findById(id);
    if (!material) {
      res.status(404).json({
        success: false,
        message: 'Material not found',
      });
      return;
    }

    if (validatedData.name) material.name = validatedData.name;
    if (validatedData.category) material.category = validatedData.category;
    if (validatedData.pricePerKg !== undefined) {
      material.pricePerKg = validatedData.pricePerKg;
      material.indicativePrice = validatedData.pricePerKg;
    } else if (validatedData.indicativePrice !== undefined) {
      material.indicativePrice = validatedData.indicativePrice;
      material.pricePerKg = validatedData.indicativePrice;
    }
    if (validatedData.unit) material.unit = validatedData.unit;
    if (validatedData.priceTrend) material.priceTrend = validatedData.priceTrend;
    if (validatedData.description !== undefined) material.description = validatedData.description;
    if (validatedData.isActive !== undefined) {
      material.isActive = validatedData.isActive;
      material.status = validatedData.isActive ? 'active' : 'inactive';
    }

    await material.save();

    res.status(200).json({
      success: true,
      message: 'Material updated successfully',
      data: {
        material,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID format',
      });
      return;
    }

    const material = await Material.findById(id);
    if (!material) {
      res.status(404).json({
        success: false,
        message: 'Material not found',
      });
      return;
    }

    // Soft deletion: preserve record for history
    material.isActive = false;
    material.status = 'inactive';
    await material.save();

    res.status(200).json({
      success: true,
      message: 'Material deactivated successfully',
      data: {
        material,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
