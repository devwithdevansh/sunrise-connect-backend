import ReportService from './src/services/ReportService.js';
import StudentFeeLedger from './src/models/StudentFeeLedger.js';

StudentFeeLedger.aggregate = async (pipeline) => {
  console.log(JSON.stringify(pipeline, null, 2));
  return [];
};

async function run() {
  try {
    const report = await ReportService.getUnpaidReport();
    console.log('Success, pipeline was built properly.');
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
