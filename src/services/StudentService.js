// src/services/StudentService.js
// Service layer for Student entity – frozen architecture compliance
// No password reset for students (not part of requirements)

import mongoose from 'mongoose';
import studentRepository from '../repositories/studentRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

import '../models/Parent.js';
import '../models/FeeCategory.js';
import '../models/FeeStructure.js';
import '../models/TransportFeeStructure.js';
import '../models/StudentFeeLedger.js';
import '../models/Payment.js';
import '../models/AcademicYear.js';

class StudentService {
  /** Create a new student */
  static async createStudent(data, performedBy = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let parentId = data.parentId;
      if (!parentId && data.parentMobile) {
        // Normalize mobile number: extract digits
        let mobile = data.parentMobile.replace(/\D/g, '');
        if (mobile.length > 10) {
          mobile = mobile.slice(-10);
        }
        if (!/^[6-9]\d{9}$/.test(mobile)) {
          mobile = '9' + mobile.padEnd(9, '0').slice(0, 9);
        }

        let parent = await mongoose.model('Parent').findOne({ primaryMobileNumber: mobile }, null, { session });
        if (!parent) {
          // Generate a random unusable hash — parent must set password via onboarding flow
          const { randomBytes } = await import('crypto');
          const randomPasswordHash = randomBytes(32).toString('hex');
          const newParent = {
            parentName: data.parentName || `Parent of ${data.studentName}`,
            primaryMobileNumber: mobile,
            passwordHash: randomPasswordHash,
            isPasswordSet: false,
            isActive: true
          };
          if (data.parentSecondaryMobile) {
            let secMobile = data.parentSecondaryMobile.replace(/\D/g, '');
            if (secMobile.length > 10) secMobile = secMobile.slice(-10);
            if (!/^[6-9]\d{9}$/.test(secMobile)) {
              secMobile = '9' + secMobile.padEnd(9, '0').slice(0, 9);
            }
            newParent.secondaryMobileNumber = secMobile;
          }

          parent = await mongoose.model('Parent').create([newParent], { session }).then(docs => docs[0]);
        }
        parentId = parent._id;
      }

      let studentCode = data.studentCode;
      if (!studentCode) {
        // Prevent duplicate imports: if student with exact name, std, div, and parent exists, reject
        const existingStudent = await mongoose.model('Student').findOne({
          studentName: data.studentName,
          standard: data.standard,
          division: data.division,
          parentId: parentId
        }, null, { session });
        
        if (existingStudent) {
          throw new AppError(`Student ${data.studentName} (${data.standard} ${data.division}) already exists with this parent number.`, 400);
        }

        const count = await mongoose.model('Student').countDocuments({}, { session });
        const rand = Math.floor(10 + Math.random() * 90);
        studentCode = `STU${String(count + 1).padStart(3, '0')}-${rand}`;
      }

      const studentData = {
        ...data,
        studentCode,
        parentId
      };

      // Strip pendingFees from the student object itself
      delete studentData.pendingFees;

      logger.info(`[createStudent] transportStartMonth in data: ${data.transportStartMonth} | in studentData: ${studentData.transportStartMonth}`);
      const student = await studentRepository.create(studentData, { session });
      logger.info(`[createStudent] student saved: transportStartMonth=${student.transportStartMonth}, transportType=${student.transportType}`);
      await AuditService.log(
        { performedBy, targetStudentId: student._id, action: 'STUDENT_CREATED', details: { name: student.studentName } },
        session
      );

      // FeeCategory resolution moved inside the academicYear loop to support year-specific categories.

      const getStartYear = (yrStr) => {
        const match = yrStr.match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      // Fetch Active Academic Year
      const activeYearDoc = await mongoose.model('AcademicYear').findOne({ isActive: true }, null, { session });
      if (!activeYearDoc) throw new AppError('No active academic year found. Please configure one in Setup.', 400);
      const activeYear = activeYearDoc.name;

      // Normalize keys in pendingFees to match database academic year names if start years match
      if (data.pendingFees && typeof data.pendingFees === 'object') {
        const dbYears = await mongoose.model('AcademicYear').find({}, null, { session });
        const normalizedPending = {};
        for (const yr of Object.keys(data.pendingFees)) {
          const yrStart = getStartYear(yr);
          const matchedDbYear = dbYears.find(dbYr => getStartYear(dbYr.name) === yrStart);
          if (matchedDbYear) {
            normalizedPending[matchedDbYear.name] = data.pendingFees[yr];
          } else {
            normalizedPending[yr] = data.pendingFees[yr];
          }
        }
        data.pendingFees = normalizedPending;
      }

      const yearsToGenerate = new Set();
      if (data.pendingFees && typeof data.pendingFees === 'object') {
        Object.keys(data.pendingFees).forEach(yr => {
          yearsToGenerate.add(yr);
        });
      }
      yearsToGenerate.add(activeYear);

      const sortedYears = Array.from(yearsToGenerate).sort((a, b) => getStartYear(a) - getStartYear(b));
      const earliestYear = sortedYears[0];

      // Fee structure calculation is performed inside the sortedYears loop to support year-specific rates.

      const isRTE = student.isRTE || false;
      const ledgersToCreate = [];

      const getMonthsForAcademicYear = (academicYear) => {
        const match = academicYear.match(/^(\d{4})/);
        const startYear = match ? parseInt(match[1], 10) : 2025;
        const baseYear = startYear + 1;
        return [
          { name: 'June', dueDate: `${baseYear}-06-15` },
          { name: 'July', dueDate: `${baseYear}-07-15` },
          { name: 'August', dueDate: `${baseYear}-08-15` },
          { name: 'September', dueDate: `${baseYear}-09-15` },
          { name: 'October', dueDate: `${baseYear}-10-15` },
          { name: 'November', dueDate: `${baseYear}-11-15` },
          { name: 'December', dueDate: `${baseYear}-12-15` },
          { name: 'January', dueDate: `${baseYear + 1}-01-15` },
          { name: 'February', dueDate: `${baseYear + 1}-02-15` },
          { name: 'March', dueDate: `${baseYear + 1}-03-15` },
          { name: 'April', dueDate: `${baseYear + 1}-04-15` },
          { name: 'May', dueDate: `${baseYear + 1}-05-15` }
        ];
      };

      const getTermsForAcademicYear = (academicYear) => {
        const match = academicYear.match(/^(\d{4})/);
        const startYear = match ? parseInt(match[1], 10) : 2025;
        const baseYear = startYear + 1;
        return [
          { name: 'Term 1', dueDate: `${baseYear}-06-15` },
          { name: 'Term 2', dueDate: `${baseYear}-10-15` }
        ];
      };

      const getPendingStartIndex = (statusStr) => {
        const clean = statusStr ? statusStr.toLowerCase().trim() : '';
        if (!clean || clean === 'paid' || clean === 'gov paid') {
          return null;
        }
        if (clean.includes('term-2') || clean.includes('term 2')) {
          return 4; // October
        }
        if (clean.includes('term-1') || clean.includes('term 1')) {
          return 0; // June
        }
        const monthPrefixes = ['jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may'];
        for (let i = 0; i < monthPrefixes.length; i++) {
          if (clean.includes(monthPrefixes[i])) {
            return i;
          }
        }
        return 0;
      };

      for (const academicYear of sortedYears) {
        // Fetch categories for this specific academic year
        const [
          educationCategory,
          transportCategory,
          termCategory,
          admissionCategory,
          bagKitCategory,
        ] = await Promise.all([
          mongoose.model('FeeCategory').findOne({ type: 'EDUCATION', isActive: true }, null, { session }),
          mongoose.model('FeeCategory').findOne({ type: 'TRANSPORT', isActive: true }, null, { session }),
          mongoose.model('FeeCategory').findOne({ type: 'TERM', isActive: true }, null, { session }),
          mongoose.model('FeeCategory').findOne({ type: 'ADMISSION', isActive: true }, null, { session }),
          mongoose.model('FeeCategory').findOne({ type: 'BAG_KIT', isActive: true }, null, { session }),
        ]);

        const ensureCategory = async (cat, defaultName, type, description) => {
          if (cat) return cat;
          if (type === 'OTHER') {
            const byName = await mongoose.model('FeeCategory').findOne({ type, name: defaultName, isActive: true }, null, { session });
            if (byName) return byName;
          } else {
            const fallback = await mongoose.model('FeeCategory').findOne({ type, isActive: true }, null, { session });
            if (fallback) return fallback;
          }
          return mongoose.model('FeeCategory').create([{ name: defaultName, type, description, isActive: true }], { session }).then(d => d[0]);
        };
        const [edCat, trCat, tmCat, adCat, bkCat] = await Promise.all([
          ensureCategory(educationCategory, 'Education Fees', 'EDUCATION', 'Standard monthly education fee'),
          ensureCategory(transportCategory, 'Transport Fees', 'TRANSPORT', 'Monthly transport fee'),
          ensureCategory(termCategory, 'Term Fees', 'TERM', 'Bi-annual term fee'),
          ensureCategory(admissionCategory, 'Admission Fees', 'ADMISSION', 'One-time admission fee'),
          ensureCategory(bagKitCategory, 'Bag & Kit', 'BAG_KIT', 'Bag & Kit fee category'),
        ]);

        // --- Fetch dynamic fee amounts from FeeStructure collection for this specific academic year ---
        let feeStruct = await mongoose.model('FeeStructure').findOne(
          { medium: student.medium, standard: student.standard, academicYear, isActive: true },
          null,
          { session }
        );
        // Fallback to active/generic fee structure if year-specific one is not found
        if (!feeStruct) {
          feeStruct = await mongoose.model('FeeStructure').findOne(
            { medium: student.medium, standard: student.standard, isActive: true },
            null,
            { session }
          );
        }

        const eduPartCount = feeStruct?.educationPartCount ?? 12;
        const termPartCount = feeStruct?.termPartCount ?? 2;
        const annualFee = feeStruct?.annualFee ?? 0;
        const totalParts = (eduPartCount + termPartCount) || 14;
        const eduAmount = annualFee > 0 ? Math.round(annualFee / totalParts) : 0;
        const termAmount = (feeStruct?.termFee !== undefined && feeStruct.termFee > 0)
          ? feeStruct.termFee
          : eduAmount;
        const admissionAmount = feeStruct?.admissionFee ?? 0;
        const bagKitAmount = feeStruct?.bagKitFee ?? 0;

        // --- Fetch transport amount for this specific academic year ---
        let transportAmount = 0;
        if (student.transportType && student.transportType !== 'None') {
          const transportStruct = await mongoose.model('TransportFeeStructure').findOne(
            { transportType: student.transportType, academicYear, isActive: true },
            null,
            { session }
          );
          if (transportStruct) {
            transportAmount = transportStruct.amount;
          } else {
            throw new AppError(`Transport fee structure not found for '${student.transportType}' in year ${academicYear}. Please create it first.`, 404);
          }
        }

        const statusStr = data.pendingFees ? data.pendingFees[academicYear] : undefined;
        const pendingStartIndex = getPendingStartIndex(statusStr);

        const getLedgerStatusAndAmounts = (feeType, feePeriod, totalAmount, isRTE) => {
          let concessionAmount = 0;
          let paidAmount = 0;
          let remainingAmount = totalAmount;
          let status = 'PENDING';

          if (isRTE && (feeType === 'EDUCATION' || feeType === 'TERM')) {
            concessionAmount = totalAmount;
            remainingAmount = 0;
            status = 'PAID';
          } else {
            const clean = statusStr ? statusStr.toLowerCase().trim() : '';
            if (clean === 'paid' || clean === 'gov paid') {
              status = 'PAID';
              paidAmount = totalAmount;
              remainingAmount = 0;
            } else if (!clean) {
              status = 'PENDING';
              paidAmount = 0;
              remainingAmount = totalAmount;
            } else {
              // Range parsing
              let itemIndex = 0;
              if (feeType === 'EDUCATION' || feeType === 'TRANSPORT') {
                const monthPrefixes = ['jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may'];
                const currentPeriodLower = feePeriod.toLowerCase();
                itemIndex = monthPrefixes.findIndex(p => currentPeriodLower.startsWith(p));
                if (itemIndex === -1) itemIndex = 0;
              } else if (feeType === 'TERM') {
                itemIndex = feePeriod.includes('2') ? 4 : 0;
              } else {
                itemIndex = 0;
              }

              if (itemIndex < pendingStartIndex) {
                status = 'PAID';
                paidAmount = totalAmount;
                remainingAmount = 0;
              } else {
                status = 'PENDING';
                paidAmount = 0;
                remainingAmount = totalAmount;
              }
            }
          }
          return { paidAmount, concessionAmount, remainingAmount, status };
        };

        const months = getMonthsForAcademicYear(academicYear);
        const terms = getTermsForAcademicYear(academicYear);

        const admissionMonth = academicYear === earliestYear ? (student.admissionMonth || 'June') : 'June';
        const startMonthIndex = months.findIndex(m => m.name === admissionMonth);
        const startIndex = startMonthIndex >= 0 ? startMonthIndex : 0;
        const monthsToCreate = months.slice(startIndex);

        // 1. Education ledgers (12 months)
        for (const m of monthsToCreate) {
          const { paidAmount, concessionAmount, remainingAmount, status } = getLedgerStatusAndAmounts('EDUCATION', m.name, eduAmount, isRTE);
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: m.name,
            feeType: 'EDUCATION',
            totalAmount: eduAmount,
            paidAmount,
            concessionAmount,
            remainingAmount,
            dueDate: new Date(m.dueDate),
            status,
            feeCategoryId: edCat._id,
            academicYear,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_EDU_${m.name.toUpperCase()}_${academicYear.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot: {
              studentName: student.studentName,
              medium: student.medium,
              standard: student.standard,
              division: student.division,
              transportType: student.transportType || 'None',
              isRTE: isRTE
            }
          });
        }

        // 2. Transport ledgers (12 months, if applicable)
        if (student.transportType && student.transportType !== 'None') {
          const transportStartMonth = academicYear === earliestYear ? (student.transportStartMonth || student.admissionMonth || 'June') : 'June';
          logger.info(`[createStudent] ledger loop: transportStartMonth=${transportStartMonth} (student.transportStartMonth=${student.transportStartMonth})`);
          const transportStartMonthIndex = months.findIndex(m => m.name === transportStartMonth);
          const tStartIndex = transportStartMonthIndex >= 0 ? transportStartMonthIndex : 0;
          const transportMonthsToCreate = months.slice(tStartIndex);

          // transportAllPaid: transport type set but no pending month — all months are already fully paid
          const allTransportPaid = data.transportAllPaid === true;

          for (const m of transportMonthsToCreate) {
            let tPaid, tConcession, tRemaining, tStatus;
            if (allTransportPaid) {
              // All transport months are already paid — record them as PAID for accurate historical ledger
              tPaid = transportAmount;
              tConcession = 0;
              tRemaining = 0;
              tStatus = 'PAID';
            } else {
              const result = getLedgerStatusAndAmounts('TRANSPORT', m.name, transportAmount, isRTE);
              tPaid = result.paidAmount;
              tConcession = result.concessionAmount;
              tRemaining = result.remainingAmount;
              tStatus = result.status;
            }
            ledgersToCreate.push({
              studentId: student._id,
              feePeriod: m.name,
              feeType: 'TRANSPORT',
              totalAmount: transportAmount,
              paidAmount: tPaid,
              concessionAmount: tConcession,
              remainingAmount: tRemaining,
              dueDate: new Date(m.dueDate),
              status: tStatus,
              feeCategoryId: trCat._id,
              academicYear,
              source: 'MANUAL',
              generatedFrom: 'TRANSPORT_STRUCTURE',
              ledgerNumber: `LEDGER_TRA_${m.name.toUpperCase()}_${academicYear.replace('-', '_')}_${student.studentCode || student._id}`,
              snapshot: {
                studentName: student.studentName,
                medium: student.medium,
                standard: student.standard,
                division: student.division,
                transportType: student.transportType,
                isRTE: isRTE
              }
            });
          }
        }

        // 3. Term ledgers (Term 1 & Term 2)
        const termsToCreate = startIndex > 5 ? [terms[1]] : terms;
        for (const t of termsToCreate) {
          const { paidAmount, concessionAmount, remainingAmount, status } = getLedgerStatusAndAmounts('TERM', t.name, termAmount, isRTE);
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: t.name,
            feeType: 'TERM',
            totalAmount: termAmount,
            paidAmount,
            concessionAmount,
            remainingAmount,
            dueDate: new Date(t.dueDate),
            status,
            feeCategoryId: tmCat._id,
            academicYear,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_TRM_${t.name.replace(' ', '').toUpperCase()}_${academicYear.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot: {
              studentName: student.studentName,
              medium: student.medium,
              standard: student.standard,
              division: student.division,
              transportType: student.transportType || 'None',
              isRTE: isRTE
            }
          });
        }

        // 4. Admission ledger (only for new admissions, only in the earliest year)
        if (student.isNewAdmission && academicYear === earliestYear) {
          const match = academicYear.match(/^(\d{4})/);
          const startYear = match ? parseInt(match[1], 10) : 2025;
          const baseYear = startYear + 1;
          const oneTimeDueDate = `${baseYear}-06-15`;

          const { paidAmount: admPaid, concessionAmount: admConc, remainingAmount: admRem, status: admStatus } = getLedgerStatusAndAmounts('ADMISSION', 'One-time', admissionAmount, isRTE);
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: 'One-time',
            feeType: 'ADMISSION',
            totalAmount: admissionAmount,
            paidAmount: admPaid,
            concessionAmount: admConc,
            remainingAmount: admRem,
            dueDate: new Date(oneTimeDueDate),
            status: admStatus,
            feeCategoryId: adCat._id,
            academicYear,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_ADM_${academicYear.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot: {
              studentName: student.studentName,
              medium: student.medium,
              standard: student.standard,
              division: student.division,
              transportType: student.transportType || 'None',
              isRTE: isRTE
            }
          });
        }

