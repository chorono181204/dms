import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, message, Modal, Tag, Card, Row, Col, Typography, Dropdown, Breadcrumb, Segmented } from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined, EyeOutlined,
    MoreOutlined, AppstoreOutlined, BarsOutlined, HomeOutlined, FolderOpenOutlined, FilePdfOutlined, FolderFilled,
    DragOutlined, FileWordOutlined, FileExcelOutlined, FileOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import { deleteDocument, updateDocument } from '../api/services/document.service'; // Use document service
import { getCategoryContents, getCategoryBreadcrumbs, moveCategory, deleteCategory } from '../api/services/category.service';
import DocumentModal from '../components/DocumentModal'; // Use DocumentModal
import FilePreviewModal from '../components/FilePreviewModal';

import DocumentCard from '../components/DocumentCard'; // Use DocumentCard for consistency if preferred
import FolderCard from '../components/FolderCard';
import CategoryModal from '../components/CategoryModal';
import { getBackendUrl } from '../utils/config';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { MenuProps } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import FolderTreeModal from '../components/FolderTreeModal';

const { Title } = Typography;

// Helper for File Icon
const getFileIcon = (fileName: string, contentPath?: string) => {
    const path = contentPath || fileName;
    if (!path) return <FileOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />;

    const ext = path.split('.').pop()?.toLowerCase();

    // Check if it's potentially just a name without extension in path
    if (ext === path.toLowerCase() && !contentPath) {
        return <FileOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />;
    }

    switch (ext) {
        case 'pdf':
            return <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />;
        case 'docx':
        case 'doc':
            return <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />;
        case 'xlsx':
        case 'xls':
        case 'csv':
            return <FileExcelOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
        case 'pptx':
        case 'ppt':
            return <FileOutlined style={{ fontSize: 24, color: '#fa8c16' }} />;
        default:
            return <FileOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />;
    }
};

