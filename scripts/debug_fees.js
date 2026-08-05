import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const studentSchema = new mongoose.Schema({
  parentId: mongoose.Schema.Types.ObjectId,
  studentName: String,
  isActive: Boolean
});

const ledgerSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  status: String,
  dueDate: Date,
  remainingAmount: Number
});

const Student = mongoose.model('Student', studentSchema);
const StudentFeeLedger = mongoose.model('StudentFeeLedger', ledgerSchema, 'studentfeeledgers');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const parentId = '6a553eecb0893da913a38993';
  
  try {
    const students = await Student.find({ parentId });
    console.log(`Found ${students.length} students for parent ${parentId}`);
    
    const now = new Date();
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    console.log(`endOfCurrentMonth limit: ${endOfCurrentMonth}`);
    
    let feeDue = 0;
    for (const st of students) {
      console.log(`Student: ${st.studentName} (ID: ${st._id}), isActive: ${st.isActive}`);
      const allLedgers = await StudentFeeLedger.find({ studentId: st._id });
      console.log(`- Total ledgers for student: ${allLedgers.length}`);
      
      const filteredLedgers = await StudentFeeLedger.find({ 
        studentId: st._id, 
        status: { $in: ['PENDING', 'PARTIAL'] },
        dueDate: { $lte: endOfCurrentMonth }
      });
      console.log(`- Ledgers matching criteria (<= end of month): ${filteredLedgers.length}`);
      filteredLedgers.forEach(l => {
          feeDue += l.remainingAmount;
          console.log(`  - status: ${l.status}, remainingAmount: ${l.remainingAmount}, dueDate: ${l.dueDate}`);
      });
    }
    console.log('Total fee due:', feeDue);
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

check();
