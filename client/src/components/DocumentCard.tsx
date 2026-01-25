import React from 'react';
import { Card, Dropdown, Typography, Tag, Space, MenuProps } from 'antd';
import {
    FolderFilled,
    MoreOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';
import { useDrag } from 'react-dnd';
import './DocumentCard.css';

const { Text } = Typography;

interface DocumentCardProps {
    document: any;
    menuItems: MenuProps['items'];
    onClick?: () => void;
    canDrag?: boolean;
}

const getFileIcon = (fileName: string, contentPath?: string) => {
    // Try to get extension from content path first (more reliable), then fileName
    const path = contentPath || fileName;
    if (!path) return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;

    const ext = path.split('.').pop()?.toLowerCase();

    // Check if it's actually a extension or just the filename (no dot)
    if (ext === path.toLowerCase() && !contentPath) {
        return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;
    }

    switch (ext) {
        case 'pdf':
            return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />;
        case 'docx':
        case 'doc':
            return <FileWordOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
        case 'xlsx':
        case 'xls':
        case 'csv':
            return <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
        case 'pptx':
        case 'ppt':
            // Ant Design doesn't have PPT icon, reuse FileOutlined with orange color or similar
            return <FileOutlined style={{ fontSize: 48, color: '#fa8c16' }} />;
        case 'txt':
            return <FileOutlined style={{ fontSize: 48, color: '#595959' }} />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            return <FileOutlined style={{ fontSize: 48, color: '#13c2c2' }} />; // Image placeholder
        default:
            return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;
    }
};

const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
        DRAFT: 'default',
        PENDING: 'processing',
        APPROVED: 'success',
        SIGNED: 'success',
        REJECTED: 'error',
        ARCHIVED: 'warning',
    };
    return statusMap[status] || 'default';
};

const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
        DRAFT: 'Bản nháp',
        PENDING: 'Chờ duyệt',
        APPROVED: 'Đã duyệt',
        SIGNED: 'Đã ký',
        REJECTED: 'Từ chối',
        ARCHIVED: 'Lưu trữ',
    };
    return statusMap[status] || status;
};

const DocumentCard: React.FC<DocumentCardProps> = ({ document, menuItems, onClick, canDrag }) => {
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'document',
        item: { id: document.id, type: 'document' },
        canDrag: canDrag,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [document.id, canDrag]);

    const isExpired = document.expirationDate && new Date(document.expirationDate) < new Date();

    return (
        <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1, cursor: canDrag ? 'move' : 'pointer' }}>
            <Card
                className={`document-card ${isExpired ? 'document-expired' : ''}`}
                hoverable
                onClick={onClick}
                styles={{ body: { padding: '16px' } }}
            >
                <div className="document-card-content">
                    {/* Icon */}
                    <div className="document-card-icon">
                        {getFileIcon(document.title, document.content)}
                    </div>

                    {/* Title */}
                    <div className="document-card-title">
                        <Text ellipsis={{ tooltip: document.title }} strong>
                            {document.title}
                        </Text>
                    </div>

                    {/* Code */}
                    {document.code && (
                        <div className="document-card-code">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {document.code}
                            </Text>
                        </div>
                    )}

                    {/* Status & Reference Tag */}
                    <div className="document-card-tags">
                        <Space size={4} wrap>
                            <Tag color={getStatusColor(document.status)}>
                                {getStatusText(document.status)}
                            </Tag>
                            {document.isReference && (
                                <Tag color="blue">Tài liệu tham khảo</Tag>
                            )}
                            {isExpired && (
                                <Tag color="error">Hết hạn</Tag>
                            )}
                        </Space>
                    </div>

                    {/* More Actions Button */}
                    <div className="document-card-actions" onClick={handleMenuClick}>
                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                            <MoreOutlined
                                style={{
                                    fontSize: 20,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                }}
                                className="document-card-more-btn"
                            />
                        </Dropdown>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DocumentCard;
