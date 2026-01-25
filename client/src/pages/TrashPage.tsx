import React, { useEffect, useState } from 'react';
import {
    Table,
    Button,
    Space,
    Tag,
    Typography,
    Card,
    message,
    Modal,
    Tooltip,
} from 'antd';
import {
    RestOutlined,
    UndoOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getTrashedDocuments, restoreDocument, permanentlyDeleteDocument } from '../api/services/document.service';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

import { useAuth } from '../contexts/AuthContext';

const TrashPage: React.FC = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    const fetchTrashedDocuments = async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const result = await getTrashedDocuments({
                page,
                limit: pageSize,
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
            message.error('Lỗi tải danh sách thùng rác');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrashedDocuments();
    }, []);

    const handleRestore = async (id: number) => {
        try {
            await restoreDocument(id);
            message.success('Đã khôi phục tài liệu');
            fetchTrashedDocuments(pagination.current, pagination.pageSize);
        } catch (error) {
            message.error('Lỗi khôi phục tài liệu');
        }
    };

    const handlePermanentDelete = (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa vĩnh viễn',
            content: 'Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa vĩnh viễn tài liệu này?',
            okText: 'Xóa vĩnh viễn',
            cancelText: 'Hủy',
            okType: 'danger',
            onOk: async () => {
                try {
                    await permanentlyDeleteDocument(id);
                    message.success('Đã xóa vĩnh viễn tài liệu');
                    fetchTrashedDocuments(pagination.current, pagination.pageSize);
                } catch (error) {
                    message.error('Lỗi xóa vĩnh viễn');
                }
            },
        });
    };

    const columns: ColumnsType<any> = [
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
            ellipsis: true,
        },
        {
            title: 'Khoa/Phòng',
            dataIndex: ['department', 'name'],
            key: 'department',
            width: 150,
            render: (text) => text || '---'
        },
        {
            title: 'Người xóa',
            dataIndex: 'createdBy',
            key: 'createdBy',
            width: 150,
            render: (_, record) => record.createdByName || record.createdBy
        },
        {
            title: 'Ngày xóa',
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            width: 180,
            render: (date) => (
                <span>
                    {dayjs(date).format('DD/MM/YYYY HH:mm')}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Sẽ xóa sau {30 - dayjs().diff(dayjs(date), 'day')} ngày
                    </Text>
                </span>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space size="middle">
                    <Tooltip title="Khôi phục">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<UndoOutlined />}
                            onClick={() => handleRestore(record.id)}
                        />
                    </Tooltip>
                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <Tooltip title="Xóa vĩnh viễn">
                            <Button
                                danger
                                shape="circle"
                                icon={<DeleteOutlined />}
                                onClick={() => handlePermanentDelete(record.id)}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <RestOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                <Title level={3} style={{ marginBottom: 0 }}>Thùng rác</Title>
            </div>

            <Card>
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">
                        * Lưu ý: Tài liệu trong thùng rác sẽ tự động bị xóa vĩnh viễn sau 30 ngày.
                    </Text>
                </div>
                <Table
                    columns={columns}
                    dataSource={documents}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1000 }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        onChange: (page, pageSize) => fetchTrashedDocuments(page, pageSize),
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} tài liệu`,
                    }}
                />
            </Card>
        </div>
    );
};

export default TrashPage;
