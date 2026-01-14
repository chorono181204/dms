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
} from 'antd';
import { SearchOutlined, DownloadOutlined, EditOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getDocuments, submitDocument } from '../api/services/document.service';
import { createSignatureRequest } from '../api/services/signature.service';
import { getUsers } from '../api/services/user.service';
import { getCategories } from '../api/services/category.service';
import DocumentModal from '../components/DocumentModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { getBackendUrl } from '../utils/config';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'orange',
  APPROVED: 'green',
  SIGNED: 'blue',
  ARCHIVED: 'default',
  REJECTED: 'red',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  SIGNED: 'Đã ký',
  ARCHIVED: 'Lưu trữ',
  REJECTED: 'Từ chối',
};

const MyDocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [categories, setCategories] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

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

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchCategories = async () => {
    try {
      const result = await getCategories({ isActive: true, limit: 100, departmentId: currentUser.departmentId });
      setCategories(result.results || []);
    } catch (error) {
      console.error('Failed to fetch categories');
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
        categoryId: selectedCategory,
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
    fetchDocuments(1, pagination.pageSize);
  }, [searchText, selectedStatus, selectedCategory]);

  const handleTableChange = (newPagination: any) => {
    fetchDocuments(newPagination.current, newPagination.pageSize);
  };

  const handleEdit = (id: number) => {
    setSelectedDocId(id);
    setModalVisible(true);
  };

  const handleDownload = (path: string) => {
    if (path && path.includes('G:\\')) {
      const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(path)}`;
      window.location.href = downloadUrl;
    } else {
      message.warning('File không tồn tại');
    }
  };

  const handleView = (record: any) => {
    if (record.content && record.content.includes('G:\\')) {
      const viewUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(record.content)}&inline=true`;
      const ext = record.content.split('.').pop() || '';
      const fullFileName = record.title.toLocaleLowerCase().endsWith(ext.toLowerCase())
        ? record.title
        : `${record.title}.${ext}`;

      setPreviewUrl(viewUrl);
      setPreviewName(fullFileName);
      setPreviewVisible(true);
    } else {
      message.warning('File không tồn tại');
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
      title: 'Loại tài liệu',
      key: 'category',
      width: 150,
      render: (_, record) => record.category?.name || '---'
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString('vi-VN')
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} size="small" onClick={() => handleView(record)} />
          <Button type="link" icon={<DownloadOutlined />} size="small" onClick={() => handleDownload(record.content)} />
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record.id)} />
          {(record.status === 'DRAFT' || record.status === 'REJECTED') && (
            <Button type="link" icon={<SendOutlined />} size="small" onClick={() => openSubmitModal(record.id)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Tài liệu của tôi</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Tìm kiếm theo tiêu đề..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
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
          <Col xs={24} sm={12} md={8} lg={6}>
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
        </Row>
      </Card>

      <Card>
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
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} tài liệu`,
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
        onCancel={() => setPreviewVisible(false)}
        fileUrl={previewUrl}
        fileName={previewName}
      />
    </div>
  );
};

export default MyDocumentsPage;
