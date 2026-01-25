import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import moment from 'moment';

export enum WatermarkType {
    APPROVED = 'APPROVED',
    OBSOLETE = 'OBSOLETE',
    DRAFT = 'DRAFT',
    REFERENCE = 'REFERENCE'
}

interface WatermarkOptions {
    type: WatermarkType;
    effectiveDate?: Date;
    obsoleteDate?: Date;
    departmentName?: string;
    visibility?: string;
}

/**
 * Apply dynamic watermark to a PDF buffer
 */
export const applyWatermark = async (pdfBuffer: Buffer, options: WatermarkOptions): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(fontkit);

    // Load Vietnamese compatible font
    const fontPath = path.join(__dirname, '../assets/fonts/arial.ttf');
    let font;
    if (fs.existsSync(fontPath)) {
        const fontBytes = fs.readFileSync(fontPath);
        font = await pdfDoc.embedFont(fontBytes);
    } else {
        // Fallback to standard font (will not support Vietnamese characters well)
        font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Define Watermark Asset Paths
    const assetBase = path.join(__dirname, '../assets/watermarks');
    let imagePath = '';
    let statusText = '';
    let dateText = '';
    let color = rgb(0, 0, 0);

    switch (options.type) {
        case WatermarkType.APPROVED:
            imagePath = path.join(assetBase, 'dapheduyet.png');
            dateText = options.effectiveDate ? `Sử dụng từ: ${moment(options.effectiveDate).format('DD/MM/YYYY')}` : '';
            color = rgb(0.3, 0.7, 0); // Greenish
            break;
        case WatermarkType.OBSOLETE:
            imagePath = path.join(assetBase, 'hethieuluc.png');
            dateText = options.obsoleteDate ? `Không sử dụng từ: ${moment(options.obsoleteDate).format('DD/MM/YYYY')}` : '';
            color = rgb(0.1, 0.2, 0.5); // Navy blue
            break;
        case WatermarkType.DRAFT:
            imagePath = path.join(assetBase, 'bannhap.png');
            color = rgb(0, 0, 0);
            break;
        case WatermarkType.REFERENCE:
            imagePath = path.join(assetBase, 'tailieuthamkhao.png');
            dateText = options.effectiveDate ? `Sử dụng từ: ${moment(options.effectiveDate).format('DD/MM/YYYY')}` : '';
            color = rgb(0.1, 0.2, 0.5); // Using same navy blue as obsolete/reference standard in image
            break;
    }

    // Load and Embed Image
    if (fs.existsSync(imagePath)) {
        const imageBytes = fs.readFileSync(imagePath);
        const image = await pdfDoc.embedPng(imageBytes);

        // Watermark Dimensions
        const wmWidth = 130;
        const wmHeight = (image.height / image.width) * wmWidth;
        const margin = 10;

        // Position: Top Right
        const posX = width - wmWidth - margin;
        const posY = height - wmHeight - margin;

        // Draw for specific status or all pages for Draft
        const pagesToDraw = options.type === WatermarkType.DRAFT ? pages : [firstPage];

        for (const page of pagesToDraw) {
            page.drawImage(image, {
                x: posX,
                y: posY,
                width: wmWidth,
                height: wmHeight,
                blendMode: 'Multiply' as any
            });

            // Draw Date Text if applicable
            if (dateText) {
                const textSize = 7;
                const textWidth = font.widthOfTextAtSize(dateText, textSize);
                const textX = posX + (wmWidth - textWidth) / 2;
                // Specific y-offset: REFERENCE stamp is very crowded, move to very bottom
                const textY = options.type === WatermarkType.REFERENCE ? posY + 1 : posY + 4;
                // Adjusted based on user feedback to +4 for others, +1 for reference
                // because it has 2 lines of text inside.

                page.drawText(dateText, {
                    x: textX,
                    y: textY,
                    size: textSize,
                    font: font,
                    color: color
                });
            }
        }
    }

    // --- NEW: Center Background Security Watermark (All Pages) ---
    let bgImagePath = '';
    if (options.visibility === 'PRIVATE') {
        bgImagePath = path.join(assetBase, 'baomat.png');
    } else if (options.visibility === 'PUBLIC') {
        bgImagePath = path.join(assetBase, 'Tài liệu chung của các khoa bảo mật cấp công khai.png');
    } else if (options.visibility === 'DEPARTMENT') {
        const dept = (options.departmentName || '').toLowerCase();

        // Regex for flexible matching
        const biochemistryRegex = /h(ó|o)a\s*sinh/i; // Matches: hóa sinh, hoá sinh
        const microbiologyRegex = /vi\s*sinh/i;       // Matches: vi sinh
        const hematologyRegex = /huyết\s*học|hhtm/i;  // Matches: huyết học, hhtm

        if (biochemistryRegex.test(dept)) {
            bgImagePath = path.join(assetBase, 'Tài liệu nội bộ của khoa Hoá sinh.png');
        } else if (microbiologyRegex.test(dept)) {
            bgImagePath = path.join(assetBase, 'Tài liệu nội bộ của khoa Vi sinh.png');
        } else if (hematologyRegex.test(dept)) {
            bgImagePath = path.join(assetBase, 'tài liệu nội bộ của khoa huyết học truyền máu.png');
        } else {
            bgImagePath = path.join(assetBase, 'Tài liệu chung của các khoa bảo mật cấp nội bộ.png');
        }
    }

    if (bgImagePath && fs.existsSync(bgImagePath)) {
        const bgImageBytes = fs.readFileSync(bgImagePath);
        const bgImage = await pdfDoc.embedPng(bgImageBytes);

        // Watermark scale (80% of page width)
        const wmScale = 0.8;
        const bgWmWidth = width * wmScale;
        const bgWmHeight = (bgImage.height / bgImage.width) * bgWmWidth;

        const bgPosX = (width - bgWmWidth) / 2;
        const bgPosY = (height - bgWmHeight) / 2;

        for (const page of pages) {
            page.drawImage(bgImage, {
                x: bgPosX,
                y: bgPosY,
                width: bgWmWidth,
                height: bgWmHeight,
                opacity: 0.15,
            });
        }
    }

    return await pdfDoc.save();
};
