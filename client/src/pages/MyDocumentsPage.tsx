import React, { useEffect, useState } from 'react';
import {
  Table,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  message,
  Modal,
  Radio,
  Checkbox,
  Segmented,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  SendOutlined,
  AppstoreOutlined,
  BarsOutlined,
  FolderFilled,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileOutlined,
  MoreOutlined,
  HomeOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  DeleteOutlined,
  EditFilled,
  PlusOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getDocuments, submitDocument } from '../api/services/document.service';
import { createSignatureRequest } from '../api/services/signature.service';
import { getUsers } from '../api/services/user.service';
import dayjs from 'dayjs';

import { getCategories, moveCategory, getCategoryContents, getCategoryBreadcrumbs, deleteCategory } from '../api/services/category.service';
import { updateDocument } from '../api/services/document.service';
import DocumentModal from '../components/DocumentModal';
import FilePreviewModal from '../components/FilePreviewModal';
import DocumentCard from '../components/DocumentCard';
import FolderCard from '../components/FolderCard';
import CategoryModal from '../components/CategoryModal';
import { getBackendUrl } from '../utils/config';
import type { MenuProps } from 'antd';
import { Breadcrumb, DatePicker } from 'antd';
const { RangePicker } = DatePicker;

import '../components/DocumentCard.css';
import { deleteDocument } from '../api/services/document.service';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import SignatureRequestModal from '../components/SignatureRequestModal';
import { PDFSignatureModal } from '../components/PDFSignatureModal';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAuth } from '../contexts/AuthContext';
import { DragOutlined } from '@ant-design/icons';
import FolderTreeModal from '../components/FolderTreeModal';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'orange',
  APPROVED: 'green',
  SIGNED: 'blue',
  ARCHIVED: 'default',
  REJECTED: 'red',
};

const visibilityLabels: Record<string, string> = {
  PRIVATE: 'Riêng tư',
  DEPARTMENT: 'Phòng ban',
  PUBLIC: 'Công khai'
};

