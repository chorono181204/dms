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

    const [form] = Form.useForm();

    // Extract initial IP from saved URL
    const getInitialIp = () => {
        const savedUrl = getBackendUrl();
        try {
            // Remove protocol and port
            return savedUrl.replace('http://', '').replace('https://', '').split(':')[0];
        } catch {
            return 'localhost';
        }
    };

    const onFinish = async (values: any) => {
        setLoading(true);
        setError('');
        try {
            // Update backend URL from IP
            if (values.ipAddress) {
                const newUrl = `http://${values.ipAddress.trim()}:3000`;
                setBackendUrl(newUrl);

                // Force reload if URL changed to ensure all services verify with new config? 
                // Alternatively, just trust the save. 
                // Since user said "lưu và dùng luôn", we assume current session needs it.
            }

            await login(values.username, values.password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đăng nhập thất bại');
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
            background: 'linear-gradient(135deg, #f0f2f5 0%, #d9e2ee 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', top: -100, right: -100, width: 400, height: 400,
                borderRadius: '50%', background: 'rgba(20, 60, 114, 0.05)', zIndex: 0
            }} />
            <div style={{
                position: 'absolute', bottom: -50, left: -50, width: 300, height: 300,
                borderRadius: '50%', background: 'rgba(244, 210, 66, 0.1)', zIndex: 0
            }} />

            <Card
                style={{
                    width: 420, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    borderTop: '4px solid #143C72', zIndex: 1
                }}
                bordered={false}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <img src="logo.svg" alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
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
                    form={form}
                    name="login"
                    initialValues={{
                        remember: true,
                        ipAddress: getInitialIp()
                    }}
                    onFinish={onFinish}
                    size="large"
                    layout="vertical"
                >
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
                    <Form.Item
                        name="ipAddress"
                        label={<span style={{ fontWeight: 500 }}>IP Máy chủ (Port 3000)</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập IP máy chủ!' }]}
                    >
                        <Input
                            prefix={<ApiOutlined style={{ color: '#143C72' }} />}
                            placeholder="Ví dụ: 192.168.1.10"
                        />
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
                        Hệ thống quản lý xét nghiệm theo ISO15189 và QĐ2429BYT
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
