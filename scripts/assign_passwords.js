/**
 * assign_passwords.js
 * -----------------------------------------------------------------------
 * Assigns a deterministic password to each parent based on their registered
 * mobile number, then (optionally) sends a WhatsApp credentials message.
 *
 * Password rule:
 *   Take the digits at even positions (0-based index: 1, 3, 5, 7, 9)
 *   of the 10-digit primary mobile number.
 *   e.g. 9687629341 → (idx 1)6 (idx 3)7 (idx 5)2 (idx 7)3 (idx 9)1 → "67231"
 *
 * Usage:
 *   node scripts/assign_passwords.js             # TEST mode (3 hardcoded phones)
 *   node scripts/assign_passwords.js --all       # Full blast (ALL active parents)
 *
 * IMPORTANT: Run in TEST mode first. Verify the 3 parents can log in.
 * Only then run with --all.
 * -----------------------------------------------------------------------
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import Parent from '../src/models/Parent.js';

// ──────────────────────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────────────────────

// These 3 phones are used for TEST mode only
const TEST_PHONES = ['9516238470', '6512473896', '9596234875'];

const IS_ALL_MODE = process.argv.includes('--all');
const DRY_RUN     = process.argv.includes('--dry-run'); // prints but does NOT write to DB

// ──────────────────────────────────────────────────────────────────────────────
// PASSWORD GENERATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generates a 5-character password from the 10-digit phone number.
 * Takes digits at 0-based indices 1, 3, 5, 7, 9 (the "even digit place" rule).
 *
 * @param {string} phone - 10-digit Indian mobile number
 * @returns {string} 5-digit password string
 */
function generatePassword(phone) {
  // Normalise: strip country code prefix if present, keep last 10 digits
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    throw new Error(`Cannot generate password — phone "${phone}" does not yield 10 digits after cleaning`);
  }
  // Indices 1, 3, 5, 7, 9 (0-based) are the "even place" positions
  return [1, 3, 5, 7, 9].map(i => digits[i]).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Sunrise Connect — Password Assignment Tool  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log(`Mode   : ${IS_ALL_MODE ? '🌍 ALL PARENTS' : '🧪 TEST (3 phones)'}`);
  console.log(`DryRun : ${DRY_RUN ? 'YES — no DB writes' : 'NO  — writes WILL happen'}`);
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Resolve target parents
  let parents;
  if (IS_ALL_MODE) {
    parents = await Parent.find({ isActive: true, primaryMobileNumber: { $exists: true, $ne: '' } })
      .select('_id primaryMobileNumber parentName isPasswordSet')
      .lean();
    console.log(`Found ${parents.length} active parents to process.\n`);
  } else {
    parents = await Parent.find({ primaryMobileNumber: { $in: TEST_PHONES } })
      .select('_id primaryMobileNumber parentName isPasswordSet')
      .lean();
    console.log(`Found ${parents.length} / ${TEST_PHONES.length} test parents.\n`);
    if (parents.length !== TEST_PHONES.length) {
      const found = parents.map(p => p.primaryMobileNumber);
      const missing = TEST_PHONES.filter(p => !found.includes(p));
      console.warn(`⚠  Missing parents for phones: ${missing.join(', ')}`);
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (const parent of parents) {
    const phone = parent.primaryMobileNumber;
    let password;
    try {
      password = generatePassword(phone);
    } catch (err) {
      console.error(`  ✗ [${parent.parentName}] ${phone} — ${err.message}`);
      failCount++;
      continue;
    }

    console.log(`  👤 ${parent.parentName || '(unnamed)'}`);
    console.log(`     Phone    : ${phone}`);
    console.log(`     Password : ${password}  (plain, NOT stored)`);

    if (!DRY_RUN) {
      try {
        const hash = await bcrypt.hash(password, 12);
        await Parent.updateOne(
          { _id: parent._id },
          {
            $set: {
              passwordHash: hash,
              isPasswordSet: true,
              allowOtpReset: false,
            },
          }
        );
        console.log(`     ✅ Password assigned successfully`);
        successCount++;
      } catch (err) {
        console.error(`     ✗ DB update failed: ${err.message}`);
        failCount++;
      }
    } else {
      console.log(`     🔵 DRY RUN — skipped DB write`);
      successCount++;
    }
    console.log('');
  }

  console.log('─────────────────────────────────────────────');
  console.log(`Done. ✅ ${successCount} succeeded  ✗ ${failCount} failed`);
  console.log('');
  if (!DRY_RUN && !IS_ALL_MODE) {
    console.log('ℹ  Next steps:');
    console.log('   1. Ask the 3 test parents to log in using:');
    console.log('      Login ID  : their 10-digit registered mobile number');
    console.log('      Password  : the 5-digit password shown above');
    console.log('   2. Once confirmed, run:  node scripts/assign_passwords.js --all');
    console.log('   3. Then send WhatsApp credentials from the Admin → WhatsApp section');
  }
  console.log('');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
