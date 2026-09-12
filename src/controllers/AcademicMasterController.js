import Subject from '../models/Subject.js';
import Curriculum from '../models/Curriculum.js';
import AcademicYear from '../models/AcademicYear.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class AcademicMasterController {
  // ==========================================
  // SUBJECT MASTER
  // ==========================================

  static createSubject = catchAsync(async (req, res) => {
    const { subjectName, subjectCode, type, gradingSystem } = req.body;
    
    const existing = await Subject.findOne({ subjectName });
    if (existing) {
      throw new AppError('Subject with this name already exists', 400);
    }
    
    const subject = await Subject.create({ subjectName, subjectCode, type, gradingSystem });
    sendResponse(res, 201, subject, 'Subject created successfully');
  });

  static getSubjects = catchAsync(async (req, res) => {
    const subjects = await Subject.find().sort({ subjectName: 1 });
    sendResponse(res, 200, subjects);
  });

  static updateSubject = catchAsync(async (req, res) => {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!subject) throw new AppError('Subject not found', 404);
    sendResponse(res, 200, subject, 'Subject updated successfully');
  });

  static deleteSubject = catchAsync(async (req, res) => {
    // Check if subject is used in any curriculum before deleting
    const inUse = await Curriculum.findOne({ subjects: req.params.id });
    if (inUse) {
      throw new AppError('Cannot delete subject because it is used in a curriculum', 400);
    }
    
    await Subject.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, null, 'Subject deleted successfully');
  });

  // ==========================================
  // CURRICULUM
  // ==========================================

  static createOrUpdateCurriculum = catchAsync(async (req, res) => {
    const { academicYearId, standard, medium, subjects } = req.body;
    
    // Ensure AcademicYear exists
    const year = await AcademicYear.findById(academicYearId);
    if (!year) throw new AppError('Academic year not found', 404);

    let curriculum = await Curriculum.findOne({ academicYearId, standard, medium });
    
    if (curriculum) {
      curriculum.subjects = subjects;
      await curriculum.save();
    } else {
      curriculum = await Curriculum.create({ academicYearId, standard, medium, subjects });
    }
    
    const populated = await Curriculum.findById(curriculum._id).populate('subjects');
    sendResponse(res, 200, populated, 'Curriculum saved successfully');
  });

  static getCurriculums = catchAsync(async (req, res) => {
    const { academicYearId } = req.query;
    let query = {};
    if (academicYearId) query.academicYearId = academicYearId;
    
    const curriculums = await Curriculum.find(query).populate('subjects').sort({ standard: 1, medium: 1 });
    sendResponse(res, 200, curriculums);
  });
}

export default AcademicMasterController;
