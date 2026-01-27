import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Path to LibreOffice soffice.exe
const SOFFICE_PATH = process.env.LIBREOFFICE_PATH || 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

/**
 * Convert document file to PDF using LibreOffice command line
 * Supports: DOCX, DOC, TXT, XLSX, XLS, PPTX, PPT
 * @param inputPath - Absolute path to input file
 * @returns Buffer containing PDF data
 */
export const convertFileToPdf = async (inputPath: string): Promise<Buffer> => {
    let tempInputPath = '';
    let outputPdfPath = '';
    const outputDir = path.join(process.cwd(), 'temp_pdf_conversions');
    const userProfileDir = path.join(outputDir, `profile_${Date.now()}`);

    try {
        // Verify LibreOffice exists
        if (!fs.existsSync(SOFFICE_PATH)) {
            throw new Error(`LibreOffice not found at: ${SOFFICE_PATH}`);
        }

        // Verify input file exists
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        // Create temporary output directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 1. Copy input file to a safe local temporary path (to avoid path/character issues)
        const safeId = `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const ext = path.extname(inputPath);
        tempInputPath = path.join(outputDir, `${safeId}${ext}`);
        fs.copyFileSync(inputPath, tempInputPath);

        // 2. Build command: soffice.exe --headless --convert-to pdf --outdir <output> <input>
        // Use -env:UserInstallation to avoid conflicts with other LibreOffice instances
        const profilePath = `file:///${userProfileDir.replace(/\\/g, '/')}`;
        const command = `"${SOFFICE_PATH}" "-env:UserInstallation=${profilePath}" --headless --convert-to pdf --outdir "${outputDir}" "${tempInputPath}"`;

        console.log('Executing LibreOffice conversion:', command);

        // Execute conversion
        const { stdout, stderr } = await execAsync(command, {
            timeout: 60000,
            windowsHide: true,
        });

        if (stderr) {
            console.warn('LibreOffice stderr:', stderr);
        }
        console.log('LibreOffice stdout:', stdout);

        // 3. Find the output PDF file (it will have the same base name as tempInputPath)
        outputPdfPath = path.join(outputDir, `${safeId}.pdf`);

        // Wait up to 5 seconds for file to appear, checking every 500ms
        let attempts = 0;
        while (!fs.existsSync(outputPdfPath) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (!fs.existsSync(outputPdfPath)) {
            throw new Error(`PDF output file not found after conversion at: ${outputPdfPath}. OutputDir contents: ${fs.readdirSync(outputDir).join(', ')}`);
        }

        // Read PDF buffer
        const pdfBuffer = fs.readFileSync(outputPdfPath);
        return pdfBuffer;

    } catch (error: any) {
        console.error('[CONVERSION_ERROR]', error);
        throw new Error(`File conversion failed: ${error.message}`);
    } finally {
        // Cleanup all temporary files and profile
        [tempInputPath, outputPdfPath].forEach(p => {
            if (p && fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) { }
            }
        });
        if (fs.existsSync(userProfileDir)) {
            try {
                // Recursive delete for profile dir
                fs.rmSync(userProfileDir, { recursive: true, force: true });
            } catch (e) { }
        }
    }
};

/**
 * Check if file is compatible for PDF conversion
 * @param filePath - Path to file
 * @returns true if file is supported
 */
export const isConvertibleFile = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = [
        '.docx', '.doc',
        '.txt',
        '.xlsx', '.xls',
        '.pptx', '.ppt'
    ];
    return supportedExtensions.includes(ext);
};
