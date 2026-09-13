import TeacherAllocation from '../models/TeacherAllocation.js';
import ClassTeacherAllocation from '../models/ClassTeacherAllocation.js';
import Curriculum from '../models/Curriculum.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class AllocationController {
  // ==========================================
  // SUBJECT TEACHER ALLOCATION
  // ==========================================

  static assignSubjectTeacher = catchAsync(async (req, res) => {
    const { academicYearId, teacherId, standard, division, medium, subjectId } = req.body;

    // 1. Validate that the subject exists in the curriculum for this standard/medium
    const curriculum = await Curriculum.findOne({ academicYearId, standard, medium });
    if (!curriculum) {
      throw new AppError(`No curriculum found for Standard ${standard} (${medium})`, 404);
    }
    
    const subjectExists = curriculum.subjects.some(id => id.toString() === subjectId);
    if (!subjectExists) {
      throw new AppError('The selected subject is not mapped to this curriculum.', 400);
    }

    // 2. Upsert allocation (if another teacher was assigned, replace them)
    const allocation = await TeacherAllocation.findOneAndUpdate(
      { academicYearId, standard, division, medium, subjectId },
      { teacherId },
      { new: true, upsert: true, runValidators: true }
    ).populate('teacherId', 'name email role').populate('subjectId');

    sendResponse(res, 200, allocation, 'Subject teacher assigned successfully');
  });

  static getSubjectAllocations = catchAsync(async (req, res) => {
    const { academicYearId, standard, division, medium } = req.query;
    
    let query = { academicYearId };
    if (standard) query.standard = standard;
    if (division) query.division = division;
    if (medium) query.medium = medium;

    const allocations = await TeacherAllocation.find(query)
      .populate('teacherId', 'name email role')
      .populate('subjectId')
      .sort({ standard: 1, division: 1, medium: 1 });
      
    sendResponse(res, 200, allocations);
  });

  static removeSubjectAllocation = catchAsync(async (req, res) => {
    await TeacherAllocation.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, null, 'Subject allocation removed');
  });

  // ==========================================
  // CLASS TEACHER (HOMEROOM) ALLOCATION
  // ==========================================

  static assignClassTeacher = catchAsync(async (req, res) => {
    const { academicYearId, teacherId, standard, division, medium } = req.body;

    // Upsert homeroom teacher
    const allocation = await ClassTeacherAllocation.findOneAndUpdate(
      { academicYearId, standard, division, medium },
      { teacherId },
      { new: true, upsert: true, runValidators: true }
    ).populate('teacherId', 'name email role');

    sendResponse(res, 200, allocation, 'Class teacher assigned successfully');
  });

  static getClassTeacherAllocations = catchAsync(async (req, res) => {
    const { academicYearId, standard, division, medium } = req.query;
    
    let query = { academicYearId };
    if (standard) query.standard = standard;
    if (division) query.division = division;
    if (medium) query.medium = medium;

    const allocations = await ClassTeacherAllocation.find(query)
      .populate('teacherId', 'name email role')
      .sort({ standard: 1, division: 1, medium: 1 });
      
    sendResponse(res, 200, allocations);
  });

  static removeClassTeacherAllocation = catchAsync(async (req, res) => {
    await ClassTeacherAllocation.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, null, 'Class teacher allocation removed');
  });
}

export default AllocationController;
