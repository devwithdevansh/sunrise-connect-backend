import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import env from '../config/env.js';

const router = express.Router();

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({ 
    cloud_name: env.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME', 
    api_key: env.CLOUDINARY_API_KEY || 'YOUR_API_KEY', 
    api_secret: env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Upload a buffer to Cloudinary and return the result.
 * Wraps the callback-based upload_stream in a Promise.
 */
function uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        stream.end(buffer);
    });
}

// ─── POST /api/v1/upload/image ────────────────────────────────────────────────
// WhatsApp template image upload (existing route — unchanged)
router.post('/image', authenticate, authorize('ADMIN', 'SUPERADMIN'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No image file provided' });
        }
        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'whatsapp_templates',
            format: 'jpg',
        });
        res.status(200).json({ status: 'success', url: result.secure_url });
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        res.status(500).json({ status: 'error', message: 'Upload to Cloudinary failed', error: error.message });
    }
});

// ─── POST /api/v1/upload/student-photo ───────────────────────────────────────
// Upload a student profile photo to Cloudinary.
//
// Deduplication: the MD5 hash of the raw file buffer is used as the Cloudinary
// public_id (under student_photos/). Uploading the exact same file twice always
// resolves to the same URL — Cloudinary never creates a duplicate.
//
// Compression: Cloudinary applies a face-aware crop to 400×400 px and selects
// the best quality/format automatically (WebP on modern browsers), keeping the
// delivered image under ~25 KB regardless of the original file size.
//
// Auth: ADMIN, STAFF, TEACHER (not parent).
// Response: { status: 'success', url: '<cloudinary_secure_url>' }
// The caller must then PATCH /api/v1/students/:id with { photoUrl } to persist.
//
router.post(
    '/student-photo',
    authenticate,
    authorize('ADMIN', 'STAFF', 'TEACHER', 'SUPERADMIN'),
    upload.single('photo'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ status: 'error', message: 'No photo file provided' });
            }

            // ── 5 MB guard ──────────────────────────────────────────────────
            const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
            if (req.file.size > MAX_BYTES) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Photo is too large. Maximum allowed size is 5 MB.',
                });
            }

            // ── Deduplication via MD5 hash as public_id ──────────────────────
            // Same file bytes → same hash → Cloudinary returns the existing asset
            // without re-uploading, saving storage and bandwidth.
            const hash = crypto.createHash('md5').update(req.file.buffer).digest('hex');

            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'student_photos',
                public_id: hash,
                // overwrite: false means if the asset already exists Cloudinary
                // skips the upload and returns the existing resource immediately.
                overwrite: false,
                invalidate: false,
                // Face-aware crop to square thumbnail; auto quality/format (WebP
                // on supporting browsers) to minimise file size.
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto:good', fetch_format: 'auto' },
                ],
            });

            return res.status(200).json({ status: 'success', url: result.secure_url });
        } catch (error) {
            console.error('Student Photo Upload Error:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Upload to Cloudinary failed',
                error: error.message,
            });
        }
    }
);

export default router;

