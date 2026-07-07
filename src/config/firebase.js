// src/config/firebase.js
// Lazy-initialises Firebase Admin SDK from a service account JSON file.
// If the file is missing (local dev without Firebase configured), logs a warning
// and returns null — the app continues to run, just without push notifications.

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the service account JSON (gitignored — never commit this file)
const SERVICE_ACCOUNT_PATH = join(__dirname, '../../config/firebase-service-account.json');

let _adminInstance = null;

export function getFirebaseAdmin() {
  if (_adminInstance) return _adminInstance;

  try {
    const require = createRequire(import.meta.url);
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      let serviceAccount;
      
      // 1. Try to load from Environment Variable (Best for Hostinger/Vercel)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } 
      // 2. Fallback to local JSON file
      else if (existsSync(SERVICE_ACCOUNT_PATH)) {
        serviceAccount = require(SERVICE_ACCOUNT_PATH);
      } 
      // 3. No credentials found
      else {
        logger.warn(
          'Firebase service account not found! Push notifications are disabled. ' +
          'Set FIREBASE_SERVICE_ACCOUNT env var or add config/firebase-service-account.json'
        );
        return null;
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin SDK initialised successfully.');
    }

    _adminInstance = admin;
    return _adminInstance;
  } catch (err) {
    logger.error('Failed to initialise Firebase Admin SDK', err);
    return null;
  }
}
