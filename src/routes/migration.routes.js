// src/routes/migration.routes.js
import { Router } from 'express';
import MigrationController from '../controllers/MigrationController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/parents',  MigrationController.migrateParents);
router.post('/students', MigrationController.migrateStudents);

export default router;
