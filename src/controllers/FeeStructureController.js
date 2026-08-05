// src/controllers/FeeStructureController.js
import FeeStructure from '../models/FeeStructure.js';
import TransportFeeStructure from '../models/TransportFeeStructure.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import AppError from '../utils/AppError.js';

class FeeStructureController {
  /**
   * GET /api/v1/fee-structures
   * Returns all active fee structures and transport fee structures
   * so the frontend can dynamically price every fee category.
   */
  static list = catchAsync(async (_req, res) => {
    const [feeStructures, transportStructures] = await Promise.all([
      FeeStructure.find({ isActive: true }).lean(),
      TransportFeeStructure.find({ isActive: true }).lean(),
    ]);

    sendResponse(res, 200, { feeStructures, transportStructures });
  });

  /**
   * POST /api/v1/fee-structures
   * Create a new standard fee structure
   */
  static createFeeStructure = catchAsync(async (req, res) => {
    const existing = await FeeStructure.findOne({ 
      medium: req.body.medium, 
      standard: req.body.standard, 
      academicYear: req.body.academicYear 
    });
    if (existing) {
      if (existing.isActive) {
        throw new AppError('Fee structure already exists for this academic year, medium and standard', 400);
      }
      const updated = await FeeStructure.findByIdAndUpdate(
        existing._id,
        { ...req.body, isActive: true },
        { new: true, runValidators: true }
      );
      return sendResponse(res, 200, updated);
    }
    const newStructure = await FeeStructure.create(req.body);
    sendResponse(res, 201, newStructure);
  });

  /**
   * POST /api/v1/fee-structures/transport
   * Create a new transport fee structure
   */
  static createTransportFeeStructure = catchAsync(async (req, res) => {
    const existing = await TransportFeeStructure.findOne({
      transportType: req.body.transportType,
      academicYear: req.body.academicYear
    });
    if (existing) {
      if (existing.isActive) {
        throw new AppError('Transport fee structure already exists for this zone and academic year', 400);
      }
      const updated = await TransportFeeStructure.findByIdAndUpdate(
        existing._id,
        { ...req.body, isActive: true },
        { new: true, runValidators: true }
      );
      return sendResponse(res, 200, updated);
    }
    const newStructure = await TransportFeeStructure.create(req.body);
    sendResponse(res, 201, newStructure);
  });

  /**
   * PUT /api/v1/fee-structures/:id
   * Updates standard fee structure (e.g. annualFee, parts counts)
   */
  static updateFeeStructure = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updated = await FeeStructure.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) {
      throw new AppError('Fee structure not found', 404);
    }
    sendResponse(res, 200, updated);
  });

  /**
   * PUT /api/v1/fee-structures/transport/:id
   * Updates transport fee structure (e.g. amount)
   */
  static updateTransportFeeStructure = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updated = await TransportFeeStructure.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) {
      throw new AppError('Transport fee structure not found', 404);
    }
    sendResponse(res, 200, updated);
  });

  /**
   * DELETE /api/v1/fee-structures/:id
   * Hard deletes a standard fee structure
   */
  static deleteFeeStructure = catchAsync(async (req, res) => {
    const { id } = req.params;
    const deleted = await FeeStructure.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError('Fee structure not found', 404);
    }
    sendResponse(res, 200, null, 'Fee structure deleted successfully');
  });

  /**
   * DELETE /api/v1/fee-structures/transport/:id
   * Hard deletes a transport fee structure
   */
  static deleteTransportFeeStructure = catchAsync(async (req, res) => {
    const { id } = req.params;
    const deleted = await TransportFeeStructure.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError('Transport fee structure not found', 404);
    }
    sendResponse(res, 200, null, 'Transport fee structure deleted successfully');
  });

  /**
   * POST /api/v1/fee-structures/copy
   * Copies all FeeStructure and TransportFeeStructure configurations from one academic year to another.
   */
  static copyFeeStructures = catchAsync(async (req, res) => {
    const { fromYear, toYear } = req.body;
    if (!fromYear || !toYear) {
      throw new AppError('fromYear and toYear are required', 400);
    }
    if (fromYear === toYear) {
      throw new AppError('Cannot copy to the same academic year', 400);
    }

    // 1. Copy Education/Standard Fee Structures
    const sourceStructures = await FeeStructure.find({ academicYear: fromYear }).lean();
    let copiedCount = 0;
    
    for (const struct of sourceStructures) {
      const exists = await FeeStructure.exists({
        academicYear: toYear,
        medium: struct.medium,
        standard: struct.standard
      });
      if (!exists) {
        delete struct._id;
        delete struct.createdAt;
        delete struct.updatedAt;
        delete struct.__v;
        struct.academicYear = toYear;
        await FeeStructure.create(struct);
        copiedCount++;
      }
    }

    // 2. Copy Transport Fee Structures
    const sourceTransport = await TransportFeeStructure.find({ academicYear: fromYear }).lean();
    let copiedTransportCount = 0;

    for (const trans of sourceTransport) {
      const exists = await TransportFeeStructure.exists({
        academicYear: toYear,
        transportType: trans.transportType
      });
      if (!exists) {
        delete trans._id;
        delete trans.createdAt;
        delete trans.updatedAt;
        delete trans.__v;
        trans.academicYear = toYear;
        await TransportFeeStructure.create(trans);
        copiedTransportCount++;
      }
    }

    sendResponse(res, 201, { copiedCount, copiedTransportCount }, `Successfully copied ${copiedCount} standard rates and ${copiedTransportCount} transport rates.`);
  });
}

export default FeeStructureController;
