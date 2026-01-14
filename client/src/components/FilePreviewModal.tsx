import React, { useEffect, useRef, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { renderAsync } from 'docx-preview';
import axios from 'axios';

interface FilePreviewModalProps {
    visible: boolean;
    onClose: () => void;
    fileUrl: string | null;
    fileName: string;
    fileExtension?: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ visible, onClose, fileUrl, fileName, fileExtension }) => {
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Check file type from fileExtension, then fileName, then fileUrl
    const extension = (fileExtension || '').toLowerCase();
    const name = (fileName || '').toLowerCase();
    const url = (fileUrl || '').toLowerCase();

    const isPdf = extension === 'pdf' || name.endsWith('.pdf') || url.includes('.pdf');
    const isDocx = extension === 'docx' || extension === 'doc' ||
        name.endsWith('.docx') || name.endsWith('.doc') ||
        url.includes('.docx') || url.includes('.doc');

    useEffect(() => {
        let timeout: any;
        if (visible && fileUrl && isDocx) {
            timeout = setTimeout(() => {
                if (containerRef.current) {
                    renderWord();
                } else {
                    console.error('containerRef.current is still null after delay');
                }
            }, 300);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [visible, fileUrl]);

    const renderWord = async () => {
        if (!fileUrl || !containerRef.current) return;
        setLoading(true);
        console.log('Fetching Word file as arraybuffer from:', fileUrl);
        try {
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
            });

            console.log('Received data, size:', response.data.byteLength);

            // Clear previous content
            if (containerRef.current) {
                containerRef.current.innerHTML = '';

                await renderAsync(response.data, containerRef.current, undefined, {
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    padding: "20px",
                });
                console.log('docx-preview rendering completed successfully');
            }
        } catch (error: any) {
            console.error('Failed to render word file:', error);
            message.error(`Lỗi hiển thị: ${error.message || 'Không xác định'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={`Xem tài liệu: ${fileName}`}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={1000}
            style={{ top: 20 }}
            bodyStyle={{ height: '80vh', overflow: 'auto', padding: 0 }}
            destroyOnClose
        >
            <div style={{ height: '100%', position: 'relative' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.7)',
                        zIndex: 10
                    }}>
                        <Spin size="large" tip="Đang tải tài liệu..." />
                    </div>
                )}

                {isPdf ? (
                    <iframe
                        src={fileUrl || ''}
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                        title="PDF Preview"
                    />
                ) : isDocx ? (
                    <div
                        ref={containerRef}
                        className="docx-container"
                        style={{ minHeight: '100%', background: '#f0f2f5' }}
                    />
                ) : (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <p>Định dạng tệp này không hỗ trợ xem trực tiếp.</p>
                        <a href={fileUrl || '#'} target="_blank" rel="noreferrer">Tải về để xem</a>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default FilePreviewModal;
