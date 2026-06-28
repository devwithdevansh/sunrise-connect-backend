import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import StudentService from '../services/StudentService.js';
import AcademicYear from '../models/AcademicYear.js';
import FeeStructure from '../models/FeeStructure.js';
import StudentFeeLedger from '../models/StudentFeeLedger.js';
import Student from '../models/Student.js';

// Ensure all models are registered
import '../models/FeeCategory.js';
import '../models/TransportFeeStructure.js';
import '../models/Parent.js';

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(clearCollections);

describe('Student Promotion & Ledger Isolation', () => {
  it('does not generate ledgers for a new active year until student is promoted, and then uses the promoted standard fees', async () => {
    // 1. Create Academic Years
    const ay25 = await AcademicYear.create({
      name: '2025-26',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      isActive: true,
    });

    const ay26 = await AcademicYear.create({
      name: '2026-27',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: false,
    });

    // 2. Create Fee Structures
    // 2025-26 standard 1
    await FeeStructure.create({
      standard: '1',
      medium: 'English',
      annualFee: 14000, // 1000 per part (12 months + 2 terms)
      educationPartCount: 12,
      termPartCount: 2,
      academicYear: '2025-26',
      isActive: true,
    });

    // 2026-27 standard 1 (if they remained)
    await FeeStructure.create({
      standard: '1',
      medium: 'English',
      annualFee: 15400, // 1100 per part
      educationPartCount: 12,
      termPartCount: 2,
      academicYear: '2026-27',
      isActive: true,
    });

    // 2026-27 standard 2 (promoted standard fee structure)
    await FeeStructure.create({
      standard: '2',
      medium: 'English',
      annualFee: 21000, // 1500 per part
      educationPartCount: 12,
      termPartCount: 2,
      academicYear: '2026-27',
      isActive: true,
    });

    // 3. Create student in 2025-26 (standard 1)
    const student = await StudentService.createStudent({
      studentName: 'Rohan Sharma',
      medium: 'English',
      standard: '1',
      division: 'A',
      parentMobile: '9876543210',
      parentName: 'Mr. Sharma',
    });

    // Verify 2025-26 ledgers are created (1000 per part)
    const ledgers25 = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2025-26' });
    expect(ledgers25.length).toBeGreaterThan(0);
    const eduLedger25 = ledgers25.find(l => l.feeType === 'EDUCATION');
    expect(eduLedger25.totalAmount).toBe(1000);

    // 4. Change active year to 2026-27
    ay25.isActive = false;
    await ay25.save();
    ay26.isActive = true;
    await ay26.save();

    // 5. Try to regenerate ledgers (simulating frontend auto-sync on page view)
    const syncRes = await StudentService.regenerateMissingLedgers(student._id);
    expect(syncRes.created).toBe(0);

    // Verify absolutely no ledgers were created for 2026-27 yet
    const ledgers26BeforePromote = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2026-27' });
    expect(ledgers26BeforePromote.length).toBe(0);

    // 6. Promote student to standard 2 in 2026-27
    await StudentService.promoteStudents([student._id], '2', 'A', '2026-27', new mongoose.Types.ObjectId());

    // Verify student standard is updated to 2
    const updatedStudent = await Student.findById(student._id);
    expect(updatedStudent.standard).toBe('2');

    // Verify ledgers for 2026-27 are now created using standard 2 fees (1500 per part)
    const ledgers26AfterPromote = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2026-27' });
    expect(ledgers26AfterPromote.length).toBeGreaterThan(0);
    const eduLedger26 = ledgers26AfterPromote.find(l => l.feeType === 'EDUCATION');
    expect(eduLedger26.totalAmount).toBe(1500); // Promoted fee structure rate

    // Verify 2025-26 ledgers remain unchanged at standard 1 fees (1000 per part)
    const finalLedgers25 = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2025-26' });
    const finalEduLedger25 = finalLedgers25.find(l => l.feeType === 'EDUCATION');
    expect(finalEduLedger25.totalAmount).toBe(1000);

    // 7. Change active year back to 2025-26 and run regenerate ledgers for Rohan (who is now std 2 in DB)
    ay26.isActive = false;
    await ay26.save();
    ay25.isActive = true;
    await ay25.save();

    const regenRes = await StudentService.regenerateMissingLedgers(student._id);
    expect(regenRes.updated).toBe(0); // Should not update any amounts to Std 2 because snapshot has Std 1

    // Verify 2025-26 ledgers STILL remain at standard 1 fees (1000 per part)
    const finalLedgers25AfterRegen = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2025-26' });
    const finalEduLedger25AfterRegen = finalLedgers25AfterRegen.find(l => l.feeType === 'EDUCATION');
    expect(finalEduLedger25AfterRegen.totalAmount).toBe(1000);
  });

  it('correctly handles transport cases during promotion, rate increases, and ledger regeneration', async () => {
    // 1. Setup Academic Years
    const ay25 = await AcademicYear.create({
      name: '2025-26',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      isActive: true,
    });

    const ay26 = await AcademicYear.create({
      name: '2026-27',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: false,
    });

    // 2. Setup Fee Structures
    await FeeStructure.create({
      standard: '1',
      medium: 'English',
      annualFee: 14000,
      educationPartCount: 12,
      termPartCount: 2,
      academicYear: '2025-26',
      isActive: true,
    });

    await FeeStructure.create({
      standard: '2',
      medium: 'English',
      annualFee: 21000,
      educationPartCount: 12,
      termPartCount: 2,
      academicYear: '2026-27',
      isActive: true,
    });

    // 3. Setup Transport Fee Structure for 2025-26 (Active rate = 1000)
    const tfs25 = await mongoose.model('TransportFeeStructure').create({
      transportType: 'Railnagar',
      amount: 1000,
      frequency: 'MONTHLY',
      isActive: true,
    });

    // 4. Create Student with Transport starting in December 2025
    const student = await StudentService.createStudent({
      studentName: 'Amit Patel',
      medium: 'English',
      standard: '1',
      division: 'A',
      parentMobile: '9876543211',
      parentName: 'Mr. Patel',
      transportType: 'Railnagar',
      transportStartMonth: 'December',
    });

    // Verify 2025-26 transport ledgers are created starting in December with rate 1000
    const ledgers25 = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2025-26', feeType: 'TRANSPORT' });
    expect(ledgers25.length).toBe(6); // Dec, Jan, Feb, Mar, Apr, May
    for (const l of ledgers25) {
      expect(l.totalAmount).toBe(1000);
    }
    const monthsWithTransport = ledgers25.map(l => l.feePeriod);
    expect(monthsWithTransport).toEqual(expect.arrayContaining(['December', 'January', 'February', 'March', 'April', 'May']));
    expect(monthsWithTransport).not.toContain('June');

    // 5. Update Transport Fee Structure for 2026-27 (Rate increases to 1500)
    tfs25.isActive = false;
    await tfs25.save();

    const tfs26 = await mongoose.model('TransportFeeStructure').create({
      transportType: 'Railnagar',
      amount: 1500,
      frequency: 'MONTHLY',
      isActive: true,
    });

    // 6. Switch Active Academic Year to 2026-27
    ay25.isActive = false;
    await ay25.save();
    ay26.isActive = true;
    await ay26.save();

    // 7. Promote Student to Std 2 in 2026-27
    await StudentService.promoteStudents([student._id], '2', 'A', '2026-27', new mongoose.Types.ObjectId());

    // Verify student transportStartMonth is reset to 'June'
    const updatedStudent = await Student.findById(student._id);
    expect(updatedStudent.transportStartMonth).toBe('June');

    // Verify transport ledgers in 2026-27 are created for all 12 months at the new rate 1500
    const ledgers26 = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2026-27', feeType: 'TRANSPORT' });
    expect(ledgers26.length).toBe(12);
    for (const l of ledgers26) {
      expect(l.totalAmount).toBe(1500);
    }

    // 8. Temporarily switch active year back to 2025-26 and run regeneration for Amit Patel
    ay26.isActive = false;
    await ay26.save();
    ay25.isActive = true;
    await ay25.save();

    const regenRes = await StudentService.regenerateMissingLedgers(student._id);
    expect(regenRes.updated).toBe(0);

    // Verify that Amit Patel's 2025-26 transport ledgers are NOT modified
    // (still only Dec-May, and still at 1000)
    const ledgers25AfterRegen = await StudentFeeLedger.find({ studentId: student._id, academicYear: '2025-26', feeType: 'TRANSPORT' });
    expect(ledgers25AfterRegen.length).toBe(6);
    for (const l of ledgers25AfterRegen) {
      expect(l.totalAmount).toBe(1000);
    }

    // 9. Verify Past Year Isolation for new transport users
    // Create a new non-transport student in 2025-26
    const nonTransportStudent = await StudentService.createStudent({
      studentName: 'Suresh Kumar',
      medium: 'English',
      standard: '1',
      division: 'A',
      parentMobile: '9876543212',
      parentName: 'Mr. Kumar',
      transportType: 'None',
    });

    // Promote Suresh to 2026-27
    ay25.isActive = false;
    await ay25.save();
    ay26.isActive = true;
    await ay26.save();

    await StudentService.promoteStudents([nonTransportStudent._id], '2', 'A', '2026-27', new mongoose.Types.ObjectId());

    // Suresh opts for transport in 2026-27 (active year)
    await StudentService.updateStudent(nonTransportStudent._id, {
      transportType: 'Railnagar',
      transportStartMonth: 'June',
    });

    // Verify Suresh has transport ledgers in 2026-27
    const sureshLedgers26 = await StudentFeeLedger.find({ studentId: nonTransportStudent._id, academicYear: '2026-27', feeType: 'TRANSPORT' });
    expect(sureshLedgers26.length).toBe(12);

    // Run regeneration for Suresh's past year 2025-26
    ay26.isActive = false;
    await ay26.save();
    ay25.isActive = true;
    await ay25.save();

    await StudentService.regenerateMissingLedgers(nonTransportStudent._id);

    // Verify Suresh STILL has NO transport ledgers in 2025-26
    const sureshLedgers25 = await StudentFeeLedger.find({ studentId: nonTransportStudent._id, academicYear: '2025-26', feeType: 'TRANSPORT' });
    expect(sureshLedgers25.length).toBe(0);
  });
});