        // 5. Bag & Kit ledger (only if buyBagKit is true, only in the earliest year)
        if (student.buyBagKit && academicYear === earliestYear) {
          const match = academicYear.match(/^(\d{4})/);
          const startYear = match ? parseInt(match[1], 10) : 2025;
          const baseYear = startYear + 1;
          const oneTimeDueDate = `${baseYear}-06-15`;

          const { paidAmount: bagPaid, concessionAmount: bagConc, remainingAmount: bagRem, status: bagStatus } = getLedgerStatusAndAmounts('BAG_KIT', 'One-time', bagKitAmount, isRTE);
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: 'One-time',
            feeType: 'BAG_KIT',
            totalAmount: bagKitAmount,
            paidAmount: bagPaid,
            concessionAmount: bagConc,
            remainingAmount: bagRem,
            dueDate: new Date(oneTimeDueDate),
            status: bagStatus,
            feeCategoryId: bkCat._id,
            academicYear,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_BAG_${academicYear.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot: {
              studentName: student.studentName,
              medium: student.medium,
              standard: student.standard,
              division: student.division,
              transportType: student.transportType || 'None',
              isRTE: isRTE
            }
          });
        }
      }

      await mongoose.model('StudentFeeLedger').insertMany(ledgersToCreate, { session });

      await session.commitTransaction();
      return student;
    } catch (err) {
      await session.abortTransaction();
      logger.error('StudentService.createStudent error', err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /** Update mutable fields */
  static async updateStudent(studentId, updates, performedBy = null) {
    const newTransport = updates.transportType;
    // Note: we validate transport existence inside the session block where we know the active year

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const student = await studentRepository.findById(studentId);
      if (!student) throw new AppError('Student not found', 404);

      // Fetch Active Academic Year
      const activeYear = await mongoose.model('AcademicYear').findOne({ isActive: true }, null, { session });
      if (!activeYear) throw new AppError('No active academic year found.', 400);
      const currentAcademicYearName = activeYear.name;

      const oldTransport = student.transportType;
      const transportMonths = updates.transportMonths;
      delete updates.transportMonths;

      // Check if parent updates are requested
      const parentNameUpdate = updates.parentName;
      const parentMobileUpdate = updates.parentMobile;
      const parentSecondaryMobileUpdate = updates.parentSecondaryMobile;

      // Delete parent updates from the student updates object so we don't save them on the Student document
      delete updates.parentName;
      delete updates.parentMobile;
      delete updates.parentSecondaryMobile;

      if (student.parentId && (parentNameUpdate !== undefined || parentMobileUpdate !== undefined || parentSecondaryMobileUpdate !== undefined)) {
        const parentId = student.parentId._id || student.parentId;
        const parent = await mongoose.model('Parent').findById(parentId).session(session);
        if (parent) {
          const parentUpdates = {};
          if (parentNameUpdate !== undefined) {
            parentUpdates.parentName = parentNameUpdate;
          }
          if (parentMobileUpdate !== undefined) {
            let mobile = parentMobileUpdate.replace(/\D/g, '');
            if (mobile.length > 10) mobile = mobile.slice(-10);
            if (!/^[6-9]\d{9}$/.test(mobile)) {
              throw new AppError('Enter Indian number or invalid number for primary mobile', 400);
            }
            if (mobile !== parent.primaryMobileNumber) {
              // Check if another parent already has this number
              const otherParent = await mongoose.model('Parent').findOne({ primaryMobileNumber: mobile }).session(session);
              if (otherParent && String(otherParent._id) !== String(parent._id)) {
                throw new AppError('This primary mobile number is already registered to another parent.', 400);
              }
              parentUpdates.primaryMobileNumber = mobile;
            }
          }
          if (parentSecondaryMobileUpdate !== undefined) {
            if (parentSecondaryMobileUpdate === null || parentSecondaryMobileUpdate === '') {
              parentUpdates.secondaryMobileNumber = null;
            } else {
              let secMobile = parentSecondaryMobileUpdate.replace(/\D/g, '');
              if (secMobile.length > 10) secMobile = secMobile.slice(-10);
              if (!/^[6-9]\d{9}$/.test(secMobile)) {
                throw new AppError('Enter Indian number or invalid number for secondary mobile', 400);
              }
              if (secMobile !== parent.secondaryMobileNumber) {
                // Check if another parent already has this secondary mobile number
                const otherParent = await mongoose.model('Parent').findOne({
                  $or: [
                    { primaryMobileNumber: secMobile },
                    { secondaryMobileNumber: secMobile }
                  ]
                }).session(session);
                if (otherParent && String(otherParent._id) !== String(parent._id)) {
                  throw new AppError('This secondary mobile number is already in use by another parent.', 400);
                }
                parentUpdates.secondaryMobileNumber = secMobile;
              }
            }
          }

          if (Object.keys(parentUpdates).length > 0) {
            await mongoose.model('Parent').updateOne({ _id: parentId }, { $set: parentUpdates }, { session });
            await AuditService.log(
              { performedBy, targetStudentId: studentId, action: 'PARENT_UPDATED', details: parentUpdates },
              session
            );
          }
        }
      }

      await studentRepository.updateOne({ _id: studentId }, { $set: updates }, { session });

      // Handle buyBagKit optional toggle
      if (updates.buyBagKit !== undefined && updates.buyBagKit !== student.buyBagKit) {
        if (updates.buyBagKit === true) {
          // Trigger generation of Bag & Kit ledger
          await this._generateLedgersForAcademicYear(studentId, currentAcademicYearName, session);
        } else {
          // Prevent disabling if a partial payment was already collected
          const partialBagKit = await mongoose.model('StudentFeeLedger').exists({
            studentId,
            feeType: 'BAG_KIT',
            status: 'PARTIAL'
          }).session(session);

          if (partialBagKit) {
            throw new AppError('Cannot disable Bag & Kit: A partial payment has already been collected.', 400);
          }

          // Delete unpaid Bag & Kit ledger if it exists
          await mongoose.model('StudentFeeLedger').deleteOne({
            studentId,
            feeType: 'BAG_KIT',
            status: 'PENDING'
          }).session(session);
        }
      }

      if (updates.isActive === false) {
        const today = new Date();
        const ledgers = await mongoose.model('StudentFeeLedger').find({
          studentId,
          status: { $in: ['PENDING', 'PARTIAL'] },
          dueDate: { $gt: today }
        }).session(session);

        for (const ledger of ledgers) {
          if (ledger.status === 'PENDING') {
            ledger.status = 'CANCELLED';
            ledger.remainingAmount = 0;
          } else if (ledger.status === 'PARTIAL') {
            ledger.concessionAmount += ledger.remainingAmount;
            ledger.remainingAmount = 0;
            ledger.status = 'PAID';
          }
          await ledger.save({ session });
        }
      }

      const reactivated = updates.isActive === true && student.isActive === false;
      if (reactivated) {
        const cancelledLedgers = await mongoose.model('StudentFeeLedger').find({
          studentId,
          academicYear: currentAcademicYearName,
          status: 'CANCELLED'
        }).session(session);

        for (const ledger of cancelledLedgers) {
          ledger.status = 'PENDING';
          ledger.remainingAmount = ledger.totalAmount - (ledger.paidAmount || 0) - (ledger.concessionAmount || 0);
          await ledger.save({ session });
        }
      }

      const standardChanged = updates.standard !== undefined && updates.standard !== student.standard;
      const mediumChanged = updates.medium !== undefined && updates.medium !== student.medium;
      const divisionChanged = updates.division !== undefined && updates.division !== student.division;
      const rteChanged = updates.isRTE !== undefined && updates.isRTE !== student.isRTE;

      if (standardChanged || mediumChanged || divisionChanged || rteChanged || reactivated) {
        await this._generateLedgersForAcademicYear(studentId, currentAcademicYearName, session, { forceCreate: false });
      }

      // Fetch Active Academic Year (resolved at start of try block)

      const oldStartMonth = student.transportStartMonth || student.admissionMonth || 'June';
      const newStartMonth = updates.transportStartMonth !== undefined ? updates.transportStartMonth : oldStartMonth;
      const effectiveTransportType = newTransport !== undefined ? newTransport : oldTransport;

      const transportTypeChanged = newTransport !== undefined && newTransport !== oldTransport;
      const transportStartMonthChanged = updates.transportStartMonth !== undefined && updates.transportStartMonth !== oldStartMonth;

      if (transportTypeChanged || transportStartMonthChanged) {
        let transportCategory = await mongoose.model('FeeCategory').findOne({ type: 'TRANSPORT' }).session(session);
        if (!transportCategory) {
          transportCategory = await mongoose.model('FeeCategory').create([{
            name: 'Transport',
            type: 'TRANSPORT',
            description: 'Transport fee category',
            isActive: true
          }], { session }).then(docs => docs[0]);
        }

        let oldRate = 0;
        let newRate = 0;

        if (oldTransport !== 'None') {
          const oldStruct = await mongoose.model('TransportFeeStructure').findOne({ transportType: oldTransport, academicYear: currentAcademicYearName }).session(session);
          if (oldStruct) {
            oldRate = oldStruct.amount;
          }
        }
        if (effectiveTransportType !== 'None') {
          const newStruct = await mongoose.model('TransportFeeStructure').findOne({ transportType: effectiveTransportType, academicYear: currentAcademicYearName, isActive: true }).session(session);
          if (!newStruct) {
            throw new AppError(`Active transport fee structure not found for ${effectiveTransportType} in year ${currentAcademicYearName}`, 404);
          }
          newRate = newStruct.amount;
        }

        const match = currentAcademicYearName.match(/^(\d{4})/);
        const startYear = match ? parseInt(match[1], 10) : 2025;
        const months = [
          { name: 'June', dueDate: `${startYear}-06-15` },
          { name: 'July', dueDate: `${startYear}-07-15` },
          { name: 'August', dueDate: `${startYear}-08-15` },
          { name: 'September', dueDate: `${startYear}-09-15` },
          { name: 'October', dueDate: `${startYear}-10-15` },
          { name: 'November', dueDate: `${startYear}-11-15` },
          { name: 'December', dueDate: `${startYear}-12-15` },
          { name: 'January', dueDate: `${startYear + 1}-01-15` },
          { name: 'February', dueDate: `${startYear + 1}-02-15` },
          { name: 'March', dueDate: `${startYear + 1}-03-15` },
          { name: 'April', dueDate: `${startYear + 1}-04-15` },
          { name: 'May', dueDate: `${startYear + 1}-05-15` }
        ];

        const allMonthsStr = months.map(m => m.name);

        let calculatedStartMonth = updates.transportStartMonth;
        if (!calculatedStartMonth && transportMonths !== undefined) {
          const idx = Math.max(0, Math.min(11, 12 - transportMonths));
          calculatedStartMonth = months[idx].name;
        }
        const transportStartMonth = calculatedStartMonth || oldStartMonth;
        const transportStartIdx = allMonthsStr.indexOf(transportStartMonth);

        const existingLedgers = await mongoose.model('StudentFeeLedger').find({
          studentId: student._id,
          feeType: 'TRANSPORT',
          $or: [
            { academicYear: currentAcademicYearName },
            { academicYear: null },
            { academicYear: { $exists: false } }
          ]
        }).session(session);

        const existingPeriods = new Set(existingLedgers.map(l => l.feePeriod));
        const ledgersToCreate = [];

        // Always ensure unpaid transport ledgers before the start month are deleted
        const monthsBeforeStart = months.slice(0, transportStartIdx < 0 ? 0 : transportStartIdx).map(m => m.name);
        const ledgersToDelete = existingLedgers.filter(l => monthsBeforeStart.includes(l.feePeriod) && l.status !== 'PAID');
        const idsToDelete = ledgersToDelete.map(l => l._id);
        
        if (idsToDelete.length > 0) {
          await mongoose.model('StudentFeeLedger').deleteMany({ _id: { $in: idsToDelete } }, { session });
        }
        
        // Rebuild existingPeriods without the deleted ones
        ledgersToDelete.forEach(l => existingPeriods.delete(l.feePeriod));

        for (let i = 0; i < 12; i++) {
          const m = months[i];
          const isTransportActiveForMonth = effectiveTransportType !== 'None' && i >= transportStartIdx;

          if (isTransportActiveForMonth) {
            if (existingPeriods.has(m.name)) {
              // UPDATE existing pending/cancelled ledger for this month
              const ledger = existingLedgers.find(l => l.feePeriod === m.name);
              if (ledger && ledger.status !== 'PAID') {
                const paidSoFar = ledger.paidAmount || 0;
                ledger.totalAmount = newRate;
                ledger.remainingAmount = Math.max(0, newRate - paidSoFar - (ledger.concessionAmount || 0));
                if (ledger.status === 'CANCELLED') {
                  ledger.status = ledger.remainingAmount === 0 ? 'PAID' : (paidSoFar > 0 ? 'PARTIAL' : 'PENDING');
                } else {
                  if (ledger.remainingAmount === 0) {
                    ledger.status = 'PAID';
                  } else if (paidSoFar > 0) {
                    ledger.status = 'PARTIAL';
                  } else {
                    ledger.status = 'PENDING';
                  }
                }
                await ledger.save({ session });
              }
            } else {
              // CREATE new ledger for this month
              ledgersToCreate.push({
                studentId: student._id,
                feePeriod: m.name,
                feeType: 'TRANSPORT',
                totalAmount: newRate,
                paidAmount: 0,
                concessionAmount: 0,
                remainingAmount: newRate,
                dueDate: new Date(m.dueDate),
                status: 'PENDING',
                feeCategoryId: transportCategory._id,
                academicYear: currentAcademicYearName,
                source: 'MANUAL',
                generatedFrom: 'TRANSPORT_STRUCTURE',
                ledgerNumber: `LEDGER_TRA_MID_${m.name.toUpperCase()}_${student.studentCode || student._id}_${Date.now()}`,
                snapshot: {
                  studentName: student.studentName,
                  medium: student.medium,
                  standard: student.standard,
                  division: student.division,
                  transportType: effectiveTransportType,
                  isRTE: student.isRTE
                }
              });
            }
          } else {
            // Month is prior to transport start month — delete if not yet removed
            if (existingPeriods.has(m.name)) {
              const ledger = existingLedgers.find(l => l.feePeriod === m.name);
              if (ledger) {
                if (ledger.status === 'PAID') {
                  // Keep PAID ledgers — don't delete money history
                } else {
                  // Delete unpaid/cancelled/pending ledgers before start
                  await mongoose.model('StudentFeeLedger').deleteOne({ _id: ledger._id }, { session });
                }
              }
            }
          }
        }

        if (ledgersToCreate.length > 0) {
          await mongoose.model('StudentFeeLedger').create(ledgersToCreate, { session, ordered: true });
        }
        await AuditService.log({ performedBy: null, targetStudentId: studentId, action: 'LEDGER_CREATED', details: { type: 'TRANSPORT_MID_YEAR_SYNC' } }, session);
      }

      await AuditService.log(
        { performedBy, targetStudentId: studentId, action: 'STUDENT_UPDATED', details: updates },
        session
      );
      await session.commitTransaction();
      return studentRepository.findById(studentId);
    } catch (e) {
      await session.abortTransaction();
      logger.error('StudentService.updateStudent error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Retrieve a student (read‑only) */
  static async getStudent(studentId) {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);
    return student;
  }
  /** Retrieve a student (read‑only) */

  /** List students with optional filtering */
  static async listStudents(filter = {}, pagination = { limit: 20, skip: 0 }) {
    const { includeInactive, ...actualFilter } = filter;
    if (includeInactive !== 'true' && includeInactive !== true) {
      actualFilter.isActive = true;
    }
    return studentRepository.find(actualFilter, null, pagination);
  }

  /** Delete a student: Soft delete if payments exist, Hard delete if no payments */
  static async deleteStudent(studentId, performedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const student = await studentRepository.findById(studentId);
      if (!student) throw new AppError('Student not found', 404);

      // Find all ledgers for this student
      const ledgers = await mongoose.model('StudentFeeLedger').find({ studentId }).session(session);
      const ledgerIds = ledgers.map(l => l._id);

      // Check if any payments exist for this student's ledgers
      let hasPayments = false;
      if (ledgerIds.length > 0) {
        const paymentCount = await mongoose.model('Payment').countDocuments({ ledgerId: { $in: ledgerIds } }).session(session);
        if (paymentCount > 0) {
          hasPayments = true;
        }
      }

      if (hasPayments) {
        // SOFT DELETE
        await studentRepository.updateOne({ _id: studentId }, { $set: { isActive: false } }, { session });
        
        // Cancel all pending/partial ledgers so they don't show up in unpaid fees
        if (ledgerIds.length > 0) {
          await mongoose.model('StudentFeeLedger').updateMany(
            { _id: { $in: ledgerIds }, status: { $in: ['PENDING', 'PARTIAL'] } },
            { $set: { status: 'CANCELLED' } },
            { session }
          );
        }

        await AuditService.log(
          { performedBy, targetStudentId: studentId, action: 'STUDENT_SOFT_DELETED', details: { studentCode: student.studentCode, studentName: student.studentName, reason: 'Has payment history' } },
          session
        );
      } else {
        // HARD DELETE
        await mongoose.model('StudentFeeLedger').deleteMany({ studentId }, { session });
        await studentRepository.deleteOne({ _id: studentId }, { session });

        await AuditService.log(
          { performedBy, targetStudentId: studentId, action: 'STUDENT_DELETED', details: { studentCode: student.studentCode, studentName: student.studentName } },
          session
        );
      }

      await session.commitTransaction();
      return { softDeleted: hasPayments };
    } catch (e) {
      await session.abortTransaction();
      logger.error('StudentService.deleteStudent error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Restore a soft-deleted student */
  static async restoreStudent(studentId, performedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const student = await studentRepository.findById(studentId);
      if (!student) throw new AppError('Student not found', 404);
      if (student.isActive) throw new AppError('Student is already active', 400);

      await studentRepository.updateOne({ _id: studentId }, { $set: { isActive: true } }, { session });

      // Note: We don't automatically un-cancel ledgers because we don't know which ones should be active. 
      // The admin can manually regenerate or update ledgers if needed.

      await AuditService.log(
        { performedBy, targetStudentId: studentId, action: 'STUDENT_RESTORED', details: { studentCode: student.studentCode, studentName: student.studentName } },
        session
      );

      await session.commitTransaction();
      return studentRepository.findById(studentId);
    } catch (e) {
      await session.abortTransaction();
      logger.error('StudentService.restoreStudent error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Promote students to a new standard */
  static async promoteStudents(studentIds, targetStandard, targetDivision, targetAcademicYear, performedBy, targetMedium = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const targetYearDoc = await mongoose.model('AcademicYear').findOne({ name: targetAcademicYear }).session(session);
      if (!targetYearDoc) {
        throw new AppError(`Academic year ${targetAcademicYear} does not exist. Please create it first in Setup.`, 400);
      }

      const students = await studentRepository.find({ _id: { $in: studentIds } }, null, { session });
      if (!students.length) throw new AppError('No valid students found', 404);

      const updatedStudentIds = [];
      for (const student of students) {
        const updates = { standard: targetStandard, division: targetDivision, isNewAdmission: false };
        if (targetMedium) {
          updates.medium = targetMedium;
          student.medium = targetMedium; // For ledger generation snapshot
        }
        if (student.transportType && student.transportType !== 'None') {
          updates.transportStartMonth = 'June';
        }
        await studentRepository.updateOne(
          { _id: student._id },
          { $set: updates },
          { session }
        );
        updatedStudentIds.push(student._id);
        
        // Wait for the ledger generation to complete for the target academic year
        await this._generateLedgersForAcademicYear(student._id, targetAcademicYear, session, { forceCreate: true });

        await AuditService.log(
          { performedBy, targetStudentId: student._id, action: 'STUDENT_UPDATED', details: { reason: 'Promotion', targetStandard, targetDivision, targetAcademicYear } },
          session
        );
      }

      await session.commitTransaction();
      return { message: `${updatedStudentIds.length} students promoted successfully` };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error promoting students:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async _generateLedgersForAcademicYear(studentId, targetAcademicYearStr, parentSession = null, options = {}) {
    const { forceCreate = false } = options;
    const session = parentSession || await mongoose.startSession();
    if (!parentSession) session.startTransaction();
    try {
      const student = await mongoose.model('Student').findById(studentId).session(session);
      if (!student) throw new AppError('Student not found', 404);

      const isRTE = student.isRTE || false;
      const academicYearStr = targetAcademicYearStr;

      const ensureCategory = async (type, defaultName, description) => {
        let query = { type };
        if (type === 'OTHER') query.name = defaultName;
        let cat = await mongoose.model('FeeCategory').findOne(query).session(session);
        if (!cat) {
          cat = await mongoose.model('FeeCategory').create([{
            name: defaultName,
            type,
            description,
            isActive: true
          }], { session }).then(docs => docs[0]);
        }
        return cat;
      };
      const educationCategory = await ensureCategory('EDUCATION', 'Education Fees', 'Standard monthly education fee');
      const transportCategory = await ensureCategory('TRANSPORT', 'Transport Fees', 'Monthly transport fee');
      const termCategory = await ensureCategory('TERM', 'Term Fees', 'Bi-annual term fee');
      const admissionCategory = await ensureCategory('ADMISSION', 'Admission Fees', 'One-time admission fee');
      const bagKitCategory = await ensureCategory('BAG_KIT', 'Bag & Kit', 'Bag & Kit fee category');

      const existingLedgers = await mongoose.model('StudentFeeLedger').find({ studentId: student._id, academicYear: academicYearStr }).session(session);
      
      if (existingLedgers.length === 0 && !forceCreate) {
        if (!parentSession) await session.commitTransaction();
        return { created: 0, updated: 0 };
      }

      const allLedgerYears = await mongoose.model('StudentFeeLedger').distinct('academicYear', { studentId: student._id }).session(session);
      const getStartYear = (yrStr) => {
        if (!yrStr) return 0;
        const match = yrStr.match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : 0;
      };
      const newerYearExists = allLedgerYears.some(yr => getStartYear(yr) > getStartYear(academicYearStr));

      // Determine standard to use (historical standard from existing ledgers' snapshots, or current standard as fallback)
      let standardToUse = student.standard;
      const ledgerWithSnapshot = existingLedgers.find(l => l.snapshot && l.snapshot.standard);

      if (ledgerWithSnapshot) {
        const activeYearDoc = await mongoose.model('AcademicYear').findOne({ isActive: true }, null, { session });
        if (!activeYearDoc) throw new AppError('No active academic year found.', 400);
        const activeYearName = activeYearDoc.name;

        if (academicYearStr === activeYearName && !newerYearExists) {
          standardToUse = student.standard;
        } else {
          standardToUse = ledgerWithSnapshot.snapshot.standard;
        }
      }

      // Keep snapshots of existing ledgers in sync for the active year
      if (!newerYearExists) {
        for (const l of existingLedgers) {
          if (l.snapshot) {
            let changed = false;
            if (l.snapshot.studentName !== student.studentName) { l.snapshot.studentName = student.studentName; changed = true; }
            if (l.snapshot.medium !== student.medium) { l.snapshot.medium = student.medium; changed = true; }
            if (l.snapshot.standard !== standardToUse) { l.snapshot.standard = standardToUse; changed = true; }
            if (l.snapshot.division !== student.division) { l.snapshot.division = student.division; changed = true; }
            if (l.snapshot.transportType !== (student.transportType || 'None')) { l.snapshot.transportType = student.transportType || 'None'; changed = true; }
            if (l.snapshot.isRTE !== isRTE) { l.snapshot.isRTE = isRTE; changed = true; }
            
            if (changed) {
              l.markModified('snapshot');
              await l.save({ session });
            }
          }
        }
      }

      const feeStruct = await mongoose.model('FeeStructure').findOne(
        { medium: student.medium, standard: standardToUse, academicYear: academicYearStr, isActive: true },
        null,
        { session }
      );

      if (!feeStruct) {
        throw new AppError(`No active fee structure found for standard ${standardToUse} (${student.medium} medium) in academic year ${academicYearStr}`, 400);
      }

      const educationAmount = Math.round(feeStruct.annualFee / ((feeStruct.educationPartCount || 12) + (feeStruct.termPartCount || 2)));
      const termAmount = (feeStruct.termFee !== undefined && feeStruct.termFee > 0)
        ? feeStruct.termFee
        : educationAmount;
      const admissionAmount = feeStruct.admissionFee ?? 0;
      const bagKitAmount = feeStruct.bagKitFee ?? 0;

      let transportAmount = 0;
      if (student.transportType && student.transportType !== 'None') {
        const existingTransportLedger = existingLedgers.find(l => l.feeType === 'TRANSPORT');
        if (existingTransportLedger) {
          transportAmount = existingTransportLedger.totalAmount;
        } else {
          const tfs = await mongoose.model('TransportFeeStructure').findOne(
            { transportType: student.transportType, academicYear: academicYearStr, isActive: true },
            null,
            { session }
          );
          if (!tfs) {
            throw new AppError(`Transport fee structure not found for '${student.transportType}' in year ${academicYearStr}. Please create it first.`, 404);
          }
          transportAmount = tfs.amount;
        }
      }

      const existingKey = (feeType, feePeriod) => existingLedgers.some(l => l.feeType === feeType && l.feePeriod === feePeriod);

      const match = academicYearStr.match(/^(\d{4})/);
      const startYear = match ? parseInt(match[1], 10) : 2025;
      const baseYear = startYear + 1;

      const allMonths = [
        { name: 'June', dueDate: `${startYear}-06-15` },
        { name: 'July', dueDate: `${startYear}-07-15` },
        { name: 'August', dueDate: `${startYear}-08-15` },
        { name: 'September', dueDate: `${startYear}-09-15` },
        { name: 'October', dueDate: `${startYear}-10-15` },
        { name: 'November', dueDate: `${startYear}-11-15` },
        { name: 'December', dueDate: `${startYear}-12-15` },
        { name: 'January', dueDate: `${baseYear}-01-15` },
        { name: 'February', dueDate: `${baseYear}-02-15` },
        { name: 'March', dueDate: `${baseYear}-03-15` },
        { name: 'April', dueDate: `${baseYear}-04-15` },
        { name: 'May', dueDate: `${baseYear}-05-15` }
      ];

      const admissionMonth = student.admissionMonth || 'June';
      const startMonthIndex = allMonths.findIndex(m => m.name === admissionMonth);
      const startIndex = startMonthIndex >= 0 ? startMonthIndex : 0;
      const months = allMonths.slice(startIndex);

      const allTerms = [
        { name: 'Term 1', dueDate: `${startYear}-06-15` },
        { name: 'Term 2', dueDate: `${startYear}-12-15` }
      ];
      const terms = startIndex > 5 ? [allTerms[1]] : allTerms;

      const snapshot = {
        studentName: student.studentName,
        medium: student.medium,
        standard: standardToUse,
        division: student.division,
        transportType: student.transportType || 'None',
        isRTE: isRTE
      };

      const ledgersToCreate = [];
      let created = 0;
      let updated = 0;

      const updateLedgerIfNeeded = async (feeType, feePeriod, newAmount) => {
        const ledger = existingLedgers.find(l => l.feeType === feeType && l.feePeriod === feePeriod);
        if (!ledger) return;

        if (feeType === 'EDUCATION' || feeType === 'TERM') {
          if (isRTE) {
            // RTE dynamic sync
            if (ledger.concessionAmount !== newAmount || ledger.status !== 'PAID') {
              ledger.totalAmount = newAmount;
              ledger.concessionAmount = newAmount;
              ledger.remainingAmount = 0;
              ledger.status = 'PAID';
              await ledger.save({ session });
              updated++;
            }
            return;
          } else {
            // RTE revocation sync (100% concession with 0 paid is reset)
            if (ledger.concessionAmount === ledger.totalAmount && (ledger.paidAmount || 0) === 0) {
              ledger.concessionAmount = 0;
              ledger.totalAmount = newAmount;
              ledger.remainingAmount = newAmount;
              ledger.status = 'PENDING';
              await ledger.save({ session });
              updated++;
              return;
            }
          }
        }

        if (ledger.status !== 'PAID') {
          if (ledger.totalAmount !== newAmount) {
            const paidSoFar = ledger.paidAmount || 0;
            ledger.totalAmount = newAmount;
            ledger.remainingAmount = Math.max(0, newAmount - paidSoFar - (ledger.concessionAmount || 0));
            if (ledger.remainingAmount === 0 && paidSoFar > 0) {
              ledger.status = 'PAID';
            } else if (paidSoFar > 0) {
              ledger.status = 'PARTIAL';
            } else {
              ledger.status = 'PENDING';
            }
            await ledger.save({ session });
            updated++;
          }
        }
      };

      if (educationCategory) {
        for (const m of months) {
          if (!existingKey('EDUCATION', m.name)) {
            ledgersToCreate.push({
              studentId: student._id,
              feePeriod: m.name,
              feeType: 'EDUCATION',
              totalAmount: educationAmount,
              paidAmount: 0,
              concessionAmount: isRTE ? educationAmount : 0,
              remainingAmount: isRTE ? 0 : educationAmount,
              dueDate: new Date(m.dueDate),
              status: isRTE ? 'PAID' : 'PENDING',
              feeCategoryId: educationCategory._id,
              academicYear: academicYearStr,
              source: 'MANUAL',
              generatedFrom: 'FEE_STRUCTURE',
              ledgerNumber: `LEDGER_EDU_${academicYearStr.replace('-', '_')}_${m.name.toUpperCase()}_${student.studentCode || student._id}`,
              snapshot
            });
          } else {
            await updateLedgerIfNeeded('EDUCATION', m.name, educationAmount);
          }
        }
      }

      let shouldGenerateTransport = transportCategory && student.transportType && student.transportType !== 'None';
      const existingTransportLedgers = existingLedgers.filter(l => l.feeType === 'TRANSPORT');
      if (shouldGenerateTransport && newerYearExists && existingTransportLedgers.length === 0) {
        shouldGenerateTransport = false;
      }

      if (shouldGenerateTransport) {
        const allMonthNames = allMonths.map(m => m.name);
        let transportStartMonthToUse = student.transportStartMonth || student.admissionMonth || 'June';
        
        if (existingTransportLedgers.length > 0) {
          let earliestIdx = 12;
          for (const l of existingTransportLedgers) {
            const idx = allMonthNames.indexOf(l.feePeriod);
            if (idx >= 0 && idx < earliestIdx) {
              earliestIdx = idx;
              transportStartMonthToUse = l.feePeriod;
            }
          }
        }

        const startMonthIndex = allMonthNames.indexOf(transportStartMonthToUse);
        const resolvedStartIdx = startMonthIndex >= 0 ? startMonthIndex : 0;

        // Delete unpaid transport ledgers before the resolved start month
        const monthsBeforeStart = allMonths.slice(0, resolvedStartIdx).map(m => m.name);
        const transportLedgersToDelete = existingTransportLedgers.filter(l => monthsBeforeStart.includes(l.feePeriod) && l.status !== 'PAID');
        if (transportLedgersToDelete.length > 0) {
          const idsToDelete = transportLedgersToDelete.map(l => l._id);
          await mongoose.model('StudentFeeLedger').deleteMany({ _id: { $in: idsToDelete } }, { session });
          existingLedgers = existingLedgers.filter(l => !idsToDelete.includes(l._id));
        }

        for (const m of months) {
          const mIdx = allMonthNames.indexOf(m.name);
          if (mIdx >= resolvedStartIdx) {
            if (!existingKey('TRANSPORT', m.name)) {
              ledgersToCreate.push({
                studentId: student._id,
                feePeriod: m.name,
                feeType: 'TRANSPORT',
                totalAmount: transportAmount,
                paidAmount: 0,
                concessionAmount: 0,
                remainingAmount: transportAmount,
                dueDate: new Date(m.dueDate),
                status: 'PENDING',
                feeCategoryId: transportCategory._id,
                academicYear: academicYearStr,
                source: 'MANUAL',
                generatedFrom: 'TRANSPORT_STRUCTURE',
                ledgerNumber: `LEDGER_TRA_${academicYearStr.replace('-', '_')}_${m.name.toUpperCase()}_${student.studentCode || student._id}`,
                snapshot
              });
            } else {
              await updateLedgerIfNeeded('TRANSPORT', m.name, transportAmount);
            }
          }
        }
      }

      if (termCategory) {
        for (const t of terms) {
          if (!existingKey('TERM', t.name)) {
            ledgersToCreate.push({
              studentId: student._id,
              feePeriod: t.name,
              feeType: 'TERM',
              totalAmount: termAmount,
              paidAmount: 0,
              concessionAmount: isRTE ? termAmount : 0,
              remainingAmount: isRTE ? 0 : termAmount,
              dueDate: new Date(t.dueDate),
              status: isRTE ? 'PAID' : 'PENDING',
              feeCategoryId: termCategory._id,
              academicYear: academicYearStr,
              source: 'MANUAL',
              generatedFrom: 'FEE_STRUCTURE',
              ledgerNumber: `LEDGER_TRM_${academicYearStr.replace('-', '_')}_${t.name.replace(' ', '').toUpperCase()}_${student.studentCode || student._id}`,
              snapshot
            });
          } else {
            await updateLedgerIfNeeded('TERM', t.name, termAmount);
          }
        }
      }

      // Determine if they already have an existing Admission ledger in any year
      const hasExistingAdmission = await mongoose.model('StudentFeeLedger').exists({ studentId: student._id, feeType: 'ADMISSION' }).session(session);

      if (admissionCategory && student.isNewAdmission && !hasExistingAdmission) {
        if (!existingKey('ADMISSION', 'One-time')) {
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: 'One-time',
            feeType: 'ADMISSION',
            totalAmount: admissionAmount,
            paidAmount: 0,
            concessionAmount: 0,
            remainingAmount: admissionAmount,
            dueDate: new Date(`${startYear}-06-15`),
            status: 'PENDING',
            feeCategoryId: admissionCategory._id,
            academicYear: academicYearStr,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_ADM_${academicYearStr.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot
          });
        } else {
          await updateLedgerIfNeeded('ADMISSION', 'One-time', admissionAmount);
        }
      } else if (admissionCategory && existingKey('ADMISSION', 'One-time')) {
        await updateLedgerIfNeeded('ADMISSION', 'One-time', admissionAmount);
      }

      // Determine if they already have an existing Bag & Kit ledger in any year
      const hasExistingBagKit = await mongoose.model('StudentFeeLedger').exists({ studentId: student._id, feeType: 'BAG_KIT' }).session(session);

      if (bagKitCategory && student.buyBagKit && !hasExistingBagKit) {
        if (!existingKey('BAG_KIT', 'One-time')) {
          ledgersToCreate.push({
            studentId: student._id,
            feePeriod: 'One-time',
            feeType: 'BAG_KIT',
            totalAmount: bagKitAmount,
            paidAmount: 0,
            concessionAmount: 0,
            remainingAmount: bagKitAmount,
            dueDate: new Date(`${startYear}-06-15`),
            status: 'PENDING',
            feeCategoryId: bagKitCategory._id,
            academicYear: academicYearStr,
            source: 'MANUAL',
            generatedFrom: 'FEE_STRUCTURE',
            ledgerNumber: `LEDGER_BAG_${academicYearStr.replace('-', '_')}_${student.studentCode || student._id}`,
            snapshot
          });
        } else {
          await updateLedgerIfNeeded('BAG_KIT', 'One-time', bagKitAmount);
        }
      } else if (bagKitCategory && existingKey('BAG_KIT', 'One-time')) {
        await updateLedgerIfNeeded('BAG_KIT', 'One-time', bagKitAmount);
      }

      if (ledgersToCreate.length > 0) {
        await mongoose.model('StudentFeeLedger').insertMany(ledgersToCreate, { session });
        created = ledgersToCreate.length;
      }

      if (!parentSession) await session.commitTransaction();
      return { created, updated };
    } catch (error) {
      if (!parentSession) await session.abortTransaction();
      logger.error('Error in _generateLedgersForAcademicYear:', error);
      throw error;
    } finally {
      if (!parentSession) session.endSession();
    }
  }

  /** Regenerate missing fee ledgers for a student (backfill for legacy data) */
  static async regenerateMissingLedgers(studentId) {
    const activeAcademicYearDoc = await mongoose.model('AcademicYear').findOne({ isActive: true }, null);
    if (!activeAcademicYearDoc) throw new AppError('No active academic year found.', 400);
    const activeAcademicYearStr = activeAcademicYearDoc.name;
    return await this._generateLedgersForAcademicYear(studentId, activeAcademicYearStr);
  }

  /**
   * Adds a custom fee ledger for a student.
   * Uses the OTHER fee category type.
   */
  static async addCustomFee(studentId, feeName, amount) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const student = await mongoose.model('Student').findById(studentId).session(session);
      if (!student) throw new ApiError(404, 'Student not found');

      let otherCategory = await mongoose.model('FeeCategory').findOne({ type: 'OTHER' }).session(session);
      if (!otherCategory) {
        otherCategory = await mongoose.model('FeeCategory').create([{
          name: 'Custom Fee',
          type: 'OTHER',
          isActive: true
        }], { session }).then(res => res[0]);
      }

      const activeAcademicYear = await mongoose.model('AcademicYear').findOne({ isActive: true }, null, { session });
      if (!activeAcademicYear) throw new AppError('No active academic year found.', 400);
      const academicYearStr = activeAcademicYear.name;

      const ledger = {
        studentId: student._id,
        feePeriod: feeName,
        feeType: 'OTHER',
        totalAmount: amount,
        paidAmount: 0,
        concessionAmount: 0,
        remainingAmount: amount,
        dueDate: new Date(),
        status: 'PENDING',
        feeCategoryId: otherCategory._id,
        academicYear: academicYearStr,
        source: 'MANUAL',
        generatedFrom: 'FEE_STRUCTURE',
        ledgerNumber: `LEDGER_CUST_${Date.now()}_${student.studentCode || student._id}`,
        snapshot: {
          studentName: student.studentName,
          medium: student.medium,
          standard: student.standard,
          division: student.division,
          transportType: student.transportType,
          isRTE: student.isRTE
        }
      };

      await mongoose.model('StudentFeeLedger').create([ledger], { session });

      await AuditService.log({
        performedBy: null,
        targetStudentId: studentId,
        action: 'LEDGER_CREATED',
        details: { type: 'CUSTOM_FEE', name: feeName, amount }
      }, session);

      await session.commitTransaction();
      return ledger;
    } catch (error) {
      await session.abortTransaction();
      logger.error('StudentService.addCustomFee error', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /** Bulk import students from excel data */
  static async importStudents(studentsArray) {
    if (!Array.isArray(studentsArray)) {
      throw new Error('Invalid input data format: expected an array of students');
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < studentsArray.length; i++) {
      const rowNum = i + 1;
      const data = studentsArray[i];

      try {
        if (!data.studentName || typeof data.studentName !== 'string' || !data.studentName.trim()) {
          throw new Error('Student name is required');
        }
        if (!data.medium || !['English', 'Gujarati'].includes(data.medium)) {
          throw new Error(`Medium must be 'English' or 'Gujarati' (got '${data.medium || ''}')`);
        }
        if (!data.standard) {
          throw new Error('Standard is required');
        }
        if (!data.division) {
          throw new Error('Division is required');
        }

        data.studentName = data.studentName.trim();
        data.standard = String(data.standard).trim();
        data.division = String(data.division).trim().toUpperCase();

        if (data.transportType) {
          data.transportType = String(data.transportType).trim();
          if (!data.transportType || data.transportType.toLowerCase() === 'none') {
            data.transportType = 'None';
          } else if (!['Railnagar', 'Outside Railnagar'].includes(data.transportType)) {
            throw new Error(`Transport Type must be 'Railnagar', 'Outside Railnagar', or 'None'`);
          }
        } else {
          data.transportType = 'None';
        }

        const parseBool = (val) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'string') {
            const normalized = val.toLowerCase().trim();
            return normalized === 'true' || normalized === 'yes' || normalized === '1';
          }
          if (typeof val === 'number') return val === 1;
          return false;
        };

        data.isRTE = parseBool(data.isRTE);
        // This import is ALWAYS for existing students (migrations), never new admissions
        data.isNewAdmission = false;

        const cleanMobileNumber = (val) => {
          if (val === undefined || val === null) return '';
          let str = String(val).trim();
          if (str.endsWith('.0')) {
            str = str.slice(0, -2);
          } else if (str.endsWith('.00')) {
            str = str.slice(0, -3);
          }
          let digits = str.replace(/\D/g, '');
          if (digits.length > 10) {
            digits = digits.slice(-10);
          }
          return digits;
        };

        if (data.parentMobile) {
          data.parentMobile = cleanMobileNumber(data.parentMobile);
          if (!/^[6-9]\d{9}$/.test(data.parentMobile)) {
            throw new Error('Enter Indian number or invalid number');
          }
        } else {
          throw new Error('Parent mobile number is required');
        }

        if (data.parentSecondaryMobile) {
          data.parentSecondaryMobile = cleanMobileNumber(data.parentSecondaryMobile);
          if (data.parentSecondaryMobile && !/^[6-9]\d{9}$/.test(data.parentSecondaryMobile)) {
            throw new Error('Enter Indian number or invalid number');
          }
        }

        const rawStartMonth = data.transportStartMonth || data["Transport Start Month"] || data["transportStartMonth"] || data["transport_start_month"];
        // transportAllPaid: transport type is set but no pending month = all transport months are already paid
        const transportAllPaid = data.transportAllPaid === true;
        if (transportAllPaid) {
          // Flag on data so createStudent can see it; set transportStartMonth to June so student record is clean
          data.transportAllPaid = true;
          data.transportStartMonth = 'June'; // All paid from June = full year paid
        } else if (rawStartMonth) {
          const cleanStart = String(rawStartMonth).toLowerCase().trim();
          const monthPrefixes = ['jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may'];
          const fullMonthNames = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
          let matched = null;
          for (let idx = 0; idx < monthPrefixes.length; idx++) {
            if (cleanStart.includes(monthPrefixes[idx])) {
              matched = fullMonthNames[idx];
              break;
            }
          }
          if (matched) {
            data.transportStartMonth = matched;
          } else {
            delete data.transportStartMonth;
          }
        }

        const student = await StudentService.createStudent(data);

        results.push({
          row: rowNum,
          studentName: data.studentName,
          status: 'success',
          studentCode: student.studentCode,
          transportStartMonth: student.transportStartMonth,
          id: student._id
        });
        successCount++;
      } catch (err) {
        let errMsg = err.message;
        if (err.code === 11000) {
          if (err.keyPattern && err.keyPattern.studentCode) {
            errMsg = 'Duplicate student code';
          } else {
            errMsg = 'Duplicate student: this parent already has a student with the same name and medium';
          }
        }
        results.push({
          row: rowNum,
          studentName: data.studentName || `Row ${rowNum}`,
          status: 'failed',
          error: errMsg
        });
        failCount++;
      }
    }

    return {
      successCount,
      failCount,
      results
    };
  }

  /**
   * Bulk-fix transport start month for already-imported students.
   * Updates transportStartMonth on the student record, deletes all existing
   * TRANSPORT ledgers for that student in the active academic year, then
   * regenerates them from the new start month.
   *
   * POST /api/v1/students/fix-transport
   * Body: { studentIds: string[], transportStartMonth: string }
   */
  static async fixTransportLedgers(studentIds, newStartMonth) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const validMonths = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
      if (!validMonths.includes(newStartMonth)) {
        throw new AppError(`Invalid month: ${newStartMonth}`, 400);
      }

      const activeYearDoc = await mongoose.model('AcademicYear').findOne({ isActive: true }, null, { session });
      if (!activeYearDoc) throw new AppError('No active academic year found.', 400);
      const activeYear = activeYearDoc.name;

      const getMonthsForAcademicYear = (yearStr) => {
        const match = yearStr.match(/^(\d{4})/);
        const startYear = match ? parseInt(match[1], 10) : 2025;
        const base = startYear + 1;
        return [
          { name: 'June',      dueDate: `${base}-06-15` },
          { name: 'July',      dueDate: `${base}-07-15` },
          { name: 'August',    dueDate: `${base}-08-15` },
          { name: 'September', dueDate: `${base}-09-15` },
          { name: 'October',   dueDate: `${base}-10-15` },
          { name: 'November',  dueDate: `${base}-11-15` },
          { name: 'December',  dueDate: `${base}-12-15` },
          { name: 'January',   dueDate: `${base + 1}-01-15` },
          { name: 'February',  dueDate: `${base + 1}-02-15` },
          { name: 'March',     dueDate: `${base + 1}-03-15` },
          { name: 'April',     dueDate: `${base + 1}-04-15` },
          { name: 'May',       dueDate: `${base + 1}-05-15` },
        ];
      };

      const months = getMonthsForAcademicYear(activeYear);
      const startIdx = months.findIndex(m => m.name === newStartMonth);
      const transportMonths = startIdx >= 0 ? months.slice(startIdx) : months;

      const transportCategory = await mongoose.model('FeeCategory').findOne({ type: 'TRANSPORT', isActive: true }, null, { session });
      if (!transportCategory) {
        throw new AppError('Transport fee category not found', 404);
      }

      const results = [];

      for (const rawId of studentIds) {
        try {
          const studentId = new mongoose.Types.ObjectId(rawId);
          const student = await mongoose.model('Student').findById(studentId, null, { session });
          if (!student) {
            results.push({ id: rawId, status: 'failed', error: 'Student not found' });
            continue;
          }

          if (!student.transportType || student.transportType === 'None') {
            results.push({ id: rawId, status: 'skipped', error: 'Student has no transport' });
            continue;
          }

          // 1. Update transportStartMonth on student record
          await mongoose.model('Student').updateOne(
            { _id: studentId },
            { $set: { transportStartMonth: newStartMonth } },
            { session }
          );

          // 2. Delete ALL existing transport ledgers for this student in the active year
          await mongoose.model('StudentFeeLedger').deleteMany(
            { studentId, feeType: 'TRANSPORT', academicYear: activeYear },
            { session }
          );

          // 3. Fetch transport amount
          const transportStruct = await mongoose.model('TransportFeeStructure').findOne(
            { transportType: student.transportType, academicYear: activeYear, isActive: true },
            null,
            { session }
          );
          // Fallback if no year-scoped rate found (legacy data)
          const transportFallback = !transportStruct
            ? await mongoose.model('TransportFeeStructure').findOne({ transportType: student.transportType, isActive: true }, null, { session })
            : null;
          const transportAmount = (transportStruct ?? transportFallback)?.amount ?? 0;

          // 4. Regenerate transport ledgers from new start month
          const newLedgers = transportMonths.map(m => ({
            studentId,
            feePeriod: m.name,
            feeType: 'TRANSPORT',
            totalAmount: transportAmount,
            paidAmount: 0,
            concessionAmount: 0,
            remainingAmount: transportAmount,
            dueDate: new Date(m.dueDate),
            status: 'PENDING',
            feeCategoryId: transportCategory._id,
            academicYear: activeYear,
            source: 'MANUAL',
            generatedFrom: 'TRANSPORT_STRUCTURE',
            ledgerNumber: `LEDGER_TRA_${m.name.toUpperCase()}_${activeYear.replace('-', '_')}_${student.studentCode || studentId}_FIX`,
            snapshot: {
              studentName: student.studentName,
              medium: student.medium,
              standard: student.standard,
              division: student.division,
              transportType: student.transportType,
              isRTE: student.isRTE
            }
          }));

          await mongoose.model('StudentFeeLedger').insertMany(newLedgers, { session });

          results.push({ id: rawId, studentName: student.studentName, status: 'fixed', monthsGenerated: transportMonths.length });
        } catch (err) {
          results.push({ id: rawId, status: 'failed', error: err.message });
        }
      }

      await session.commitTransaction();
      return { results, fixedCount: results.filter(r => r.status === 'fixed').length };
    } catch (error) {
      await session.abortTransaction();
      logger.error('StudentService.fixTransportLedgers error', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Automatically promotes a batch of students (by ID) to their next logical standard.
   * Each student keeps the same division. New fee ledgers are generated for the active academic year.
   * 
   * Does NOT use a wrapping session to avoid nested transaction conflicts — each call to
   * promoteStudents manages its own session internally.
   */
  static async autoPromoteBatch(studentIds, performedBy = null) {
    try {
      // Fetch active academic year
      const activeYearDoc = await mongoose.model('AcademicYear').findOne({ isActive: true });
      if (!activeYearDoc) {
        throw new AppError('No active academic year found. Please set one in Setup before promoting.', 400);
      }
      const activeYear = activeYearDoc.name;

      // Fetch all fee structures for the active year to validate before promoting
      const feeStructures = await mongoose.model('FeeStructure').find({ academicYear: activeYear });
      const feeStructureSet = new Set(
        feeStructures.map(fs => `${fs.medium}__${fs.standard}`)
      );

      // Map of how standards advance
      const preSchoolMap = { 'nursery': 'LKG', 'lkg': 'UKG', 'ukg': '1' };
      const getNextStandard = (currentStd) => {
        const stdLower = String(currentStd).toLowerCase().trim();
        if (preSchoolMap[stdLower]) return preSchoolMap[stdLower];
        const num = parseInt(stdLower, 10);
        if (!isNaN(num) && num < 12) return (num + 1).toString();
        return null; // Std 12 or invalid — skip
      };

      // Fetch all students in the given batch
      const students = await mongoose.model('Student').find({ _id: { $in: studentIds } });

      // Group by nextStandard + division + medium
      const promotionGroups = {};
      const skipped = [];

      for (const student of students) {
        const nextStd = getNextStandard(student.standard);

        // Skip Std 12 graduates
        if (!nextStd) {
          skipped.push({
            id: student._id,
            name: student.studentName,
            reason: `Std ${student.standard} is the final standard — cannot be promoted further`
          });
          continue;
        }

        // Skip if no fee structure exists for this medium + next standard in active year
        let targetMedium = student.medium;
        const feeKey = `${targetMedium}__${nextStd}`;
        if (feeStructureSet.size > 0 && !feeStructureSet.has(feeKey)) {
          // Try fallback medium
          const fallbackMedium = targetMedium.toLowerCase() === 'english' ? 'Gujarati' : 'English';
          const fallbackFeeKey = `${fallbackMedium}__${nextStd}`;
          if (feeStructureSet.has(fallbackFeeKey)) {
            targetMedium = fallbackMedium;
          } else {
            skipped.push({
              id: student._id,
              name: student.studentName,
              reason: `No fee structure found for Std ${nextStd} in ${activeYear}. Please add the fee structure first, then re-promote.`
            });
            continue;
          }
        }

        // Group key includes medium so Eng/Guj students don't mix
        const key = `${targetMedium}__${nextStd}__${student.division}`;
        if (!promotionGroups[key]) {
          promotionGroups[key] = {
            targetStandard: nextStd,
            targetDivision: student.division,
            targetMedium: targetMedium,
            studentIds: []
          };
        }
        promotionGroups[key].studentIds.push(student._id.toString());
      }

      let promotedCount = 0;
      const groupErrors = [];

      // Call promoteStudents for each group — each manages its own DB session
      for (const key of Object.keys(promotionGroups)) {
        const group = promotionGroups[key];
        try {
          await StudentService.promoteStudents(
            group.studentIds,
            group.targetStandard,
            group.targetDivision,
            activeYear,
            performedBy,
            group.targetMedium
          );
          promotedCount += group.studentIds.length;
        } catch (err) {
          logger.error(`autoPromoteBatch: group ${key} failed: ${err.message}`);
          groupErrors.push({ group: key, error: err.message });
        }
      }

      return {
        promotedCount,
        skippedCount: skipped.length,
        skipped,
        groupErrors
      };
    } catch (error) {
      logger.error('StudentService.autoPromoteBatch error', error);
      throw error;
    }
  }
}

export default StudentService;
