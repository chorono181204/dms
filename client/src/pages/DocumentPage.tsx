
import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, message, Modal, Tag, Card, Row, Col, Typography, Select, Dropdown, DatePicker, Breadcrumb, Segmented } from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined, EyeOutlined, EditFilled,
    MoreOutlined, HistoryOutlined, SendOutlined, AppstoreOutlined, BarsOutlined, HomeOutlined, FolderOpenOutlined, FilePdfOutlined, FolderFilled
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import { getDocuments, deleteDocument, updateDocument } from '../api/services/document.service';
import { getCategories, getCategoryContents, getCategoryBreadcrumbs, moveCategory, deleteCategory } from '../api/services/category.service';
import DocumentModal from '../components/DocumentModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { PDFSignatureModal } from '../components/PDFSignatureModal';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import SignatureRequestModal from '../components/SignatureRequestModal';
import DocumentCard from '../components/DocumentCard';
import FolderCard from '../components/FolderCard';
import CategoryModal from '../components/CategoryModal';
import { getBackendUrl } from '../utils/config';
import dayjs from 'dayjs';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { MenuProps } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { DragOutlined } from '@ant-design/icons';
import FolderTreeModal from '../components/FolderTreeModal';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface Document {
    id: number; title: string; code: string | null; status: string;
    department?: { name: string }; category?: { name: string };
    content: string; createdBy: string; createdByName?: string;
    updatedBy?: string; updatedByName?: string; visibility: string;
    accessLevel: string; createdAt: string; updatedAt: string;
    permissions?: any[]; departmentId?: number; effectiveDate?: string | null;
    expirationDate?: string | null; isReference?: boolean; attachments?: any[];
}

const statusLabels: Record<string, string> = {
    DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt',
    SIGNED: 'Đã ký', ARCHIVED: 'Lưu trữ', REJECTED: 'Từ chối',
};

