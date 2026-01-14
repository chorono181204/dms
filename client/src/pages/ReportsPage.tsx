import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Table,
  Typography,
  Space,
  Statistic,
} from 'antd'
import {
  SearchOutlined,
  DownloadOutlined,
  BarChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

// Mock data
const mockReportData = [
  {
    id: '1',
    department: 'Khoa Hóa sinh',
    category: 'Xét nghiệm',
    totalDocuments: 245,
    signed: 230,
    pending: 15,
    period: 'Tháng 1/2024',
  },
  {
    id: '2',
    department: 'Khoa Nội',
    category: 'Khám bệnh',
    totalDocuments: 189,
    signed: 175,
    pending: 14,
    period: 'Tháng 1/2024',
  },
  {
    id: '3',
    department: 'Khoa Ngoại',
    category: 'Phẫu thuật',
    totalDocuments: 156,
    signed: 150,
    pending: 6,
    period: 'Tháng 1/2024',
  },
]

const columns: ColumnsType<any> = [
  {
    title: 'Khoa',
    dataIndex: 'department',
    key: 'department',
    width: 200,
  },
  {
    title: 'Loại tài liệu',
    dataIndex: 'category',
    key: 'category',
    width: 150,
  },
  {
    title: 'Tổng số',
    dataIndex: 'totalDocuments',
    key: 'totalDocuments',
    width: 100,
    align: 'right',
  },
  {
    title: 'Đã ký',
    dataIndex: 'signed',
    key: 'signed',
    width: 100,
    align: 'right',
  },
  {
    title: 'Chờ xử lý',
    dataIndex: 'pending',
    key: 'pending',
    width: 100,
    align: 'right',
  },
  {
    title: 'Thời kỳ',
    dataIndex: 'period',
    key: 'period',
    width: 150,
  },
]

export default function ReportsPage() {
  const [form] = Form.useForm()
  const [searchResults, setSearchResults] = useState<any[]>([])

  const handleSearch = (values: any) => {
    // Mock search
    setSearchResults(mockReportData)
  }

  const handleExport = () => {
    // Mock export
    console.log('Export report')
  }

  const departments = [
    'Khoa Hóa sinh',
    'Khoa Nội',
    'Khoa Ngoại',
    'Khoa Chẩn đoán hình ảnh',
  ]

  const categories = ['Xét nghiệm', 'Khám bệnh', 'Chẩn đoán', 'Phẫu thuật', 'Điều trị']

  return (
    <div>
      <Title level={3}>Tìm kiếm & Báo cáo</Title>

      {/* Search Form */}
      <Card title="Tìm kiếm nâng cao" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="keyword" label="Từ khóa">
                <Input placeholder="Tiêu đề, mã BN..." prefix={<SearchOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="department" label="Khoa">
                <Select placeholder="Chọn khoa" allowClear>
                  {departments.map((dept) => (
                    <Select.Option key={dept} value={dept}>
                      {dept}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="category" label="Loại tài liệu">
                <Select placeholder="Chọn loại" allowClear>
                  {categories.map((cat) => (
                    <Select.Option key={cat} value={cat}>
                      {cat}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="dateRange" label="Thời gian">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  Tìm kiếm
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleExport}>
                  Xuất báo cáo
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng tài liệu"
              value={590}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Đã ký"
              value={555}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chờ xử lý"
              value={35}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tỷ lệ hoàn thành"
              value={94.1}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Results Table */}
      <Card title="Kết quả báo cáo">
        <Table
          columns={columns}
          dataSource={searchResults}
          rowKey="id"
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} kết quả`,
          }}
        />
      </Card>
    </div>
  )
}

