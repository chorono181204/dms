import { useState } from 'react'
import { Layout, Menu, Typography, Badge, Dropdown, Empty } from 'antd'
import {
  FileTextOutlined,
  AuditOutlined,
  SettingOutlined,
  BarChartOutlined,
  UserOutlined,
  HomeOutlined,
  LinkOutlined,
  LeftOutlined,
  RightOutlined,
  BellOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import DocumentEditor from '../components/DocumentEditor'
import HomePage from '../pages/HomePage'
import DocumentPage from '../pages/DocumentPage'

import MyDocumentsPage from '../pages/MyDocumentsPage'

import TemplateManagementPage from '../pages/TemplateManagementPage'
import ApprovalPages from '../pages/ApprovalPages'
import ReportsPage from '../pages/ReportsPage'
import SettingsPages from '../pages/SettingsPages'
import ConnectPage from '../pages/ConnectPage'
import ProfilePage from '../pages/ProfilePage'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const { Header, Sider, Content } = Layout

function MainLayout() {
  const [selectedKey, setSelectedKey] = useState('home')
  const [collapsed, setCollapsed] = useState(false)
  const [notificationCount, setNotificationCount] = useState(12) // Số thông báo mới (ví dụ)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Dữ liệu thông báo mẫu
  const notifications = [
    {
      id: 1,
      title: 'Tài liệu mới cần phê duyệt',
      content: 'Bạn có 1 tài liệu mới cần phê duyệt từ khoa Hóa sinh',
      time: '5 phút trước',
      isRead: false,
    },
    {
      id: 2,
      title: 'Tài liệu đã được ký',
      content: 'Tài liệu "Báo cáo xét nghiệm" đã được ký thành công',
      time: '1 giờ trước',
      isRead: false,
    },
    {
      id: 3,
      title: 'Nhắc nhở phê duyệt',
      content: 'Bạn có 3 tài liệu đang chờ phê duyệt',
      time: '2 giờ trước',
      isRead: true,
    },
  ]

  // Tạo menu items cho dropdown
  const notificationMenuItems = notifications.length > 0
    ? notifications.map((item) => ({
      key: item.id.toString(),
      label: (
        <div
          style={{
            padding: '8px 0',
            backgroundColor: item.isRead ? '#ffffff' : '#f6ffed',
            borderLeft: item.isRead ? 'none' : '3px solid #52c41a',
            paddingLeft: item.isRead ? '12px' : '9px',
          }}
          onClick={() => {
            if (!item.isRead) {
              setNotificationCount((prev) => Math.max(0, prev - 1))
            }
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={{ fontWeight: item.isRead ? 400 : 600, fontSize: 14 }}>{item.title}</span>
            {!item.isRead && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#52c41a',
                  display: 'inline-block',
                  marginLeft: 8,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>{item.content}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{item.time}</div>
        </div>
      ),
    }))
    : [
      {
        key: 'empty',
        label: <Empty description="Không có thông báo mới" style={{ padding: '20px 0' }} />,
        disabled: true,
      },
    ]

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider
            collapsible
            collapsed={collapsed}
            trigger={null}
            width={280}
            style={{
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              height: '100vh',
              overflow: 'hidden',
            }}
          >
            {/* Header với logo bệnh viện */}
            <div
              style={{
                padding: collapsed ? '16px 8px' : '20px 16px',
                textAlign: 'center',
              }}
            >
              {!collapsed && (
                <>
                  {/* Logo */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <img
                      src="/logo.svg"
                      alt="Logo bệnh viện"
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: 'contain',
                      }}
                    />
                  </div>

                  {/* Tên bệnh viện */}
                  <div style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#143C72',
                        lineHeight: 1.5,
                        marginBottom: 2,
                        letterSpacing: '0.3px',
                      }}
                    >
                      BỆNH VIỆN ĐA KHOA SỐ 1
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#143C72',
                        lineHeight: 1.5,
                        letterSpacing: '0.3px',
                      }}
                    >
                      TỈNH LÀO CAI
                    </div>
                  </div>

                  {/* Tagline */}
                  <div
                    style={{
                      fontSize: 10,
                      fontStyle: 'italic',
                      color: '#F4D242',
                      marginTop: 6,
                      fontWeight: 400,
                    }}
                  >
                    More than a hospital
                  </div>
                </>
              )}
              {collapsed && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src="/logo.svg"
                    alt="Logo"
                    style={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Menu */}
            <div style={{ flex: 1, overflow: 'auto', paddingBottom: 48 }}>
              <Menu
                theme="light"
                mode="inline"
                selectedKeys={[selectedKey]}
                onClick={(e) => {
                  if (e.key === 'logout') {
                    handleLogout()
                  } else {
                    setSelectedKey(e.key as string)
                  }
                }}
                style={{
                  borderRight: 'none',
                  background: '#ffffff',
                }}
                items={[
                  {
                    key: 'home',
                    icon: <HomeOutlined />,
                    label: 'Trang chủ',
                  },
                  {
                    key: 'documents',
                    icon: <FileTextOutlined />,
                    label: 'Quản lý tài liệu',
                    children: [
                      { key: 'documents:list', label: 'Danh sách tài liệu' },
                      { key: 'documents:mine', label: 'Tài liệu của tôi' },
                      { key: 'documents:templates', label: 'Quản lý mẫu' },
                      { key: 'documents:categories', label: 'Quản lý danh mục' },
                    ],
                  },
                  {
                    key: 'approval',
                    icon: <AuditOutlined />,
                    label: 'Phê duyệt / Ký',
                    children: [
                      { key: 'approval:pending-approve', label: 'Chờ tôi phê duyệt' },
                      { key: 'approval:pending-sign', label: 'Chờ tôi ký' },
                      { key: 'approval:history', label: 'Lịch sử phê duyệt / ký' },
                    ],
                  },
                  {
                    key: 'reports',
                    icon: <BarChartOutlined />,
                    label: 'Tìm kiếm & Báo cáo',
                  },
                  {
                    key: 'settings',
                    icon: <SettingOutlined />,
                    label: 'Quản lý hệ thống',
                    children: [
                      { key: 'settings:users', label: 'Người dùng & phân quyền' },
                      // Only Admin sees Department Management
                      ...(useAuth().user?.role === 'ADMIN' ? [{ key: 'settings:departments', label: 'Quản lý khoa' }] : []),
                      { key: 'settings:integration', label: 'Ký số & tích hợp HIS' },
                    ],
                  },
                  {
                    key: 'connect',
                    icon: <LinkOutlined />,
                    label: 'Kết nối',
                  },
                  {
                    key: 'account',
                    icon: <UserOutlined />,
                    label: 'Hồ sơ cá nhân',
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    danger: true,
                  },
                ]}
              />
            </div>

            {/* Toggle button ở dưới cùng */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                padding: '0 16px',
              }}
            >
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8c8c8c',
                  fontSize: 16,
                }}
              >
                {collapsed ? <RightOutlined /> : <LeftOutlined />}
              </button>
            </div>
          </Sider>

          <Layout
            className="app-content"
            style={{
              marginLeft: collapsed ? 80 : 280,
              transition: 'margin-left 0.2s',
            }}
          >
            <Header
              style={{
                background: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
                height: 64,
                padding: '0 24px',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span
                  style={{
                    fontSize: 27,
                    fontWeight: 700,
                    color: '#143C72',
                    letterSpacing: '0.5px',
                  }}
                >
                  Khoa hóa sinh
                </span>
              </div>
              <Dropdown
                menu={{ items: notificationMenuItems }}
                trigger={['click']}
                placement="bottomRight"
                overlayStyle={{ width: 400, maxHeight: 500, overflowY: 'auto' }}
              >
                <div style={{ position: 'relative', marginRight: 48, cursor: 'pointer' }}>
                  <Badge
                    count={notificationCount > 9 ? '9+' : notificationCount}
                    overflowCount={9}
                    offset={[4, -4]}
                  >
                    <BellOutlined
                      style={{
                        fontSize: 20,
                        color: '#143C72',
                        cursor: 'pointer',
                        marginLeft: 8,
                      }}
                    />
                  </Badge>
                </div>
              </Dropdown>
            </Header>
            <Content style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
              {/* Trang chủ */}
              {selectedKey === 'home' && <HomePage />}

              {/* Tài liệu */}


              {selectedKey === 'documents:list' && <DocumentPage />}
              {selectedKey === 'documents:mine' && <MyDocumentsPage />}

              {selectedKey === 'documents:templates' && <TemplateManagementPage />}

              {/* Phê duyệt / Ký */}
              {selectedKey === 'approval:pending-approve' && <ApprovalPages type="pending-approve" />}
              {selectedKey === 'approval:pending-sign' && <ApprovalPages type="pending-sign" />}
              {selectedKey === 'approval:history' && <ApprovalPages type="history" />}

              {/* Tìm kiếm & Báo cáo */}
              {selectedKey === 'reports' && <ReportsPage />}

              {/* Quản lý hệ thống */}
              {selectedKey === 'settings:users' && <SettingsPages type="users" />}
              {selectedKey === 'settings:departments' && useAuth().user?.role === 'ADMIN' && <SettingsPages type="departments" />}
              {selectedKey === 'documents:categories' && <SettingsPages type="doc-types" />}
              {selectedKey === 'settings:integration' && <SettingsPages type="integration" />}

              {/* Kết nối */}
              {selectedKey === 'connect' && <ConnectPage />}

              {/* Hồ sơ cá nhân */}
              {selectedKey === 'account' && <ProfilePage />}
            </Content>
          </Layout>
        </Layout>
      </Layout>

    </div>
  )
}

export default MainLayout
