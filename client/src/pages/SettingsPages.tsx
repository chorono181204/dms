import { useState } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  Modal,
  Form,
  Select,
  Switch,
  message,
  Tabs,
  Upload,
  Radio,
  Skeleton,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  FileTextOutlined,
  LinkOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import userService from '../services/user.service'
import departmentService from '../services/department.service'

import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { processSignatureImage } from '../utils/imageUtils'
import { getBackendUrl } from '../utils/config'

const { Title } = Typography

// Mock data - Users
const mockUsers = [
  {
    id: '1',
    username: 'nguyenvana',
    fullName: 'Nguyễn Văn A',
    department: 'Khoa Hóa sinh',
    role: 'USER',
    isActive: true,
    lastLogin: '2024-01-15 10:30',
  },
  {
    id: '2',
    username: 'tranthib',
    fullName: 'Trần Thị B',
    department: 'Khoa Nội',
    role: 'MANAGER',
    isActive: true,
    lastLogin: '2024-01-15 09:15',
  },
  {
    id: '3',
    username: 'levanc',
    fullName: 'Lê Văn C',
    department: 'Khoa Ngoại',
    role: 'ADMIN',
    isActive: true,
    lastLogin: '2024-01-14 16:20',
  },
]

// Removed mockCategories

const roleColors: Record<string, string> = {
  ADMIN: 'red',
  MANAGER: 'orange',
  USER: 'blue',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  USER: 'Người dùng',
}

interface SettingsPageProps {
  type: 'users' | 'integration' | 'departments'
}

