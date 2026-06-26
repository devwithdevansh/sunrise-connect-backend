// backend/scripts/seedDummyData.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import AcademicYear from '../src/models/AcademicYear.js';
import FeeCategory from '../src/models/FeeCategory.js';
import FeeStructure from '../src/models/FeeStructure.js';
import TransportFeeStructure from '../src/models/TransportFeeStructure.js';

// Setup env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sunrise-connect';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. Create Academic Year
    console.log('--- 1. Academic Year ---');
    let year = await AcademicYear.findOne({ name: '2026-2027' });
    if (!year) {
      year = await AcademicYear.create({
        name: '2026-2027',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isActive: true,
      });
      console.log('Created Academic Year 2026-2027');
    } else {
      console.log('Academic Year 2026-2027 already exists.');
      if (!year.isActive) {
        year.isActive = true;
        await year.save();
      }
    }

    // 2. Create Fee Categories
    console.log('--- 2. Fee Categories ---');
    const defaultCategories = [
      { name: 'Monthly Tuition Fee', type: 'EDUCATION', description: 'Standard monthly education charges' },
      { name: 'Term Fee', type: 'TERM', description: 'Half-yearly term fee' },
      { name: 'Admission Fee', type: 'ADMISSION', description: 'One-time registration fee' },
      { name: 'Transport Fee', type: 'TRANSPORT', description: 'Monthly bus charges' },
      { name: 'Bag & Kit Fee', type: 'OTHER', description: 'Study materials and uniform' },
    ];

    for (const cat of defaultCategories) {
      let existing = await FeeCategory.findOne({ name: cat.name });
      if (!existing) {
        await FeeCategory.create(cat);
        console.log(`Created Fee Category: ${cat.name}`);
      } else {
        console.log(`Fee Category ${cat.name} already exists.`);
      }
    }

    // 3. Create Transport Zones
    console.log('--- 3. Transport Zones ---');
    const zones = [
      { transportType: 'Railnagar', amount: 800, frequency: 'MONTHLY' },
      { transportType: 'Outside Railnagar', amount: 1200, frequency: 'MONTHLY' }
    ];

    for (const zone of zones) {
      let existing = await TransportFeeStructure.findOne({ transportType: zone.transportType });
      if (!existing) {
        await TransportFeeStructure.create(zone);
        console.log(`Created Transport Zone: ${zone.transportType}`);
      } else {
        console.log(`Transport Zone ${zone.transportType} already exists.`);
      }
    }

    // 4. Create Fee Structures for Standards 1-12 (English and Gujarati)
    console.log('--- 4. Fee Structures (Standards 1-12) ---');
    const mediums = ['English', 'Gujarati'];
    
    for (let std = 1; std <= 12; std++) {
      for (const medium of mediums) {
        let existing = await FeeStructure.findOne({ standard: String(std), medium });
        if (!existing) {
          // Calculate realistic ascending fee amounts
          const baseFee = medium === 'English' ? 12000 : 10000;
          const annualFee = baseFee + (std * 1000); // Increases by 1000 per standard
          
          await FeeStructure.create({
            standard: String(std),
            medium,
            annualFee,
            educationPartCount: 12,
            termPartCount: 2,
            termFee: Math.round(annualFee / 14),
            admissionFee: Math.round(annualFee * 0.07),
            bagKitFee: Math.round(annualFee * 0.05),
          });
          console.log(`Created Fee Structure for Std ${std} - ${medium} Medium (₹${annualFee})`);
        } else {
          console.log(`Fee Structure for Std ${std} - ${medium} Medium already exists.`);
        }
      }
    }

    console.log('\n✅ Seeding complete! You can now use the Setup screens perfectly.');
    process.exit(0);

  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
