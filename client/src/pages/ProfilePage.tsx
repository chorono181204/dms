import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Typography,
  message,
  Divider,
  Avatar,
  Skeleton,
  Upload,
  Space, // Added Space back as it's used later
  Tabs, // Added Tabs back as it's used later
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  SaveOutlined,
  UploadOutlined,
  EditOutlined, // Added EditOutlined back as it's used later
} from '@ant-design/icons'
import { getBackendUrl } from '../utils/config';
import userService from '../services/user.service'
import authService from '../services/auth.service'
import { processSignatureImage } from '../utils/imageUtils'
import { ImageCropModal } from '../components/ImageCropModal'
import { useAuth } from '../contexts/AuthContext'

const { Title } = Typography

export default function ProfilePage() {
  const { user: authUser, updateUser } = useAuth() // Get updateUser
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [isEditing, setIsEditing] = useState(false)
  const [user, setUser] = useState<any>(null)
  // ... (keep existing state)
  const [loading, setLoading] = useState(true)
  const [signatureLoading, setSignatureLoading] = useState(false)
  const [cropModalVisible, setCropModalVisible] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const data = await userService.getProfile()
      setUser(data)
      profileForm.setFieldsValue({
        username: data.username,
        name: data.name,
        phone: data.phone,
        role: data.role,
        // email: data.email, // Backend doesn't have email yet? Check User model. It has username.
        // Using placeholder for missing fields
      })
    } catch (err) {
      message.error('Lỗi tải thông tin cá nhân')
    } finally {
      setLoading(false)
    }
  }
  const handleSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields()
      const { username, role, departmentId, ...updateData } = values
      const updatedUser = await userService.updateProfile(updateData)

      // Update local storage AND Context
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
      const newUserData = { ...currentUser, ...updatedUser };
      updateUser(newUserData); // Sync context

      message.success('Cập nhật thông tin thành công')
      setIsEditing(false)
      fetchProfile()
    } catch (error: any) {
      console.error(error)
      message.error(error.response?.data?.message || 'Lỗi cập nhật hồ sơ')
    }
  }

  // ... (handleChangePassword remains same)

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields()
      await authService.changePassword({
        newPassword: values.newPassword
      })
      message.success('Đổi mật khẩu thành công')
      passwordForm.resetFields()
    } catch (error: any) {
      console.error(error)
      message.error(error.response?.data?.message || 'Lỗi đổi mật khẩu')
    }
  }

  if (loading) return <Skeleton active />

  return (
    <div>
      <Title level={3}>Hồ sơ cá nhân</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Avatar size={100} icon={<UserOutlined />} style={{ marginBottom: 16 }} />
              <Title level={4}>{user?.name || user?.username}</Title>
              <Typography.Text type="secondary">{user?.role}</Typography.Text>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Typography.Text strong>Khoa: </Typography.Text>
                  <Typography.Text>{user?.department?.name || '---'}</Typography.Text>
                </div>
                <div>
                  <Typography.Text strong>Vai trò: </Typography.Text>
                  <Typography.Text>{user?.role}</Typography.Text>
                </div>
              </Space>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card>
            <Tabs
              items={[
                {
                  key: 'profile',
                  label: 'Thông tin cá nhân',
                  children: (
                    <Form
                      form={profileForm}
                      layout="vertical"
                      initialValues={user}
                    >
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="name"
                            label="Họ và tên"
                            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                          >
                            <Input prefix={<UserOutlined />} disabled={!isEditing} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="username"
                            label="Tên đăng nhập"
                            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
                          >
                            <Input disabled />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="phone"
                            label="Số điện thoại"
                          >
                            <Input disabled={!isEditing} />
                          </Form.Item>
                        </Col>
                        {/* Other fields like Birthday/Position can be added when DB supports them */}
                      </Row>
                      <Form.Item>
                        <Space>
                          {!isEditing ? (
                            <Button type="primary" icon={<EditOutlined />} onClick={() => setIsEditing(true)}>
                              Chỉnh sửa
                            </Button>
                          ) : (
                            <>
                              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveProfile}>
                                Lưu
                              </Button>
                              <Button onClick={() => {
                                setIsEditing(false)
                                profileForm.resetFields()
                              }}>
                                Hủy
                              </Button>
                            </>
                          )}
                        </Space>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: 'password',
                  label: 'Đổi mật khẩu',
                  children: (
                    <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
                      <Form.Item
                        name="newPassword"
                        label="Mật khẩu mới"
                        rules={[
                          { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item
                        name="confirmPassword"
                        label="Xác nhận mật khẩu mới"
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve()
                              }
                              return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                            },
                          }),
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                          Đổi mật khẩu
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: 'signature',
                  label: 'Chữ ký số',
                  children: (
                    <div style={{ padding: '20px 0' }}>
                      <div style={{ marginBottom: 20 }}>
                        <Typography.Text type="secondary">
                          Tải lên ảnh chữ ký của bạn (nên dùng ảnh nền trong suốt .png).
                          Chữ ký này sẽ được dùng để chèn vào các văn bản khi bạn thực hiện ký số.
                        </Typography.Text>
                      </div>

                      <Row gutter={24} align="middle">
                        <Col span={12}>
                          <Upload
                            name="file"
                            listType="picture-card"
                            className="avatar-uploader"
                            showUploadList={false}
                            action={`${getBackendUrl()}/v1/users/profile/signature`}
                            headers={{
                              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                            }}
                            beforeUpload={(file) => {
                              console.log('beforeUpload started for:', file.name);
                              setSelectedImageFile(file);
                              setCropModalVisible(true);
                              return false; // Prevent auto upload
                            }}
                            onChange={(info) => {
                              if (info.file.status === 'uploading') {
                                setSignatureLoading(true);
                                return;
                              }
                              if (info.file.status === 'done') {
                                message.success('Tải lên chữ ký thành công');
                                setSignatureLoading(false);
                                fetchProfile();
                              } else if (info.file.status === 'error') {
                                message.error('Lỗi tải lên chữ ký');
                                setSignatureLoading(false);
                              }
                            }}
                          >
                            {signatureLoading ? (
                              <Skeleton.Image active />
                            ) : (
                              <div>
                                <PlusOutlined />
                                <div style={{ marginTop: 8 }}>{user?.signatureImage ? 'Đổi chữ ký' : 'Tải lên'}</div>
                              </div>
                            )}
                          </Upload>
                        </Col>
                        <Col span={12}>
                          {user?.signatureImage && !signatureLoading && (
                            <div style={{ padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8, textAlign: 'center' }}>
                              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Xem trước chữ ký:</Typography.Text>
                              <img
                                src={`${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(user.signatureImage)}&inline=true`}
                                alt="signature-preview"
                                style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }}
                              />
                            </div>
                          )}
                        </Col>
                      </Row>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <ImageCropModal
        visible={cropModalVisible}
        imageFile={selectedImageFile}
        onCancel={() => {
          setCropModalVisible(false);
          setSelectedImageFile(null);
        }}
        onConfirm={async (croppedBlob) => {
          setCropModalVisible(false);
          setSignatureLoading(true);

          try {
            // Process the cropped image (background removal)
            const croppedFile = new File([croppedBlob], 'cropped.png', { type: 'image/png' });
            const processedBlob = await processSignatureImage(croppedFile);
            const processedFile = new File([processedBlob], selectedImageFile?.name.replace(/\.[^/.]+$/, "") + ".png" || 'signature.png', { type: 'image/png' });

            // Upload to server
            const formData = new FormData();
            formData.append('file', processedFile);

            const response = await fetch(`${getBackendUrl()}/v1/users/profile/signature`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
              body: formData,
            });

            if (response.ok) {
              const result = await response.json();

              // Update local storage AND Context with new signature
              const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
              if (result.signatureImage) {
                const newUserData = { ...currentUser, signatureImage: result.signatureImage };
                updateUser(newUserData); // Sync context
              }

              message.success('Tải lên chữ ký thành công');
              fetchProfile();
            } else {
              message.error('Lỗi tải lên chữ ký');
            }
          } catch (err) {
            console.error('Upload error:', err);
            message.error('Lỗi xử lý ảnh chữ ký');
          } finally {
            setSignatureLoading(false);
            setSelectedImageFile(null);
          }
        }}
      />
    </div>
  )
}
