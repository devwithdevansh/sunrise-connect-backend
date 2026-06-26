import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import StudentService from '../services/StudentService.js';

// Ensure all models are registered
import '../models/FeeCategory.js';
import '../models/TransportFeeStructure.js';
import '../models/AcademicYear.js';
import '../models/FeeStructure.js';
import '../models/Parent.js';
import '../models/Student.js';
import '../models/StudentFeeLedger.js';

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(clearCollections);

beforeEach(async () => {
  // Create active year
  await mongoose.model('AcademicYear').create({
    name: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isActive: true
  });

  // Create standard categories
  await mongoose.model('FeeCategory').create([
    { name: 'Education', type: 'EDUCATION', isActive: true },
    { name: 'Transport', type: 'TRANSPORT', isActive: true },
    { name: 'Term', type: 'TERM', isActive: true },
    { name: 'Admission', type: 'ADMISSION', isActive: true },
    { name: 'Bag & Kit', type: 'OTHER', isActive: true }
  ]);

  // Create Fee Structure
  await mongoose.model('FeeStructure').create({
    medium: 'English',
    standard: '5',
    annualFee: 14000,
    educationPartCount: 12,
    termPartCount: 2,
    termFee: 1000,
    admissionFee: 800,
    bagKitFee: 500,
    isActive: true
  });
});

describe('Student excel import multi-year fee generation tests', () => {
  it('generates multi-year fees with range parsing and entry-year only one-time fees', async () => {
    const parent = await mongoose.model('Parent').create({
      parentName: 'Amit Sharma',
      primaryMobileNumber: '9876543210',
      passwordHash: 'hash',
      isActive: true
    });

    // Create student with pending fees for 2024-25 and 2025-26
    const student = await StudentService.createStudent({
      parentId: parent._id,
      studentName: 'Rahul Sharma',
      medium: 'English',
      standard: '5',
      division: 'A',
      isNewAdmission: true,
      pendingFees: {
        '2024-25': 'oct to may',
        '2025-26': 'paid'
      }
    });

    expect(student._id).toBeDefined();

    const ledgers = await mongoose.model('StudentFeeLedger').find({ studentId: student._id });

    // Expecting:
    // 2024-25: 12 Education, 2 Term, 1 Admission, 1 Bag & Kit = 16 ledgers
    // 2025-26: 12 Education, 2 Term = 14 ledgers
    // Total = 30 ledgers
    expect(ledgers.length).toBe(30);

    // Verify 2025-26 ledgers are all PAID
    const year2526 = ledgers.filter(l => l.academicYear === '2025-26');
    expect(year2526.length).toBe(14);
    expect(year2526.every(l => l.status === 'PAID')).toBe(true);
    expect(year2526.every(l => l.remainingAmount === 0)).toBe(true);

    // Verify 2024-25 range parsing (oct to may)
    const year2425 = ledgers.filter(l => l.academicYear === '2024-25');
    expect(year2425.length).toBe(16);

    // Check months June to September are PAID
    const paidMonths = ['June', 'July', 'August', 'September'];
    paidMonths.forEach(m => {
      const edu = year2425.find(l => l.feeType === 'EDUCATION' && l.feePeriod === m);
      expect(edu.status).toBe('PAID');
      expect(edu.remainingAmount).toBe(0);
      expect(edu.paidAmount).toBe(edu.totalAmount);
    });

    // Check months October to May are PENDING
    const pendingMonths = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
    pendingMonths.forEach(m => {
      const edu = year2425.find(l => l.feeType === 'EDUCATION' && l.feePeriod === m);
      expect(edu.status).toBe('PENDING');
      expect(edu.remainingAmount).toBe(edu.totalAmount);
      expect(edu.paidAmount).toBe(0);
    });

    // Check Term 1 (June) is PAID, Term 2 (October) is PENDING
    const term1 = year2425.find(l => l.feeType === 'TERM' && l.feePeriod === 'Term 1');
    expect(term1.status).toBe('PAID');
    const term2 = year2425.find(l => l.feeType === 'TERM' && l.feePeriod === 'Term 2');
    expect(term2.status).toBe('PENDING');

    // Check Admission and Bag & Kit (One-time, earliest year 2024-25) are PAID (June index is before Oct)
    const adm = year2425.find(l => l.feeType === 'ADMISSION');
    expect(adm.status).toBe('PAID');
    expect(adm.remainingAmount).toBe(0);

    const bag = year2425.find(l => l.feeType === 'BAG_KIT');
    expect(bag.status).toBe('PAID');
    expect(bag.remainingAmount).toBe(0);

    // Check no Admission or Bag & Kit for 2025-26
    const adm25 = year2526.find(l => l.feeType === 'ADMISSION');
    expect(adm25).toBeUndefined();
  });
});
