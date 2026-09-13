import Timetable from '../models/Timetable.js';
import AcademicYear from '../models/AcademicYear.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

class TimetableController {
  
  /**
   * Helper function to convert "HH:MM AM/PM" to minutes since midnight for easy collision checking.
   */
  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let [ , hours, mins, modifier ] = match;
    hours = parseInt(hours, 10);
    mins = parseInt(mins, 10);
    if (hours === 12 && modifier.toUpperCase() === 'AM') hours = 0;
    if (hours !== 12 && modifier.toUpperCase() === 'PM') hours += 12;
    return hours * 60 + mins;
  }

  /**
   * Helper to check for overlapping times.
   */
  static isOverlap(start1, end1, start2, end2) {
    const s1 = TimetableController.timeToMinutes(start1);
    const e1 = TimetableController.timeToMinutes(end1);
    const s2 = TimetableController.timeToMinutes(start2);
    const e2 = TimetableController.timeToMinutes(end2);
    // Overlap occurs if one period starts before the other ends, and ends after the other starts
    return s1 < e2 && s2 < e1;
  }

  /**
   * POST /api/v1/erp/timetable
   * Admin can assign a period. Includes collision checks.
   */
  static createPeriod = catchAsync(async (req, res) => {
    const { standard, division, medium, dayOfWeek, periodName, startTime, endTime, subjectId, teacherId } = req.body;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) throw new AppError('No active academic year', 400);

    if (req.user.role !== 'ADMIN') throw new AppError('Only administrators can edit the timetable', 403);

    // 1. Check for class overlaps
    // A class cannot have two periods at the same time
    const classPeriods = await Timetable.find({
      academicYearId: activeYear._id,
      standard,
      division,
      medium,
      dayOfWeek
    });

    for (const period of classPeriods) {
      if (TimetableController.isOverlap(startTime, endTime, period.startTime, period.endTime)) {
        throw new AppError(`Class conflict: Period '${period.periodName}' already exists at this time.`, 409);
      }
    }

    // 2. Check for teacher overlaps
    // A teacher cannot be assigned to two classes at the same time
    if (teacherId) {
      const teacherPeriods = await Timetable.find({
        academicYearId: activeYear._id,
        teacherId,
        dayOfWeek
      });

      for (const period of teacherPeriods) {
        if (TimetableController.isOverlap(startTime, endTime, period.startTime, period.endTime)) {
          throw new AppError(`Teacher conflict: This teacher is already scheduled for Std ${period.standard}-${period.division} at this time.`, 409);
        }
      }
    }

    const newPeriod = await Timetable.create({
      academicYearId: activeYear._id,
      standard,
      division,
      medium,
      dayOfWeek,
      periodName,
      startTime,
      endTime,
      subjectId,
      teacherId
    });

    sendResponse(res, 201, newPeriod, 'Period scheduled successfully');
  });

  /**
   * GET /api/v1/erp/timetable
   * Parents get their own child's class timetable (studentId required, ownership-checked).
   */
  static getTimetable = catchAsync(async (req, res) => {
    const { standard, division, medium, teacherId, studentId } = req.query;

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) return sendResponse(res, 200, []);

    let query = { academicYearId: activeYear._id };

    if (req.user.role === 'parent') {
      const student = await verifyParentOwnsStudent(req, studentId);
      query.standard = student.standard;
      query.division = student.division;
      query.medium = student.medium;
    } else if (standard && division && medium) {
      query.standard = standard;
      query.division = division;
      query.medium = medium;
    } else if (teacherId) {
      query.teacherId = teacherId;
    } else {
      // By default, if teacher requests, show their timetable
      if (req.user.role === 'TEACHER') {
        query.teacherId = req.user._id;
      }
    }

    const periods = await Timetable.find(query)
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name')
      .sort({ dayOfWeek: 1, startTime: 1 }); // Sorting by string time might be flawed if format isn't 24h, but we can sort on frontend

    sendResponse(res, 200, periods);
  });

  /**
   * DELETE /api/v1/erp/timetable/:id
   */
  static deletePeriod = catchAsync(async (req, res) => {
    if (req.user.role !== 'ADMIN') throw new AppError('Only administrators can edit the timetable', 403);
    
    const period = await Timetable.findById(req.params.id);
    if (!period) throw new AppError('Period not found', 404);

    await period.deleteOne();
    sendResponse(res, 200, null, 'Period deleted successfully');
  });
}

export default TimetableController;
