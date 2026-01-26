import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Embed signature image into PDF at specified position with name and position text
 * @param pdfBytes - Original PDF as Uint8Array
 * @param signatureImageUrl - URL to signature PNG image
 * @param pageNumber - Page number (0-indexed)
 * @param x - X coordinate (from bottom-left)
 * @param y - Y coordinate (from bottom-left)
 * @param width - Signature width
 * @param height - Signature height
 * @param userName - Name of the person signing
 * @param userPosition - Position/title of the person signing
 * @returns Modified PDF as Uint8Array
 */
export const embedSignatureInPdf = async (
    pdfBytes: Uint8Array,
    signatureImageUrl: string,
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
    userName?: string,
    userPosition?: string
): Promise<Uint8Array> => {
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Fetch signature image
    const signatureImageBytes = await fetch(signatureImageUrl).then(res => res.arrayBuffer());

    // Embed the PNG image
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    // Get the page
    const pages = pdfDoc.getPages();
    const page = pages[pageNumber];

    // Draw the signature image (which already includes name and position)
    // Use Multiply blend mode to make white background transparent
    page.drawImage(signatureImage, {
        x,
        y,
        width,
        height,
        blendMode: 'Multiply' as any, // Cast to any if type definition is missing, or import BlendMode
    });

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    return modifiedPdfBytes;
};

/**
 * Convert PDF Uint8Array to Blob for download
 * @param pdfBytes - PDF as Uint8Array
 * @returns Blob
 */
export const pdfBytesToBlob = (pdfBytes: Uint8Array): Blob => {
    return new Blob([pdfBytes], { type: 'application/pdf' });
};

/**
 * Download PDF blob as file
 * @param blob - PDF Blob
 * @param filename - Filename for download
 */
export const downloadPdf = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

/**
 * Creates a composite image containing the signature image and text (name/position)
 * Returns a Data URL (base64 PNG)
 */
export const createCompositeSignatureImage = (
    originalImageUrl: string,
    width: number,
    height: number,
    userName?: string,
    userPosition?: string,
    dateString?: string, // Added dateString parameter
    fontFamily: string = 'Arial',
    fontSizePt: number = 14
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            // Dynamic scale: Ensure the signature image part is at least ~800px wide for crispness at high zoom
            const scale = Math.max(4, 1000 / width);

            // Calculate height needed for text
            const baseFontSize = fontSizePt * scale;
            const textPadding = 0;
            let textHeight = 0;
            if (userName) textHeight += baseFontSize + textPadding;
            if (userPosition) textHeight += (baseFontSize * 0.8) + textPadding;
            if (dateString) textHeight += (baseFontSize * 0.7) + textPadding;

            // Prepare fonts for measurement
            // Ensure font family is quoted if it contains spaces
            const cleanFont = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
            const nameFont = `bold ${baseFontSize}px ${cleanFont}, sans-serif`;
            const positionFont = `normal ${baseFontSize * 0.8}px ${cleanFont}, sans-serif`;
            const dateFont = `italic ${baseFontSize * 0.7}px ${cleanFont}, sans-serif`; // Added date font

            // Measure text width
            let maxTextWidth = 0;
            if (userName) {
                ctx.font = nameFont;
                const metrics = ctx.measureText(userName);
                maxTextWidth = Math.max(maxTextWidth, metrics.width);
            }
            if (userPosition) {
                ctx.font = positionFont;
                const metrics = ctx.measureText(`(${userPosition})`);
                maxTextWidth = Math.max(maxTextWidth, metrics.width);
            }
            if (dateString) { // Measure date width
                ctx.font = dateFont;
                const metrics = ctx.measureText(dateString);
                maxTextWidth = Math.max(maxTextWidth, metrics.width);
            }

            // Canvas dimensions
            // Width is max of image width or text width (plus some padding for text)
            const imgWidth = width * scale;
            const finalWidth = Math.max(imgWidth, maxTextWidth + (10 * scale));

            canvas.width = finalWidth;
            canvas.height = (height * scale) + textHeight + (10 * scale); // 10px extra padding

            // 2. Draw Signature Image (Centered)
            const drawW = width * scale;
            const drawH = height * scale;
            const imgX = (finalWidth - drawW) / 2;
            ctx.drawImage(img, imgX, 0, drawW, drawH);

            // 3. Draw Text (Centered)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#000000';

            let currentY = drawH + textPadding;

            if (userName) {
                ctx.font = nameFont;
                ctx.fillText(userName, finalWidth / 2, currentY);
                currentY += baseFontSize + textPadding;
            }

            if (userPosition) {
                ctx.font = positionFont;
                ctx.fillStyle = '#666666';
                ctx.fillText(`(${userPosition})`, finalWidth / 2, currentY);
                currentY += (baseFontSize * 0.85) + textPadding;
            }

            if (dateString) { // Draw date
                ctx.font = dateFont;
                ctx.fillStyle = '#000000'; // Black color for date
                ctx.fillText(dateString, finalWidth / 2, currentY);
            }

            resolve({
                dataUrl: canvas.toDataURL('image/png'),
                visualWidth: finalWidth / scale,
                visualHeight: canvas.height / scale
            });
        };
        img.onerror = (err) => reject(err);
        img.src = originalImageUrl;
    });
};
