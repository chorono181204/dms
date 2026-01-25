import { useState } from 'react'
import { Layout, Menu, Typography, Badge, Dropdown, Empty } from 'antd'
import TaskPage from '../pages/TaskPage'
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
  MessageOutlined,
  OrderedListOutlined, // For Tasks
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
import TrashPage from '../pages/TrashPage'
import ChatPage from '../pages/ChatPage'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { socketService } from '../api/services/socket.service'
import { notificationService, Notification } from '../api/services/notification.service'
import { useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const { Header, Sider, Content } = Layout

function MainLayout() {
  const [selectedKey, setSelectedKey] = useState('home')
  const [collapsed, setCollapsed] = useState(false)
  const [notificationCount, setNotificationCount] = useState(12) // Số thông báo mới (ví dụ)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [unreadTaskCount, setUnreadTaskCount] = useState(0)
  const notificationSound = useRef<HTMLAudioElement | null>(null)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Ref to keep track of current notifications for socket event handler
  const notificationsRef = useRef<Notification[]>([]);

  // Sync ref with state
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications(10, 0);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error("Failed to load notifications", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(notification.id);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error(e);
      }
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  // Tạo menu items cho dropdown
  // Tạo menu items cho dropdown
  const notificationMenuItems = [
    {
      key: 'header',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
          <Typography.Text strong>Thông báo</Typography.Text>
          <Typography.Link onClick={(e) => { e.preventDefault(); handleMarkAllRead(); }}>Đánh dấu đã đọc</Typography.Link>
        </div>
      ),
      disabled: false,
      style: { cursor: 'default', background: '#fff' }
    },
    { type: 'divider' },
    ...notifications.map((item) => ({
      key: item.id.toString(),
      label: (
        <div
          onClick={() => handleNotificationClick(item)}
          style={{
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            opacity: item.isRead ? 0.6 : 1
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography.Text strong={!item.isRead} style={{ fontSize: 13 }}>
              {item.title}
            </Typography.Text>
            {!item.isRead && <Badge status="processing" />}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.content}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 10 }}>
            {dayjs(item.createdAt).fromNow()}
          </Typography.Text>
        </div>
      ),
    })),
    { type: 'divider' },
    {
      key: 'view-all',
      label: <div style={{ textAlign: 'center' }}>Xem tất cả</div>
    }
  ]

  // Socket notification logic
  useEffect(() => {
    notificationSound.current = new Audio('/sound.mp3')

    socketService.connect()
    const handleGlobalMessage = (message: any) => {
      // If we are not currently on the chat page, show notification
      if (selectedKey !== 'chat' && message.senderId !== user?.id) {
        setUnreadChatCount(prev => prev + 1)

        // Play sound if enabled in settings (default true)
        const soundEnabled = localStorage.getItem('chat_notification_sound') !== 'false'
        if (soundEnabled) {
          notificationSound.current?.play().catch(e => console.error('Audio play failed', e))
        }
      }
    }

    // Unified Notification Listener
    const handleNewNotification = (data: any) => {
      // Check for duplicate using ref to access latest state without dependency cycle
      if (notificationsRef.current.some(n => n.id === data.id)) {
        return;
      }

      // Add to list
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Play sound
      const soundEnabled = localStorage.getItem('chat_notification_sound') !== 'false'
      if (soundEnabled) {
        notificationSound.current?.play().catch(e => console.error('Audio play failed', e))
      }
    };

    socketService.onReceiveMessage(handleGlobalMessage)
    // socketService.on('new_task', handleTaskEvent) -- Removed
    // socketService.on('task_updated', handleTaskEvent) -- Removed
    socketService.on('new_notification', handleNewNotification)
    socketService.on('receive_notification', handleNewNotification) // Alias

    return () => {
      socketService.offReceiveMessage(handleGlobalMessage)
      socketService.off('new_notification', handleNewNotification)
      socketService.off('receive_notification', handleNewNotification)
    }
  }, [selectedKey, user?.id])

  // Clear unread task count when switching to tasks
  useEffect(() => {
    if (selectedKey === 'tasks') {
      setUnreadTaskCount(0)
    }
  }, [selectedKey])

  // Clear unread count when switching to chat
  useEffect(() => {
    if (selectedKey === 'chat') {
      setUnreadChatCount(0)
    }
  }, [selectedKey])

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
                    key: 'tasks',
                    icon: (
                      <Badge dot={unreadTaskCount > 0} offset={[5, 0]}>
                        <OrderedListOutlined />
                      </Badge>
                    ),
                    label: 'Công việc',
                  },
                  {
                    key: 'documents',
                    icon: <FileTextOutlined />,
                    label: 'Quản lý tài liệu',
                    children: [
                      { key: 'documents:list', label: 'Danh sách tài liệu' },
                      { key: 'documents:mine', label: 'Tài liệu của tôi' },
                      { key: 'documents:templates', label: 'Quản lý mẫu' },

                      { key: 'documents:trash', label: 'Thùng rác' },
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
                  ...(user?.role === 'ADMIN' || user?.role === 'MANAGER' ? [{
                    key: 'settings',
                    icon: <SettingOutlined />,
                    label: 'Quản lý hệ thống',
                    children: [
                      { key: 'settings:users', label: 'Người dùng & phân quyền' },
                      // Only Admin sees Department Management
                      ...(user?.role === 'ADMIN' ? [{ key: 'settings:departments', label: 'Quản lý khoa' }] : []),
                      { key: 'settings:integration', label: 'Ký số & tích hợp HIS' },
                    ],
                  }] : []),
                  {
                    key: 'connect',
                    icon: <LinkOutlined />,
                    label: 'Kết nối',
                  },
                  {
                    key: 'chat',
                    icon: (
                      <Badge dot={unreadChatCount > 0} offset={[5, 0]}>
                        <MessageOutlined />
                      </Badge>
                    ),
                    label: 'Tin nhắn',
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
              <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#143C72',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    lineHeight: 1.2,
                    marginBottom: 2
                  }}
                >
                  Hệ thống quản lý xét nghiệm theo ISO15189 và QĐ2429BYT
                </span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#D32F2F', // Red color for highlighting department
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    lineHeight: 1.2
                  }}
                >
                  {user?.department?.name || 'KHOA XÉT NGHIỆM TỔNG HỢP'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Notification */}
                <Dropdown
                  menu={{ items: notificationMenuItems as any }}
                  trigger={['click']}
                  placement="bottomRight"
                  overlayStyle={{ width: 400, maxHeight: 500, overflowY: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)' }}
                >
                  <div style={{ cursor: 'pointer' }}>
                    <Badge
                      count={unreadCount}
                      overflowCount={9}
                      offset={[4, -4]}
                    >
                      <BellOutlined
                        style={{
                          fontSize: 20,
                          color: '#143C72',
                          cursor: 'pointer',
                        }}
                      />
                    </Badge>
                  </div>
                </Dropdown>

                {/* Profile */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'background 0.3s'
                  }}
                  className="header-profile-hover"
                  onClick={() => setSelectedKey('account')}
                >
                  <div style={{ textAlign: 'right', marginRight: 12, display: 'flex', flexDirection: 'column' }}>
                    <Typography.Text strong style={{ color: '#143C72', fontSize: 14, lineHeight: '1.2' }}>
                      {user?.name || user?.username || 'User'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: '1.2' }}>
                      {user?.role === 'ADMIN' ? 'Quản trị hệ thống' :
                        user?.role === 'MANAGER' ? 'Trưởng/Phó khoa' : 'Nhân viên'}
                    </Typography.Text>
                  </div>
                  <UserOutlined style={{ fontSize: 24, padding: 8, background: '#f0f2f5', borderRadius: '50%', color: '#143C72' }} />
                </div>
              </div>
            </Header>
            <Content style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
              {/* Trang chủ */}
              {selectedKey === 'home' && <HomePage />}

              {/* Tài liệu */}


              {selectedKey === 'documents:list' && <DocumentPage />}
              {selectedKey === 'documents:mine' && <MyDocumentsPage />}

              {selectedKey === 'documents:templates' && <TemplateManagementPage />}
              {selectedKey === 'documents:trash' && <TrashPage />}

              {/* Phê duyệt / Ký */}
              {selectedKey === 'approval:pending-approve' && <ApprovalPages type="pending-approve" />}
              {selectedKey === 'approval:pending-sign' && <ApprovalPages type="pending-sign" />}
              {selectedKey === 'approval:history' && <ApprovalPages type="history" />}

              {/* Tìm kiếm & Báo cáo */}
              {selectedKey === 'reports' && <ReportsPage />}

              {/* Quản lý hệ thống */}
              {selectedKey === 'settings:users' && <SettingsPages type="users" />}
              {selectedKey === 'settings:departments' && useAuth().user?.role === 'ADMIN' && <SettingsPages type="departments" />}

              {selectedKey === 'settings:integration' && <SettingsPages type="integration" />}

              {/* Kết nối */}
              {selectedKey === 'connect' && <ConnectPage />}

              {/* Hồ sơ cá nhân */}
              {selectedKey === 'account' && <ProfilePage />}

              {/* Nhắn tin */}
              {selectedKey === 'chat' && <ChatPage />}

              {/* Công việc */}
              {selectedKey === 'tasks' && <TaskPage />}

              <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 10, paddingBottom: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#143C72' }}>
                  CKI Vũ Thị Thuý Phương - 0349.648.326
                </span>
              </div>
            </Content>
          </Layout>
        </Layout>
      </Layout>

    </div>
  )
}

export default MainLayout
