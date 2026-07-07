// src/config/firebase.js
// Lazy-initialises Firebase Admin SDK from a service account JSON file
// or from the FIREBASE_SERVICE_ACCOUNT environment variable.

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the local service account JSON (gitignored)
const SERVICE_ACCOUNT_PATH = join(
  __dirname,
  '../../config/firebase-service-account.json'
);

let _adminInstance = null;

/**
 * Returns the Firebase Admin instance (singleton).
 * Returns null if Firebase is not configured.
 */
export function getFirebaseAdmin() {
  if (_adminInstance) return _adminInstance;

  try {
    const require = createRequire(import.meta.url);
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      let serviceAccount;

      // 1. Preferred: Environment Variable (Hostinger/Vercel/etc.)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      }
      // 2. Local JSON file (Development)
      else if (existsSync(SERVICE_ACCOUNT_PATH)) {
        serviceAccount = require(SERVICE_ACCOUNT_PATH);
      }
      // 3. Firebase not configured
      else {
        logger.warn(
          'Firebase service account not found. Push notifications are disabled. ' +
          'Set FIREBASE_SERVICE_ACCOUNT environment variable or add config/firebase-service-account.json.'
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