const statusColors: Record<string, string> = {
    DRAFT: 'default', PENDING: 'orange', APPROVED: 'green',
    SIGNED: 'blue', ARCHIVED: 'default', REJECTED: 'red',
};

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
        accept: ['document', 'folder'],
        canDrop: (item: any) => {
            if (record?.type !== 'folder' || record?.isVirtual) return false;
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

const DocumentPage: React.FC = () => {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
    const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
    const [selectedVisibility, setSelectedVisibility] = useState<string | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('documentPageViewMode') as 'grid' | 'list') || 'list');
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [effectiveDateRange, setEffectiveDateRange] = useState<any>(null);
    const [expirationDateRange, setExpirationDateRange] = useState<any>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | undefined>(undefined);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [modalVisible, setModalVisible] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);

    const [selectedDocumentForPreview, setSelectedDocumentForPreview] = useState<any | null>(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewName, setPreviewName] = useState('');
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signaturePdfUrl, setSignaturePdfUrl] = useState('');
    const [signatureDocTitle, setSignatureDocTitle] = useState('');
    const [signatureDocId, setSignatureDocId] = useState<number | null>(null);
    const [signatureRequestModalVisible, setSignatureRequestModalVisible] = useState(false);
    const [selectedDocumentForRequest, setSelectedDocumentForRequest] = useState<Document | null>(null);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [selectedDocumentForHistory, setSelectedDocumentForHistory] = useState<Document | null>(null);
    const [selectedFolderForEdit, setSelectedFolderForEdit] = useState<any | null>(null);
    const [moveModalVisible, setMoveModalVisible] = useState(false);
    const [movingItem, setMovingItem] = useState<{ id: number, type: 'document' | 'folder', departmentId?: number, departmentName?: string } | null>(null);

    const { user } = useAuth();

    const handleViewModeChange = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('documentPageViewMode', mode);
    };

    const fetchCategories = async () => {
        try {
            const result = await getCategories({ isActive: true, limit: 100, departmentId: user.departmentId });
            setCategories(result.results || []);
        } catch (error) { console.error('Failed to fetch categories'); }
    };

    const fetchDepartments = async () => {
        try {
            const { getDepartments } = await import('../api/services/department.service');
            const result = await getDepartments({ limit: 100 });
            setDepartments(result.results || []);
        } catch (error) { console.error('Failed to fetch departments'); }
    };

    const fetchFolderContents = async (folderId: number | null, page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const params: any = { page, limit: pageSize, search: searchText || undefined, status: selectedStatus, departmentId: selectedDepartment, visibility: selectedVisibility };
            if (effectiveDateRange && effectiveDateRange.length === 2) {
                params.effectiveDateStart = effectiveDateRange[0].startOf('day').toISOString();
                params.effectiveDateEnd = effectiveDateRange[1].endOf('day').toISOString();
            }
            if (expirationDateRange && expirationDateRange.length === 2) {
                params.expirationDateStart = expirationDateRange[0].startOf('day').toISOString();
                params.expirationDateEnd = expirationDateRange[1].endOf('day').toISOString();
            }
            if (folderId === null) {
                const contentsResult = await getCategoryContents('root', params);
                setFolders(contentsResult.folders || []);
                setDocuments(contentsResult.documents?.results || []);
                setPagination({ current: contentsResult.documents?.page || 1, pageSize: contentsResult.documents?.limit || 10, total: contentsResult.documents?.totalResults || 0 });
                setBreadcrumbs([]);
            } else {
                const [contentsResult, breadcrumbsResult] = await Promise.all([getCategoryContents(folderId, params), getCategoryBreadcrumbs(folderId)]);
                setFolders(contentsResult.folders || []);
                setDocuments(contentsResult.documents?.results || []);
                setPagination({ current: contentsResult.documents?.page || 1, pageSize: contentsResult.documents?.limit || 10, total: contentsResult.documents?.totalResults || 0 });
                setBreadcrumbs(breadcrumbsResult || []);
            }
        } catch (error) { message.error('Không thể tải nội dung thư mục'); } finally { setLoading(false); }
    };

    const navigateToFolder = (folderId: number | null) => {
        setCurrentFolderId(folderId);
        setPagination({ ...pagination, current: 1 });
    };

    useEffect(() => {
        fetchCategories();
        if (user.role === 'ADMIN' || user.department?.isSupervisory) fetchDepartments();
    }, []);

    useEffect(() => {
        fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
    }, [currentFolderId, searchText, selectedStatus, selectedDepartment, selectedVisibility, effectiveDateRange, expirationDateRange]);

    const handleTableChange = (newPagination: any) => fetchFolderContents(currentFolderId, newPagination.current, newPagination.pageSize);

    const handleAdd = () => { setSelectedDocId(null); setModalVisible(true); };
    const handleAddFolder = () => { setSelectedFolderForEdit(null); setCurrentParentId(currentFolderId); setCategoryModalVisible(true); };
    const handleEditFolder = (folder: any) => { setSelectedFolderForEdit(folder); setCategoryModalVisible(true); };

    const handleGridDrop = async (item: any, targetFolder: any) => {
        const sourceId = item.id; const sourceType = item.type; const targetId = targetFolder.id;
        if (sourceType === 'folder' && sourceId === targetId) return;
        setLoading(true);
        try {
            if (sourceType === 'document') {
                const fd = new FormData(); fd.append('categoryId', String(targetId));
                await updateDocument(sourceId, fd);
                message.success('Đã di chuyển tài liệu');
            } else if (sourceType === 'folder') {
                await moveCategory(sourceId, { newParentId: targetId });
                message.success('Đã di chuyển thư mục');
            }
            fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
        } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi khi di chuyển'); } finally { setLoading(false); }
    };

    const handleEdit = (record: Document) => { setSelectedDocId(record.id); setModalVisible(true); };

    const handleDelete = (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa', content: 'Bạn có chắc chắn muốn xóa tài liệu này? File đính kèm cũng sẽ bị xóa vĩnh viễn.',
            okText: 'Xóa', cancelText: 'Hủy', okType: 'danger',
            onOk: async () => {
                try {
                    await deleteDocument(id);
                    message.success('Đã xóa tài liệu');
                    fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
                } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi xóa tài liệu'); }
            },
        });
    };

    const handleView = (record: Document) => {
        const token = localStorage.getItem('accessToken');
        const filePath = encodeURIComponent(record.content);
        const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&inline=true' + (token ? `&token=${token}` : '');
        setSelectedDocumentForPreview(record); setPreviewUrl(url); setPreviewName(record.title); setPreviewVisible(true);
    };

    const handleDownload = async (record: Document) => {
        if (record.visibility === 'PRIVATE' && user.role !== 'ADMIN' && record.createdBy !== user.username) {
            message.error('Tài liệu BẢO MẬT không được phép tải xuống.'); return;
        }
        try {
            const filePath = encodeURIComponent(record.content);
            const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&token=' + localStorage.getItem('accessToken');
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = record.content.split('\\').pop() || 'document.pdf';
            document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
        } catch (error) { message.error('Lỗi tải xuống tài liệu'); }
    };

    const handleSign = async (record: Document) => {
        if (!user.signatureImage) {
            message.warning('Vui lòng tải lên chữ ký của bạn trong trang Hồ sơ trước khi ký văn bản');
            return;
        }
        if (!record.content) {
            message.error('Tài liệu không có nội dung file');
            return;
        }

        try {
            message.loading({ content: 'Đang tải tài liệu...', key: 'sign-loading' });
            const token = localStorage.getItem('accessToken');
            if (!token) {
                message.warning('Phiên làm việc hết hạn, vui lòng đăng nhập lại');
                return;
            }

            const filePath = encodeURIComponent(record.content);
            const url = `${getBackendUrl()}/v1/upload/download?path=${filePath}&inline=true&token=${token}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('Không có quyền truy cập (401)');
                throw new Error(`Lỗi tải file: ${response.status}`);
            }

            const pdfBlob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            setSignaturePdfUrl(pdfUrl);
            setSignatureDocTitle(record.title);
            setSignatureDocId(record.id);
            setSignatureModalVisible(true);
            message.destroy('sign-loading');
        } catch (error: any) {
            console.error('Sign error:', error);
            message.error({ content: `Lỗi: ${error.message || 'Không thể tải tài liệu để ký'}`, key: 'sign-loading' });
        }
    };

    const handleRequestSignature = (record: Document) => { setSelectedDocumentForRequest(record); setSignatureRequestModalVisible(true); };

    const handleSignatureConfirm = async (signedPdfBlob: Blob) => {
        if (!signatureDocId) return;
        try {
            const formData = new FormData();
            formData.append('file', signedPdfBlob, signatureDocTitle + '_signed.pdf');
            formData.append('status', 'SIGNED');

            await updateDocument(signatureDocId, formData);

            setSignatureModalVisible(false);
            message.success('Ký văn bản thành công!');
            fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
        } catch (error: any) {
            console.error('Sign upload error:', error);
            message.error(error.response?.data?.message || 'Lỗi lưu văn bản đã ký');
        }
    };

    const getFolderMenuItems = (folder: any): MenuProps['items'] => {
        const isAdmin = user.role === 'ADMIN';
        const isOwner = folder.createdBy === user.username;
        const isManagerOfDept = user.role === 'MANAGER' && folder.departmentId === user.departmentId;

        const canEdit = isAdmin || isOwner || isManagerOfDept;
        const canDelete = isAdmin || isOwner || isManagerOfDept;

        const items: MenuProps['items'] = [
            {
                key: 'open',
                label: 'Mở',
                icon: <FolderOpenOutlined />,
                onClick: () => navigateToFolder(folder.id)
            },
        ];

        if (canEdit) {
            items.push({ key: 'edit', label: 'Sửa', icon: <EditOutlined />, onClick: () => handleEditFolder(folder) });
        }
        if (canDelete) {
            items.push({ type: 'divider' });
            items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDeleteCategory(folder.id) });
        }
        return items;
    };

    const handleDeleteCategory = (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa thư mục',
            content: 'Bạn có chắc chắn muốn xóa thư mục này? Thư mục phải trống mới có thể xóa.',
            okText: 'Xóa', cancelText: 'Hủy', okType: 'danger',
            onOk: async () => {
                try {
                    await deleteCategory(id);
                    message.success('Đã xóa thư mục');
                    fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
                } catch (error: any) { message.error(error.response?.data?.message || 'Lỗi xóa thư mục'); }
            },
        });
    };

    const handleMoveSelect = async (targetFolderId: number | null) => {
        if (!movingItem) return;

        setLoading(true);
        setMoveModalVisible(false);
        try {
            if (movingItem.type === 'document') {
                const fd = new FormData();
                fd.append('categoryId', targetFolderId === null ? '' : String(targetFolderId));
                await updateDocument(movingItem.id, fd);
                message.success('Đã di chuyển tài liệu');
            } else {
                await moveCategory(movingItem.id, { newParentId: targetFolderId });
                message.success('Đã di chuyển thư mục');
            }

            // Refresh current folder
            if (currentFolderId === null) {
                fetchFolderContents(null, 1, pagination.pageSize);
            } else {
                fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.response?.data?.message || 'Lỗi khi di chuyển');
        } finally {
            setLoading(false);
            setMovingItem(null);
        }
    };

    const getMenuItems = (record: any): MenuProps['items'] => {
        // Handle Folder Actions
        if (record.type === 'folder') {
            const isAdmin = user.role === 'ADMIN';
            const isOwner = record.createdBy === user.username;
            const isManagerOfDept = user.role === 'MANAGER' && record.departmentId === user.departmentId;

            const canEdit = isAdmin || isOwner || isManagerOfDept;
            const canDelete = isAdmin || isOwner || isManagerOfDept;

            const items: MenuProps['items'] = [
                { key: 'open', label: 'Mở', icon: <FolderOpenOutlined />, onClick: () => navigateToFolder(record.id) }
            ];

            if (canEdit) {
                items.push({ key: 'edit', label: 'Sửa', icon: <EditOutlined />, onClick: () => handleEditFolder(record) });
                items.push({
                    key: 'move', label: 'Di chuyển', icon: <DragOutlined />, onClick: () => {
                        setMovingItem({
                            id: record.id,
                            type: 'folder',
                            departmentId: record.departmentId,
                            departmentName: record.department?.name
                        });
                        setMoveModalVisible(true);
                    }
                });
            }

            if (canDelete) {
                items.push({ type: 'divider' });
                items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDeleteCategory(record.id) });
            }

            return items;
        }

        // Handle Document Actions
        const isOwner = record.createdBy === user.username;
        const isAdmin = user.role === 'ADMIN';
        const userPermission = record.permissions?.find((p: any) => Number(p.userId) === Number(user.id));
        const isSupervisory = user.department?.isSupervisory;
        const hasDepartmentAccess = record.visibility === 'DEPARTMENT' && (record.departmentId === user.departmentId || isSupervisory);

        const canView = isOwner || isAdmin || userPermission || (record.visibility === 'PUBLIC') || hasDepartmentAccess;
        const isManagerOfDept = user.role === 'MANAGER' && record.departmentId === user.departmentId;
        const canEdit = isOwner || isAdmin || isManagerOfDept || (userPermission?.permission === 'EDIT');
        const canSign = isOwner || isAdmin || (userPermission?.permission === 'SIGN');
        const canDelete = isOwner || isAdmin || isManagerOfDept;

        const items: MenuProps['items'] = [];
        if (canView) {
            items.push({ key: 'view', label: 'Xem', icon: <EyeOutlined />, onClick: () => handleView(record) });
            const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT' || userPermission?.permission === 'SIGN';
            const canDownload = (isAdmin || isOwner || hasExplicitDownload || (record.visibility !== 'PRIVATE' && record.accessLevel !== 'VIEW'));
            if (canDownload) items.push({ key: 'download', label: 'Tải xuống', icon: <DownloadOutlined />, onClick: () => handleDownload(record) });
        }
        if (canEdit) {
            if (!record.isReference) items.push({ key: 'request_sign', label: 'Trình ký', icon: <SendOutlined />, onClick: () => handleRequestSignature(record) });
            items.push({
                key: 'move', label: 'Di chuyển', icon: <DragOutlined />, onClick: () => {
                    setMovingItem({
                        id: record.id,
                        type: 'document',
                        departmentId: record.departmentId,
                        departmentName: record.department?.name
                    });
                    setMoveModalVisible(true);
                }
            });
            items.push({ key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined />, onClick: () => handleEdit(record) });
        }
        if (canSign && !record.isReference) items.push({ key: 'sign', label: 'Ký số', icon: <EditFilled />, onClick: () => handleSign(record) });
        if (canDelete) {
            items.push({ key: 'history', label: 'Lịch sử phiên bản', icon: <HistoryOutlined />, onClick: () => { setSelectedDocumentForHistory(record); setHistoryVisible(true); } });
            items.push({ type: 'divider' });
            items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record.id) });
        }
        return items;
    };

    const columns: ColumnsType<any> = [
        { title: 'Số/Ký hiệu', dataIndex: 'code', key: 'code', width: 150, render: (text) => <b>{text || ''}</b> },
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', width: 300 },
        { title: 'Ngày hiệu lực', dataIndex: 'effectiveDate', key: 'effectiveDate', width: 150, render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '' },
        {
            title: 'Ngày hết hạn', dataIndex: 'expirationDate', key: 'expirationDate', width: 150, render: (text) => {
                if (!text) return '';
                const date = dayjs(text); const isExpired = date.isBefore(dayjs(), 'day');
                return (<span style={{ color: isExpired ? 'red' : 'inherit' }}>{date.format('DD/MM/YYYY')}</span>);
            }
        },
        { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120, render: (status) => (<Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>) },
        { title: 'Nguồn', key: 'isReference', width: 120, render: (_, record) => record.isReference ? <Tag color="blue">Tài liệu tham khảo</Tag> : <Tag>Nội bộ</Tag> },
        {
            title: 'Quyền hạn', key: 'permission', width: 140, render: (_, record) => {
                let label = ''; let color = '';
                const visibility = record.type === 'folder'
                    ? (record.isGlobal ? 'PUBLIC' : 'DEPARTMENT')
                    : record.visibility;

                switch (visibility) {
                    case 'PRIVATE': label = '03 - Bảo mật'; color = 'red'; break;
                    case 'DEPARTMENT': label = '02 - Nội bộ'; color = 'orange'; break;
                    case 'PUBLIC': label = '01 - Công khai'; color = 'green'; break;
                    default: label = 'Không xác định'; color = 'default';
                }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        { title: 'Loại tài liệu', key: 'category', width: 150, render: (_, record) => record.type === 'folder' ? '' : (record.category?.name || '') },
        {
            title: 'Phòng ban', key: 'department', width: 150,
            render: (_, record) => {
                const deptName = record.department?.name;
                if (deptName) return deptName;
                if (record.isGlobal || record.visibility === 'PUBLIC') return <Tag color="cyan">Hệ thống</Tag>;
                return '';
            }
        },
        { title: 'Người tạo', dataIndex: 'createdByName', key: 'createdBy', width: 150, render: (_, record) => record.createdByName || record.createdBy },
        { title: 'Người cập nhật', dataIndex: 'updatedByName', key: 'updatedBy', width: 150, render: (_, record) => record.updatedByName || record.updatedBy || '' },
        {
            title: 'Thao tác', key: 'action', width: 200, fixed: 'right', render: (_, record) => {
                const items = getMenuItems(record);
                return (<Space size="small">{items && items.length > 0 ? (<Dropdown menu={{ items }} trigger={['click']}><Button type="text" icon={<MoreOutlined style={{ fontSize: '20px', fontWeight: 'bold' }} />} /></Dropdown>) : (<span></span>)}</Space>);
            }
        }
    ];

    const listColumns: ColumnsType<any> = [
        {
            title: 'Tên', dataIndex: 'name', key: 'name', width: 300, ellipsis: true, render: (_, record) => (
                <Space style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => record.type === 'folder' ? navigateToFolder(record.id) : handleView(record)}>
                    {record.type === 'folder' ? (<FolderOpenOutlined style={{ fontSize: 24, color: '#1890ff' }} />) : (<FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />)}
                    <Typography.Text strong={record.type === 'folder'}>{record.name || record.title}</Typography.Text>
                </Space>
            ),
        },
        ...columns.filter(c => c.key !== 'title' && c.key !== 'category')
    ];

    return (
        <DndProvider backend={HTML5Backend}>
            <div style={{ padding: '0 0px' }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                    <Col><Title level={3} style={{ margin: 0 }}>Danh sách tài liệu, hồ sơ.</Title></Col>
                    <Col>
                        {(() => {
                            const currentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
                            const isVirtual = currentFolderId && currentFolder && !(
                                user.role === 'ADMIN' ||
                                currentFolder.isGlobal ||
                                currentFolder.createdBy === user.username ||
                                currentFolder.departmentId === user.departmentId
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
                                        Thêm tài liệu
                                    </Button>
                                </Space>
                            );
                        })()}
                    </Col>
                </Row>
                <Card bordered={false} style={{ marginBottom: 16 }}>
                    <Breadcrumb style={{ marginBottom: 16 }}>
                        <Breadcrumb.Item onClick={() => navigateToFolder(null)} style={{ cursor: 'pointer' }}><HomeOutlined /> Trang chủ / Global</Breadcrumb.Item>
                        {breadcrumbs.map((crumb) => (<Breadcrumb.Item key={crumb.id} onClick={() => navigateToFolder(crumb.id)} style={{ cursor: 'pointer' }}>{crumb.name}</Breadcrumb.Item>))}</Breadcrumb>
                    <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} sm={12} md={6}><Input placeholder="Tìm kiếm tài liệu..." prefix={<SearchOutlined />} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear /></Col>
                        <Col xs={24} sm={12} md={6}><RangePicker placeholder={['Từ ngày hiệu lực', 'Đến ngày hiệu lực']} style={{ width: '100%' }} onChange={(dates) => setEffectiveDateRange(dates)} value={effectiveDateRange} /></Col>
                        <Col xs={24} sm={12} md={6}><RangePicker placeholder={['Từ ngày hết hạn', 'Đến ngày hết hạn']} style={{ width: '100%' }} onChange={(dates) => setExpirationDateRange(dates)} value={expirationDateRange} /></Col>
                        <Col xs={24} sm={12} md={6}><Select placeholder="Chọn trạng thái" style={{ width: '100%' }} allowClear onChange={(value) => setSelectedStatus(value)}>{Object.entries(statusLabels).map(([value, label]) => (<Select.Option key={value} value={value}>{label}</Select.Option>))}</Select></Col>
                        {(user.role === 'ADMIN' || user.department?.isSupervisory) && (<Col xs={24} sm={12} md={6}><Select placeholder="Lọc theo Khoa/Phòng" style={{ width: '100%' }} allowClear onChange={(value) => setSelectedDepartment(value)} value={selectedDepartment}>{departments.map(dept => (<Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>))}</Select></Col>)}
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
                                return (<Col xs={24} sm={12} md={8} lg={6} xl={4} key={folder.id}><FolderCard folder={folder} menuItems={getFolderMenuItems(folder)} onDoubleClick={() => navigateToFolder(folder.id)} onDropItem={(item) => handleGridDrop(item, folder)} canDrag={canEditFolder} /></Col>);
                            })}
                            {documents.map(doc => {
                                const isOwner = doc.createdBy === user.username;
                                const isAdmin = user.role === 'ADMIN';
                                const isManagerOfDept = user.role === 'MANAGER' && doc.departmentId === user.departmentId;
                                const userPermission = doc.permissions?.find((p: any) => Number(p.userId) === Number(user.id));
                                const canEdit = isOwner || isAdmin || isManagerOfDept || userPermission?.permission === 'EDIT';
                                return (<Col xs={24} sm={12} md={8} lg={6} xl={4} key={doc.id}><DocumentCard document={doc} menuItems={getMenuItems(doc)} canDrag={canEdit} /></Col>);
                            })}
                        </Row>
                        {!loading && folders.length === 0 && documents.length === 0 && (<div style={{ textAlign: 'center', padding: '100px 0', color: '#8c8c8c' }}>Thư mục trống</div>)}
                    </div>
                ) : (
                    <Card bordered={false}>
                        <Table
                            columns={listColumns as any}
                            dataSource={[...folders.map(f => ({ ...f, type: 'folder' })), ...documents.map(d => ({ ...d, type: 'document', name: d.title }))]}
                            rowKey={(record) => record.type + '-' + record.id}
                            loading={loading}
                            scroll={{ x: 1500, y: 'calc(100vh - 400px)' }}
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
                                    canDrag = isOwner || isAdmin || isManagerOfDept || userPermission?.permission === 'EDIT';
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
                                showTotal: (total) => 'Tổng ' + total + ' mục',
                            }}
                            onChange={handleTableChange}
                            rowClassName={(record) => {
                                if (record.type === 'folder') return '';
                                const isExpired = record.expirationDate && dayjs(record.expirationDate).isBefore(dayjs(), 'day');
                                return isExpired ? 'document-expired' : '';
                            }}
                        />
                    </Card>
                )}
                <DocumentModal visible={modalVisible} onCancel={() => setModalVisible(false)} onSuccess={() => { setModalVisible(false); fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize); }} documentId={selectedDocId} defaultCategoryId={currentFolderId} />
                <SignatureRequestModal visible={signatureRequestModalVisible} documentId={selectedDocumentForRequest?.id} onCancel={() => setSignatureRequestModalVisible(false)} onSuccess={() => { fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize); }} />
                <FilePreviewModal
                    visible={previewVisible}
                    fileUrl={previewUrl}
                    fileName={previewName}
                    onClose={() => setPreviewVisible(false)}
                    canDownload={selectedDocumentForPreview ? (() => {
                        const doc = selectedDocumentForPreview;
                        const u = user;
                        const isOwner = doc.createdBy === u.username;
                        const isAdmin = u.role === 'ADMIN';
                        const isSupervisory = u.department?.isSupervisory;
                        const userPermission = doc.permissions?.find((p: any) => Number(p.userId) === Number(u.id));
                        const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT' || userPermission?.permission === 'SIGN';
                        const hasViewAccess = isOwner || isAdmin || userPermission || (doc.visibility === 'PUBLIC') || (doc.visibility === 'DEPARTMENT' && (doc.departmentId === u.departmentId || isSupervisory));

                        return hasViewAccess && (isAdmin || isOwner || hasExplicitDownload || (doc.visibility !== 'PRIVATE' && doc.accessLevel !== 'VIEW'));
                    })() : false}
                    attachments={selectedDocumentForPreview?.attachments || []}
                />
                <PDFSignatureModal
                    visible={signatureModalVisible}
                    pdfUrl={signaturePdfUrl}
                    signatureImageUrl={user.signatureImage ? `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(user.signatureImage)}&inline=true&token=${localStorage.getItem('accessToken')}` : ''}
                    documentTitle={signatureDocTitle}
                    userName={user.name || user.username}
                    userPosition={user.position || user.role || ''}
                    onCancel={() => setSignatureModalVisible(false)}
                    onConfirm={handleSignatureConfirm}
                />
                {selectedDocumentForHistory && (<VersionHistoryPanel visible={historyVisible} onClose={() => { setHistoryVisible(false); setSelectedDocumentForHistory(null); }} documentId={selectedDocumentForHistory.id} canEdit={user?.role === 'ADMIN' || selectedDocumentForHistory.createdBy === user?.username || selectedDocumentForHistory.permissions?.some((p: any) => p.userId === user?.id && p.permission === 'EDIT')} onRestore={() => fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize)} />)}
                <CategoryModal visible={categoryModalVisible} category={selectedFolderForEdit} parentId={currentParentId} onCancel={() => setCategoryModalVisible(false)} onSuccess={() => { setCategoryModalVisible(false); fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize); }} />

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
};

export default DocumentPage;
