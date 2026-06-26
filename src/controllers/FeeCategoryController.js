import FeeCategory from '../models/FeeCategory.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const getAllFeeCategories = catchAsync(async (req, res, next) => {
  const categories = await FeeCategory.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: categories,
  });
});

export const createFeeCategory = catchAsync(async (req, res, next) => {
  const newCategory = await FeeCategory.create(req.body);

  res.status(201).json({
    status: 'success',
    data: newCategory,
  });
});

export const updateFeeCategory = catchAsync(async (req, res, next) => {
  const category = await FeeCategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    return next(new AppError('No fee category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: category,
  });
});

export const deleteFeeCategory = catchAsync(async (req, res, next) => {
  const category = await FeeCategory.findByIdAndDelete(req.params.id);

  if (!category) {
    return next(new AppError('No fee category found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
