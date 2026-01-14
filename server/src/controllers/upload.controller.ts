import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import fs from 'fs';
import path from 'path';

const uploadFile = catchAsync(async (req, res) => {
    if (!req.file) {
        res.status(httpStatus.BAD_REQUEST).send({ message: 'No file uploaded' });
        return;
    }

    const category = req.body.category || 'Chưa phân loại';
    const name = req.body.name || 'Untitled';

    // Target structure: G:\My Drive\DMS\{category}\Mẫu
    const targetRoot = 'G:\\My Drive\\DMS';
    const targetDir = path.join(targetRoot, category, 'Mẫu');

    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Use the provided Name for the filename, keeping original extension
        const ext = path.extname(req.file.originalname); // .docx
        const safeName = name.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ \-_]/g, '_');
        const finalFilename = `${safeName}${ext}`;
        const targetPath = path.join(targetDir, finalFilename);

        // Move file
        try {
            fs.renameSync(req.file.path, targetPath);
        } catch (e: any) {
            if (e.code === 'EXDEV') {
                fs.copyFileSync(req.file.path, targetPath);
                fs.unlinkSync(req.file.path);
            } else {
                throw e;
            }
        }

        res.status(httpStatus.OK).send({
            url: targetPath, // We still save the absolute path internally
            filename: finalFilename
        });

    } catch (error) {
        console.error('Error saving file to G drive:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            message: 'Could not save file to G: Drive.',
            error: error
        });
    }
});

const downloadFile = catchAsync(async (req, res) => {
    const filePath = req.query.path as string;
    const isInline = req.query.inline === 'true';

    console.log('Download request for path:', filePath);
    console.log('Path exists?', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
        console.error('File not found at path:', filePath);
        res.status(httpStatus.NOT_FOUND).send({ message: 'File not found' });
        return;
    }

    if (isInline) {
        // Send file for browser to display (if supported, e.g. PDF)
        res.setHeader('Content-Security-Policy', "");
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.sendFile(path.resolve(filePath));
    } else {
        // Force download
        res.download(path.resolve(filePath));
    }
});

export default {
    uploadFile,
    downloadFile
};
