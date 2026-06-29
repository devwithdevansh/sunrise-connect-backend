import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://connect123:connect123@ourprojects.pcdpqxh.mongodb.net/?appName=OurProjects';
const HOURS_AGO = 3;

async function cleanup() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const cutoff = new Date(Date.now() - HOURS_AGO * 60 * 60 * 1000);
  console.log('Deleting students created after:', cutoff.toISOString());

  const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  const Student = mongoose.model('Student', StudentSchema, 'students');
  const Ledger = mongoose.model('Ledger', new mongoose.Schema({}, { strict: false }), 'studentfeeledgers');
  const Parent = mongoose.model('Parent', new mongoose.Schema({}, { strict: false }), 'parents');

  const students = await Student.find({ createdAt: { $gte: cutoff } }, { _id: 1, parentId: 1, studentName: 1, standard: 1 });
  console.log('Found', students.length, 'students to delete');
  students.slice(0, 5).forEach(s => console.log(' -', s.studentName, 'Std', s.standard));

  if (students.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const studentIds = students.map(s => s._id);
  const parentIds = [...new Set(students.map(s => s.parentId?.toString()).filter(Boolean))];

  const ledgerRes = await Ledger.deleteMany({ studentId: { $in: studentIds } });
  console.log('Deleted', ledgerRes.deletedCount, 'ledger entries');

  const stuRes = await Student.deleteMany({ _id: { $in: studentIds } });
  console.log('Deleted', stuRes.deletedCount, 'students');

  let orphans = 0;
  for (const pid of parentIds) {
    const kids = await Student.countDocuments({ parentId: new mongoose.Types.ObjectId(pid) });
    if (kids === 0) {
      await Parent.deleteOne({ _id: new mongoose.Types.ObjectId(pid) });
      orphans++;
    }
  }
  console.log('Deleted', orphans, 'orphaned parent accounts');
  console.log('DONE - database is clean for re-testing');
  await mongoose.disconnect();
}

cleanup().catch(err => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
