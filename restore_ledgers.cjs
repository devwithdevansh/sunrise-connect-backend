const mongoose = require('mongoose');

async function restorePastLedgers() {
  await mongoose.connect('mongodb://127.0.0.1:27017/sunrise-connect');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const studentCode = 'STU1782654565391'; // lnlkn
    const targetYear = '2026-27';
    const correctStandard = 'Std 1';

    const student = await mongoose.model('Student').findOne({ studentCode });
    if (!student) throw new Error('Student not found');

    const existingLedgers = await mongoose.model('StudentFeeLedger').find({
      studentId: student._id,
      academicYear: targetYear,
      feeType: { $in: ['EDUCATION', 'TERM'] }
    });

    let feeStruct = await mongoose.model('FeeStructure').findOne({
      medium: student.medium,
      standard: correctStandard,
      academicYear: targetYear,
      isActive: true
    });

    if (!feeStruct) {
      feeStruct = await mongoose.model('FeeStructure').findOne({
        medium: student.medium,
        standard: correctStandard,
        isActive: true
      });
    }

    const educationAmount = Math.round(feeStruct.annualFee / ((feeStruct.educationPartCount || 12) + (feeStruct.termPartCount || 2)));
    const termAmount = Math.round(feeStruct.annualFee / ((feeStruct.educationPartCount || 12) + (feeStruct.termPartCount || 2)));

    for (const l of existingLedgers) {
      if (l.snapshot) {
        l.snapshot.standard = correctStandard;
        l.markModified('snapshot');
      }

      if (l.status !== 'PAID' && !student.isRTE) {
        const newAmount = l.feeType === 'EDUCATION' ? educationAmount : termAmount;
        l.totalAmount = newAmount;
        const paidSoFar = l.paidAmount || 0;
        l.remainingAmount = Math.max(0, newAmount - paidSoFar - (l.concessionAmount || 0));
        
        if (l.remainingAmount === 0 && paidSoFar > 0) l.status = 'PAID';
        else if (paidSoFar > 0) l.status = 'PARTIAL';
        else l.status = 'PENDING';
      }
      await l.save({ session });
    }

    await session.commitTransaction();
    console.log(`Successfully restored ledgers for ${studentCode} to ${correctStandard} for ${targetYear}`);
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
  } finally {
    session.endSession();
    mongoose.disconnect();
  }
}

restorePastLedgers();
