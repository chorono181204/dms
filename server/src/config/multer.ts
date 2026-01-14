import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads');

// Create uploads folder if not exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Keep original name but prepend timestamp to avoid collisions
        // Or just use original name if user prefers readable links?
        // User wants "Open with Word", so preserving extension is critical.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // clean filename of special chars
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, uniqueSuffix + '-' + cleanName);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export default upload;
