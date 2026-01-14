import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Path to LibreOffice soffice.exe
const SOFFICE_PATH = process.env.LIBREOFFICE_PATH || 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

/**
 * Convert DOCX file to PDF using LibreOffice command line
 * @param inputPath - Absolute path to input DOCX file
 * @returns Buffer containing PDF data
 */
export const convertDocxToPdf = async (inputPath: string): Promise<Buffer> => {
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
            timeout: 30000, // 30 second timeout
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
        await new Promise(resolve => setTimeout(resolve, 500));

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
        throw new Error(`DOCX to PDF conversion failed: ${error.message}`);
    }
};

/**
 * Convert DOCX buffer to PDF buffer
 * @param docxBuffer - Buffer containing DOCX data
 * @returns Buffer containing PDF data
 */
export const convertDocxBufferToPdf = async (docxBuffer: Buffer): Promise<Buffer> => {
    // Create temporary input file
    const tempDir = path.join(process.cwd(), 'temp_pdf_conversions');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempInputPath = path.join(tempDir, `temp_${Date.now()}.docx`);
    fs.writeFileSync(tempInputPath, docxBuffer);

    try {
        const pdfBuffer = await convertDocxToPdf(tempInputPath);

        // Cleanup temp input file
        try {
            fs.unlinkSync(tempInputPath);
        } catch (err) {
            console.warn('Failed to delete temp DOCX:', err);
        }

        return pdfBuffer;
    } catch (error) {
        // Cleanup on error
        try {
            fs.unlinkSync(tempInputPath);
        } catch (err) {
            // Ignore cleanup errors
        }
        throw error;
    }
};

/**
 * Check if file is a DOCX file based on extension
 * @param filePath - Path to file
 * @returns true if file is DOCX
 */
export const isDocxFile = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.docx' || ext === '.doc';
};
