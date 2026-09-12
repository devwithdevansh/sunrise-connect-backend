import Exam from '../models/Exam.js';
import ExamResult from '../models/ExamResult.js';
import AcademicYear from '../models/AcademicYear.js';
import AllocationGuardService from '../services/AllocationGuardService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class ExamController {
  /**
   * POST /api/v1/erp/exams
   * Admins create exams for a specific standard and medium.
   */
  static createExam = catchAsync(async (req, res) => {
    const { standard, divisions, medium, examName, type, maxMarks, passingMarks, subjects } = req.body;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      throw new AppError('No active academic year found', 400);
    }

    // Only Admin can create an exam schedule
    if (req.user.role !== 'ADMIN') {
      throw new AppError('Only administrators can schedule new exams', 403);
    }

    const exam = await Exam.create({
      academicYearId: activeYear._id,
      standard,
      divisions,
      medium,
      examName,
      type,
      maxMarks,
      passingMarks,
      subjects,
      createdBy: req.user._id
    });

    sendResponse(res, 201, exam, 'Exam created successfully');
  });

  /**
   * GET /api/v1/erp/exams
   */
  static getExams = catchAsync(async (req, res) => {
    const { standard, medium } = req.query;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      return sendResponse(res, 200, []);
    }

    let query = { academicYearId: activeYear._id };
    if (standard) query.standard = standard;
    if (medium) query.medium = medium;

    const exams = await Exam.find(query)
      .populate('subjects.subjectId', 'subjectName subjectCode')
      .sort({ createdAt: -1 });

    sendResponse(res, 200, exams);
  });

  /**
   * GET /api/v1/erp/exams/results/student/:studentId
   * A parent's (or staff's) view of one child's results across every exam
   * they've taken, across all academic years. Ownership-checked for parents.
   */
  static getResultsForStudent = catchAsync(async (req, res) => {
    const { studentId } = req.params;

    if (req.user.role === 'parent') {
      await verifyParentOwnsStudent(req, studentId);
    }

    const results = await ExamResult.find({ studentId })
      .populate({ path: 'examId', select: 'examName type maxMarks passingMarks academicYearId standard medium' })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ createdAt: -1 });

    sendResponse(res, 200, results);
  });

  /**
   * GET /api/v1/erp/exams/:examId/results?subjectId=xyz&division=A
   * Fetch results for a specific exam, subject, and division
   */
  static getExamResults = catchAsync(async (req, res) => {
    const { examId } = req.params;
    const { subjectId, division } = req.query;

    if (!subjectId || !division) {
      throw new AppError('subjectId and division are required to fetch results', 400);
    }

    const exam = await Exam.findById(examId);
    if (!exam) throw new AppError('Exam not found', 404);

    // Filter by division & subject in the exam results
    // To do this, we need to join with Student collection to filter by division.
    // However, it's easier to just find the ExamResults and populate student, then filter,
    // or query the students in that division and find their results.
    
    // We also must verify that the requesting user is either Admin or the assigned Subject Teacher
    // for this specific class (exam.standard, division, exam.medium, subjectId).
    await AllocationGuardService.verifySubjectTeacherAccess(
      req.user,
      exam.academicYearId,
      exam.standard,
      division,
      exam.medium,
      subjectId
    );

    const results = await ExamResult.find({
      examId,
      subjectId
    }).populate({
      path: 'studentId',
      match: { division: division },
      select: 'studentName admissionNo rollNo division'
    });

    // Filter out results where studentId is null (meaning they didn't match the division)
    const filteredResults = results.filter(r => r.studentId != null);

    sendResponse(res, 200, filteredResults);
  });

  /**
   * POST /api/v1/erp/exams/:examId/results
   * Bulk insert/update exam results for a specific subject & division
   */
  static saveExamResults = catchAsync(async (req, res) => {
    const { examId } = req.params;
    const { subjectId, division, results } = req.body; // results is an array of { studentId, marksObtained, gradeObtained, remarks }

    if (!subjectId || !division || !results) {
      throw new AppError('subjectId, division, and results are required', 400);
    }

    const exam = await Exam.findById(examId);
    if (!exam) throw new AppError('Exam not found', 404);

    // Verify access
    await AllocationGuardService.verifySubjectTeacherAccess(
      req.user,
      exam.academicYearId,
      exam.standard,
      division,
      exam.medium,
      subjectId
    );

    // Process bulk upsert
    const bulkOps = results.map(r => ({
      updateOne: {
        filter: { examId, subjectId, studentId: r.studentId },
        update: {
          $set: {
            marksObtained: r.marksObtained,
            gradeObtained: r.gradeObtained,
            remarks: r.remarks,
            enteredBy: req.user._id,
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await ExamResult.bulkWrite(bulkOps);
    }

    sendResponse(res, 200, null, 'Results saved successfully');
  });
}

export default ExamController;
