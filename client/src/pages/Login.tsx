import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, ApiOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { setBackendUrl, getBackendUrl } from '../utils/config';

const { Title } = Typography;

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: any) => {
        setLoading(true);
        setError('');
        try {
            // Save backend URL first
            if (values.backendUrl) {
                setBackendUrl(values.backendUrl);
            }

            await login(values.username, values.password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #f0f2f5 0%, #d9e2ee 100%)', // Sáng sủa, hiện đại
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background decoration circles */}
            <div style={{
                position: 'absolute',
                top: -100,
                right: -100,
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'rgba(20, 60, 114, 0.05)',
                zIndex: 0
            }} />
            <div style={{
                position: 'absolute',
                bottom: -50,
                left: -50,
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'rgba(244, 210, 66, 0.1)',
                zIndex: 0
            }} />

            <Card
                style={{
                    width: 420,
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    borderTop: '4px solid #143C72', // Main brand color
                    zIndex: 1
                }}
                bordered={false}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <img
                            src="/logo.svg"
                            alt="Logo"
                            style={{ width: 64, height: 64, objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ color: '#143C72', fontWeight: 800, fontSize: 18, textTransform: 'uppercase', lineHeight: 1.4 }}>
                        Bệnh viện Đa khoa Số 1
                    </div>
                    <div style={{ color: '#143C72', fontWeight: 800, fontSize: 18, textTransform: 'uppercase', lineHeight: 1.4 }}>
                        Tỉnh Lào Cai
                    </div>
                    <div style={{ color: '#F4D242', fontStyle: 'italic', marginTop: 8, fontWeight: 500 }}>
                        More than a hospital
                    </div>
                </div>

                {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}

                <Form
                    name="login"
                    initialValues={{
                        remember: true,
                        backendUrl: getBackendUrl()
                    }}
                    onFinish={onFinish}
                    size="large"
                    layout="vertical"
                >
                    <Form.Item
                        name="backendUrl"
                        label={<span style={{ fontWeight: 500 }}>Backend URL (tùy chọn)</span>}
                    >
                        <Input
                            prefix={<ApiOutlined style={{ color: '#143C72' }} />}
                            placeholder="http://localhost:3000"
                        />
                    </Form.Item>
                    <Form.Item
                        name="username"
                        label={<span style={{ fontWeight: 500 }}>Tên đăng nhập</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
                    >
                        <Input prefix={<UserOutlined style={{ color: '#143C72' }} />} placeholder="Nhập tên đăng nhập" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label={<span style={{ fontWeight: 500 }}>Mật khẩu</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#143C72' }} />} placeholder="Nhập mật khẩu" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            loading={loading}
                            style={{
                                background: '#143C72',
                                borderColor: '#143C72',
                                height: 48,
                                fontSize: 16,
                                fontWeight: 600
                            }}
                        >
                            Đăng nhập hệ thống
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center', color: '#8c8c8c', fontSize: 13 }}>
                        © 2024 Hệ thống Quản lý Tài liệu Bệnh viện
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
