// backend/src/seed.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from './models/Student.js';
import StudentFeeLedger from './models/StudentFeeLedger.js';
import FeeCategory from './models/FeeCategory.js';
import PaymentTransaction from './models/Payment.js';
import Parent from './models/Parent.js';
import FeeStructure from './models/FeeStructure.js';
import TransportFeeStructure from './models/TransportFeeStructure.js';
import StudentService from './services/StudentService.js';

dotenv.config();

const uri = process.env.MONGODB_URI;

async function main() {
  try {
    await mongoose.connect(uri);
    // Cleanup any existing seed data to ensure idempotent runs
    await Promise.all([
      Parent.deleteMany({}),
      Student.deleteMany({}),
      StudentFeeLedger.deleteMany({}),
      PaymentTransaction.deleteMany({}),
      FeeCategory.deleteMany({}),
      FeeStructure.deleteMany({}),
      TransportFeeStructure.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing seed collections');
    console.log('✅ Connected to MongoDB');

    // ---- Seed Fee Structures ----
    // These define the master pricing per medium + standard
    const feeStructures = [
      // English medium
      { medium: 'English', standard: '1', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '2', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '3', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '4', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '5', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '6', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '7', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '8', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '9', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '10', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '11', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'English', standard: '12', annualFee: 36000, educationPartCount: 12, termPartCount: 2, isActive: true },
      // Gujarati medium
      { medium: 'Gujarati', standard: '1', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '2', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '3', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '4', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '5', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '6', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '7', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '8', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '9', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '10', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '11', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
      { medium: 'Gujarati', standard: '12', annualFee: 30000, educationPartCount: 12, termPartCount: 2, isActive: true },
    ];
    await FeeStructure.insertMany(feeStructures.map(f => ({ ...f, academicYear: '2025-26' })));
    console.log(`📋 Seeded ${feeStructures.length} FeeStructure records`);

    // ---- Seed Transport Fee Structures ----
    const transportStructures = [
      { transportType: 'Railnagar', amount: 600, frequency: 'MONTHLY', isActive: true },
      { transportType: 'Outside Railnagar', amount: 900, frequency: 'MONTHLY', isActive: true },
    ];
    await TransportFeeStructure.insertMany(transportStructures);
    console.log(`🚌 Seeded ${transportStructures.length} TransportFeeStructure records`);

    // ---- Create a dummy parent for seed data ----
    const seedParent = await Parent.findOneAndUpdate(
      { primaryMobileNumber: '9876543210' },
      {
        $setOnInsert: {
          parentName: 'Seed Parent',
          passwordHash: 'hashedpassword',
          isActive: true
        }
      },
      { upsert: true, new: true }
    );


    // ---- Sample Students ----
    const students = [
      {
        studentName: 'Anita Patel',
        standard: '9',
        division: 'B',
        medium: 'Gujarati',
        isRTE: false,
        status: '1 DUE',
        parentId: seedParent._id,
        studentCode: 'STU001'
      },
      {
        studentName: 'Rohan Singh',
        standard: '10',
        division: 'A',
        medium: 'English',
        isRTE: false,
        status: '1 DUE',
        parentId: seedParent._id,
        studentCode: 'STU002'
      },
      {
        studentName: 'Sneha Kumar',
        standard: '11',
        division: 'C',
        medium: 'English',
        isRTE: true,
        status: 'RTE',
        parentId: seedParent._id,
        studentCode: 'STU003'
      }
    ];

    const insertedStudents = [];
    for (const s of students) {
      const student = await StudentService.createStudent(s);
      insertedStudents.push(student);
    }
    console.log(`📚 Inserted ${insertedStudents.length} students via StudentService`);

    // Fetch the generated ledgers
    const insertedLedgers = await StudentFeeLedger.find({
      studentId: { $in: insertedStudents.map(s => s._id) }
    }).lean();
    console.log(`📒 Fetched ${insertedLedgers.length} auto-generated ledger entries`);

    // ---- Sample Payment (pay for first student's June fee) ----
    const firstStudent = insertedStudents[0];
    const firstLedger = insertedLedgers.find(l => l.studentId.toString() === firstStudent._id.toString());
    if (firstLedger) {
      const payment = new PaymentTransaction({
        ledgerId: firstLedger._id,
        amount: firstLedger.totalAmount,
        method: 'CASH',
        details: { remark: 'Initial seed payment' }
      });
      await payment.save();
      // Update ledger as paid
      await StudentFeeLedger.updateOne(
        { _id: firstLedger._id },
        { $set: { paidAmount: firstLedger.totalAmount, remainingAmount: 0, status: 'PAID' } }
      );
      console.log('💰 Created a sample payment and marked ledger as PAID');
    }

    console.log('✅ Seed script finished');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main();