// Draggable Row for List View
const DraggableBodyRow = ({ record, onDrop, canDrag, className, style, ...restProps }: any) => {
    const ref = React.useRef<HTMLTableRowElement>(null);

    const [{ isDragging }, drag] = useDrag({
        type: record?.type || 'unknown',
        item: { id: record?.id, type: record?.type },
        canDrag: canDrag && !record?.isVirtual,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['template', 'folder'],
        canDrop: (item: any) => {
            if (record?.type !== 'folder' || record?.isVirtual) return false;
            // Cannot drop folder into itself
            if (item.type === 'folder' && item.id === record?.id) return false;
            return true;
        },
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return;
            onDrop(item, record);
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    if (record?.type === 'folder') {
        drag(drop(ref));
    } else {
        drag(ref);
    }

    return (
        <tr
            ref={ref}
            className={className}
            style={{
                ...style,
                cursor: canDrag && !record?.isVirtual ? 'move' : 'default',
                opacity: isDragging ? 0.5 : 1,
                backgroundColor: isOver && canDrop ? '#e6f7ff' : undefined,
            }}
            {...restProps}
        />
    );
};

export default function TemplateManagementPage() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('templatePageViewMode') as 'grid' | 'list') || 'list');

    // Folder State
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    // Context about the current folder (to pass to create subfolder)
    const [currentFolderContext, setCurrentFolderContext] = useState<{ isGlobal?: boolean, departmentId?: number | null } | undefined>(undefined);

    // Pagination & Modal State
    const [pagination, setPagination] = useState({ current: 1, pageSize: 12, total: 0 }); // Use 12 for grid
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

    // Category Modal
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [selectedFolderForEdit, setSelectedFolderForEdit] = useState<any | null>(null);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);

    // Preview State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState('');

    // Move State
    const [moveModalVisible, setMoveModalVisible] = useState(false);
    const [movingItem, setMovingItem] = useState<{ id: number, type: 'template' | 'folder', departmentId?: number, departmentName?: string } | null>(null);

    const handleViewModeChange = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('templatePageViewMode', mode);
    };

    const fetchFolderContents = async (folderId: number | null, page = 1, pageSize = 12) => {
        setLoading(true);
        try {
            const params: any = {
                page,
                limit: pageSize,
                search: searchText || undefined,
                type: 'template' // Crucial: tell backend we want templates
            };

            if (folderId === null) {
                const contentsResult = await getCategoryContents('root', params);
                setFolders(contentsResult.folders || []);
                setTemplates(contentsResult.documents?.results || []); // Backend returns standard structure with 'documents' key
                setPagination({
                    current: contentsResult.documents?.page || 1,
                    pageSize: contentsResult.documents?.limit || 12,
                    total: contentsResult.documents?.totalResults || 0
                });
                setBreadcrumbs([]);
                setCurrentFolderContext(undefined);
            } else {
                const [contentsResult, breadcrumbsResult] = await Promise.all([
                    getCategoryContents(folderId, params),
                    getCategoryBreadcrumbs(folderId)
                ]);
                setFolders(contentsResult.folders || []);
                setTemplates(contentsResult.documents?.results || []);
                setPagination({
                    current: contentsResult.documents?.page || 1,
                    pageSize: contentsResult.documents?.limit || 12,
                    total: contentsResult.documents?.totalResults || 0
                });
                setBreadcrumbs(breadcrumbsResult || []);

                if (breadcrumbsResult && breadcrumbsResult.length > 0) {
                    const current = breadcrumbsResult[breadcrumbsResult.length - 1];
                    setCurrentFolderContext({
                        isGlobal: current.isGlobal,
                        departmentId: current.departmentId
                    });
                }
            }
        } catch (error) {
            message.error('Không thể tải nội dung thư mục');
        } finally {
            setLoading(false);
        }
    };

    const navigateToFolder = (folderId: number | null) => {
        setCurrentFolderId(folderId);
        setPagination({ ...pagination, current: 1 });
    };

    useEffect(() => {
        fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
    }, [currentFolderId, searchText]);

    const handleTableChange = (newPagination: any) => {
        fetchFolderContents(currentFolderId, newPagination.current, newPagination.pageSize);
    }

    // Actions
    const handleAdd = () => {
        setSelectedTemplateId(null);
        setModalVisible(true);
    };

    const handleEdit = (id: number) => {
        setSelectedTemplateId(id);
        setModalVisible(true);
    };

    const handleDelete = (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: 'Bạn có chắc chắn muốn xóa mẫu này?',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteDocument(id);
                    message.success('Đã xóa mẫu thành công');
                    fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
                } catch (error: any) {
                    message.error(error.response?.data?.message || 'Lỗi xóa mẫu'); // Fixed bracket
                }
            },
        });
    };

    const handleView = (record: any) => {
        if (record.content && record.content.includes('G:\\')) {
            const viewUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&inline=true&token=${localStorage.getItem('accessToken')}`;

            const ext = record.content.split('.').pop() || '';
            const tName = record.title || record.name;
            const fullFileName = tName.toLocaleLowerCase().endsWith(ext.toLowerCase())
                ? tName
                : `${tName}.${ext}`;

            setPreviewUrl(viewUrl);
            setPreviewName(fullFileName);
            setPreviewVisible(true);
        } else {
            message.warning('File không tồn tại');
        }
    };

    // Folder Actions
    const handleAddFolder = () => {
        setSelectedFolderForEdit(null);
        setCurrentParentId(currentFolderId);
        setCategoryModalVisible(true);
    };

    const handleEditFolder = (folder: any) => {
        setSelectedFolderForEdit(folder);
        setCategoryModalVisible(true);
    };

    const handleDeleteCategory = (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa thư mục',
            content: 'Bạn có chắc chắn muốn xóa thư mục này? Thư mục phải trống mới có thể xóa.',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteCategory(id);
                    message.success('Đã xóa thư mục');
                    fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
                } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi xóa thư mục'); }
            },
        });
    };

    // Drag and Drop Logic
    const handleGridDrop = async (item: any, targetFolder: any) => {
        const sourceId = item.id;
        const sourceType = item.type;
        const targetId = targetFolder.id;

        if (sourceType === 'folder' && sourceId === targetId) return;

        setLoading(true);
        try {
            if (sourceType === 'template') {
                const fd = new FormData();
                fd.append('categoryId', String(targetId));
                fd.append('isTemplate', 'true'); // Maintain template flag
                await updateDocument(sourceId, fd);
                message.success('Đã di chuyển mẫu');
            } else if (sourceType === 'folder') {
                await moveCategory(sourceId, { newParentId: targetId });
                message.success('Đã di chuyển thư mục');
            }
            fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi di chuyển');
        } finally {
            setLoading(false);
        }
    };

    const handleMoveSelect = async (targetFolderId: number | null) => {
        if (!movingItem) return;

        setLoading(true);
        setMoveModalVisible(false);
        try {
            if (movingItem.type === 'template') {
                const fd = new FormData();
                fd.append('categoryId', targetFolderId === null ? '' : String(targetFolderId));
                fd.append('isTemplate', 'true');
                await updateDocument(movingItem.id, fd);
                message.success('Đã di chuyển mẫu');
            } else {
                await moveCategory(movingItem.id, { newParentId: targetFolderId });
                message.success('Đã di chuyển thư mục');
            }

            if (currentFolderId === null) {
                fetchFolderContents(null, 1, pagination.pageSize);
            } else {
                fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi khi di chuyển');
        } finally {
            setLoading(false);
            setMovingItem(null);
        }
    };

    // Menu Item Generators
    const getFolderMenuItems = (folder: any): MenuProps['items'] => {
        const isAdmin = user.role === 'ADMIN';
        const isOwner = folder.createdBy === user.username;
        const isManagerOfDept = user.role === 'MANAGER' && folder.departmentId === user.departmentId;

        const canEdit = isAdmin || isOwner || isManagerOfDept;
        const canDelete = isAdmin || isOwner || isManagerOfDept;

        const items: MenuProps['items'] = [
            { key: 'open', label: 'Mở', icon: <FolderOpenOutlined />, onClick: () => navigateToFolder(folder.id) },
        ];

        if (canEdit) {
            items.push({ key: 'edit', label: 'Sửa', icon: <EditOutlined />, onClick: () => handleEditFolder(folder) });
            items.push({
                key: 'move', label: 'Di chuyển', icon: <DragOutlined />, onClick: () => {
                    setMovingItem({
                        id: folder.id,
                        type: 'folder',
                        departmentId: folder.departmentId,
                        departmentName: folder.department?.name
                    });
                    setMoveModalVisible(true);
                }
            });
        }
        if (canDelete) {
            items.push({ type: 'divider' });
            items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDeleteCategory(folder.id) });
        }
        return items;
    };

    const getTemplateMenuItems = (record: any): MenuProps['items'] => {
        const isOwner = record.createdBy === user.username;
        const isAdmin = user.role === 'ADMIN';
        const isManagerOfDept = user.role === 'MANAGER' && record.departmentId === user.departmentId;
        const userPermission = record.permissions?.find((p: any) => Number(p.userId) === Number(user.id));

        const canView = true; // Templates are usually viewable if listed? Or visibility check applies in backend listing.
        const canEdit = isOwner || isAdmin || isManagerOfDept || (userPermission?.permission === 'EDIT');
        const canDelete = isOwner || isAdmin || isManagerOfDept;

        const items: MenuProps['items'] = [];

        items.push({ key: 'view', label: 'Xem', icon: <EyeOutlined />, onClick: () => handleView(record) });

        items.push({
            key: 'download',
            label: 'Tải xuống',
            icon: <DownloadOutlined />,
            onClick: () => {
                if (record.content && record.content.includes('G:\\')) {
                    const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&token=${localStorage.getItem('accessToken')}`;
                    window.location.href = downloadUrl;
                } else {
                    message.warning('File không tồn tại');
                }
            }
        });

        if (canEdit) {
            items.push({
                key: 'move', label: 'Di chuyển', icon: <DragOutlined />, onClick: () => {
                    setMovingItem({
                        id: record.id,
                        type: 'template',
                        departmentId: record.departmentId,
                        departmentName: record.department?.name
                    });
                    setMoveModalVisible(true);
                }
            });
            items.push({ key: 'edit', label: 'Sửa', icon: <EditOutlined />, onClick: () => handleEdit(record.id) });
        }
        if (canDelete) {
            items.push({ type: 'divider' });
            items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record.id) });
        }
        return items;
    };

    // Columns Definition
    const columns: ColumnsType<any> = [
        {
            title: 'Tên mẫu',
            dataIndex: 'name',
            key: 'name',
            width: 300,
            render: (text, record) => (
                <Space style={{ cursor: 'pointer' }} onClick={() => record.type === 'folder' ? navigateToFolder(record.id) : handleView(record)}>
                    {record.type === 'folder' ? (
                        <FolderOpenOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    ) : (
                        getFileIcon(record.title || record.name, record.content)
                    )}
                    <span style={{ fontWeight: 500 }}>{record.title || record.name}</span>
                </Space>
            )
        },
        {
            title: 'Loại',
            key: 'category',
            width: 150,
            render: (_, record) => record.type === 'folder' ? '' : (record.category?.name || '---'),
        },
        {
            title: 'Phòng ban',
            key: 'department',
            width: 150,
            render: (_, record) => record.department?.name || (record.isGlobal ? <Tag color="cyan">Hệ thống</Tag> : '---'),
        },
        {
            title: 'Quyền hạn',
            key: 'visibility',
            width: 130,
            render: (_, record) => {
                if (record.type === 'folder') return '';
                let label = ''; let color = '';
                switch (record.visibility) {
                    case 'PRIVATE': label = 'Bảo mật'; color = 'red'; break;
                    case 'DEPARTMENT': label = 'Nội bộ'; color = 'orange'; break;
                    case 'PUBLIC': label = 'Công khai'; color = 'green'; break;
                    default: label = 'Chưa thiết lập'; color = 'default';
                }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 100,
            render: (isActive: any, record) => record.type === 'folder' ? '' : (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Hoạt động' : 'Tắt'}
                </Tag>
            ),
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_, record) => {
                const items = record.type === 'folder' ? getFolderMenuItems(record) : getTemplateMenuItems(record);
                return (<Space size="small">{items && items.length > 0 ? (<Dropdown menu={{ items }} trigger={['click']}><Button type="text" icon={<MoreOutlined style={{ fontSize: '20px', fontWeight: 'bold' }} />} /></Dropdown>) : (<span></span>)}</Space>);
            },
        },
    ];

    return (
        <DndProvider backend={HTML5Backend}>
            <div style={{ padding: '0 0px' }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                    <Col><Title level={3} style={{ margin: 0 }}>Quản lý mẫu tài liệu</Title></Col>
                    <Col>
                        {(() => {
                            const currentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                            const isVirtual = currentFolderId && currentFolder && !(
                                user.role === 'ADMIN' ||
                                (currentFolder && currentFolder.isGlobal) ||
                                (currentFolder && currentFolder.createdBy === user.username) ||
                                (currentFolder && currentFolder.departmentId === user.departmentId)
                            );
                            const canAdd = !currentFolderId || !isVirtual;

                            return (
                                <Space>
                                    <Segmented
                                        value={viewMode}
                                        onChange={(value) => handleViewModeChange(value as 'grid' | 'list')}
                                        options={[{ value: 'list', icon: <BarsOutlined /> }, { value: 'grid', icon: <AppstoreOutlined /> }]}
                                    />
                                    <Button icon={<FolderFilled />} onClick={handleAddFolder} disabled={!canAdd}>
                                        Thêm thư mục
                                    </Button>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!canAdd}>
                                        Thêm mẫu mới
                                    </Button>
                                </Space>
                            );
                        })()}
                    </Col>
                </Row>

                <Card bordered={false} style={{ marginBottom: 16 }}>
                    <Breadcrumb style={{ marginBottom: 16 }}>
                        <Breadcrumb.Item onClick={() => navigateToFolder(null)} style={{ cursor: 'pointer' }}><HomeOutlined /> Trang chủ</Breadcrumb.Item>
                        {breadcrumbs.map((crumb) => (<Breadcrumb.Item key={crumb.id} onClick={() => navigateToFolder(crumb.id)} style={{ cursor: 'pointer' }}>{crumb.name}</Breadcrumb.Item>))}
                    </Breadcrumb>
                    <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} sm={12} md={8}>
                            <Input
                                placeholder="Tìm kiếm mẫu..."
                                prefix={<SearchOutlined />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                        </Col>
                        {/* Add more filters if needed */}
                    </Row>
                </Card>

                {viewMode === 'grid' ? (
                    <div style={{ minHeight: 'calc(100vh - 350px)' }}>
                        <Row gutter={[16, 16]}>
                            {folders.map(folder => {
                                const isAdmin = user.role === 'ADMIN';
                                const isOwner = folder.createdBy === user.username;
                                const isManagerOfDept = user.role === 'MANAGER' && folder.departmentId === user.departmentId;
                                const canEditFolder = isAdmin || isOwner || isManagerOfDept;
                                return (
                                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={folder.id}>
                                        <FolderCard
                                            folder={folder}
                                            menuItems={getFolderMenuItems(folder)}
                                            onDoubleClick={() => navigateToFolder(folder.id)}
                                            onDropItem={(item) => handleGridDrop(item, folder)}
                                            canDrag={canEditFolder}
                                        />
                                    </Col>
                                );
                            })}
                            {templates.map(tpl => {
                                const isOwner = tpl.createdBy === user.username;
                                const isAdmin = user.role === 'ADMIN';
                                const isManagerOfDept = user.role === 'MANAGER' && tpl.departmentId === user.departmentId;
                                const userPermission = tpl.permissions?.find((p: any) => Number(p.userId) === Number(user.id));
                                const canEdit = isOwner || isAdmin || isManagerOfDept || (userPermission?.permission === 'EDIT');

                                return (
                                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={tpl.id}>
                                        <DocumentCard
                                            document={tpl}
                                            menuItems={getTemplateMenuItems(tpl)}
                                            canDrag={canEdit}

                                        />
                                    </Col>
                                );
                            })}
                        </Row>
                        {!loading && folders.length === 0 && templates.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '100px 0', color: '#8c8c8c' }}>Thư mục trống</div>
                        )}
                    </div>
                ) : (
                    <Card bordered={false}>
                        <Table
                            columns={columns}
                            dataSource={[...folders.map(f => ({ ...f, type: 'folder' })), ...templates.map(d => ({ ...d, type: 'template' }))]}
                            rowKey={(record) => record.type + '-' + record.id}
                            loading={loading}
                            scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
                            components={{
                                body: {
                                    row: DraggableBodyRow,
                                },
                            }}
                            onRow={(record) => {
                                let canDrag = false;
                                if (record.type === 'folder') {
                                    const isAdmin = user.role === 'ADMIN';
                                    const isOwner = record.createdBy === user.username;
                                    const isManagerOfDept = user.role === 'MANAGER' && record.departmentId === user.departmentId;
                                    canDrag = isAdmin || isOwner || isManagerOfDept;
                                } else {
                                    const isOwner = record.createdBy === user.username;
                                    const isAdmin = user.role === 'ADMIN';
                                    const isManagerOfDept = user.role === 'MANAGER' && record.departmentId === user.departmentId;
                                    const userPermission = record.permissions?.find((p: any) => Number(p.userId) === Number(user.id));
                                    canDrag = isOwner || isAdmin || isManagerOfDept || (userPermission?.permission === 'EDIT');
                                }
                                return {
                                    record,
                                    onDrop: handleGridDrop,
                                    canDrag: canDrag,
                                };
                            }}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: pagination.total,
                                showSizeChanger: true,
                                showTotal: (total) => `Tổng ${total} mục`,
                            }}
                            onChange={handleTableChange}
                        />
                    </Card>
                )}

                <DocumentModal
                    visible={modalVisible}
                    onCancel={() => setModalVisible(false)}
                    onSuccess={() => { setModalVisible(false); fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize); }}
                    documentId={selectedTemplateId}
                    defaultCategoryId={currentFolderId} // Pass current folder as default
                    isTemplate={true} // FORCE TEMPLATE MODE
                />

                <CategoryModal
                    visible={categoryModalVisible}
                    category={selectedFolderForEdit}
                    parentId={currentParentId}
                    isTemplate={true} // FORCE TEMPLATE MODE
                    onCancel={() => setCategoryModalVisible(false)}
                    onSuccess={() => { setCategoryModalVisible(false); fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize); }}
                />

                <FilePreviewModal
                    visible={previewVisible}
                    onClose={() => setPreviewVisible(false)}
                    fileUrl={previewUrl}
                    fileName={previewName}
                />

                <FolderTreeModal
                    visible={moveModalVisible}
                    onCancel={() => { setMoveModalVisible(false); setMovingItem(null); }}
                    onSelect={handleMoveSelect}
                    movingItemId={movingItem?.id}
                    movingItemType={movingItem?.type}
                    currentParentId={currentFolderId}
                    departmentId={movingItem?.departmentId}
                    departmentName={movingItem?.departmentName}
                />
            </div>
        </DndProvider>
    );
}
