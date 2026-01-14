import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  message,
  Switch,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

// Mock data
const mockConnections = [
  {
    id: '1',
    name: 'HIS - Hệ thống thông tin bệnh viện',
    type: 'HIS',
    endpoint: 'https://his.example.com/api',
    status: 'connected',
    lastSync: '2024-01-15 10:30',
  },
  {
    id: '2',
    name: 'PACS - Hệ thống lưu trữ hình ảnh',
    type: 'PACS',
    endpoint: 'https://pacs.example.com/api',
    status: 'disconnected',
    lastSync: '2024-01-14 16:20',
  },
  {
    id: '3',
    name: 'LIS - Hệ thống xét nghiệm',
    type: 'LIS',
    endpoint: 'https://lis.example.com/api',
    status: 'connected',
    lastSync: '2024-01-15 09:15',
  },
]

const statusColors: Record<string, string> = {
  connected: 'success',
  disconnected: 'error',
  connecting: 'processing',
}

const statusLabels: Record<string, string> = {
  connected: 'Đã kết nối',
  disconnected: 'Ngắt kết nối',
  connecting: 'Đang kết nối',
}

const columns: ColumnsType<any> = [
  {
    title: 'Tên hệ thống',
    dataIndex: 'name',
    key: 'name',
    width: 250,
  },
  {
    title: 'Loại',
    dataIndex: 'type',
    key: 'type',
    width: 120,
  },
  {
    title: 'Endpoint',
    dataIndex: 'endpoint',
    key: 'endpoint',
    width: 300,
    ellipsis: true,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: string) => (
      <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
    ),
  },
  {
    title: 'Đồng bộ lần cuối',
    dataIndex: 'lastSync',
    key: 'lastSync',
    width: 150,
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
          icon={record.status === 'connected' ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
          size="small"
          onClick={() => handleToggleConnection(record)}
        >
          {record.status === 'connected' ? 'Ngắt' : 'Kết nối'}
        </Button>
        <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
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
      </Space>
    ),
  },
]

const handleToggleConnection = (record: any) => {
  const action = record.status === 'connected' ? 'ngắt kết nối' : 'kết nối'
  Modal.confirm({
    title: `Xác nhận ${action}`,
    content: `Bạn có chắc chắn muốn ${action} với hệ thống "${record.name}"?`,
    onOk: () => {
      message.success(`Đã ${action} thành công`)
    },
  })
}

const handleEdit = (record: any) => {
  // Mock edit
  console.log('Edit', record)
}

const handleDelete = (id: string) => {
  Modal.confirm({
    title: 'Xác nhận xóa',
    content: 'Bạn có chắc chắn muốn xóa kết nối này?',
    onOk: () => {
      message.success('Đã xóa kết nối thành công')
    },
  })
}

export default function ConnectPage() {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  const handleAdd = () => {
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleSubmit = () => {
    form.validateFields().then(() => {
      message.success('Thêm kết nối thành công')
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  return (
    <div>
      <Title level={3}>Kết nối</Title>

      <Card
        style={{ marginBottom: 16 }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm kết nối
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={mockConnections}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} kết nối`,
          }}
        />
      </Card>

      <Modal
        title="Thêm kết nối mới"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Tên hệ thống"
            rules={[{ required: true, message: 'Vui lòng nhập tên hệ thống' }]}
          >
            <Input placeholder="Nhập tên hệ thống" />
          </Form.Item>
          <Form.Item
            name="type"
            label="Loại hệ thống"
            rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
          >
            <Select placeholder="Chọn loại hệ thống">
              <Select.Option value="HIS">HIS - Hệ thống thông tin bệnh viện</Select.Option>
              <Select.Option value="PACS">PACS - Hệ thống lưu trữ hình ảnh</Select.Option>
              <Select.Option value="LIS">LIS - Hệ thống xét nghiệm</Select.Option>
              <Select.Option value="RIS">RIS - Hệ thống thông tin X-quang</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="API Endpoint"
            rules={[
              { required: true, message: 'Vui lòng nhập endpoint' },
              { type: 'url', message: 'Vui lòng nhập URL hợp lệ' },
            ]}
          >
            <Input placeholder="https://example.com/api" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="Nhập API Key (nếu có)" />
          </Form.Item>
          <Form.Item name="autoSync" label="Tự động đồng bộ" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

