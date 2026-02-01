import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message, Space } from 'antd';
import { LockOutlined, TeamOutlined, GlobalOutlined } from '@ant-design/icons';
import { createCategory, updateCategory } from '../api/services/category.service';
import { useAuth } from '../contexts/AuthContext';

interface CategoryModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    parentId?: number | null;
    category?: any; // If editing
    isSubFolder?: boolean; // If true, hide global/department scope options (inherit or simple)
    initialValues?: { isGlobal?: boolean; departmentId?: number | null }; // New prop for preset context
}

const CategoryModal: React.FC<CategoryModalProps> = ({
    visible,
    onCancel,
    onSuccess,
    parentId,
    category,
    isSubFolder,
    initialValues // Destructure new prop
}) => {
    const [form] = Form.useForm();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            if (category) {
                let visibility = 'PRIVATE';
                if (category.isGlobal) {
                    visibility = 'PUBLIC';
                } else if (category.departmentId) {
                    visibility = 'DEPARTMENT';
                }

                form.setFieldsValue({
                    name: category.name,
                    description: category.description,
                    isActive: category.isActive,
                    visibility: visibility,
                });
            } else {
                // Default value logic
                let defaultVisibility = 'PRIVATE';
                if (initialValues) {
                    if (initialValues.isGlobal) {
                        defaultVisibility = 'PUBLIC';
                    } else if (initialValues.departmentId === user?.departmentId) {
                        defaultVisibility = 'DEPARTMENT';
                    }
                }

                form.setFieldsValue({
                    visibility: defaultVisibility
                });
            }
        }
    }, [visible, category, form, initialValues, user]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: any = {
                name: values.name,
                description: values.description,
                isActive: true, // Default to active
            };

            // Map visibility to payload
            if (values.visibility === 'PUBLIC') {
                payload.isGlobal = true;
                payload.departmentId = null;
            } else if (values.visibility === 'DEPARTMENT') {
                payload.isGlobal = false;
                // Use initialValues departmentId if present (to keep in same context), otherwise user's dept
                if (initialValues?.departmentId) {
                    payload.departmentId = initialValues.departmentId;
                } else if (user?.departmentId) {
                    payload.departmentId = user.departmentId;
                } else {
                    payload.departmentId = null;
                }
            } else {
                // PRIVATE
                payload.isGlobal = false;
                // Private folders still need a physical home
                if (initialValues?.departmentId) {
                    payload.departmentId = initialValues.departmentId;
                } else if (user?.departmentId) {
                    payload.departmentId = user.departmentId;
                } else {
                    payload.departmentId = null;
                }
            }

            if (parentId) {
                payload.parentId = parentId;
            }

            if (category && category.id) {
                await updateCategory(category.id, payload);
                message.success('Cập nhật thư mục thành công');
            } else {
                await createCategory(payload);
                message.success('Tạo thư mục thành công');
            }

            onSuccess();
            onCancel();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={category ? 'Cập nhật thư mục' : 'Thêm thư mục mới'}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Tên thư mục"
                    rules={[{ required: true, message: 'Vui lòng nhập tên thư mục' }]}
                >
                    <Input placeholder="Nhập tên thư mục" />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Mô tả"
                >
                    <Input.TextArea placeholder="Mô tả ngắn gọn (tùy chọn)" rows={3} />
                </Form.Item>

                <Form.Item
                    name="visibility"
                    label="Quyền truy cập"
                    initialValue="PRIVATE"
                    rules={[{ required: true, message: 'Vui lòng chọn quyền truy cập' }]}
                >
                    <Select>
                        <Select.Option value="PRIVATE">
                            <Space>
                                <LockOutlined />
                                <span>Chỉ mình tôi</span>
                            </Space>
                        </Select.Option>
                        <Select.Option value="DEPARTMENT">
                            <Space>
                                <TeamOutlined />
                                <span>Toàn khoa</span>
                            </Space>
                        </Select.Option>
                        <Select.Option value="PUBLIC">
                            <Space>
                                <GlobalOutlined />
                                <span>Công khai</span>
                            </Space>
                        </Select.Option>
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CategoryModal;
