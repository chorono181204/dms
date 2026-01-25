import React, { useEffect, useRef, useState } from 'react';
import { Modal, Spin, message, Button, Space, Layout, List, Typography } from 'antd';
import {
    DownloadOutlined,
    PaperClipOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileUnknownOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { renderAsync } from 'docx-preview';
import client from '../api/client';
import { getApiUrl } from '../utils/config';

const { Sider, Content } = Layout;
const { Text } = Typography;

interface FilePreviewModalProps {
    visible: boolean;
    onClose: () => void;
    fileUrl: string | null;
    fileName: string;
    fileExtension?: string;
    canDownload?: boolean;
    attachments?: any[];
}

interface FileItem {
    id: string | number;
    name: string;
    url: string;
    extension: string;
    type: 'MAIN' | 'REFERENCE';
    originalPath?: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ visible, onClose, fileUrl, fileName, fileExtension, canDownload = true, attachments = [] }) => {
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeFile, setActiveFile] = useState<FileItem | null>(null);

    // Helper to extract extension
    const getAuthenticatedUrl = (url: string | null) => {
        if (!url) return '';
        if (url.startsWith('blob:')) return url;
        if (url.includes('token=')) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}token=${localStorage.getItem('accessToken') || ''}`;
    };

    const getExtension = (name: string, url: string = '') => {
        // 1. Try to get from name first (most reliable if name has extension)
        if (name && name.includes('.')) {
            const nameExt = name.split('.').pop()?.toLowerCase();
            if (nameExt && nameExt.length < 5 && nameExt !== name.toLowerCase()) return nameExt;
        }

        // 2. Try to get from URL
        if (url) {
            try {
                // If URL has query param 'path', use it (e.g. /download?path=.../file.pdf)
                if (url.includes('path=')) {
                    const params = new URLSearchParams(url.split('?')[1]);
                    const pathParam = params.get('path');
                    if (pathParam) {
                        const pathExt = pathParam.split('.').pop()?.toLowerCase();
                        if (pathExt && pathExt.length < 5) return pathExt;
                    }
                }

                // Fallback: clean URL and check extension
                const cleanUrl = url.split('?')[0];
                const urlExt = cleanUrl.split('.').pop()?.toLowerCase();
                if (urlExt && urlExt.length < 5) return urlExt;
            } catch (e) {
                console.error("Error parsing URL extension:", e);
            }
        }
        return '';
    };

    // Sync props to state (Initialize with Main file)
    useEffect(() => {
        if (visible && fileUrl) {
            setActiveFile({
                id: 'main',
                name: fileName,
                url: fileUrl,
                extension: fileExtension || getExtension(fileName, fileUrl),
                type: 'MAIN'
            });
        }
    }, [visible, fileUrl, fileName, fileExtension]);

    const currentName = (activeFile?.name || '').toLowerCase();
    const currentUrl = (activeFile?.url || '').toLowerCase();
    const currentExt = (activeFile?.extension || '').toLowerCase().replace('.', '');

    const isPdf = currentExt === 'pdf' || currentName.endsWith('.pdf') || currentUrl.includes('.pdf');
    const isDocx = currentExt === 'docx' || currentExt === 'doc' ||
        currentName.endsWith('.docx') || currentName.endsWith('.doc') ||
        currentUrl.includes('.docx') || currentUrl.includes('.doc');

    // Effect for DOCX rendering
    useEffect(() => {
        let timeout: any;
        if (visible && activeFile && isDocx) {
            // Reset container content
            if (containerRef.current) containerRef.current.innerHTML = '';

            timeout = setTimeout(() => {
                if (containerRef.current) {
                    renderWord(activeFile.url);
                }
            }, 300);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [visible, activeFile, isDocx]);

    const renderWord = async (url: string) => {
        if (!url || !containerRef.current) return;
        setLoading(true);
        try {
            const response = await client.get(url, {
                responseType: 'arraybuffer',
            });
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
                await renderAsync(response.data, containerRef.current, undefined, {
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    padding: "20px",
                });
            }
        } catch (error: any) {
            console.error('Failed to render word file:', error);
            message.error(`Lỗi hiển thị DOCX: ${error.message || 'Không xác định'}`);
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = (ext: string) => {
        const e = (ext || '').toLowerCase();
        if (e === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
        if (e === 'doc' || e === 'docx') return <FileWordOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
        return <FileUnknownOutlined style={{ fontSize: 20 }} />;
    };

    // Construct file list
    const fileList: FileItem[] = [];
    if (fileUrl) {
        fileList.push({
            id: 'main',
            name: fileName,
            url: fileUrl,
            extension: fileExtension || getExtension(fileName, fileUrl),
            type: 'MAIN'
        });
    }

    if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
            const ext = getExtension(att.fileName, att.filePath);
            const previewUrl = `${getApiUrl()}/upload/download?path=${encodeURIComponent(att.filePath)}&inline=true`;
            fileList.push({
                id: att.id,
                name: att.fileName,
                url: previewUrl,
                extension: ext,
                type: 'REFERENCE',
                originalPath: att.filePath
            });
        });
    }

    const handleDownload = async (url: string, name: string) => {
        try {
            const authUrl = getAuthenticatedUrl(url.replace('inline=true', 'inline=false'));
            const response = await fetch(authUrl);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        } catch (error) {
            console.error('Download error:', error);
            message.error('Lỗi tải về tài liệu');
        }
    };

    return (
        <Modal
            title={null}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={1200}
            style={{ top: 20 }}
            styles={{ body: { padding: 0, height: '85vh', overflow: 'hidden' } }}
            destroyOnClose
            centered
        >
            <Layout style={{ height: '100%', background: '#fff' }}>
                <Content style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f0' }}>
                    {/* Toolbar / Header */}
                    <div style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fff',
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            {activeFile && getFileIcon(activeFile.extension)}
                            <Text strong style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 600 }}>
                                {activeFile?.name}
                            </Text>
                            {activeFile?.type === 'MAIN' && <Text type="secondary" style={{ fontSize: 12 }}>(Tài liệu chính)</Text>}
                        </div>

                        <Space>
                            {canDownload && activeFile && (
                                <Button
                                    type="primary"
                                    ghost
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleDownload(activeFile.url, activeFile.name)}
                                >
                                    Tải xuống
                                </Button>
                            )}
                            <Button onClick={onClose}>Đóng</Button>
                        </Space>
                    </div>

                    {/* Main Content Area */}
                    <div style={{ flex: 1, position: 'relative', overflow: isPdf ? 'hidden' : 'auto', background: '#f5f5f5' }}>
                        {loading && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 20
                            }}>
                                <Spin size="large" tip="Đang tải..." />
                            </div>
                        )}

                        {activeFile ? (
                            <>
                                {isPdf ? (
                                    <iframe
                                        src={`${getAuthenticatedUrl(activeFile.url)}#toolbar=0&view=FitH`}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 'none', display: 'block' }}
                                        title="PDF Preview"
                                    />
                                ) : isDocx ? (
                                    <div
                                        ref={containerRef}
                                        style={{ minHeight: '100%', background: '#fff', margin: '0 auto', maxWidth: '850px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}
                                    />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                                        <FileUnknownOutlined style={{ fontSize: 64, marginBottom: 16, color: '#ccc' }} />
                                        <Text style={{ fontSize: 16 }}>Định dạng này không hỗ trợ xem trước.</Text>
                                        <Text type="secondary" style={{ marginBottom: 20 }}>Vui lòng tải về để xem nội dung.</Text>
                                        {canDownload && (
                                            <Button
                                                type="primary"
                                                icon={<DownloadOutlined />}
                                                onClick={() => handleDownload(activeFile.url, activeFile.name)}
                                            >
                                                Tải về
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center' }}>Chưa chọn tài liệu</div>
                        )}
                    </div>
                </Content>

                {/* Sidebar */}
                <Sider width={320} theme="light" style={{ borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                        <Text strong style={{ fontSize: 15 }}><PaperClipOutlined /> Danh sách tài liệu ({fileList.length})</Text>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        <List
                            itemLayout="horizontal"
                            dataSource={fileList}
                            split={false}
                            renderItem={(item) => (
                                <List.Item
                                    className={`file-preview-item ${activeFile?.id === item.id ? 'active' : ''}`}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        background: activeFile?.id === item.id ? '#e6f7ff' : '#fff',
                                        border: activeFile?.id === item.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                                        marginBottom: 8,
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setActiveFile(item)}
                                >
                                    <List.Item.Meta
                                        avatar={getFileIcon(item.extension)}
                                        title={
                                            <Text strong={activeFile?.id === item.id} style={{ fontSize: 14 }}>
                                                {item.name}
                                            </Text>
                                        }
                                        description={
                                            <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {item.type === 'MAIN' ? 'Tài liệu chính' : 'Tham khảo'}
                                                </Text>
                                            </Space>
                                        }
                                    />
                                    {activeFile?.id === item.id && <EyeOutlined style={{ color: '#1890ff' }} />}
                                </List.Item>
                            )}
                        />
                    </div>
                </Sider>
            </Layout>
        </Modal>
    );
};

export default FilePreviewModal;
