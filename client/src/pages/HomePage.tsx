import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Typography, Table, Tag } from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { getDashboardStats } from '../api/services/document.service'

const { Title } = Typography



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
    render: (text: string) => text ? new Date(text).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '',
  },
]

export default function HomePage() {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    pendingApproval: 0,
    pendingSign: 0,
    signedToday: 0
  });
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data.stats);
      setRecentDocuments(data.recentDocuments);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={3}>Trang chủ</Title>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="Tổng số tài liệu"
              value={stats.totalDocuments}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="Chờ phê duyệt"
              value={stats.pendingApproval}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="Chờ ký"
              value={stats.pendingSign}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#ff7a00' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="Đã ký hôm nay"
              value={stats.signedToday}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Documents */}
      <Card title="Tài liệu gần đây" style={{ marginBottom: 24 }} loading={loading} bordered={false}>
        <Table
          dataSource={recentDocuments}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}


