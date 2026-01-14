
import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, message, Modal, Tag, Card, Row, Col, Typography, Select, Tooltip, Dropdown } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    DownloadOutlined,
    EyeOutlined,
    EditFilled,
    MoreOutlined,
    HistoryOutlined,
    SendOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import { getDocuments, deleteDocument } from '../api/services/document.service';
import { getCategories } from '../api/services/category.service';
import DocumentModal from '../components/DocumentModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { PDFSignatureModal } from '../components/PDFSignatureModal';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import SignatureRequestModal from '../components/SignatureRequestModal';
import { getBackendUrl } from '../utils/config';

const { Title } = Typography;

interface Document {
    id: number;
    title: string;
    code: string | null;
    status: string;
    department?: {
        name: string;
    };
    category?: {
        name: string;
    };
    content: string; // File path
    createdBy: string;
    updatedBy?: string;
    visibility: string;
    accessLevel: string;
    createdAt: string;
    permissions?: any[]; // Added for permission check
    departmentId?: number; // Added for department access check
}

const statusLabels: Record<string, string> = {
    DRAFT: 'Bản nháp',
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    SIGNED: 'Đã ký',
    ARCHIVED: 'Lưu trữ',
    REJECTED: 'Từ chối',
};

const statusColors: Record<string, string> = {
    DRAFT: 'default',
    PENDING: 'orange',
    APPROVED: 'green',
    SIGNED: 'blue',
    ARCHIVED: 'default',
    REJECTED: 'red',
};