const visibilityColors: Record<string, string> = {
  PRIVATE: 'magenta',
  DEPARTMENT: 'cyan',
  PUBLIC: 'blue'
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  SIGNED: 'Đã ký',
  ARCHIVED: 'Lưu trữ',
  REJECTED: 'Từ chối',
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

const MyDocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [isReference, setIsReference] = useState<string | undefined>();
  const [categories, setCategories] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [effectiveDateRange, setEffectiveDateRange] = useState<any>(null);
  const [expirationDateRange, setExpirationDateRange] = useState<any>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('myDocumentsViewMode') as 'grid' | 'list') || 'list';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('myDocumentsViewMode', mode);
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitType, setSubmitType] = useState<number>(1);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSigners, setSelectedSigners] = useState<number[]>([]);
  const [submitNote, setSubmitNote] = useState('');

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signaturePdfUrl, setSignaturePdfUrl] = useState<string>('');
  const [signatureDocTitle, setSignatureDocTitle] = useState<string>('');
  const [signatureDocId, setSignatureDocId] = useState<number | null>(null);
  const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<any | null>(null);

  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedDocumentForHistory, setSelectedDocumentForHistory] = useState<any>(null);

  const [signatureRequestModalVisible, setSignatureRequestModalVisible] = useState(false);
  const [selectedDocumentForRequest, setSelectedDocumentForRequest] = useState<any | null>(null);

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingItem, setMovingItem] = useState<{ id: number, type: 'document' | 'folder', departmentId?: number, departmentName?: string } | null>(null);

  const { user: currentUser } = useAuth();

  const handleAddFolder = () => {
    setEditingCategory(null);
    setCurrentParentId(currentFolderId);
    setCategoryModalVisible(true);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setCurrentParentId(category.parentId);
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = (category: any) => {
    const docCount = category._count?.documents || 0;
    if (docCount > 0) {
      message.error(`Thư mục này còn chứa ${docCount} tài liệu. Vui lòng xóa hoặc di chuyển tài liệu trước.`);
      return;
    }

    Modal.confirm({
      title: 'Xóa thư mục',
      content: `Bạn có chắc chắn muốn xóa thư mục "${category.name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteCategory(category.id);
          message.success('Đã xóa thư mục');
          if (currentFolderId === null) {
            fetchFolderContents(null, 1, pagination.pageSize);
          } else {
            fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Không thể xóa thư mục');
        }
      }
    });
  };

  const handleAddDocument = () => {
    setSelectedDocId(null);
    setModalVisible(true);
  };

  const fetchCategories = async () => {
    try {
      const result = await getCategories({ isActive: true, limit: 100, departmentId: currentUser.departmentId });
      setCategories(result.results || []);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const fetchFolderContents = async (folderId: number | null, page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params: any = {
        page: page,
        limit: pageSize,
        search: searchText || undefined,
        isReference: isReference || undefined,
        createdBy: currentUser.username
      };
      if (selectedStatus) params.status = selectedStatus;

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
        setPagination({
          current: contentsResult.documents?.page || 1,
          pageSize: contentsResult.documents?.limit || 10,
          total: contentsResult.documents?.totalResults || 0
        });
        setBreadcrumbs([]);
      } else {
        const [contentsResult, breadcrumbsResult] = await Promise.all([
          getCategoryContents(folderId, params),
          getCategoryBreadcrumbs(folderId)
        ]);

        setFolders(contentsResult.folders || []);
        setDocuments(contentsResult.documents?.results || []);
        setPagination({
          current: contentsResult.documents?.page || 1,
          pageSize: contentsResult.documents?.limit || 10,
          total: contentsResult.documents?.totalResults || 0
        });
        setBreadcrumbs(breadcrumbsResult || []);
      }
    } catch (error) {
      console.error('Failed to fetch folder contents:', error);
      message.error('Không thể tải nội dung thư mục');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const result = await getDocuments({
        page,
        limit: pageSize,
        title: searchText || undefined,
        status: selectedStatus,
        categoryId: currentFolderId || undefined,
        createdBy: currentUser.username,
      });

      if (result && result.results) {
        setDocuments(result.results);
        setPagination({
          current: result.page,
          pageSize: result.limit,
          total: result.totalResults
        });
      }
    } catch (error) {
      message.error('Lỗi tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
  }, [currentFolderId, searchText, selectedStatus, isReference, effectiveDateRange, expirationDateRange]); // Added date ranges

  const handleTableChange = (newPagination: any) => {
    fetchFolderContents(currentFolderId, newPagination.current, newPagination.pageSize);
  };

  const navigateToFolder = (folderId: number | null) => {
    setCurrentFolderId(folderId);
    setPagination({ ...pagination, current: 1 });
  };

  const handleEdit = (id: number) => {
    setSelectedDocId(id);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa tài liệu này? File đính kèm cũng sẽ bị xóa vĩnh viễn.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDocument(id);
          message.success('Đã xóa tài liệu');
          fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Lỗi xóa tài liệu');
        }
      },
    });
  };

  const handleSign = async (record: any) => {
    if (!currentUser.signatureUrl && !currentUser.signatureImage) {
      Modal.confirm({
        title: 'Chưa có chữ ký',
        content: 'Bạn cần cập nhật chữ ký trong phần Hồ sơ cá nhân trước khi thực hiện ký số.',
        okText: 'Đi đến Hồ sơ',
        cancelText: 'Đóng',
        onOk: () => {
          window.location.href = '/settings';
        }
      });
      return;
    }

    if (!record.content) {
      message.error('Tài liệu không có nội dung file');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        message.warning('Phiên làm việc hết hạn, vui lòng đăng nhập lại');
        return;
      }

      message.loading({ content: 'Đang tải tài liệu...', key: 'sign-loading' });

      const filePath = encodeURIComponent(record.content);
      const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${filePath}&inline=true&token=${token}`;

      const response = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch document');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setSignaturePdfUrl(blobUrl);
      setSignatureDocTitle(record.title);
      setSignatureDocId(record.id);
      setSelectedDocumentForSignature(record);
      setSignatureModalVisible(true);
      message.destroy('sign-loading');
    } catch (error: any) {
      console.error('Sign error:', error);
      message.error({ content: `Lỗi: ${error.message || 'Không thể tải tài liệu để ký'}`, key: 'sign-loading' });
    }
  };

  const handleRequestSignature = (record: any) => {
    setSelectedDocumentForRequest(record);
    setSignatureRequestModalVisible(true);
  };

  const handleDownload = async (filePath: string) => {
    if (!filePath) {
      message.warning('File không tồn tại');
      return;
    }

    try {
      const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(filePath)}&token=${localStorage.getItem('accessToken')}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('\\').pop() || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Download error:', error);
      message.error('Lỗi tải xuống tài liệu');
    }
  };

  const handleView = (record: any) => {
    if (record.content) {
      const token = localStorage.getItem('accessToken');
      const viewUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&inline=true${token ? `&token=${token}` : ''}`;
      const ext = record.content.split('.').pop() || '';
      const fullFileName = record.title.toLocaleLowerCase().endsWith(ext.toLowerCase())
        ? record.title
        : `${record.title}.${ext}`;

      setPreviewUrl(viewUrl);
      setPreviewName(fullFileName);
      setSelectedDocId(record.id);
      setPreviewVisible(true);
    } else {
      const isOwner = record.createdBy === currentUser.username;
      const canEdit = isOwner || currentUser.role === 'ADMIN';

      if (canEdit) {
        handleEdit(record.id);
      } else {
        message.warning('Tài liệu chưa có file đính kèm');
      }
    }
  };

  const openSubmitModal = async (id: number) => {
    setSelectedDocId(id);
    setSubmitType(1);
    setSelectedSigners([]);
    setSubmitNote('');
    setSubmitModalVisible(true);

    try {
      const res = await getUsers({ limit: 1000 });
      setUsers(res.results.filter((u: any) => u.id !== currentUser.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnifiedSubmit = async () => {
    if (!selectedDocId) return;

    try {
      if (submitType === 1) {
        await submitDocument(selectedDocId);
        message.success('Đã gửi yêu cầu duyệt');
      } else {
        if (selectedSigners.length === 0) {
          message.error('Vui lòng chọn ít nhất 1 người ký');
          return;
        }
        await createSignatureRequest(selectedDocId, selectedSigners, submitNote);
        message.success('Đã gửi yêu cầu ký');
      }
      setSubmitModalVisible(false);
      fetchDocuments(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error(error);
      message.error('Có lỗi xảy ra khi gửi yêu cầu');
    }
  };

  const getFolderMenuItems = (folder: any): MenuProps['items'] => {
    const isOwner = folder.createdBy === currentUser.username;
    const isManagerOfDept = currentUser.role === 'MANAGER' && folder.departmentId === currentUser.departmentId;
    const canEdit = isOwner || currentUser.role === 'ADMIN' || isManagerOfDept;

    const items: any[] = [
      { key: 'open', label: 'Mở', icon: <FolderOpenOutlined />, onClick: () => navigateToFolder(folder.id) }
    ];

    if (canEdit) {
      items.push({ type: 'divider' });
      items.push({ key: 'edit', label: 'Sửa', icon: <EditOutlined />, onClick: () => handleEditCategory(folder) });
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
      const docCount = folder._count?.documents || 0;
      const isEmpty = docCount === 0;

      items.push({
        key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, disabled: !isEmpty,
        onClick: () => handleDeleteCategory(folder), title: !isEmpty ? 'Chỉ có thể xóa thư mục trống' : undefined
      });
    }
    return items;
  };

  const getMenuItems = (record: any): MenuProps['items'] => {
    if (record.type === 'folder') {
      return getFolderMenuItems(record);
    }

    // Permission logic matching DocumentPage
    const isOwner = record.createdBy === currentUser.username;
    const isAdmin = currentUser.role === 'ADMIN';
    const userPermission = record.permissions?.find((p: any) => Number(p.userId) === Number(currentUser.id));
    const isSupervisory = currentUser.department?.isSupervisory;
    const hasDepartmentAccess = record.visibility === 'DEPARTMENT' && (record.departmentId === currentUser.departmentId || isSupervisory);

    const canView = isOwner || isAdmin || userPermission || (record.visibility === 'PUBLIC') || hasDepartmentAccess;
    const isManagerOfDept = currentUser.role === 'MANAGER' && record.departmentId === currentUser.departmentId;
    const canEdit = isOwner || isAdmin || isManagerOfDept || (userPermission?.permission === 'EDIT');
    const canSign = isOwner || isAdmin || (userPermission?.permission === 'SIGN');
    const canDelete = isOwner || isAdmin || isManagerOfDept;

    const items: MenuProps['items'] = [];

    if (canView) {
      items.push({ key: 'view', label: 'Xem', icon: <EyeOutlined />, onClick: () => handleView(record) });
      const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT' || userPermission?.permission === 'SIGN';
      const canDownload = (isAdmin || isOwner || hasExplicitDownload || (record.visibility !== 'PRIVATE' && record.accessLevel !== 'VIEW'));
      if (canDownload) items.push({ key: 'download', label: 'Tải xuống', icon: <DownloadOutlined />, onClick: () => handleDownload(record.content) });
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
      items.push({ key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined />, onClick: () => handleEdit(record.id) });
    }
    if (canSign && !record.isReference) items.push({ key: 'sign', label: 'Ký số', icon: <EditFilled />, onClick: () => handleSign(record) });
    if (canDelete) {
      items.push({ key: 'history', label: 'Lịch sử phiên bản', icon: <HistoryOutlined />, onClick: () => { setSelectedDocumentForHistory(record); setHistoryVisible(true); } });
      items.push({ type: 'divider' });
      items.push({ key: 'delete', label: 'Xóa', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record.id) });
    }
    return items;
  };

  const handleGridDrop = async (item: any, targetFolder: any) => {
    const sourceId = item.id;
    const sourceType = item.type;
    const targetId = targetFolder.id;

    if (sourceType === 'folder' && sourceId === targetId) return;

    setLoading(true);
    try {
      if (sourceType === 'document') {
        const fd = new FormData();
        fd.append('categoryId', String(targetId));
        await updateDocument(sourceId, fd);
        message.success('Đã di chuyển tài liệu');
      } else if (sourceType === 'folder') {
        await moveCategory(sourceId, { newParentId: targetId });
        message.success('Đã di chuyển thư mục');
      }

      if (currentFolderId === null) {
        fetchFolderContents(null, 1, pagination.pageSize);
      } else {
        fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
      }
    } finally {
      setLoading(false);
    }
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
          <Col>
            <Title level={3} style={{ margin: 0 }}>Tài liệu của tôi</Title>
          </Col>
          <Col>
            {(() => {
              const currentFolder = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
              const isVirtual = currentFolderId && currentFolder && !(
                currentUser.role === 'ADMIN' ||
                currentFolder.isGlobal ||
                currentFolder.createdBy === currentUser.username ||
                currentFolder.departmentId === currentUser.departmentId
              );
              const canAdd = !currentFolderId || !isVirtual;

              return (
                <Space>
                  <Segmented
                    value={viewMode}
                    onChange={(value) => handleViewModeChange(value as 'grid' | 'list')}
                    options={[
                      { value: 'list', icon: <BarsOutlined /> },
                      { value: 'grid', icon: <AppstoreOutlined /> },
                    ]}
                  />
                  <Button icon={<FolderFilled />} onClick={handleAddFolder} disabled={!canAdd}>
                    Thêm thư mục
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDocument} disabled={!canAdd}>
                    Thêm tài liệu
                  </Button>
                </Space>
              );
            })()}
          </Col>
        </Row>

        <Card bordered={false} style={{ marginBottom: 16 }}>
          <Breadcrumb style={{ marginBottom: 16 }}>
            <Breadcrumb.Item onClick={() => navigateToFolder(null)} style={{ cursor: 'pointer' }}>
              <HomeOutlined /> Trang chủ / Hồ sơ của tôi
            </Breadcrumb.Item>
            {breadcrumbs.map((crumb) => (
              <Breadcrumb.Item
                key={crumb.id}
                onClick={() => navigateToFolder(crumb.id)}
                style={{ cursor: 'pointer' }}
              >
                {crumb.name}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>

          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <Input
                placeholder="Tìm kiếm theo tiêu đề..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="Loại tài liệu"
                style={{ width: '100%' }}
                allowClear
                onChange={(value) => setIsReference(value)}
                value={isReference}
              >
                <Select.Option value="false">Tài liệu chính thức</Select.Option>
                <Select.Option value="true">Tài liệu tham khảo</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="Chọn trạng thái"
                style={{ width: '100%' }}
                value={selectedStatus}
                onChange={setSelectedStatus}
                allowClear
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <Select.Option key={value} value={value}>
                    {label}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                placeholder={['Từ ngày hiệu lực', 'Đến ngày hiệu lực']}
                style={{ width: '100%' }}
                onChange={(dates) => setEffectiveDateRange(dates)}
                value={effectiveDateRange}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                placeholder={['Từ ngày hết hạn', 'Đến ngày hết hạn']}
                style={{ width: '100%' }}
                onChange={(dates) => setExpirationDateRange(dates)}
                value={expirationDateRange}
              />
            </Col>
          </Row>
        </Card>

        {viewMode === 'grid' ? (
          <div style={{ minHeight: 'calc(100vh - 350px)' }}>
            <Row gutter={[16, 16]}>
              {/* Folders first */}
              {folders.map(folder => (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={folder.id}>
                  <FolderCard
                    key={`folder-${folder.id}`}
                    folder={folder}
                    menuItems={getFolderMenuItems(folder)}
                    onDoubleClick={() => navigateToFolder(folder.id)}
                    canDrag={currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || folder.createdBy === currentUser.username}
                    onDropItem={(item) => handleGridDrop(item, folder)}
                  />
                </Col>
              ))}
              {/* Then documents */}
              {documents.map(doc => (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={doc.id}>
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    menuItems={getMenuItems(doc)}
                    canDrag={currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || doc.createdBy === currentUser.username}
                  />
                </Col>
              ))}
            </Row>
            {!loading && folders.length === 0 && documents.length === 0 && (<div style={{ textAlign: 'center', padding: '100px 0', color: '#8c8c8c' }}>Thư mục trống</div>)}
          </div>
        ) : (
          <Card bordered={false}>
            <Table
              columns={listColumns as any}
              dataSource={[...folders.map(f => ({ ...f, type: 'folder' })), ...documents.map(d => ({ ...d, type: 'document', name: d.title }))]}
              rowKey={(record) => record.type + '-' + record.id}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => 'Tổng ' + total + ' mục',
              }}
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
                  const isAdmin = currentUser.role === 'ADMIN';
                  const isOwner = record.createdBy === currentUser.username;
                  const isManagerOfDept = currentUser.role === 'MANAGER' && record.departmentId === currentUser.departmentId;
                  canDrag = isAdmin || isOwner || isManagerOfDept;
                } else {
                  const isOwner = record.createdBy === currentUser.username;
                  const isAdmin = currentUser.role === 'ADMIN';
                  const isManagerOfDept = currentUser.role === 'MANAGER' && record.departmentId === currentUser.departmentId;
                  const userPermission = record.permissions?.find((p: any) => Number(p.userId) === Number(currentUser.id));
                  canDrag = isOwner || isAdmin || isManagerOfDept || userPermission?.permission === 'EDIT';
                }
                return {
                  record,
                  onDrop: handleGridDrop,
                  canDrag: canDrag,
                };
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

        <DocumentModal
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          onSuccess={() => {
            setModalVisible(false);
            if (currentFolderId === null) {
              fetchFolderContents(null, 1, pagination.pageSize);
            } else {
              fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
          }}

          documentId={selectedDocId}
          defaultCategoryId={currentFolderId}
        />

        <CategoryModal
          visible={categoryModalVisible}
          onCancel={() => {
            setCategoryModalVisible(false);
            setEditingCategory(null);
          }}
          onSuccess={() => {
            setCategoryModalVisible(false);
            setEditingCategory(null);
            if (currentFolderId === null) {
              fetchFolderContents(null, 1, pagination.pageSize);
            } else {
              fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
          }}
          parentId={currentParentId}
          category={editingCategory}
          isSubFolder={!!currentParentId}
        />

        <Modal
          title="Trình ký văn bản"
          open={submitModalVisible}
          onCancel={() => setSubmitModalVisible(false)}
          onOk={handleUnifiedSubmit}
          okText="Gửi đi"
          cancelText="Hủy"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Typography.Text strong>Chọn loại yêu cầu:</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Radio.Group onChange={(e) => setSubmitType(e.target.value)} value={submitType}>
                  <Radio value={1}>Gửi Lãnh đạo duyệt</Radio>
                  <Radio value={2}>Gửi đồng nghiệp ký nháy / ký số</Radio>
                </Radio.Group>
              </div>
            </div>

            {submitType === 2 && (
              <div>
                <Typography.Text strong>Chọn người ký:</Typography.Text>
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid #d9d9d9', padding: '8px', borderRadius: '4px' }}>
                  <Checkbox.Group
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    onChange={(checkedValues) => setSelectedSigners(checkedValues as number[])}
                    value={selectedSigners}
                  >
                    {users.map(u => (
                      <Checkbox key={u.id} value={u.id}>
                        {u.name || u.username} {u.position ? `(${u.position})` : ''}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              </div>
            )}

            <div>
              <Typography.Text>Ghi chú:</Typography.Text>
              <Input.TextArea
                rows={2}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder="Nhập nội dung ghi chú..."
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        </Modal>

        <FilePreviewModal
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          fileUrl={previewUrl}
          fileName={previewName}
          canDownload={selectedDocId ? (() => {
            const doc = documents.find(d => d.id === selectedDocId);
            if (!doc) return true;

            const isOwner = doc.createdBy === currentUser.username;
            const isAdmin = currentUser.role === 'ADMIN';

            const userPermission = doc.permissions?.find((p: any) => Number(p.userId) === Number(currentUser.id));
            const hasExplicitDownload = userPermission?.permission === 'DOWNLOAD' || userPermission?.permission === 'EDIT';

            return (
              isAdmin ||
              isOwner ||
              hasExplicitDownload ||
              (!userPermission && doc.visibility !== 'PRIVATE')
            );
          })() : true}
        />

        <SignatureRequestModal
          visible={signatureRequestModalVisible}
          documentId={selectedDocumentForRequest?.id}
          onCancel={() => setSignatureRequestModalVisible(false)}
          onSuccess={() => {
            setSignatureRequestModalVisible(false);
            if (currentFolderId === null) {
              fetchFolderContents(null, 1, pagination.pageSize);
            } else {
              fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
          }}
        />

        <PDFSignatureModal
          visible={signatureModalVisible}
          pdfUrl={signaturePdfUrl}
          documentTitle={signatureDocTitle}
          documentId={signatureDocId || 0}
          onCancel={() => setSignatureModalVisible(false)}
          signatureImageUrl={currentUser.signatureImage ? `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(currentUser.signatureImage)}&inline=true&token=${localStorage.getItem('accessToken')}` : ''}
          userName={currentUser.name || currentUser.username} userPosition={currentUser.position || currentUser.role || ''}
          onConfirm={async (blob: Blob) => {
            if (!signatureDocId) return;
            try {
              const formData = new FormData();
              formData.append('file', blob, signatureDocTitle + '_signed.pdf');
              formData.append('status', 'SIGNED');

              await updateDocument(signatureDocId, formData);

              setSignatureModalVisible(false);
              message.success('Ký văn bản thành công!');
              if (currentFolderId === null) {
                fetchFolderContents(null, 1, pagination.pageSize);
              } else {
                fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
              }
            } catch (error: any) {
              console.error('Sign upload error:', error);
              message.error(error.response?.data?.message || 'Lỗi lưu văn bản đã ký');
            }
          }}
        />

        <VersionHistoryPanel
          visible={historyVisible}
          document={selectedDocumentForHistory}
          onClose={() => setHistoryVisible(false)}
          onRestore={() => {
            setHistoryVisible(false);
            if (currentFolderId === null) {
              fetchFolderContents(null, 1, pagination.pageSize);
            } else {
              fetchFolderContents(currentFolderId, pagination.current, pagination.pageSize);
            }
          }}
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
    </DndProvider >
  );
};

export default MyDocumentsPage;
