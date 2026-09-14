// src/validations/student.schema.js
import { z } from 'zod';

const profileSchema = z.object({
  birthPlace: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  caste: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  medicalRemark: z.string().nullable().optional(),
});

export const createStudentSchema = {
  body: z.object({
    parentId: z.string().min(1).optional(),
    studentCode: z.string().min(1).optional(),
    studentName: z.string().min(1).max(100),
    parentName: z.string().optional(),
    parentMobile: z.string().optional(),
    parentSecondaryMobile: z.string().optional(),
    medium: z.enum(['English', 'Gujarati']),
    standard: z.string().min(1),
    division: z.string().min(1),
    transportType: z.string().optional(),
    isRTE: z.boolean().optional(),
    isNewAdmission: z.boolean().optional(),
    buyBagKit: z.boolean().optional(),
    admissionMonth: z.enum(['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']).optional(),
    transportStartMonth: z.enum(['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']).optional(),
    surname: z.string().nullable().optional(),
    fatherName: z.string().nullable().optional(),
    motherName: z.string().nullable().optional(),
    grNo: z.string().nullable().optional(),
    gender: z.enum(['Male', 'Female']).nullable().optional(),
    dob: z.coerce.date().nullable().optional(),
    aadharNo: z.string().nullable().optional(),
    penNo: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    profile: profileSchema.optional(),
  }),
};

export const updateStudentSchema = {
  body: z.object({
    studentName: z.string().min(1).max(100).optional(),
    medium: z.enum(['English', 'Gujarati']).optional(),
    standard: z.string().optional(),
    division: z.string().optional(),
    transportType: z.string().optional(),
    transportMonths: z.coerce.number().int().min(0).max(12).optional(),
    isRTE: z.boolean().optional(),
    isNewAdmission: z.boolean().optional(),
    buyBagKit: z.boolean().optional(),
    admissionMonth: z.enum(['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']).optional(),
    transportStartMonth: z.enum(['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']).optional(),
    isActive: z.boolean().optional(),
    parentName: z.string().optional(),
    parentMobile: z.string().optional(),
    parentSecondaryMobile: z.string().nullable().optional(),
    parentAllowOtpReset: z.boolean().optional(),
    isMigrated: z.boolean().optional(),
    grNo: z.string().nullable().optional(),
    fatherName: z.string().nullable().optional(),
    motherName: z.string().nullable().optional(),
    gender: z.enum(['Male', 'Female']).nullable().optional(),
    dob: z.coerce.date().nullable().optional(),
    aadharNo: z.string().nullable().optional(),
    penNo: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    surname: z.string().nullable().optional(),
    profile: profileSchema.optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
};

export const listStudentsSchema = {
  query: z.object({
    parentId: z.string().optional(),
    medium: z.enum(['English', 'Gujarati']).optional(),
    standard: z.string().optional(),
    division: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(2000).optional(),
    skip: z.coerce.number().int().min(0).optional(),
  }),
};

export const deleteStudentSchema = {
  params: z.object({ id: z.string().min(1) }),
};