const DocumentPage: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
    const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
    const [categories, setCategories] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Initialize selectedDepartment with user's department for non-admin users
    const [selectedDepartment, setSelectedDepartment] = useState<number | undefined>(
        user.role !== 'ADMIN' ? user.departmentId : undefined
    );

    // Pagination
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

    // Preview State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState('');
    const [selectedDocumentForPreview, setSelectedDocumentForPreview] = useState<Document | null>(null); // Added

    // Signature State
    const [signatureModalVisible, setSignatureModalVisible] = useState(false);
    const [signaturePdfUrl, setSignaturePdfUrl] = useState<string>('');
    const [signatureDocTitle, setSignatureDocTitle] = useState<string>('');
    const [signatureDocId, setSignatureDocId] = useState<number | null>(null);
    const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<Document | null>(null); // Added

    // Version History State
    const [historyVisible, setHistoryVisible] = useState(false);
    const [selectedDocumentForHistory, setSelectedDocumentForHistory] = useState<any>(null);

    // Signature Request State
    const [signatureRequestModalVisible, setSignatureRequestModalVisible] = useState(false); // Added
    const [selectedDocumentForRequest, setSelectedDocumentForRequest] = useState<Document | null>(null); // Added

    const fetchCategories = async () => {
        try {
            const result = await getCategories({ isActive: true, limit: 100, departmentId: user.departmentId });
            setCategories(result.results || []);
        } catch (error) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchDepartments = async () => {
        try {
            const { getDepartments } = await import('../api/services/department.service');
            const result = await getDepartments({ limit: 100 });
            setDepartments(result.results || []);
        } catch (error) {
            console.error('Failed to fetch departments');
        }
    };

    const fetchDocuments = async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const result = await getDocuments({
                page,
                limit,
                title: searchText || undefined,
                status: selectedStatus,
                categoryId: selectedCategory,
                departmentId: selectedDepartment,
            });

            if (result && result.results) {
                setDocuments(result.results);
                setPagination({
                    current: result.page,
                    pageSize: result.limit,
                    total: result.totalResults
                });
            } else {
                setDocuments([]);
            }
        } catch (error) {
            message.error('Lỗi tải danh sách tài liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
        if (user.role === 'ADMIN') {
            fetchDepartments();
        }
    }, []);

    useEffect(() => {
        fetchDocuments(1, pagination.pageSize);
    }, [searchText, selectedStatus, selectedCategory, selectedDepartment]);

    const handleTableChange = (newPagination: any) => {
        fetchDocuments(newPagination.current, newPagination.pageSize);
    };

    const handleAdd = () => {
        setSelectedDocId(null);
        setModalVisible(true);
    };

    const handleEdit = (record: Document) => {
        setSelectedDocId(record.id);
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
                    fetchDocuments(pagination.current, pagination.pageSize);
                } catch (error: any) {
                    message.error(error.response?.data?.message || 'Lỗi xóa tài liệu');
                }
            },
        });
    };

    const handleView = (record: Document) => {
        const filePath = encodeURIComponent(record.content);
        // Using string concatenation to avoid potential backtick issues
        const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&inline=true';

        setSelectedDocumentForPreview(record);
        setPreviewUrl(url);
        setPreviewName(record.title);
        setPreviewVisible(true);
    };

    const handleDownload = (record: Document) => {
        const filePath = encodeURIComponent(record.content);
        const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath;
        window.location.href = url;
    };

    const handleSign = async (record: Document) => {
        // Check if user has signature
        if (!user.signatureImage) {
            message.warning('Vui lòng tải lên chữ ký của bạn trong trang Hồ sơ trước khi ký văn bản');
            return;
        }

        try {
            // Use the same endpoint as handleView (which works!)
            const filePath = encodeURIComponent(record.content);
            // Using string concatenation to avoid potential backtick issues
            const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&inline=true';
            console.log('Fetching PDF from:', url);

            const token = localStorage.getItem('accessToken');
            const response = await fetch(url, {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            });

            console.log('PDF Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('PDF fetch error:', errorText);
                throw new Error('Failed to fetch PDF: ' + response.status + ' - ' + errorText);
            }

            // Create blob URL from response
            const pdfBlob = await response.blob();
            console.log('PDF Blob size:', pdfBlob.size, 'type:', pdfBlob.type);

            const pdfUrl = URL.createObjectURL(pdfBlob);

            setSignaturePdfUrl(pdfUrl);
            setSignatureDocTitle(record.title);
            setSignatureDocId(record.id);
            setSignatureModalVisible(true);
        } catch (error) {
            console.error('Error preparing document for signature:', error);
            message.error('Không thể tải tài liệu để ký. Vui lòng thử lại sau.');
        }
    };

    const handleRequestSignature = (record: Document) => {
        setSelectedDocumentForRequest(record);
        setSignatureRequestModalVisible(true);
    };



    const handleSignatureConfirm = async (signedPdfBlob: Blob) => {
        if (!signatureDocId) return;

        try {
            // Upload signed PDF back to server
            const formData = new FormData();
            formData.append('file', signedPdfBlob, signatureDocTitle + '_signed.pdf');
            // Add status 'SIGNED' to satisfy "body must have at least 1 key" validation
            formData.append('status', 'SIGNED');

            const token = localStorage.getItem('accessToken');
            const url = `${getBackendUrl()}/v1/documents/` + signatureDocId;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer ' + token,
                },
                body: formData,
            });

            if (response.ok) {
                // message.success('Ký văn bản thành công!'); // Handled by Modal
                setSignatureModalVisible(false);
                fetchDocuments(pagination.current, pagination.pageSize);
            } else {
                message.error('Lỗi lưu văn bản đã ký');
            }
        } catch (error) {
            console.error('Error uploading signed PDF:', error);
            message.error('Lỗi upload văn bản đã ký');
        }
    };

    const columns: ColumnsType<Document> = [
        {
            title: 'Số/Ký hiệu',
            dataIndex: 'code',
            key: 'code',
            width: 150,
            render: (text) => <b>{text || '---'}</b>
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            width: 300,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => (
                <Tag color={statusColors[status] || 'default'}>
                    {statusLabels[status] || status}
                </Tag>
            )
        },
        {
            title: 'Quyền hạn',
            key: 'permission',
            width: 120,
            render: (_, record) => {
                // Check user's permission on this document
                const isOwner = record.createdBy === user.username;
                const isAdmin = user.role === 'ADMIN';

                if (isOwner || isAdmin) {
                    return <Tag color="green">Toàn quyền</Tag>;
                }

                // Check explicit permission
                const userPermission = record.permissions?.find((p: any) => p.userId === user.id);
                if (userPermission) {
                    const permLabels: any = {
                        'VIEW': 'Chỉ xem',
                        'EDIT': 'Chỉnh sửa',
                        'SIGN': 'Ký',
                        'APPROVE': 'Phê duyệt'
                    };
                    const permColors: any = {
                        'VIEW': 'blue',
                        'EDIT': 'orange',
                        'SIGN': 'purple',
                        'APPROVE': 'cyan'
                    };
                    return <Tag color={permColors[userPermission.permission]}>{permLabels[userPermission.permission]}</Tag>;
                }

                // Department access
                if (record.visibility === 'DEPARTMENT' && record.departmentId === user.departmentId) {
                    return <Tag color="blue">Chỉ xem</Tag>;
                }

                return <Tag color="default">Không có quyền</Tag>;
            }
        },
        {
            title: 'Loại tài liệu',
            key: 'category',
            width: 150,
            render: (_, record) => record.category?.name || '---'
        },
        {
            title: 'Phòng ban',
            key: 'department',
            width: 150,
            render: (_, record) => record.department?.name || '---'
        },
        {
            title: 'Người tạo',
            dataIndex: 'createdBy',
            key: 'createdBy',
            width: 120,
        },
        {
            title: 'Người cập nhật',
            dataIndex: 'updatedBy',
            key: 'updatedBy',
            width: 120,
            render: (text) => text || '---'
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 200,
            fixed: 'right',
            render: (_, record) => {
                // Check user's actual permissions
                const isOwner = record.createdBy === user.username;
                const isAdmin = user.role === 'ADMIN';

                // Check explicit permission
                const userPermission = record.permissions?.find((p: any) => p.userId === user.id);
                const hasDepartmentAccess = record.visibility === 'DEPARTMENT' && record.departmentId === user.departmentId;

                // Determine what user can do
                const canView = isOwner || isAdmin || userPermission || hasDepartmentAccess;
                const canEdit = isOwner || isAdmin || (userPermission?.permission === 'EDIT');
                const canSign = isOwner || isAdmin || (userPermission?.permission === 'SIGN');
                const canDelete = isOwner || isAdmin || user.role === 'MANAGER'; // Only Admin, Manager, or Owner can delete (and view history as per request)

                // Dropdown menu items
                const menuItems: any[] = [];

                if (canEdit) {
                    menuItems.push({
                        key: 'edit',
                        label: 'Chỉnh sửa',
                        icon: <EditOutlined />,
                        onClick: () => handleEdit(record)
                    });
                }

                if (canDelete) {
                    menuItems.push({
                        key: 'delete',
                        label: 'Xóa',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleDelete(record.id)
                    });
                }

                return (
                    <Space size="small">
                        {canView && (
                            <>
                                <Tooltip title="Xem">
                                    <Button
                                        type="text"
                                        icon={<EyeOutlined />}
                                        size="small"
                                        onClick={() => handleView(record)}
                                        style={{ color: '#1890ff' }}
                                    />
                                </Tooltip>
                                <Tooltip title="Tải xuống">
                                    <Button
                                        type="text"
                                        icon={<DownloadOutlined />}
                                        size="small"
                                        onClick={() => handleDownload(record)}
                                        style={{ color: '#1890ff' }}
                                    />
                                </Tooltip>
                            </>
                        )}
                        {canEdit && (
                            <Tooltip title="Trình ký">
                                <Button
                                    type="text"
                                    icon={<SendOutlined />}
                                    size="small"
                                    onClick={() => handleRequestSignature(record)}
                                    style={{ color: '#1890ff' }}
                                />
                            </Tooltip>
                        )}
                        {canSign && (
                            <Tooltip title="Ký số">
                                <Button
                                    type="text"
                                    icon={<EditFilled />}
                                    size="small"
                                    onClick={() => handleSign(record)}
                                    style={{ color: '#1890ff' }}
                                />
                            </Tooltip>
                        )}
                        {menuItems.length > 0 && (
                            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                                <Button type="text" icon={<MoreOutlined />} size="small" style={{ color: '#1890ff' }} />
                            </Dropdown>
                        )}
                        {canDelete && (
                            <Tooltip title="Lịch sử phiên bản">
                                <Button
                                    type="text"
                                    icon={<HistoryOutlined />}
                                    size="small"
                                    onClick={() => {
                                        setSelectedDocumentForHistory(record);
                                        setHistoryVisible(true);
                                    }}
                                    style={{ color: '#1890ff' }}
                                />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        }
    ];

    return (
        <div>
            <Title level={3}>Kho tài liệu số</Title>

            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={6}>
                        <Input
                            placeholder="Tìm kiếm tài liệu..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Chọn danh mục"
                            style={{ width: '100%' }}
                            allowClear
                            onChange={(value) => setSelectedCategory(value)}
                        >
                            {categories.map(cat => (
                                <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Chọn trạng thái"
                            style={{ width: '100%' }}
                            allowClear
                            onChange={(value) => setSelectedStatus(value)}
                        >
                            {Object.entries(statusLabels).map(([value, label]) => (
                                <Select.Option key={value} value={value}>{label}</Select.Option>
                            ))}
                        </Select>
                    </Col>
                    {user.role === 'ADMIN' && (
                        <Col xs={24} sm={12} md={6}>
                            <Select
                                placeholder="Lọc theo Khoa/Phòng"
                                style={{ width: '100%' }}
                                allowClear
                                onChange={(value) => setSelectedDepartment(value)}
                            >
                                {departments.map(dept => (
                                    <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
                                ))}
                            </Select>
                        </Col>
                    )}
                    <Col xs={24} sm={12} md={6}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block>
                            Thêm tài liệu
                        </Button>
                    </Col>
                </Row>
            </Card>

            <Card>
                <Table
                    columns={columns}
                    dataSource={documents}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => 'Tổng ' + total + ' tài liệu',
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            <DocumentModal
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSuccess={() => {
                    setModalVisible(false);
                    fetchDocuments(pagination.current, pagination.pageSize);
                }}
                documentId={selectedDocId}
            />

            {/* Signature Request Modal */}
            <SignatureRequestModal
                visible={signatureRequestModalVisible}
                documentId={selectedDocumentForRequest?.id}
                onCancel={() => setSignatureRequestModalVisible(false)}
                onSuccess={() => {
                    // Maybe refresh list to show updated status?
                    // Currently status is tracked in SignatureRequest table, not heavily on Doc table unless we join
                    fetchDocuments(pagination.current, pagination.pageSize);
                }}
            />

            <FilePreviewModal
                visible={previewVisible}
                fileUrl={previewUrl}
                fileName={previewName}
                onClose={() => setPreviewVisible(false)}
            />

            <PDFSignatureModal
                visible={signatureModalVisible}
                pdfUrl={signaturePdfUrl}
                signatureImageUrl={`${getBackendUrl()}/v1/upload/download?path=` + encodeURIComponent(user.signatureImage || '') + '&inline=true'}
                documentTitle={signatureDocTitle}
                userName={user.name || user.username}
                userPosition={user.position || user.role || ''}
                onCancel={() => setSignatureModalVisible(false)}
                onConfirm={handleSignatureConfirm}
            />

            {selectedDocumentForHistory && (
                <VersionHistoryPanel
                    visible={historyVisible}
                    onClose={() => {
                        setHistoryVisible(false);
                        setSelectedDocumentForHistory(null);
                    }}
                    documentId={selectedDocumentForHistory.id}
                    canEdit={
                        user?.role === 'ADMIN' ||
                        selectedDocumentForHistory.createdBy === user?.username ||
                        selectedDocumentForHistory.permissions?.some((p: any) => p.userId === user?.id && p.permission === 'EDIT')
                    }
                    onRestore={() => fetchDocuments(pagination.current, pagination.pageSize)}
                />
            )}
        </div >
    );
};

export default DocumentPage;
