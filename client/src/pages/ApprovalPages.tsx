import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  Input,
  message,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  EditFilled,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getPendingSignatures, getSignatureHistory } from '../api/services/signature.service';
import { getPendingApprovals, approveDocument, rejectDocument, getApprovalHistory } from '../api/services/document.service';
import { PDFSignatureModal } from '../components/PDFSignatureModal';
import { useAuth } from '../contexts/AuthContext';
import FilePreviewModal from '../components/FilePreviewModal';
import { Modal, Form } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getBackendUrl } from '../utils/config';

const { Title } = Typography

const actionColors: Record<string, string> = {
  APPROVED: 'success',
  REJECTED: 'error',
  SIGNED: 'processing',
  DRAFT: 'default',
  PENDING: 'warning',
}

const actionLabels: Record<string, string> = {
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  SIGNED: 'Đã ký',
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ xử lý',
}

interface ApprovalPageProps {
  type: 'pending-sign' | 'history' | 'pending-approve'
}

export default function ApprovalPages({ type }: ApprovalPageProps) {
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false);

  // Data State
  const [data, setData] = useState<any[]>([]);

  // Signature State
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureDocTitle, setSignatureDocTitle] = useState('');
  const [signatureDocId, setSignatureDocId] = useState<number | null>(null);
  const [signaturePdfUrl, setSignaturePdfUrl] = useState('');

  // Preview State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewExtension, setPreviewExtension] = useState('');

  // Approval Modal State
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [approvalForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let res = [];
      if (type === 'pending-sign') {
        res = await getPendingSignatures();
      } else if (type === 'history') {
        // Fetch both signature history and approval history
        const [signatureHistory, approvalHistory] = await Promise.all([
          getSignatureHistory(),
          getApprovalHistory()
        ]);
        res = [...signatureHistory, ...approvalHistory];
      } else if (type === 'pending-approve') {
        res = await getPendingApprovals();
      }

      console.log('Fetched data:', res);

      const formatted = res.map((item: any) => {
        if (type === 'pending-approve') {
          return {
            id: item.id,
            key: item.id,
            title: item.title,
            category: item.category?.name || '---',
            department: item.department?.name || '---',
            owner: item.createdBy,
            requestedAt: new Date(item.updatedAt).toLocaleString(),
            status: item.status,
            note: item.description || '',
            patientId: item.code || '---',
            content: item.content
          };
        }

        // Handle both signature history (nested) and approval history (flat)
        const doc = item.document || item; // If item.document exists, use it; otherwise item is already the document
        const isSignatureHistory = !!item.document;

        return {
          id: doc.id,
          key: item.id,
          title: doc.title,
          category: doc.category?.name || '---',
          department: doc.department?.name || '---',
          owner: doc.createdBy,
          requestedAt: isSignatureHistory
            ? new Date(item.requestedAt).toLocaleString()
            : new Date(doc.updatedAt).toLocaleString(),
          signedAt: item.signedAt ? new Date(item.signedAt).toLocaleString() : null,
          status: item.status || item.action, // signature uses 'status', approval uses 'action'
          note: item.note || item.actionDescription || '',
          patientId: doc.code || '---',
          content: doc.content
        }
      });
      setData(formatted);
    } catch (error) {
      console.error(error);
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const getColumns = (): ColumnsType<any> => {
    const baseColumns: ColumnsType<any> = [
      {
        title: 'Tiêu đề',
        dataIndex: 'title',
        key: 'title',
        width: 250,
        ellipsis: true,
      },
      {
        title: 'Mã số',
        dataIndex: 'patientId',
        key: 'patientId',
        width: 120,
      },
      {
        title: 'Loại',
        dataIndex: 'category',
        key: 'category',
        width: 120,
      },
      {
        title: 'Khoa',
        dataIndex: 'department',
        key: 'department',
        width: 150,
      },
    ]

    if (type === 'pending-sign') {
      return [
        ...baseColumns,
        {
          title: 'Người gửi',
          dataIndex: 'owner',
          key: 'owner',
          width: 120,
        },
        {
          title: 'Ngày yêu cầu',
          dataIndex: 'requestedAt',
          key: 'requestedAt',
          width: 150,
        },
        {
          title: 'Ghi chú',
          dataIndex: 'note',
          key: 'note',
          width: 150,
          ellipsis: true,
        },
        {
          title: 'Thao tác',
          key: 'action',
          width: 150,
          fixed: 'right',
          render: (_, record) => (
            <Space size="small">
              <Button
                type="link"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => handleView(record)}
              >
                Xem
              </Button>
              <Button
                type="primary"
                icon={<EditFilled />}
                size="small"
                onClick={() => handleSign(record)}
              >
                Ký
              </Button>
            </Space>
          ),
        },
      ]
    }

    if (type === 'pending-approve') {
      return [
        ...baseColumns,
        {
          title: 'Người tạo',
          dataIndex: 'owner',
          key: 'owner',
          width: 120,
        },
        {
          title: 'Ngày cập nhật',
          dataIndex: 'requestedAt',
          key: 'requestedAt',
          width: 150,
        },
        {
          title: 'Trạng thái',
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (status: string) => (
            <Tag color={actionColors[status] || 'default'}>{actionLabels[status] || status}</Tag>
          ),
        },
        {
          title: 'Thao tác',
          key: 'action',
          width: 200,
          fixed: 'right',
          render: (_, record) => (
            <Space size="small">
              <Button
                type="link"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => handleView(record)}
              />
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  Modal.confirm({
                    title: 'Xác nhận phê duyệt',
                    content: 'Bạn có chắc chắn muốn phê duyệt tài liệu này?',
                    okText: 'Duyệt',
                    cancelText: 'Hủy',
                    onOk: async () => {
                      try {
                        await approveDocument(record.id, '');
                        message.success('Đã phê duyệt tài liệu');
                        fetchData();
                      } catch (error) {
                        console.error(error);
                        message.error('Có lỗi xảy ra');
                      }
                    }
                  });
                }}
              />
              <Button
                danger
                icon={<CloseCircleOutlined />}
                size="small"
                onClick={() => {
                  setSelectedDocId(record.id);
                  setApprovalAction('reject');
                  approvalForm.resetFields();
                  setApprovalModalVisible(true);
                }}
              />
            </Space>
          ),
        },
      ]
    }

    // history
    return [
      ...baseColumns,
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: string) => (
          <Tag color={actionColors[status] || 'default'}>{actionLabels[status] || status}</Tag>
        ),
      },
      {
        title: 'Ngày ký/xử lý',
        dataIndex: 'signedAt',
        key: 'signedAt',
        width: 150,
      },
      {
        title: 'Ghi chú',
        dataIndex: 'note',
        key: 'note',
        width: 200,
        ellipsis: true,
      },
      {
        title: 'Thao tác',
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>
            Xem
          </Button>
        ),
      },
    ]
  }

  const handleView = async (doc: any) => {
    if (!doc.content) {
      message.error('Tài liệu không có nội dung để xem');
      return;
    }

    const hide = message.loading('Đang tải tài liệu...', 0);
    try {
      const filePath = encodeURIComponent(doc.content);
      const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&inline=true';
      const token = localStorage.getItem('accessToken');

      const response = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      setPreviewUrl(blobUrl);
      setPreviewName(doc.title);
      // Extract extension from the original file path
      const extension = doc.content.split('.').pop();
      setPreviewExtension(extension ? '.' + extension : '');
      setPreviewVisible(true);
    } catch (error) {
      console.error('Error viewing document:', error);
      message.error('Không thể tải tài liệu để xem');
    } finally {
      hide();
    }
  };

  const handleSign = async (doc: any) => {
    // Check if user has signature
    if (!user?.signatureImage) {
      message.warning('Vui lòng tải lên chữ ký của bạn trong trang Hồ sơ trước khi ký văn bản');
      return;
    }

    if (!doc.content) {
      message.error('Tài liệu không có nội dung để ký');
      return;
    }

    try {
      // Fetch PDF for signing
      const filePath = encodeURIComponent(doc.content);
      const url = `${getBackendUrl()}/v1/upload/download?path=` + filePath + '&inline=true';

      const token = localStorage.getItem('accessToken');
      const response = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setSignaturePdfUrl(pdfUrl);
      setSignatureDocId(doc.id);
      setSignatureDocTitle(doc.title);
      setSignatureModalVisible(true);
    } catch (error) {
      console.error('Error preparing document for signature:', error);
      message.error('Không thể tải tài liệu để ký. Vui lòng thử lại sau.');
    }
  }

  const filteredData = data.filter((doc) =>
    doc.title.toLowerCase().includes(searchText.toLowerCase()) ||
    doc.patientId?.toLowerCase().includes(searchText.toLowerCase())
  )

  const getTitle = () => {
    switch (type) {
      case 'pending-sign':
        return 'Chờ tôi ký'
      case 'pending-approve':
        return 'Chờ tôi duyệt'
      case 'history':
        return 'Lịch sử xử lý'
      default:
        return ''
    }
  }

  return (
    <div>
      <Title level={3}>{getTitle()}</Title>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Tìm kiếm theo tiêu đề, mã số..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={getColumns()}
          dataSource={filteredData}
          rowKey="key"
          scroll={{ x: 1200 }}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => 'Tổng ' + total + ' tài liệu',
          }}
        />
        <Modal
          title={approvalAction === 'approve' ? "Phê duyệt tài liệu" : "Từ chối tài liệu"}
          open={approvalModalVisible}
          onCancel={() => setApprovalModalVisible(false)}
          onOk={async () => {
            try {
              const values = await approvalForm.validateFields();
              if (!selectedDocId) return;

              if (approvalAction === 'approve') {
                await approveDocument(selectedDocId, values.comment);
                message.success('Đã phê duyệt tài liệu');
              } else {
                await rejectDocument(selectedDocId, values.comment);
                message.success('Đã từ chối tài liệu');
              }
              setApprovalModalVisible(false);
              fetchData();
            } catch (error) {
              console.error(error);
              message.error('Có lỗi xảy ra');
            }
          }}
          okText={approvalAction === 'approve' ? "Duyệt" : "Từ chối"}
          cancelText="Hủy"
          okButtonProps={{ danger: approvalAction === 'reject' }}
        >
          <Form form={approvalForm} layout="vertical">
            <Form.Item
              name="comment"
              label={approvalAction === 'approve' ? "Ghi chú (tùy chọn)" : "Lý do từ chối"}
              rules={approvalAction === 'reject' ? [{ required: true, message: 'Vui lòng nhập lý do từ chối' }] : []}
            >
              <Input.TextArea rows={4} placeholder={approvalAction === 'approve' ? "Ghi chú thêm (nếu có)..." : "Nhập lý do từ chối..."} />
            </Form.Item>
          </Form>
        </Modal>
      </Card>

      <PDFSignatureModal
        visible={signatureModalVisible}
        pdfUrl={signaturePdfUrl}
        signatureImageUrl={user?.signatureImage ? `${getBackendUrl()}/v1/upload/download?path=` + encodeURIComponent(user.signatureImage) + '&inline=true' : ''}
        documentTitle={signatureDocTitle}
        userName={user?.name || user?.username || ''}
        userPosition={user?.position || user?.role || ''}
        onCancel={() => setSignatureModalVisible(false)}
        onConfirm={async (signedPdfBlob: Blob) => {
          if (!signatureDocId) return;

          try {
            const formData = new FormData();
            formData.append('file', signedPdfBlob, signatureDocTitle + '_signed.pdf');
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
              message.success('Ký văn bản thành công!');
              setSignatureModalVisible(false);
              fetchData(); // Refresh list (works for both pending and history if we were implementing auto-refresh on history, but main use case is pending list refresh)
            } else {
              message.error('Lỗi lưu văn bản đã ký');
            }
          } catch (error) {
            console.error('Error uploading signed PDF:', error);
            message.error('Lỗi upload văn bản đã ký');
          }
        }}
      />
      <FilePreviewModal
        visible={previewVisible}
        fileUrl={previewUrl}
        fileName={previewName}
        fileExtension={previewExtension}
        onClose={() => {
          setPreviewVisible(false);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl('');
        }}
      />
    </div>
  )
}

