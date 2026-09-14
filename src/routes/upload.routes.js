import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import env from '../config/env.js';

const router = express.Router();

// Configuration
cloudinary.config({ 
    cloud_name: env.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME', 
    api_key: env.CLOUDINARY_API_KEY || 'YOUR_API_KEY', 
    api_secret: env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/image', authenticate, authorize('ADMIN', 'SUPERADMIN'), upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No image file provided' });
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'whatsapp_templates' },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary Upload Error:', error);
                    return res.status(500).json({ status: 'error', message: 'Upload to Cloudinary failed', error: error.message });
                }
                res.status(200).json({ status: 'success', url: result.secure_url });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ status: 'error', message: 'Server error during upload' });
    }
});

export default router;
