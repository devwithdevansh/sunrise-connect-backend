import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Parent from '../src/models/Parent.js';
import Student from '../src/models/Student.js';

function generatePassword(phone) {
  if (!phone) return 'N/A';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return 'N/A';
  return [1, 3, 5, 7, 9].map(i => digits[i]).join('');
}

async function exportData() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // We write directly to the artifact directory so the user can access it easily.
  // The directory is provided as a command line argument, or defaults to current directory.
  const artifactDir = process.argv[2] || process.cwd();
  const outputPath = path.join(artifactDir, 'parent_passwords_export.csv');

  const ws = fs.createWriteStream(outputPath);
  // Write CSV header
  ws.write('Parent Name,Primary Mobile Number,Password,Linked Students\n');

  const parents = await Parent.find({ isActive: true }).lean();
  console.log(`Found ${parents.length} parents.`);

  for (const parent of parents) {
    // Find linked students
    const students = await Student.find({ parentId: parent._id, isActive: true }).lean();
    const studentNames = students.map(s => s.studentName).join(' & ');

    const phone = parent.primaryMobileNumber || '';
    const password = generatePassword(phone);

    // Escape quotes and wrap in quotes for CSV safety
    const safeParentName = `"${(parent.parentName || '').replace(/"/g, '""')}"`;
    const safePhone = `"${phone}"`;
    const safePassword = `"${password}"`;
    const safeStudents = `"${studentNames.replace(/"/g, '""')}"`;

    ws.write(`${safeParentName},${safePhone},${safePassword},${safeStudents}\n`);
  }

  ws.end();
  await new Promise(resolve => ws.on('finish', resolve));

  console.log(`\nExport complete! File saved to: ${outputPath}`);
  await mongoose.disconnect();
}

exportData().catch(console.error);
