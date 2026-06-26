import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import StudentService from '../services/StudentService.js';
import PaymentService from '../services/PaymentService.js';
import studentRepository from '../repositories/studentRepository.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import StudentController from '../controllers/StudentController.js';
import LedgerController from '../controllers/LedgerController.js';
import PaymentController from '../controllers/PaymentController.js';

// Ensure all models are registered
import '../models/FeeCategory.js';
import '../models/TransportFeeStructure.js';
import '../models/AcademicYear.js';
import '../models/FeeStructure.js';
import '../models/Parent.js';
import '../models/Student.js';
import '../models/StudentFeeLedger.js';
import '../models/Payment.js';

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(clearCollections);

beforeEach(async () => {
  await mongoose.model('AcademicYear').create({
    name: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isActive: true
  });

  await mongoose.model('FeeCategory').create({
    name: 'Transport',
    type: 'TRANSPORT',
    isActive: true
  });

  await mongoose.model('FeeCategory').create({
    name: 'Education',
    type: 'EDUCATION',
    isActive: true
  });

  await mongoose.model('FeeCategory').create({
    name: 'Term',
    type: 'TERM',
    isActive: true
  });

  await mongoose.model('TransportFeeStructure').create([
    { transportType: 'Railnagar', amount: 600, isActive: true },
    { transportType: 'Outside Railnagar', amount: 900, isActive: true }
  ]);
});

