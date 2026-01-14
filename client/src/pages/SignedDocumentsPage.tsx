import { useState } from 'react'
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
} from 'antd'
import { SearchOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

// Mock data - chỉ tài liệu đã ký hoặc lưu trữ
const mockSignedDocuments = [
  {
    id: '1',
    title: 'Báo cáo xét nghiệm BN-2024-001',
    category: 'Xét nghiệm',
    department: 'Khoa Hóa sinh',
    status: 'SIGNED',
    owner: 'Nguyễn Văn A',
    patientId: 'BN-2024-001',
    signedAt: '2024-01-15 11:00',
    signedBy: 'Trưởng khoa Hóa sinh',
  },
  {
    id: '2',
    title: 'Báo cáo phẫu thuật BN-2024-004',
    category: 'Phẫu thuật',
    department: 'Khoa Ngoại',
    status: 'ARCHIVED',
    owner: 'Phạm Thị D',
    patientId: 'BN-2024-004',
    signedAt: '2024-01-14 17:00',
    signedBy: 'Trưởng khoa Ngoại',
  },
  {
    id: '3',
    title: 'Kết quả chẩn đoán hình ảnh BN-2024-003',
    category: 'Chẩn đoán',
    department: 'Khoa Chẩn đoán hình ảnh',
    status: 'SIGNED',
    owner: 'Lê Văn C',
    patientId: 'BN-2024-003',
    signedAt: '2024-01-15 09:30',
    signedBy: 'Trưởng khoa Chẩn đoán',
  },
]

const statusColors: Record<string, string> = {
  SIGNED: 'success',
  ARCHIVED: 'default',
}

const statusLabels: Record<string, string> = {
  SIGNED: 'Đã ký',
  ARCHIVED: 'Lưu trữ',
}

const columns: ColumnsType<any> = [
  {
    title: 'Tiêu đề',
    dataIndex: 'title',
    key: 'title',
    width: 250,
    ellipsis: true,
  },
  {
    title: 'Mã bệnh nhân',
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
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: string) => (
      <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
    ),
  },
  {
    title: 'Người ký',
    dataIndex: 'signedBy',
    key: 'signedBy',
    width: 150,
  },
  {
    title: 'Ngày ký',
    dataIndex: 'signedAt',
    key: 'signedAt',
    width: 150,
  },
  {
    title: 'Thao tác',
    key: 'action',
    width: 150,
    fixed: 'right',
    render: (_, record) => (
      <Space size="small">
        <Button type="link" icon={<EyeOutlined />} size="small">
          Xem
        </Button>
        <Button type="link" icon={<DownloadOutlined />} size="small">
          Tải
        </Button>
      </Space>
    ),
  },
]

export default function SignedDocumentsPage() {
  const [searchText, setSearchText] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>()

  const filteredData = mockSignedDocuments.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchText.toLowerCase()) ||
      doc.patientId.toLowerCase().includes(searchText.toLowerCase())
    const matchesStatus = !selectedStatus || doc.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <Title level={3}>Tài liệu đã ký / Lưu trữ</Title>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Tìm kiếm theo tiêu đề, mã BN..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
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

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} tài liệu`,
          }}
        />
      </Card>
    </div>
  )
}

