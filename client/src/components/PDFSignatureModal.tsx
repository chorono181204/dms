import { useState, useRef, useEffect } from 'react';
import { Modal, Button, message, Slider, Spin, Select, Switch, DatePicker } from 'antd';
import { PlusOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import Draggable from 'react-draggable';
import { Document, Page, pdfjs } from 'react-pdf';
import dayjs from 'dayjs';
import { embedSignatureInPdf, pdfBytesToBlob } from '../utils/pdfUtils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
// Use CDN for better compatibility in dev mode if local import fails
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFSignatureModalProps {
    visible: boolean;
    pdfUrl: string;
    signatureImageUrl: string;
    documentTitle: string;
    userName: string;
    userPosition: string;
    onCancel: () => void;
    onConfirm: (signedPdfBlob: Blob) => void;
}

interface SignatureInstance {
    id: string;
    pageNumber: number; // 1-indexed
    x: number;
    y: number;
    width: number;
    height: number;
}

export const PDFSignatureModal: React.FC<PDFSignatureModalProps> = ({
    visible,
    pdfUrl,
    signatureImageUrl,
    documentTitle,
    userName,
    userPosition,
    onCancel,
    onConfirm,
}) => {
    // Constants for localStorage keys
    const STORAGE_KEYS = {
        FONT: 'signature_config_font',
        FONT_SIZE: 'signature_config_font_size',
        SIG_WIDTH: 'signature_config_width'
    };

    const [numPages, setNumPages] = useState<number | null>(null);
    const [aspectRatio, setAspectRatio] = useState(2); // Default 2:1

    // Initialize from localStorage or defaults
    const [signatureSize, setSignatureSize] = useState(() => {
        const savedWidth = localStorage.getItem(STORAGE_KEYS.SIG_WIDTH);
        return {
            width: savedWidth ? parseInt(savedWidth) : 130, // Default 130
            height: (savedWidth ? parseInt(savedWidth) : 130) / 2
        };
    });

    const [includeInfo, setIncludeInfo] = useState(true);
    const [includeDate, setIncludeDate] = useState(true);
    const [signDate, setSignDate] = useState(dayjs());

    const [textFont, setTextFont] = useState(() => {
        return localStorage.getItem(STORAGE_KEYS.FONT) || 'Times New Roman'; // Default Times New Roman
    });

    const [textSize, setTextSize] = useState(() => {
        const savedSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
        return savedSize ? parseInt(savedSize) : 12; // Default 12
    });

    // Persist changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SIG_WIDTH, signatureSize.width.toString());
    }, [signatureSize.width]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.FONT, textFont);
    }, [textFont]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.FONT_SIZE, textSize.toString());
    }, [textSize]);

    const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
    const [isPlacingMode, setIsPlacingMode] = useState(false);
    const [signatures, setSignatures] = useState<SignatureInstance[]>([]);

    // Determine aspect ratio from image
    useEffect(() => {
        if (signatureImageUrl) {
            const img = new Image();
            img.src = signatureImageUrl;
            img.onload = () => {
                if (img.width && img.height) {
                    const ratio = img.width / img.height;
                    setAspectRatio(ratio);
                    // Update current size to match new ratio
                    setSignatureSize(prev => ({
                        width: prev.width,
                        height: prev.width / ratio
                    }));
                }
            };
        }
    }, [signatureImageUrl]);

    // For tracking cursor across pages
    const [viewScale, setViewScale] = useState(1.0); // PDF rendering scale
    const containerRef = useRef<HTMLDivElement>(null);

    // Load PDF bytes when URL changes for final embedding
    useEffect(() => {
        if (pdfUrl) {
            fetch(pdfUrl)
                .then(res => res.arrayBuffer())
                .then(buffer => setPdfBytes(new Uint8Array(buffer)))
                .catch(err => {
                    console.error('Error loading PDF:', err);
                    message.error('Lỗi tải PDF');
                });

            // Reset state
            setSignatures([]);
            setIsPlacingMode(false);
        }
    }, [pdfUrl, visible]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    // Handle clicking on a specific page to place signature
    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
        if (!isPlacingMode) return;

        // Get coordinates relative to the page container
        const rect = e.currentTarget.getBoundingClientRect();
        // Since the page might be scaled by viewScale, we need to normalize 
        // OR better: keep the signature coordinate relative to the *visual* page now,
        // and normalize during save.
        // Actually, react-draggable works in pixels. It's easier if we store display pixels 
        // and then map to PDF point on save.

        const x = e.clientX - rect.left - (signatureSize.width * viewScale) / 2;
        const y = e.clientY - rect.top - (signatureSize.height * viewScale) / 2;

        const newSignature: SignatureInstance = {
            id: `sig-${Date.now()}`,
            pageNumber,
            x: Math.max(0, x), // Ensure not outside
            y: Math.max(0, y),
            width: signatureSize.width,
            height: signatureSize.height,
        };

        setSignatures([...signatures, newSignature]);
        setIsPlacingMode(false);
        message.success(`Đã thêm chữ ký vào trang ${pageNumber}`);
    };

    const handleRemoveSignature = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering page click
        setSignatures(signatures.filter(sig => sig.id !== id));
        message.info('Đã xóa chữ ký');
    };

    const handleDragStop = (id: string, data: { x: number; y: number }) => {
        setSignatures(signatures.map(sig =>
            sig.id === id ? { ...sig, x: data.x, y: data.y } : sig
        ));
    };

    const handleConfirm = async () => {
        if (!pdfBytes) {
            message.error('PDF chưa được tải');
            return;
        }

        if (signatures.length === 0) {
            message.warning('Vui lòng thêm ít nhất một chữ ký');
            return;
        }

        try {
            message.loading({ content: 'Đang xử lý PDF...', key: 'signing' });

            let modifiedPdfBytes = pdfBytes;
            const fallbackPageHeight = 842;

            for (const sig of signatures) {
                const pageEl = document.querySelector(`.page-container[data-page-number="${sig.pageNumber}"] .react-pdf__Page__canvas`);
                let truePageHeight = fallbackPageHeight;
                let currentScale = viewScale;

                if (pageEl) {
                    const rect = pageEl.getBoundingClientRect();
                    truePageHeight = rect.height / currentScale;
                }

                // Pass font settings to generator
                const compositeDataUrl = await import('../utils/pdfUtils').then(m => m.createCompositeSignatureImage(
                    signatureImageUrl,
                    sig.width,
                    sig.height,
                    includeInfo ? userName : undefined,
                    includeInfo ? userPosition : undefined,
                    includeDate && signDate ? signDate.format('HH:mm DD/MM/YYYY') : undefined, // Check toggle and pass date
                    textFont,
                    textSize
                ));

                const compositeImg = new Image();
                compositeImg.src = compositeDataUrl;
                await new Promise(r => compositeImg.onload = r);

                const compositeAspectRatio = compositeImg.width / compositeImg.height;
                const pdfWidth = sig.width;
                const pdfHeight = pdfWidth / compositeAspectRatio;

                const pdfBaseX = sig.x / currentScale;
                const pdfBaseY = sig.y / currentScale;

                const pdfY = truePageHeight - pdfBaseY - pdfHeight;

                modifiedPdfBytes = await embedSignatureInPdf(
                    modifiedPdfBytes,
                    compositeDataUrl,
                    sig.pageNumber - 1,
                    pdfBaseX,
                    pdfY,
                    pdfWidth,
                    pdfHeight,
                    undefined,
                    undefined
                );
            }

            const blob = pdfBytesToBlob(modifiedPdfBytes);
            onConfirm(blob);
            message.success({ content: 'Ký văn bản thành công!', key: 'signing' });
        } catch (error) {
            console.error('Error signing PDF:', error);
            message.error({ content: `Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`, key: 'signing' });
        }
    };

    const fontOptions = [
        { label: 'Arial', value: 'Arial' },
        { label: 'Times New Roman', value: 'Times New Roman' },
        { label: 'Verdana', value: 'Verdana' },
        { label: 'Tahoma', value: 'Tahoma' },
        { label: 'Segoe UI', value: 'Segoe UI' },
        { label: 'Courier New', value: 'Courier New' },
    ];

    return (
        <Modal
            title={`Ký tài liệu - ${documentTitle}`}
            open={visible}
            onCancel={onCancel}
            width={1200}
            style={{ top: 20 }}
            footer={[
                <Button key="cancel" onClick={onCancel} size="large">
                    Hủy
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    onClick={handleConfirm}
                    size="large"
                    disabled={signatures.length === 0}
                >
                    Xác nhận ký ({signatures.length})
                </Button>,
            ]}
        >
            <div style={{ display: 'flex', gap: 20, height: '70vh' }}>
                {/* Left: PDF Preview (Scrollable) */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        backgroundColor: '#525659',
                        border: '1px solid #d9d9d9',
                        borderRadius: 8,
                        padding: '24px 0',
                        textAlign: 'center',
                        position: 'relative'
                    }}
                >
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(error) => console.error('Error loading PDF Document:', error)}
                        loading={<div style={{ padding: 40, color: 'white' }}><Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: 'white' }} spin />} /> Đang tải PDF...</div>}
                        error={<div style={{ color: '#ff4d4f', padding: 20 }}>Không thể tải PDF. Vui lòng thử lại.</div>}
                    >
                        {numPages && Array.from(new Array(numPages), (el, index) => {
                            const pageNum = index + 1;
                            const pageSignatures = signatures.filter(s => s.pageNumber === pageNum);

                            return (
                                <div
                                    key={`page-${pageNum}`}
                                    className="page-container"
                                    data-page-number={pageNum}
                                    style={{
                                        position: 'relative',
                                        display: 'inline-block',
                                        marginBottom: 20,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        cursor: isPlacingMode ? 'crosshair' : 'default',
                                        lineHeight: 0,
                                    }}
                                    onClick={(e) => handlePageClick(e, pageNum)}
                                >
                                    <Page
                                        pageNumber={pageNum}
                                        scale={viewScale}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className="pdf-page"
                                    />

                                    {pageSignatures.map(sig => (
                                        <Draggable
                                            key={`sig-${sig.id}`}
                                            defaultPosition={{ x: sig.x, y: sig.y }}
                                            onStop={(e, data) => handleDragStop(sig.id, data)}
                                            bounds="parent"
                                            disabled={false}
                                            scale={viewScale}
                                        >
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: sig.width * viewScale, // Scale width
                                                    cursor: 'move',
                                                    border: '2px solid #52c41a',
                                                    borderRadius: 4,
                                                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                    zIndex: 100,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    paddingBottom: 4
                                                }}
                                                title="Kéo thả để di chuyển"
                                            >
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={(e) => handleRemoveSignature(sig.id, e)}
                                                    style={{
                                                        position: 'absolute',
                                                        top: -12,
                                                        right: -12,
                                                        zIndex: 101,
                                                        backgroundColor: '#fff',
                                                        borderRadius: '50%',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                        padding: 0,
                                                        width: 24,
                                                        height: 24,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        minWidth: 24
                                                    }}
                                                />
                                                {signatureImageUrl ? (
                                                    <img
                                                        src={signatureImageUrl}
                                                        style={{ width: '100%', height: sig.height * viewScale, display: 'block', objectFit: 'contain' }} // Scale height
                                                        alt="Signature"
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '100%',
                                                        height: sig.height * viewScale,
                                                        background: '#f0f0f0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 10,
                                                        color: '#999'
                                                    }}>
                                                        Chưa có chữ ký
                                                    </div>
                                                )}
                                                {includeInfo && userName && (
                                                    <div style={{
                                                        fontSize: textSize * 0.8, // Roughly preview size
                                                        fontFamily: textFont,
                                                        fontWeight: 'bold',
                                                        color: '#000',
                                                        marginTop: 2,
                                                        textAlign: 'center',
                                                        lineHeight: '1.2'
                                                    }}>
                                                        {userName}
                                                    </div>
                                                )}
                                                {includeInfo && userPosition && (
                                                    <div style={{
                                                        fontSize: textSize * 0.7,
                                                        fontFamily: textFont,
                                                        color: '#666',
                                                        marginTop: 1,
                                                        textAlign: 'center',
                                                        lineHeight: '1.2'
                                                    }}>
                                                        ({userPosition})
                                                    </div>
                                                )}
                                                {includeDate && signDate && (
                                                    <div style={{
                                                        fontSize: textSize * 0.65,
                                                        fontFamily: textFont,
                                                        color: '#000000',
                                                        marginTop: 1,
                                                        textAlign: 'center',
                                                        lineHeight: '1.2',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        {signDate.format('HH:mm DD/MM/YYYY')}
                                                    </div>
                                                )}
                                            </div>
                                        </Draggable>
                                    ))}

                                    {isPlacingMode && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            pointerEvents: 'none',
                                            border: '2px dashed #1890ff',
                                            backgroundColor: 'rgba(24, 144, 255, 0.05)',
                                            zIndex: 50
                                        }} />
                                    )}
                                </div>
                            );
                        })}
                    </Document>
                </div>

                {/* Right: Controls - Added height: 100% and overflow management */}
                <div style={{ width: 280, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#666' }}>
                        Công cụ
                    </div>

                    <Button
                        type={isPlacingMode ? 'default' : 'primary'}
                        icon={<PlusOutlined />}
                        onClick={() => setIsPlacingMode(!isPlacingMode)}
                        block
                        size="large"
                        style={{ marginBottom: 16 }}
                        className={isPlacingMode ? 'pulsing-button' : ''}
                    >
                        {isPlacingMode ? 'Hủy đặt chữ ký' : 'Thêm chữ ký'}
                    </Button>

                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                        {/* Font Settings */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#fff',
                            marginBottom: 16
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#666' }}>
                                Font & Cỡ chữ (Tên):
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <Select
                                    style={{ width: '100%' }}
                                    value={textFont}
                                    onChange={setTextFont}
                                    options={fontOptions}
                                    placeholder="Chọn font"
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#999' }}>Size:</span>
                                <Slider
                                    style={{ flex: 1 }}
                                    min={10}
                                    max={30}
                                    value={textSize}
                                    onChange={setTextSize}
                                />
                                <span style={{ fontSize: 12, width: 24 }}>{textSize}</span>
                            </div>
                        </div>

                        {/* Info Toggle */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#fff',
                            marginBottom: 16,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>
                                    Kèm thông tin (Họ tên/Chức vụ):
                                </span>
                                <Switch size="small" checked={includeInfo} onChange={setIncludeInfo} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>
                                    Kèm ngày ký:
                                </span>
                                <Switch size="small" checked={includeDate} onChange={setIncludeDate} />
                            </div>
                            {includeDate && (
                                <div style={{ marginTop: 8 }}>
                                    <DatePicker
                                        showTime
                                        format="HH:mm DD/MM/YYYY"
                                        value={signDate}
                                        onChange={(date) => setSignDate(date || dayjs())}
                                        style={{ width: '100%' }}
                                        allowClear={false}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Signature Preview Card */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#fafafa',
                            marginBottom: 16
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: '#666' }}>
                                Xem trước chữ ký:
                            </div>
                            <div style={{
                                textAlign: 'center',
                                padding: 10,
                                backgroundColor: '#fff',
                                borderRadius: 4,
                                border: '1px solid #e8e8e8'
                            }}>
                                {signatureImageUrl ? (
                                    <img
                                        src={signatureImageUrl}
                                        alt="Signature Preview"
                                        style={{
                                            width: signatureSize.width,
                                            maxWidth: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            margin: '0 auto',
                                            marginBottom: 4
                                        }}
                                    />
                                ) : (
                                    <div style={{ padding: 20, color: '#999' }}>Chưa có chữ ký</div>
                                )}
                                {includeInfo && userName && (
                                    <div style={{ fontFamily: textFont, fontSize: textSize, fontWeight: 'bold' }}>{userName}</div>
                                )}
                                {includeInfo && userPosition && (
                                    <div style={{ fontFamily: textFont, fontSize: textSize * 0.85, color: '#666' }}>({userPosition})</div>
                                )}
                                {includeDate && signDate && (
                                    <div style={{ fontFamily: textFont, fontSize: textSize * 0.75, color: '#000000', fontStyle: 'italic', marginTop: 2 }}>{signDate.format('HH:mm DD/MM/YYYY')}</div>
                                )}
                            </div>
                        </div>

                        {/* Size Control */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#fff',
                            marginBottom: 16
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: '#666' }}>
                                Kích thước chữ ký:
                            </div>
                            <Slider
                                min={80}
                                max={400}
                                value={signatureSize.width}
                                onChange={(value) => setSignatureSize({ width: value, height: value / aspectRatio })}
                                marks={{ 80: 'Nhỏ', 240: 'Vừa', 400: 'Lớn' }}
                            />
                            <div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 8 }}>
                                {Math.round(signatureSize.width)}px × {Math.round(signatureSize.height)}px
                            </div>
                        </div>

                        {/* Zoom Control */}
                        <div style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#fff',
                            marginBottom: 16
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, color: '#666' }}>
                                Thu phóng (Zoom):
                            </div>
                            <Slider
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                value={viewScale}
                                onChange={setViewScale}
                                marks={{ 0.5: '50%', 1.0: '100%', 1.5: '150%' }}
                            />
                        </div>

                        {/* Signatures List */}
                        {signatures.length > 0 && (
                            <div style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: 8,
                                padding: 12,
                                backgroundColor: '#fff',
                                marginBottom: 16
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#666' }}>
                                    Chữ ký đã thêm: ({signatures.length})
                                </div>
                                {signatures.map((sig, index) => (
                                    <div key={sig.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 8px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: 4,
                                        marginBottom: 6
                                    }}>
                                        <span style={{ fontSize: 12 }}>
                                            Trang {sig.pageNumber}
                                            <span style={{ color: '#999', fontSize: 10, marginLeft: 4 }}>
                                                ({Math.round(sig.x)}, {Math.round(sig.y)})
                                            </span>
                                        </span>
                                        <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => handleRemoveSignature(sig.id, e)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Simple Instructions - Inside scrollable area */}
                        {signatures.length === 0 && (
                            <div style={{
                                padding: 12,
                                backgroundColor: '#e6f7ff',
                                border: '1px solid #91d5ff',
                                borderRadius: 8,
                                fontSize: 12,
                                color: '#0050b3'
                            }}>
                                <div>1. Bấm "Thêm chữ ký"</div>
                                <div>2. Click vào vị trí trên PDF</div>
                                <div>3. "Xác nhận ký" khi hoàn tất</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
