/**
 * Processes a signature image to remove the background using OpenCV.js
 * Handles shadows, uneven lighting, and noise using professional algorithms
 * 
 * @param file - The original image file
 * @returns A promise that resolves to a new Blob (PNG) with transparent background
 */
export const processSignatureImage = (file: File): Promise<Blob> => {
    console.log('Processing signature image with OpenCV.js:', file.name, file.type, file.size);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('FileReader loaded');
            const img = new Image();
            img.onload = () => {
                console.log('Image object loaded', img.width, 'x', img.height);

                try {
                    // Load OpenCV.js
                    const cv = (window as any).cv;
                    if (!cv) {
                        throw new Error('OpenCV.js not loaded');
                    }

                    // Create canvas and get image data
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        throw new Error('Could not get canvas context');
                    }

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    // Convert to OpenCV Mat
                    const src = cv.imread(canvas);
                    const gray = new cv.Mat();
                    const binary = new cv.Mat();
                    const result = new cv.Mat();

                    console.log('OpenCV: Converting to grayscale...');
                    // Step 1: Convert to grayscale
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                    console.log('OpenCV: Applying adaptive thresholding...');
                    // Step 2: Adaptive thresholding (handles shadows and uneven lighting)
                    cv.adaptiveThreshold(
                        gray,
                        binary,
                        255,
                        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv.THRESH_BINARY,
                        91,  // Block size (Increased to prevent hollowing of thick strokes)
                        15   // C constant
                    );

                    console.log('OpenCV: Applying morphological operations...');
                    // Step 3: Morphological operations to clean up
                    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));

                    // Close operation: fill small gaps in strokes
                    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);

                    // Open operation: remove small noise
                    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);

                    console.log('OpenCV: Creating transparent background...');
                    // Step 4: Convert binary to RGBA with transparent background
                    cv.cvtColor(binary, result, cv.COLOR_GRAY2RGBA);

                    // Make white pixels transparent, black pixels opaque
                    for (let i = 0; i < result.data.length; i += 4) {
                        const gray = result.data[i]; // R channel (same as G and B in grayscale)

                        if (gray > 127) {
                            // White pixel → transparent
                            result.data[i + 3] = 0;
                        } else {
                            // Black pixel → opaque black
                            result.data[i] = 0;
                            result.data[i + 1] = 0;
                            result.data[i + 2] = 0;
                            result.data[i + 3] = 255;
                        }
                    }

                    console.log('OpenCV: Rendering to canvas...');
                    // Render result to canvas
                    cv.imshow(canvas, result);

                    // Cleanup OpenCV Mats
                    src.delete();
                    gray.delete();
                    binary.delete();
                    result.delete();
                    kernel.delete();

                    console.log('Converting canvas to blob...');
                    canvas.toBlob((blob) => {
                        if (blob) {
                            console.log('Blob created successfully:', blob.size, blob.type);
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                    }, 'image/png');
                } catch (error) {
                    console.error('OpenCV processing error:', error);
                    reject(error);
                }
            };
            img.onerror = (err) => {
                console.error('Image load error:', err);
                reject(new Error('Error loading image'));
            };
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
};
