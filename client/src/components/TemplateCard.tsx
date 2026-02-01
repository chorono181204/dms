import React from 'react';
import { Card, Dropdown, Typography, Tag, Space, MenuProps } from 'antd';
import {
    MoreOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';
import { useDrag } from 'react-dnd';
import './DocumentCard.css'; // Reuse DocumentCard styles for consistency

const { Text } = Typography;

interface TemplateCardProps {
    template: any;
    menuItems: MenuProps['items'];
    onClick?: () => void;
    canDrag?: boolean;
}

const getFileIcon = (fileName: string, contentPath?: string) => {
    const path = contentPath || fileName;
    if (!path) return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;

    const ext = path.split('.').pop()?.toLowerCase();

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
            return <FileOutlined style={{ fontSize: 48, color: '#fa8c16' }} />;
        default:
            return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />;
    }
};

const TemplateCard: React.FC<TemplateCardProps> = ({ template, menuItems, onClick, canDrag }) => {
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'template',
        item: { id: template.id, type: 'template' },
        canDrag: canDrag,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [template.id, canDrag]);

    return (
        <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1, cursor: canDrag ? 'move' : 'pointer' }}>
            <Card
                className="document-card"
                hoverable
                onClick={onClick}
                styles={{ body: { padding: '16px' } }}
            >
                <div className="document-card-content">
                    {/* Icon */}
                    <div className="document-card-icon">
                        {getFileIcon(template.name, template.content)}
                    </div>

                    {/* Title */}
                    <div className="document-card-title">
                        <Text ellipsis={{ tooltip: template.name }} strong>
                            {template.name}
                        </Text>
                    </div>

                    {/* Status Tags */}
                    <div className="document-card-tags">
                        <Space size={4} wrap>
                            <Tag color={template.isActive ? 'success' : 'default'}>
                                {template.isActive ? 'Hoạt động' : 'Tắt'}
                            </Tag>
                            {/* Visibility Tag */}
                            {template.visibility === 'PUBLIC' && <Tag color="green">Công khai</Tag>}
                            {template.visibility === 'DEPARTMENT' && <Tag color="orange">Nội bộ</Tag>}
                            {template.visibility === 'PRIVATE' && <Tag color="red">Bảo mật</Tag>}
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

export default TemplateCard;
