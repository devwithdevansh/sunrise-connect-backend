import express from 'express';
import * as expenseController from '../controllers/expense.controller.js';

const router = express.Router();

router
  .route('/')
  .get(expenseController.getExpenses)
  .post(expenseController.createExpense);

router
  .route('/:id')
  .delete(expenseController.deleteExpense);

router
  .patch('/:id/reverse', expenseController.reverseExpense);

export default router;