describe('Transport status reactivation & payments batch query tests', () => {
  it('updates transport status and reactivates cancelled/pending ledgers properly', async () => {


    // 3. Create a parent
    const parent = await mongoose.model('Parent').create({
      parentName: 'Test Parent',
      primaryMobileNumber: '9876543210',
      passwordHash: 'hash',
      isActive: true
    });

    // 4. Create student with Railnagar transport
    const student = await StudentService.createStudent({
      parentId: parent._id,
      studentName: 'Aarav Shah',
      medium: 'English',
      standard: '5',
      division: 'A',
      transportType: 'Railnagar',
      isNewAdmission: false,
      admissionMonth: 'June'
    });

    expect(student.transportType).toBe('Railnagar');

    // Verify June transport ledger exists
    let transportLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      feeType: 'TRANSPORT'
    });
    expect(transportLedgers.length).toBe(12); // 12 months June to May
    expect(transportLedgers[0].totalAmount).toBe(600);
    expect(transportLedgers[0].status).toBe('PENDING');

    // 5. Update student to None transport
    const updatedNone = await StudentService.updateStudent(student._id, { transportType: 'None' });
    expect(updatedNone.transportType).toBe('None');

    // Verify unpaid transport ledgers are now CANCELLED
    transportLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      feeType: 'TRANSPORT'
    });
    expect(transportLedgers.every(l => l.status === 'CANCELLED')).toBe(true);

    // 6. Update student back to Outside Railnagar
    const updatedOutside = await StudentService.updateStudent(student._id, { transportType: 'Outside Railnagar' });
    expect(updatedOutside.transportType).toBe('Outside Railnagar');

    // Verify transport ledgers are updated to 900 and status reactivated to PENDING
    transportLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      feeType: 'TRANSPORT'
    });
    expect(transportLedgers.length).toBe(12);
    expect(transportLedgers.every(l => l.totalAmount === 900)).toBe(true);
    expect(transportLedgers.every(l => l.status === 'PENDING')).toBe(true);
  });

  it('supports None to Railnagar mid-year transport upgrade and respects transportMonths and academicYear scoping', async () => {


    // 3. Create parent and student with 'None' transport
    const parent = await mongoose.model('Parent').create({
      parentName: 'Test Parent 2',
      primaryMobileNumber: '9876543211',
      passwordHash: 'hash',
      isActive: true
    });

    const student = await StudentService.createStudent({
      parentId: parent._id,
      studentName: 'Vihaan Mehta',
      medium: 'English',
      standard: '5',
      division: 'A',
      transportType: 'None',
      isNewAdmission: false,
      admissionMonth: 'June'
    });

    expect(student.transportType).toBe('None');

    // 4. Verify no transport ledgers exist
    let transportLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      feeType: 'TRANSPORT'
    });
    expect(transportLedgers.length).toBe(0);

    // 5. Update student to Railnagar transport with 5 months remaining
    const updated = await StudentService.updateStudent(student._id, {
      transportType: 'Railnagar',
      transportMonths: 5
    });

    expect(updated.transportType).toBe('Railnagar');

    // Verify exactly 5 months of transport ledgers are created (from Jan to May)
    transportLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      feeType: 'TRANSPORT',
      academicYear: '2025-26'
    });
    expect(transportLedgers.length).toBe(5);
    expect(transportLedgers.every(l => l.totalAmount === 600)).toBe(true);

    const periods = transportLedgers.map(l => l.feePeriod);
    expect(periods).toContain('January');
    expect(periods).toContain('February');
    expect(periods).toContain('March');
    expect(periods).toContain('April');
    expect(periods).toContain('May');
    expect(periods).not.toContain('December');
  });

  it('supports query batching for payments by ledgerIds', async () => {
    // 1. Create dummy ledgers
    const ledger1 = await mongoose.model('StudentFeeLedger').create({
      studentId: new mongoose.Types.ObjectId(),
      feePeriod: 'June',
      feeType: 'EDUCATION',
      totalAmount: 3000,
      paidAmount: 0,
      concessionAmount: 0,
      remainingAmount: 3000,
      dueDate: new Date(),
      status: 'PENDING',
      feeCategoryId: new mongoose.Types.ObjectId(),
      academicYear: '2025-26',
      source: 'MANUAL',
      generatedFrom: 'FEE_STRUCTURE',
      ledgerNumber: 'L1',
      snapshot: { studentName: 'Test 1', medium: 'English', standard: '5', division: 'A', transportType: 'None', isRTE: false }
    });

    const ledger2 = await mongoose.model('StudentFeeLedger').create({
      studentId: new mongoose.Types.ObjectId(),
      feePeriod: 'June',
      feeType: 'TRANSPORT',
      totalAmount: 600,
      paidAmount: 0,
      concessionAmount: 0,
      remainingAmount: 600,
      dueDate: new Date(),
      status: 'PENDING',
      feeCategoryId: new mongoose.Types.ObjectId(),
      academicYear: '2025-26',
      source: 'MANUAL',
      generatedFrom: 'TRANSPORT_STRUCTURE',
      ledgerNumber: 'L2',
      snapshot: { studentName: 'Test 2', medium: 'English', standard: '5', division: 'A', transportType: 'None', isRTE: false }
    });

    // 2. Create payments for these ledgers
    const pay1 = await mongoose.model('Payment').create({
      ledgerId: ledger1._id,
      amount: 1000,
      method: 'CASH',
      isReversal: false
    });

    const pay2 = await mongoose.model('Payment').create({
      ledgerId: ledger2._id,
      amount: 600,
      method: 'UPI',
      isReversal: false
    });

    // Create a payment for another ledger to verify filtering
    const pay3 = await mongoose.model('Payment').create({
      ledgerId: new mongoose.Types.ObjectId(),
      amount: 500,
      method: 'ONLINE',
      isReversal: false
    });

    // 3. Test listPayments with ledgerIds filter (comma-separated string)
    const list = await PaymentService.listPayments({ ledgerIds: `${ledger1._id},${ledger2._id}` }, { limit: 10, skip: 0 });
    expect(list.length).toBe(2);
    
    const matchedIds = list.map(p => p._id.toString());
    expect(matchedIds).toContain(pay1._id.toString());
    expect(matchedIds).toContain(pay2._id.toString());
    expect(matchedIds).not.toContain(pay3._id.toString());
  });

  describe('Parent role ownership constraints tests', () => {
    const mockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };
    const mockNext = (expectedErrText) => jest.fn((err) => {
      if (err) {
        console.error('TEST ERROR CAPTURED:', err);
        if (expectedErrText) {
          expect(err.message).toContain(expectedErrText);
        } else {
          throw err;
        }
      }
    });

    it('listStudents enforces parentId scoping on query', async () => {
      const parent1 = await mongoose.model('Parent').create({ parentName: 'P1', primaryMobileNumber: '9999999991', passwordHash: 'h' });
      const parent2 = await mongoose.model('Parent').create({ parentName: 'P2', primaryMobileNumber: '9999999992', passwordHash: 'h' });

      const s1 = await StudentService.createStudent({ parentId: parent1._id, studentName: 'Student One', medium: 'English', standard: '1', division: 'A' });
      const s2 = await StudentService.createStudent({ parentId: parent2._id, studentName: 'Student Two', medium: 'English', standard: '1', division: 'A' });

      // Query as parent 1
      const req = {
        user: { id: parent1._id.toString(), role: 'parent' },
        query: { limit: 10 }
      };
      const res = mockRes();
      const next = mockNext();

      await StudentController.listStudents(req, res, next);
      
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      const studentIds = body.data.map(s => s._id.toString());
      expect(studentIds).toContain(s1._id.toString());
      expect(studentIds).not.toContain(s2._id.toString());
    });

    it('getStudent throws 403 when accessing another parent student', async () => {
      const parent1 = await mongoose.model('Parent').create({ parentName: 'P1', primaryMobileNumber: '9999999991', passwordHash: 'h' });
      const parent2 = await mongoose.model('Parent').create({ parentName: 'P2', primaryMobileNumber: '9999999992', passwordHash: 'h' });

      const s2 = await StudentService.createStudent({ parentId: parent2._id, studentName: 'Student Two', medium: 'English', standard: '1', division: 'A' });

      const req = {
        user: { id: parent1._id.toString(), role: 'parent' },
        params: { id: s2._id.toString() }
      };
      const res = mockRes();
      const next = mockNext('permission to view this student');

      await StudentController.getStudent(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('listLedgers scopes to parent students ledgers', async () => {
      const parent1 = await mongoose.model('Parent').create({ parentName: 'P1', primaryMobileNumber: '9999999991', passwordHash: 'h' });
      const parent2 = await mongoose.model('Parent').create({ parentName: 'P2', primaryMobileNumber: '9999999992', passwordHash: 'h' });

      const s1 = await StudentService.createStudent({ parentId: parent1._id, studentName: 'Student One', medium: 'English', standard: '1', division: 'A' });
      const s2 = await StudentService.createStudent({ parentId: parent2._id, studentName: 'Student Two', medium: 'English', standard: '1', division: 'A' });

      const req = {
        user: { id: parent1._id.toString(), role: 'parent' },
        query: { limit: 100 }
      };
      const res = mockRes();
      const next = mockNext();

      await LedgerController.listLedgers(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      const studentIds = body.data.map(l => l.studentId.toString());
      expect(studentIds.every(id => id === s1._id.toString())).toBe(true);
    });

    it('createPayment throws 403 for other student ledger', async () => {
      const parent1 = await mongoose.model('Parent').create({ parentName: 'P1', primaryMobileNumber: '9999999991', passwordHash: 'h' });
      const parent2 = await mongoose.model('Parent').create({ parentName: 'P2', primaryMobileNumber: '9999999992', passwordHash: 'h' });

      const s2 = await StudentService.createStudent({ parentId: parent2._id, studentName: 'Student Two', medium: 'English', standard: '1', division: 'A' });
      const s2Ledger = await mongoose.model('StudentFeeLedger').findOne({ studentId: s2._id });

      const req = {
        user: { id: parent1._id.toString(), role: 'parent' },
        body: { ledgerId: s2Ledger._id.toString(), amount: 1000, method: 'CASH' }
      };
      const res = mockRes();
      const next = mockNext('permission to pay for this ledger');

      await PaymentController.createPayment(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
