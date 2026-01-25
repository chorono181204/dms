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
        const outputDir = path.join(process.cwd(), 'temp_pdf_conversions');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Build command: soffice.exe --headless --convert-to pdf --outdir <output> <input>
        const command = `"${SOFFICE_PATH}" --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;

        console.log('Executing LibreOffice conversion:', command);

        // Execute conversion
        const { stdout, stderr } = await execAsync(command, {
            timeout: 60000, // Increased timeout for larger files
            windowsHide: true,
        });

        if (stderr) {
            console.warn('LibreOffice stderr:', stderr);
        }

        console.log('LibreOffice stdout:', stdout);

        // Find the output PDF file
        const inputFileName = path.basename(inputPath, path.extname(inputPath));
        const outputPdfPath = path.join(outputDir, `${inputFileName}.pdf`);

        // Wait a bit for file to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!fs.existsSync(outputPdfPath)) {
            throw new Error(`PDF output file not found: ${outputPdfPath}`);
        }

        // Read PDF buffer
        const pdfBuffer = fs.readFileSync(outputPdfPath);

        // Cleanup: delete the temporary PDF file
        try {
            fs.unlinkSync(outputPdfPath);
        } catch (err) {
            console.warn('Failed to delete temp PDF:', err);
        }

        return pdfBuffer;
    } catch (error: any) {
        throw new Error(`File conversion failed: ${error.message}`);
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
