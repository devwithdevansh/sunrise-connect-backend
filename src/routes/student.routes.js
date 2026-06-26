// src/routes/student.routes.js
import { Router } from 'express';
import StudentController from '../controllers/StudentController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createStudentSchema,
  updateStudentSchema,
  listStudentsSchema,
  deleteStudentSchema,
} from '../validations/student.schema.js';

const router = Router();

router.use(authenticate);

router.post('/',     authorize('ADMIN', 'STAFF'), validate(createStudentSchema), StudentController.createStudent);
router.post('/promote', authorize('ADMIN'), StudentController.promoteStudents);
router.post('/import', authorize('ADMIN'), StudentController.importStudents);
router.get('/',      authorize('ADMIN', 'STAFF', 'parent'), validate(listStudentsSchema),  StudentController.listStudents);
router.get('/:id',   authorize('ADMIN', 'STAFF', 'parent'), StudentController.getStudent);
router.patch('/:id', authorize('ADMIN', 'STAFF'), validate(updateStudentSchema), StudentController.updateStudent);
router.delete('/:id', authorize('ADMIN', 'STAFF'), validate(deleteStudentSchema), StudentController.deleteStudent);
router.post('/:id/regenerate-ledgers', authorize('ADMIN'), StudentController.regenerateLedgers);
router.post('/:id/custom-fee', authorize('ADMIN', 'STAFF'), StudentController.addCustomFee);

export default router;
