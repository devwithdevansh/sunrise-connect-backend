// src/controllers/MigrationController.js
import MigrationService from '../services/MigrationService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class MigrationController {
  /** POST /api/v1/migration/parents */
  static migrateParents = catchAsync(async (req, res) => {
    await MigrationService.migrateParents(req.body.parents);
    sendResponse(res, 200, null, `${req.body.parents.length} parent(s) migrated successfully`);
  });

  /** POST /api/v1/migration/students */
  static migrateStudents = catchAsync(async (req, res) => {
    await MigrationService.migrateStudents(req.body.students);
    sendResponse(res, 200, null, `${req.body.students.length} student(s) migrated successfully`);
  });
}

export default MigrationController;
