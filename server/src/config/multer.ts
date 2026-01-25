import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

const prisma = new PrismaClient(); // Local instance to avoid circular deps if client imports config

// Root directory for uploads
// User requested "G drive". We can try to use G or fallback to local uploads.
// For safety in dev environment (where G might not exist), we check.
const PREFERRED_ROOT = 'G:\\DMS_DATA';
const GDRIVE_ROOT = 'G:\\My Drive\\DMS';
const FALLBACK_ROOT = path.join(__dirname, '../../uploads');

const getUploadRoot = () => {
    try {
        if (fs.existsSync('G:\\')) {
            // Check for Google Drive structure matches
            if (fs.existsSync('G:\\My Drive')) {
                const gDrivePath = GDRIVE_ROOT;
                if (!fs.existsSync(gDrivePath)) {
                    fs.mkdirSync(gDrivePath, { recursive: true });
                }
                return gDrivePath;
            }

            // Fallback to standard G: root
            if (!fs.existsSync(PREFERRED_ROOT)) {
                fs.mkdirSync(PREFERRED_ROOT, { recursive: true });
            }
            return PREFERRED_ROOT;
        }
    } catch (e) {
        // G drive access error
    }
    return FALLBACK_ROOT;
};

const storage = multer.diskStorage({
    destination: async function (req: any, file, cb) {
        try {
            const root = getUploadRoot();
            let finalPath = root;

            // Check if this is a Chat upload
            if (req.originalUrl && req.originalUrl.includes('/chat/')) {
                finalPath = path.join(root, 'Chat_Uploads');
                if (!fs.existsSync(finalPath)) {
                    fs.mkdirSync(finalPath, { recursive: true });
                }
                console.log(`[CHAT UPLOAD] Saving to: ${finalPath}`);
                cb(null, finalPath);
                return;
            }

            // 1. Determine Department
            // Admin might send departmentId, else use user's department
            let departmentId = req.body.departmentId ? Number(req.body.departmentId) : undefined;
            if (!departmentId && req.user) {
                departmentId = req.user.departmentId;
            }

            let departmentName = 'General';
            if (departmentId) {
                const dept = await prisma.department.findUnique({ where: { id: departmentId } });
                if (dept) {
                    departmentName = dept.name;
                }
            }

            // 2. Determine Category Path (Recursive)
            let categoryPathParts: string[] = [];
            if (req.body.categoryId) {
                let currentId = Number(req.body.categoryId);
                while (currentId) {
                    const cat = await prisma.category.findUnique({ where: { id: currentId } });
                    if (cat) {
                        categoryPathParts.unshift(cat.name); // Add to front
                        currentId = cat.parentId || 0;
                    } else {
                        break;
                    }
                }
            } else {
                // If no category selected, save to Department Root.
                // Do not append any folder name.
            }

            // Sanitization helper - only remove unsafe filesystem characters
            const sanitize = (name: string) => name.replace(/[<>:"\/\\|?*]/g, '_');

            const safeDept = sanitize(departmentName);
            const safeCatPath = categoryPathParts.map(sanitize).join(path.sep);

            // Construct full path: ROOT / Dept / Cat / SubCat
            finalPath = path.join(root, safeDept, safeCatPath);

            // Create directory
            if (!fs.existsSync(finalPath)) {
                fs.mkdirSync(finalPath, { recursive: true });
            }

            cb(null, finalPath);

        } catch (error) {
            console.error('Multer Destination Error:', error);
            // Fallback to basic uploads dir in case of DB error
            cb(null, FALLBACK_ROOT);
        }
    },
    filename: function (req, file, cb) {
        // Use sanitized original name.
        // Add timestamp to ensure uniqueness if needed, but user prefers clean structure.
        // We will append timestamp ONLY if file exists? 
        // For DMS, uniqueness is safer.

        // Helper to sanitize for filesystem paths - only remove truly illegal characters
        const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

        const cleanName = sanitize(file.originalname);
        const nameWithoutExt = path.parse(cleanName).name;
        const ext = path.parse(cleanName).ext;

        // Final: Name_Timestamp.ext
        cb(null, `${nameWithoutExt}_${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export default upload;
