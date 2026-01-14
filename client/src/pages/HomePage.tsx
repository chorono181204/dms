import { Card, Row, Col, Statistic, Typography, Table, Tag } from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'

const { Title } = Typography

// Mock data
const mockStats = {
  totalDocuments: 1248,
  pendingApproval: 12,
  pendingSign: 8,
  signedToday: 45,
}

const recentDocuments = [
  {
    id: '1',
    title: 'Báo cáo xét nghiệm BN-2024-001',
    category: 'Xét nghiệm',
    status: 'SIGNED',
    owner: 'Nguyễn Văn A',
    createdAt: '2024-01-15 10:30',
  },
  {
    id: '2',
    title: 'Phiếu khám bệnh BN-2024-002',
    category: 'Khám bệnh',
    status: 'PENDING_APPROVE',
    owner: 'Trần Thị B',
    createdAt: '2024-01-15 09:15',
  },
  {
    id: '3',
    title: 'Kết quả chẩn đoán hình ảnh',
    category: 'Chẩn đoán',
    status: 'PENDING_SIGN',
    owner: 'Lê Văn C',
    createdAt: '2024-01-15 08:45',
  },
  {
    id: '4',
    title: 'Báo cáo phẫu thuật',
    category: 'Phẫu thuật',
    status: 'APPROVED',
    owner: 'Phạm Thị D',
    createdAt: '2024-01-14 16:20',
  },
]

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  PENDING_APPROVE: 'warning',
  APPROVED: 'processing',
  PENDING_SIGN: 'orange',
  SIGNED: 'success',
  ARCHIVED: 'default',
  REJECTED: 'error',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVE: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PENDING_SIGN: 'Chờ ký',
  SIGNED: 'Đã ký',
  ARCHIVED: 'Lưu trữ',
  REJECTED: 'Từ chối',
}

const columns = [
  {
    title: 'Tiêu đề',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: 'Loại',
    dataIndex: 'category',
    key: 'category',
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>
    ),
  },
  {
    title: 'Người tạo',
    dataIndex: 'owner',
    key: 'owner',
  },
  {
    title: 'Thời gian',
    dataIndex: 'createdAt',
    key: 'createdAt',
  },
]

export default function HomePage() {
  return (
    <div>
      <Title level={3}>Trang chủ</Title>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng số tài liệu"
              value={mockStats.totalDocuments}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chờ phê duyệt"
              value={mockStats.pendingApproval}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chờ ký"
              value={mockStats.pendingSign}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#ff7a00' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Đã ký hôm nay"
              value={mockStats.signedToday}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Documents */}
      <Card title="Tài liệu gần đây" style={{ marginBottom: 24 }}>
        <Table
          dataSource={recentDocuments}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>
    </div>
  )
}


