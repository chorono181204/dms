import { useState, useEffect } from 'react';
import {
    Table,
    Input,
    Button,
    Space,
    Card,
    Row,
    Col,
    Typography,
    Modal,
    message,
    Tag,
} from 'antd';
import {
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import templateService, { Template } from '../services/template.service';
import TemplateModal from '../components/TemplateModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { getBackendUrl } from '../utils/config';

const { Title } = Typography;

export default function TemplateManagementPage() {
    const [searchText, setSearchText] = useState('');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

    // Preview State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState('');

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);

    // Pagination State
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    // Auth Info
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchTemplates = async (page = 1, limit = 10) => {
        setLoading(true);
        try {
            const result = await templateService.getTemplates({
                page,
                limit,
                // We should probably pass searchText here too if backend supports it in 'name' filter
                name: searchText || undefined,
            });

            if (result && result.results) {
                setTemplates(result.results);
                setPagination({
                    current: result.page,
                    pageSize: result.limit,
                    total: result.totalResults
                });
            } else {
                setTemplates([]); // Fallback
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi tải danh sách mẫu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates(pagination.current, pagination.pageSize);
    }, [searchText]); // Re-fetch when search changes (debounce would be better but this is simple)

    const handleTableChange = (newPagination: any) => {
        fetchTemplates(newPagination.current, newPagination.pageSize);
    };

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
            onOk: async () => {
                try {
                    await templateService.deleteTemplate(id);
                    message.success('Đã xóa mẫu thành công');
                    fetchTemplates(pagination.current, pagination.pageSize);
                } catch (error: any) {
                    message.error(error.response?.data?.message || 'Lỗi xóa mẫu');
                }
            },
        });
    };

    const handleModalSuccess = () => {
        setModalVisible(false);
        fetchTemplates(pagination.current, pagination.pageSize);
    };

    const handleView = (record: Template) => {
        if (record.content && record.content.includes('G:\\')) {
            const viewUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&inline=true&token=${localStorage.getItem('accessToken')}`;

            const ext = record.content.split('.').pop() || '';
            const fullFileName = record.name.toLocaleLowerCase().endsWith(ext.toLowerCase())
                ? record.name
                : `${record.name}.${ext}`;

            setPreviewUrl(viewUrl);
            setPreviewName(fullFileName);
            setPreviewVisible(true);
        } else {
            message.warning('File không tồn tại');
        }
    };

    // Filter local for search -> NO, now we filter on server. 
    // filteredData is just templates now because server returns filtered results.
    const dataSource = templates;

    const columns: ColumnsType<Template> = [
        {
            title: 'Tên mẫu',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'Loại',
            key: 'category',
            width: 120,
            render: (_, record) => record.category?.name || '---',
        },
        {
            title: 'Phòng ban',
            key: 'department',
            width: 150,
            render: (_, record) => record.department?.name || '---',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 100,
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Hoạt động' : 'Tắt'}
                </Tag>
            ),
        },
        {
            title: 'Tạo bởi',
            dataIndex: 'createdBy',
            key: 'createdBy',
            width: 120,
        },
        {
            title: 'Cập nhật bởi',
            dataIndex: 'updatedBy',
            key: 'updatedBy',
            width: 120,
            render: (text) => <span style={{ color: '#888' }}>{text || '---'}</span>
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_, record) => {
                const canEdit = ['ADMIN', 'MANAGER'].includes(user.role) || record.createdBy === user.username;

                return (
                    <Space size="small">
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleView(record)}
                        >
                            Xem
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => {
                                if (record.content && record.content.includes('G:\\')) {
                                    const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&token=${localStorage.getItem('accessToken')}`;
                                    window.location.href = downloadUrl;
                                } else {
                                    message.warning('File không tồn tại');
                                }
                            }}
                        >
                            Tải
                        </Button>
                        {canEdit && (
                            <>
                                <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record.id)}>
                                    Sửa
                                </Button>
                                <Button
                                    type="link"
                                    danger
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    onClick={() => handleDelete(record.id)}
                                >
                                    Xóa
                                </Button>
                            </>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div>
            <Title level={3}>Quản lý mẫu tài liệu</Title>

            {/* Actions */}
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]} justify="space-between" align="middle">
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Input
                            placeholder="Tìm kiếm mẫu..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => {
                                setSearchText(e.target.value);
                                // Reset to page 1 when searching
                                // fetchTemplates(1, pagination.pageSize); // handled by useEffect dependency
                            }}
                            allowClear
                        />
                    </Col>
                    <Col>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Thêm mẫu mới
                        </Button>
                    </Col>
                </Row>
            </Card>

            {/* Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={dataSource}
                    rowKey="id"
                    scroll={{ x: 1200 }}
                    loading={loading}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} mẫu`,
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            {/* Reusable Modal */}
            <TemplateModal
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSuccess={handleModalSuccess}
                templateId={selectedTemplateId}
            />

            <FilePreviewModal
                visible={previewVisible}
                onClose={() => setPreviewVisible(false)}
                fileUrl={previewUrl}
                fileName={previewName}
            />
        </div>
    );
}
