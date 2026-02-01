import React, { useState, useEffect } from 'react';
import { Modal, Tree, Input, Empty, Spin } from 'antd';
import { SearchOutlined, FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { getCategoryTree } from '../api/services/category.service';

interface FolderTreeModalProps {
    visible: boolean;
    onCancel: () => void;
    onSelect: (targetFolderId: number | null) => void;
    movingItemId?: number | null;
    movingItemType?: 'document' | 'folder' | 'template';
    currentParentId?: number | null;
    departmentId?: number | null;
    departmentName?: string;
    title?: string;
}

const FolderTreeModal: React.FC<FolderTreeModalProps> = ({
    visible,
    onCancel,
    onSelect,
    movingItemId,
    movingItemType,
    currentParentId,
    departmentId,
    departmentName,
    title = 'Di chuyển đến'
}) => {
    const [treeData, setTreeData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [selectedKey, setSelectedKey] = useState<number | string | null>(null);

    useEffect(() => {
        if (visible) {
            fetchTree();
            setSelectedKey(null);
        }
    }, [visible]);

    const fetchTree = async () => {
        setLoading(true);
        try {
            const data = await getCategoryTree(departmentId || undefined);
            const processedData = formatTreeData(data);
            // Add Department Root option
            const rootTitle = departmentName
                ? `Thư mục gốc - ${departmentName}`
                : 'Hồ sơ của tôi (Trang chủ)';
            setTreeData([{
                title: rootTitle,
                key: 'root',
                id: null,
                disabled: currentParentId === null,
                icon: <FolderOutlined />,
                children: processedData
            }]);
        } catch (error) {
            console.error('Failed to fetch category tree:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTreeData = (data: any[]): any[] => {
        return data.map(item => {
            // Disable moving a folder into itself or its children
            const isSelfOrChild = movingItemType === 'folder' && item.id === movingItemId;
            // Disable moving into current parent (already there)
            const isCurrentParent = item.id === currentParentId;

            return {
                title: item.name,
                key: item.id,
                id: item.id,
                disabled: isSelfOrChild || isCurrentParent,
                icon: <FolderOutlined />,
                children: item.children ? formatTreeData(item.children) : []
            };
        });
    };

    const handleSelect = (selectedKeys: any[]) => {
        if (selectedKeys.length > 0) {
            const key = selectedKeys[0];
            setSelectedKey(key === 'root' ? 'root' : key);
        }
    };

    const handleOk = () => {
        if (selectedKey === null) return;
        onSelect(selectedKey === 'root' ? null : Number(selectedKey));
    };

    return (
        <Modal
            title={title}
            open={visible}
            onCancel={onCancel}
            onOk={handleOk}
            okText="Dời đến đây"
            cancelText="Hủy"
            okButtonProps={{ disabled: selectedKey === null }}
            width={400}
        >
            <div style={{ marginBottom: 16 }}>
                <Input
                    placeholder="Tìm kiếm thư mục..."
                    prefix={<SearchOutlined />}
                    onChange={e => setSearchValue(e.target.value)}
                    allowClear
                />
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
                ) : treeData.length > 0 ? (
                    <Tree
                        showIcon
                        defaultExpandAll
                        treeData={treeData}
                        onSelect={handleSelect}
                        selectedKeys={selectedKey ? [selectedKey] : []}
                        titleRender={(node: any) => {
                            const isSelected = selectedKey === node.key;
                            return (
                                <span style={{ color: isSelected ? '#1890ff' : 'inherit', fontWeight: isSelected ? 500 : 'normal' }}>
                                    {node.title}
                                </span>
                            );
                        }}
                    />
                ) : (
                    <Empty description="Không tìm thấy thư mục" />
                )}
            </div>
        </Modal>
    );
};

export default FolderTreeModal;
