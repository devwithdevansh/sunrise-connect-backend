export const PERMISSIONS_GROUPS = [
  {
    groupName: 'Academics & Exams',
    permissions: [
      { id: 'MARK_ATTENDANCE', label: 'Mark Attendance' },
      { id: 'ENTER_MARKS', label: 'Enter Marks' },
      { id: 'VIEW_TIMETABLE', label: 'View Timetable' },
      { id: 'SCHEDULE_EXAM', label: 'Schedule Exam' },
      { id: 'GENERATE_RESULT', label: 'Generate Result' },
      { id: 'VIEW_SINGLE_REPORT', label: 'Single Report' }
    ]
  },
  {
    groupName: 'Student Management',
    permissions: [
      { id: 'ADD_ADMISSION', label: 'Add Admission' },
      { id: 'MOVE_STUDENT', label: 'Move Student' },
      { id: 'APPROVE_LEAVE', label: 'Student Leave' },
      { id: 'EARLY_LEAVE', label: 'Early Leave' },
      { id: 'VIEW_COMPLAINT', label: 'Student Complaint' },
      { id: 'TEACHER_REVIEW', label: 'Teacher Review' },
      { id: 'ASSIGN_HOMEWORK', label: 'Homework' }
    ]
  },
  {
    groupName: 'Certificates & Documents',
    permissions: [
      { id: 'BONAFIDE_CERT', label: 'Bonafide' },
      { id: 'TRIAL_CERT', label: 'Trial Certificate' },
      { id: 'CASTE_CERT', label: 'Caste Certificate' },
      { id: 'CHARACTER_CERT', label: 'Character Certificate' },
      { id: 'LEAVING_CERT', label: 'LC (Leaving)' },
      { id: 'NOC_CERT', label: 'NOC' },
      { id: 'BIRTH_CERT', label: 'Birth Certificate' },
      { id: 'CERT_TEMPLATE', label: 'Certificate Template' }
    ]
  },
  {
    groupName: 'Staff & Setup',
    permissions: [
      { id: 'ADD_STAFF', label: 'Add Staff' },
      { id: 'STAFF_ATTENDANCE', label: 'Staff Attendance' },
      { id: 'STAFF_REPORT', label: 'Staff Report' },
      { id: 'SCHOOL_SETUP', label: 'School Setup' },
      { id: 'ADD_USER', label: 'Add User' },
      { id: 'SETTINGS', label: 'Settings' },
      { id: 'IMPORT_EXPORT', label: 'Import/Export Data' },
      { id: 'ANNUAL_CALENDAR', label: 'Annual Calendar' }
    ]
  },
  {
    groupName: 'Communication & ID Cards',
    permissions: [
      { id: 'MESSAGE', label: 'Message' },
      { id: 'TEACHER_MESSAGE', label: 'Teacher Message' },
      { id: 'MESSAGE_TEMPLATE', label: 'Add Message Template' },
      { id: 'ID_HORIZONTAL', label: 'Id-card-horizontal' },
      { id: 'ID_VERTICAL', label: 'Id-card-vertical' }
    ]
  },
  {
    groupName: 'Finance & Accounts',
    permissions: [
      { id: 'PENDING_FEE', label: 'Pending Fee Slip' },
      { id: 'FINANCE_REPORT', label: 'Finance Report' },
      { id: 'ADD_INCOME', label: 'Add Income' },
      { id: 'ADD_INCOME_CAT', label: 'Add Income Category' },
      { id: 'ADD_EXPENSE', label: 'Add Expense' },
      { id: 'ADD_EXPENSE_CAT', label: 'Add Expense Category' },
      { id: 'ADD_BANK', label: 'Add Bank' }
    ]
  },
  {
    groupName: 'Library & E-Content',
    permissions: [
      { id: 'ADD_BOOK', label: 'Add New Book' },
      { id: 'ADD_BOOK_CAT', label: 'Add Book Category' },
      { id: 'ISSUE_RETURN', label: 'Issue & Return Book' },
      { id: 'E_CONTENT', label: 'E-Content' },
      { id: 'E_MATERIAL', label: 'E-Material' }
    ]
  },
  {
    groupName: 'Transport & Inward/Outward',
    permissions: [
      { id: 'ADD_VEHICLE', label: 'Add Vehicle/Driver' },
      { id: 'STUDENTS_IN_VEHICLE', label: 'Students in vehicle' },
      { id: 'VEHICLE_PICKUP', label: 'Vehicle Pickup Point' },
      { id: 'INWARD', label: 'Inward' },
      { id: 'OUTWARD', label: 'Outward' }
    ]
  }
];

export const getAllPermissionIds = () => {
  return PERMISSIONS_GROUPS.flatMap(g => g.permissions.map(p => p.id));
};
