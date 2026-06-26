import express from 'express';
import * as feeCategoryController from '../controllers/FeeCategoryController.js';

const router = express.Router();

router
  .route('/')
  .get(feeCategoryController.getAllFeeCategories)
  .post(feeCategoryController.createFeeCategory);

router
  .route('/:id')
  .put(feeCategoryController.updateFeeCategory)
  .delete(feeCategoryController.deleteFeeCategory);

export default router;
