import mongoose from 'mongoose';

// Use same env variables logic
const MONGODB_URI = 'mongodb://localhost:27017/sunrise_connect';

// Models
const paymentSchema = new mongoose.Schema({}, { strict: false });
const Payment = mongoose.model('Payment', paymentSchema, 'payments');

const ledgerSchema = new mongoose.Schema({}, { strict: false });
const Ledger = mongoose.model('StudentFeeLedger', ledgerSchema, 'studentfeeledgers');

const auditLogSchema = new mongoose.Schema({}, { strict: false });
const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'auditlogs');

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const startDate = new Date('2026-07-01T00:00:00Z');
    
    // Using amounts specified in screenshot: 650 and 4200
    const dummyPayments = await Payment.find({
      createdAt: { $gte: startDate },
      amount: { $in: [650, 4200] }
    });

    console.log(`Found ${dummyPayments.length} dummy payments`);

    for (const payment of dummyPayments) {
      console.log(`Processing payment ${payment._id} of amount ${payment.amount}`);
      
      const ledger = await Ledger.findById(payment.ledgerId);
      if (ledger) {
        console.log(`Found ledger ${ledger._id}. Current paidAmount: ${ledger.paidAmount}`);
        const newPaidAmount = Math.max(0, ledger.paidAmount - payment.amount);
        const newRemainingAmount = ledger.totalAmount - newPaidAmount - ledger.concessionAmount;
        
        let status = 'PENDING';
        if (newRemainingAmount === 0) status = 'PAID';
        else if (newPaidAmount > 0) status = 'PARTIAL';
        
        await Ledger.updateOne(
          { _id: ledger._id },
          { $set: { paidAmount: newPaidAmount, remainingAmount: newRemainingAmount, status } }
        );
        console.log(`Updated ledger to paidAmount: ${newPaidAmount}, status: ${status}`);
      }

      await Payment.deleteOne({ _id: payment._id });
      console.log(`Deleted payment ${payment._id}`);
      
      await AuditLog.deleteMany({ 'details.paymentId': payment._id });
    }

    console.log('Cleanup completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

main();
