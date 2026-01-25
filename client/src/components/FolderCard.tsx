import React from 'react';
import { Card, Dropdown, Typography, Tag, Space, MenuProps } from 'antd';
import { FolderFilled, MoreOutlined, FolderOpenOutlined, LockOutlined } from '@ant-design/icons';
import { useDrag, useDrop } from 'react-dnd';
import './DocumentCard.css';

const { Text } = Typography;

interface FolderCardProps {
    folder: any;
    menuItems: MenuProps['items'];
    onDoubleClick?: () => void;
    canDrag?: boolean;
    onDropItem?: (item: any) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, menuItems, onDoubleClick, canDrag, onDropItem }) => {
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    // Drag Source
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'folder',
        item: { id: folder.id, type: 'folder' },
        canDrag: canDrag && !folder.isVirtual, // Can't drag virtual folders
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [folder.id, canDrag, folder.isVirtual]);

    // Drop Target
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: ['document', 'folder'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return;
            if (onDropItem) onDropItem(item);
        },
        canDrop: (item: any) => {
            // Can't drop into itself or into virtual folders (read-only)
            if (folder.isVirtual) return false;
            if (item.type === 'folder' && item.id === folder.id) return false;
            return true;
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [folder.id, onDropItem, folder.isVirtual]);

    // Combine refs
    const attachRef = (el: HTMLDivElement) => {
        drag(el);
        drop(el);
    };

    const backgroundColor = (isOver && canDrop) ? '#e6f7ff' : 'white';

    return (
        <div ref={attachRef} style={{ opacity: isDragging ? 0.5 : 1 }}>
            <Card
                className="document-card folder-card"
                hoverable
                onDoubleClick={onDoubleClick}
                bodyStyle={{ padding: '16px', backgroundColor }}
            >
                <div className="document-card-content">
                    {/* Folder Icon */}
                    <div className="document-card-icon">
                        <FolderOpenOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    </div>

                    {/* Folder Name */}
                    <div className="document-card-title">
                        <Text ellipsis={{ tooltip: folder.name }} strong>
                            {folder.name}
                        </Text>
                    </div>

                    {/* Document Count */}
                    {folder._count && (
                        <div className="document-card-code">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {folder._count.documents || 0} tài liệu
                            </Text>
                        </div>
                    )}

                    {/* Tags */}
                    <div className="document-card-tags">
                        <Space size={4} wrap>
                            {folder.isGlobal && <Tag color="green">Toàn bộ</Tag>}
                            {folder._count?.children > 0 && (
                                <Tag>{folder._count.children} thư mục con</Tag>
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

export default FolderCard;
