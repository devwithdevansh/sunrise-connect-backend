import Student from '../models/Student.js';
import AppError from './AppError.js';

/**
 * Shared ownership check for every parent-facing read/write endpoint
 * (Homework, Timetable, Exam results, Attendance, Leave requests): a parent
 * may only ever see or act on their own children, never an arbitrary
 * studentId. Returns the Student doc (callers use its standard/division/
 * medium to scope the rest of the query) or throws.
 */
export default async function verifyParentOwnsStudent(req, studentId) {
  if (!studentId) throw new AppError('studentId is required', 400);
  const student = await Student.findOne({ _id: studentId, parentId: req.user.id });
  if (!student) throw new AppError('Student not found for this account', 404);
  return student;
}
