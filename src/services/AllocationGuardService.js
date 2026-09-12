import TeacherAllocation from '../models/TeacherAllocation.js';
import ClassTeacherAllocation from '../models/ClassTeacherAllocation.js';
import AppError from '../utils/AppError.js';

class AllocationGuardService {
  /**
   * Validates if a user is authorized to perform homeroom actions (like attendance, leave approval)
   * for a specific class. Admins bypass this.
   */
  static async verifyClassTeacherAccess(user, academicYearId, standard, division, medium) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'STAFF') return true; // Staff often handle data entry for teachers

    const allocation = await ClassTeacherAllocation.findOne({
      academicYearId,
      standard,
      division,
      medium,
      teacherId: user._id
    });

    if (!allocation) {
      throw new AppError(`You are not assigned as the class teacher for Std ${standard}-${division} (${medium})`, 403);
    }
    return true;
  }

  /**
   * Validates if a user is authorized to perform subject-level actions (like grading, homework)
   * for a specific subject in a specific class. Admins bypass this.
   */
  static async verifySubjectTeacherAccess(user, academicYearId, standard, division, medium, subjectId) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'STAFF') return true;

    const allocation = await TeacherAllocation.findOne({
      academicYearId,
      standard,
      division,
      medium,
      subjectId,
      teacherId: user._id
    });

    if (!allocation) {
      throw new AppError(`You are not assigned as the subject teacher for this class.`, 403);
    }
    return true;
  }
}

export default AllocationGuardService;
