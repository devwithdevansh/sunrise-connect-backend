import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import env from './src/config/env.js';

cloudinary.config({ 
    cloud_name: env.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME', 
    api_key: env.CLOUDINARY_API_KEY || 'YOUR_API_KEY', 
    api_secret: env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
});

console.log("Cloud name:", env.CLOUDINARY_CLOUD_NAME);
console.log("API Key:", env.CLOUDINARY_API_KEY);

const uploadStream = cloudinary.uploader.upload_stream(
    { folder: 'whatsapp_templates' },
    (error, result) => {
        if (error) {
            console.error('Cloudinary Upload Error:', error);
        } else {
            console.log('Success:', result.secure_url);
        }
    }
);

// upload a tiny dummy image buffer
const dummyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
uploadStream.end(dummyImage);
