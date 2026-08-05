import Expense from '../models/Expense.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const createExpense = catchAsync(async (req, res, next) => {
  const { title, category, amount, paymentMethod, description, date } = req.body;

  if (!title || amount === undefined || amount === null) {
    return next(new AppError('Title and amount are required', 400));
  }

  const expense = await Expense.create({
    title,
    category: category || 'Miscellaneous',
    amount: Number(amount),
    paymentMethod: paymentMethod || 'CASH',
    description: description || '',
    date: date ? new Date(date) : new Date(),
    createdBy: req.user ? req.user._id : null,
  });

  res.status(201).json({
    status: 'success',
    data: { expense },
  });
});

export const getExpenses = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  let query = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    query.date = { $gte: start, $lte: end };
  }

  const expenses = await Expense.find(query)
    .sort({ date: -1, createdAt: -1 })
    .populate('createdBy', 'name email role');

  res.status(200).json({
    status: 'success',
    results: expenses.length,
    data: { expenses },
  });
});

export const deleteExpense = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const expense = await Expense.findByIdAndDelete(id);

  if (!expense) {
    return next(new AppError('No expense found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Expense deleted successfully',
  });
});

export const reverseExpense = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  const expense = await Expense.findById(id);
  if (!expense) {
    return next(new AppError('No expense found with that ID', 404));
  }

  if (expense.isReversed) {
    return next(new AppError('Expense is already reversed', 400));
  }

  expense.isReversed = true;
  expense.reversedAt = new Date();
  expense.reversedReason = reason || 'Reversed by user';

  await expense.save();

  res.status(200).json({
    status: 'success',
    data: { expense },
  });
});