export default function SettingsPages({ type }: SettingsPageProps) {
  const { user: currentUser } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  const getTitle = () => {
    switch (type) {
      case 'users':
        return 'Người dùng & phân quyền'

      case 'departments':
        return 'Quản lý khoa/phòng'
      case 'integration':
        return 'Ký số & tích hợp HIS'
      default:
        return ''
    }
  }

  const getDescription = () => {
    switch (type) {
      case 'users':
        return 'Quản lý tài khoản, vai trò và quyền truy cập tài liệu.'
      case 'departments':
        return 'Quản lý danh sách khoa/phòng ban trong bệnh viện.'

      case 'integration':
        return 'Thiết lập nhà cung cấp chữ ký số và kết nối với hệ thống HIS.'
      default:
        return ''
    }
  }

  // State for Users
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [signatureLoading, setSignatureLoading] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // Fetch Users
  const fetchUsers = async (page = 1, pageSize = 10, search = '') => {
    setLoading(true)
    try {
      const params: any = { page, limit: pageSize }
      if (search) params.name = search

      // Strict Department Filtering for Non-Admins (Managers/Supervisors restricted to own dept in Settings)
      if (currentUser?.role !== 'ADMIN' && currentUser?.departmentId) {
        params.departmentId = currentUser.departmentId;
      }

      const data = await userService.getUsers(params)
      setUsers(data.results)
      setPagination({
        current: data.page,
        pageSize: data.limit,
        total: data.totalResults,
      })
    } catch (error) {
      message.error('Lỗi tải danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }

  // Fetch Departments for Dropdown
  const fetchDepartments = async () => {
    try {
      const data = await departmentService.getDepartments({ limit: 100 })
      setDepartments(data.results)
    } catch (error) {
      console.error('Failed to load departments')
    }
  }



  useEffect(() => {
    if (type === 'users') {
      fetchUsers(pagination.current, pagination.pageSize, searchText)
      fetchDepartments()
    }
    if (type === 'departments') {
      fetchDepartments()
    }

  }, [type, searchText]) // Reload when search changes. Ideally should debounce.

  // Handle Table Change (Pagination)
  const handleTableChange = (newPagination: any) => {
    fetchUsers(newPagination.current, newPagination.pageSize, searchText)
  }

  // Optimize Search with debounce (simple implementation via timeout not added to keep it compatible with existing structure, just effect dependency)

  const [editingUserId, setEditingUserId] = useState<string | number | null>(null)

  // Handle Create/Update User
  const handleSaveUser = async () => {
    try {
      const values = await form.validateFields()

      if (editingUserId) {
        // Update
        await userService.updateUser(editingUserId, values)
        message.success('Cập nhật người dùng thành công')
      } else {
        // Create
        await userService.createUser({ ...values, password: values.password || 'password1' })
        message.success('Thêm người dùng thành công')
      }

      setIsModalVisible(false)
      form.resetFields()
      setEditingUserId(null)
      fetchUsers(pagination.current, pagination.pageSize, searchText)
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lỗi lưu người dùng')
    }
  }

  // Handle Edit User Click
  const handleEditUser = (record: any) => {
    setEditingUserId(record.id)
    form.setFieldsValue({
      username: record.username,
      name: record.name,
      role: record.role,
      departmentId: record.departmentId || record.department?.id, // Handle both if API returns nested or flat
      position: record.position,
      isChief: record.isChief,
      signatureImage: record.signatureImage
    })
    setIsModalVisible(true)
  }

  // Handle Delete User
  const handleDeleteUser = (id: string | number) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa người dùng này?',
      onOk: async () => {
        try {
          await userService.deleteUser(id)
          message.success('Đã xóa thành công')
          fetchUsers(pagination.current, pagination.pageSize, searchText)
        } catch (error) {
          message.error('Lỗi xóa người dùng')
        }
      },
    })
  }

  // Re-render columns to include edit handler
  if (type === 'users') {
    // ... columns definition needs to be inside the render or have access to handleEditUser
    // It is inside the component, so it has access.
  }

  if (type === 'users') {
    const userColumns: ColumnsType<any> = [
      {
        title: 'Tên đăng nhập',
        dataIndex: 'username',
        key: 'username',
        width: 150,
      },
      {
        title: 'Họ tên',
        dataIndex: 'name',
        key: 'name',
        width: 200,
      },
      {
        title: 'Khoa',
        key: 'department',
        width: 150,
        render: (_, record) => record.department?.name || '---',
      },
      {
        title: 'Chức vụ',
        dataIndex: 'position',
        key: 'position',
        width: 150,
        render: (text) => text || '---',
      },
      {
        title: 'Vai trò',
        dataIndex: 'role',
        key: 'role',
        width: 120,
        render: (role: string) => (
          <Tag color={roleColors[role]} > {roleLabels[role]}</Tag >
        ),
      },
      {
        title: 'KTV Trưởng',
        dataIndex: 'isChief',
        key: 'isChief',
        width: 100,
        render: (isChief: boolean) => isChief ? <Tag color="gold">KTV Trưởng</Tag> : null,
      },
      {
        title: 'Tạo bởi',
        dataIndex: 'createdBy',
        key: 'createdBy',
        width: 150,
        render: (text: string) => <span style={{ color: '#888' }}>{text || '---'}</span>
      },
      {
        title: 'Cập nhật bởi',
        dataIndex: 'updatedBy',
        key: 'updatedBy',
        width: 150,
        render: (text) => <span style={{ color: '#888' }}>{text || '---'}</span>
      },
      {
        title: 'Trạng thái',
        // dataIndex: 'isEmailVerified', // Backend has isEmailVerified, not isActive explicitly yet, but we can assume Verified = Active for now or hardcode.
        key: 'isActive',
        width: 100,
        render: (record) => (
          <Tag color={'success'}>Hoạt động</Tag>
        ),
      },
      {
        title: 'Thao tác',
        key: 'action',
        width: 150,
        fixed: 'right',
        render: (_, record) => {
          const canAction =
            (currentUser?.role === 'ADMIN') ||
            (currentUser?.role === 'MANAGER' && record.role === 'USER')

          return (
            <Space size="small">
              <Button
                type="link"
                icon={<EditOutlined />}
                size="small"
                onClick={() => handleEditUser(record)}
                disabled={!canAction}
              >
                Sửa
              </Button>
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => handleDeleteUser(record.id)}
                disabled={!canAction}
              >
                Xóa
              </Button>
            </Space>
          )
        },
      },
    ]

    return (
      <div>
        <Title level={3}>{getTitle()}</Title>

        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} justify="space-between" align="middle">
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                placeholder="Tìm kiếm người dùng..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setIsModalVisible(true);
                if (currentUser?.role !== 'ADMIN' && currentUser?.departmentId) {
                  form.setFieldsValue({ departmentId: currentUser.departmentId });
                }
              }}>
                Thêm người dùng
              </Button>
            </Col>
          </Row>
        </Card>

        <Card>
          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            scroll={{ x: 1000 }}
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} người dùng`,
            }}
            onChange={handleTableChange}
          />
        </Card>

        <Modal
          title={editingUserId ? "Cập nhật người dùng" : "Thêm người dùng"}
          open={isModalVisible}
          onOk={handleSaveUser}
          onCancel={() => {
            setIsModalVisible(false)
            form.resetFields()
            setEditingUserId(null)
          }}
          width={600}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="username"
              label="Tên đăng nhập"
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
            >
              <Input placeholder="Nhập tên đăng nhập" />
            </Form.Item>
            <Form.Item
              name="name" // Changed from fullName to name to match API
              label="Họ tên"
              rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            >
              <Input placeholder="Nhập họ tên" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: !editingUserId, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password placeholder={editingUserId ? "Để trống nếu không đổi mật khẩu" : "Nhập mật khẩu"} />
            </Form.Item>

            <Form.Item
              name="departmentId"
              label="Khoa"
              rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
            >
              <Select placeholder="Chọn khoa" disabled={currentUser?.role !== 'ADMIN'}>
                {departments.map(dept => (
                  <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="position"
              label="Chức vụ"
            >
              <Input placeholder="Nhập chức vụ (Ví dụ: Trưởng khoa)" />
            </Form.Item>

            <Form.Item name="isChief" valuePropName="checked">
              <Switch /> <span style={{ marginLeft: 8 }}>KTV Trưởng (Quyền giao việc cho nhân viên)</span>
            </Form.Item>

            <Form.Item
              name="role"
              label="Vai trò"
              rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
            >
              <Select placeholder="Chọn vai trò">
                <Select.Option value="USER">Người dùng</Select.Option>
                <Select.Option value="MANAGER">Quản lý</Select.Option>
                {currentUser?.role === 'ADMIN' && (
                  <Select.Option value="ADMIN">Quản trị viên</Select.Option>
                )}
              </Select>
            </Form.Item>

            {editingUserId && (
              <Form.Item label="Chữ ký (Ảnh)">
                <Upload
                  name="file"
                  listType="picture-card"
                  className="avatar-uploader"
                  showUploadList={false}
                  action={`${getBackendUrl()}/v1/users/${editingUserId}/signature`}
                  headers={{
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                  }}
                  beforeUpload={async (file) => {
                    console.log('Admin beforeUpload started for:', file.name);
                    try {
                      const processedBlob = await processSignatureImage(file);
                      console.log('Admin image processed, creating file object...');
                      const newName = file.name.replace(/\.[^/.]+$/, "") + ".png";
                      const processedFile = new File([processedBlob], newName, { type: 'image/png' });
                      console.log('Admin file object created:', processedFile.name);
                      return processedFile;
                    } catch (err) {
                      console.error('Admin signature processing failed:', err);
                      message.error('Lỗi xử lý ảnh chữ ký');
                      return false;
                    }
                  }}
                  onChange={(info) => {
                    if (info.file.status === 'uploading') {
                      setSignatureLoading(true);
                      return;
                    }
                    if (info.file.status === 'done') {
                      message.success('Cập nhật chữ ký thành công');
                      setSignatureLoading(false);
                      fetchUsers(pagination.current, pagination.pageSize, searchText);
                    } else if (info.file.status === 'error') {
                      message.error('Lỗi tải lên chữ ký');
                      setSignatureLoading(false);
                    }
                  }}
                >
                  {signatureLoading ? (
                    <Skeleton.Image active style={{ width: 100, height: 60 }} />
                  ) : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>{form.getFieldValue('signatureImage') ? 'Đổi chữ ký' : 'Tải lên'}</div>
                    </div>
                  )}
                </Upload>
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
    )
  }

  // Departments Logic
  if (type === 'departments') {
    const handleSaveDepartment = async () => {
      try {
        const values = await form.validateFields();
        if (editingUserId) { // re-using editingUserId state for department ID
          await departmentService.updateDepartment(editingUserId, values);
          message.success('Cập nhật khoa thành công');
        } else {
          await departmentService.createDepartment(values);
          message.success('Thêm khoa thành công');
        }
        setIsModalVisible(false);
        form.resetFields();
        setEditingUserId(null);
        fetchDepartments();
      } catch (error: any) {
        message.error(error.response?.data?.message || 'Lỗi lưu khoa');
      }
    };

    const handleDeleteDepartment = (id: number) => {
      Modal.confirm({
        title: 'Xóa khoa',
        content: 'Bạn có chắc chắn muốn xóa khoa này? Hành động này có thể ảnh hưởng đến các người dùng và văn bản thuộc khoa.',
        onOk: async () => {
          try {
            await departmentService.deleteDepartment(id);
            message.success('Đã xóa khoa');
            fetchDepartments();
          } catch (error: any) {
            message.error(error.response?.data?.message || 'Lỗi xóa khoa');
          }
        }
      });
    };

    const columns: ColumnsType<any> = [
      { title: 'Mã khoa', dataIndex: 'code', key: 'code', width: 100 },
      { title: 'Tên khoa', dataIndex: 'name', key: 'name', width: 250 },
      {
        title: 'Cập nhật bởi',
        key: 'updatedBy',
        width: 150,
        render: (_, record) => <span style={{ color: '#888' }}>{record.updatedBy || record.createdBy || '---'}</span>
      },
      {
        title: 'Thao tác',
        key: 'action',
        width: 150,
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingUserId(record.id);
                form.setFieldsValue(record);
                setIsModalVisible(true);
              }}
            >
              Sửa
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDepartment(record.id)}
            >
              Xóa
            </Button>
          </Space>
        )
      }
    ];

    return (
      <div>
        <Title level={3}>{getTitle()}</Title>
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between">
            <Col>
              {/* Search could be added here */}
              <span style={{ color: '#666' }}>{getDescription()}</span>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                Thêm khoa
              </Button>
            </Col>
          </Row>
        </Card>
        <Card>
          <Table
            columns={columns}
            dataSource={departments}
            rowKey="id"
            loading={loading} // Re-using loading state, might need to set it in fetchDepartments
            pagination={{ pageSize: 10 }}
          />
        </Card>
        <Modal
          title={editingUserId ? "Cập nhật thông tin khoa" : "Thêm khoa mới"}
          open={isModalVisible}
          onOk={handleSaveDepartment}
          onCancel={() => {
            setIsModalVisible(false);
            form.resetFields();
            setEditingUserId(null);
          }}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Tên khoa"
              rules={[{ required: true, message: 'Vui lòng nhập tên khoa' }]}
            >
              <Input placeholder="Ví dụ: Khoa Hóa sinh" />
            </Form.Item>
            <Form.Item
              name="code"
              label="Mã khoa"
              rules={[{ required: true, message: 'Vui lòng nhập mã khoa' }]}
            >
              <Input placeholder="Ví dụ: BIO, IT..." />
            </Form.Item>
          </Form>
        </Modal>
      </div >
    );
  }



  // integration
  return (
    <div>
      <Title level={3}>{getTitle()}</Title>
      <Card>
        <Tabs
          items={[
            {
              key: 'signature',
              label: 'Cấu hình ký số',
              children: (
                <Form layout="vertical">
                  <Form.Item label="Nhà cung cấp">
                    <Select placeholder="Chọn nhà cung cấp">
                      <Select.Option value="viettel">Viettel CA</Select.Option>
                      <Select.Option value="vnpt">VNPT CA</Select.Option>
                      <Select.Option value="fpt">FPT CA</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="API Endpoint">
                    <Input placeholder="https://api.example.com" />
                  </Form.Item>
                  <Form.Item label="API Key">
                    <Input.Password placeholder="Nhập API Key" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary">Lưu cấu hình</Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'his',
              label: 'Tích hợp HIS',
              children: (
                <Form layout="vertical">
                  <Form.Item label="HIS Endpoint">
                    <Input placeholder="https://his.example.com/api" />
                  </Form.Item>
                  <Form.Item label="API Key">
                    <Input.Password placeholder="Nhập API Key" />
                  </Form.Item>
                  <Form.Item label="Đồng bộ dữ liệu">
                    <Switch defaultChecked />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary">Lưu cấu hình</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

const handleDelete = (id: string) => {
  Modal.confirm({
    title: 'Xác nhận xóa',
    content: 'Bạn có chắc chắn muốn xóa mục này?',
    onOk: () => {
      message.success('Đã xóa thành công')
    },
  })
}

