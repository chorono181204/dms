import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Upload, Button, message, Space, Row, Col } from 'antd';
import { UploadOutlined, FileOutlined } from '@ant-design/icons';
import { createDocument, updateDocument, getDocument } from '../api/services/document.service';
import { getCategories } from '../api/services/category.service';
import { getUsers } from '../api/services/user.service';

const { Option } = Select;
const { TextArea } = Input;

interface DocumentModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    documentId?: number | null;
}

const DocumentModal: React.FC<DocumentModalProps> = ({ visible, onCancel, onSuccess, documentId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]); // List of all users to share with
    const [visibility, setVisibility] = useState('PRIVATE');

    // Auth info to get department
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Reset form when modal opens
    useEffect(() => {
        if (visible) {
            form.resetFields();
            setFileList([]);
            fetchCategories(); // Fetch categories for all users
            fetchUsers(); // Fetch users for sharing
            if (documentId) {
                fetchDocument(documentId);
            }
            if (user.role === 'ADMIN') {
                fetchDepartments();
            }
        }
    }, [visible, documentId]);

    const fetchUsers = async () => {
        try {
            const params: any = { limit: 1000 };
            if (user.departmentId) {
                params.departmentId = user.departmentId;
            }
            const result = await getUsers(params);
            // Filter out current user from the list (optional, but good UX)
            // But sometimes you want to see yourself? Usually not for sharing.
            setUsers(result.results.filter((u: any) => u.id !== user.id) || []);
        } catch (error) {
            console.error('Failed to fetch users');
        }
    };

    const fetchCategories = async () => {
        try {
            // Filter by department + global
            const result = await getCategories({
                isActive: true,
                limit: 100,
                departmentId: user.departmentId
            });
            setCategories(result.results || []);
        } catch (error) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchDepartments = async () => {
        try {
            const { getDepartments } = await import('../api/services/department.service');
            const result = await getDepartments({ limit: 100 });
            setDepartments(result.results || []);
        } catch (error) {
            console.error('Failed to fetch departments', error);
        }
    };

    const fetchDocument = async (id: number) => {
        try {
            const data = await getDocument(id);

            const sharedWith: number[] = [];
            let accessLevel = 'VIEW';

            if (data.permissions && data.permissions.length > 0) {
                data.permissions.forEach((p: any) => {
                    sharedWith.push(p.userId);
                    // If any permission is EDIT, we assume the shared level is EDIT
                    if (p.permission === 'EDIT') accessLevel = 'EDIT';
                });
            }

            form.setFieldsValue({
                title: data.title,
                code: data.code,
                description: data.description,
                status: data.status,
                departmentId: data.departmentId,
                categoryId: data.categoryId,
                visibility: data.visibility || 'PRIVATE',
                sharedWith: sharedWith,
                sharedAccessLevel: accessLevel
            });
            setVisibility(data.visibility || 'PRIVATE');
        } catch (error) {
            message.error('Không thể tải thông tin tài liệu');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const formData = new FormData();
            formData.append('title', values.title);
            if (values.code) formData.append('code', values.code);
            if (values.description) formData.append('description', values.description);
            if (values.status) formData.append('status', values.status);
            if (values.categoryId) formData.append('categoryId', values.categoryId);

            // Handle visibility
            formData.append('visibility', values.visibility || 'PRIVATE');
            formData.append('accessLevel', 'VIEW');

            // Handle sharedWithViewers and sharedWithEditors (Simplification Map)
            if (values.visibility === 'PRIVATE' || !values.visibility) {
                const sharedWith = values.sharedWith || [];
                const level = values.sharedAccessLevel || 'VIEW';

                // Map to backend fields
                if (level === 'EDIT') {
                    formData.append('sharedWithEditors', JSON.stringify(sharedWith));
                    formData.append('sharedWithViewers', JSON.stringify([]));
                } else {
                    formData.append('sharedWithViewers', JSON.stringify(sharedWith));
                    formData.append('sharedWithEditors', JSON.stringify([]));
                }
            } else {
                formData.append('sharedWithViewers', JSON.stringify([]));
                formData.append('sharedWithEditors', JSON.stringify([]));
            }

            // Should be automatic based on user, but can pass explicit if admin
            if (user.role === 'ADMIN') {
                if (values.departmentId) {
                    formData.append('departmentId', values.departmentId);
                } else {
                    message.error('Vui lòng chọn khoa/phòng ban');
                    setLoading(false);
                    return;
                }
            } else {
                formData.append('departmentId', user.departmentId || ''); // Should specific field or inherit?
                // Controller will use user.departmentId if not sent.
            }

            if (fileList.length > 0) {
                const fileToUpload = fileList[0].originFileObj || fileList[0];
                formData.append('file', fileToUpload);
            }

            if (documentId) {
                await updateDocument(documentId, formData);
                message.success('Cập nhật tài liệu thành công');
            } else {
                if (fileList.length === 0) {
                    message.error('Vui lòng chọn file văn bản');
                    setLoading(false);
                    return;
                }
                await createDocument(formData);
                message.success('Thêm mới tài liệu thành công');
            }

            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const uploadProps = {
        onRemove: (file: any) => {
            setFileList([]);
        },
        beforeUpload: (file: any) => {
            setFileList([file]);
            return false; // Prevent auto upload
        },
        fileList,
    };

    return (
        <Modal
            title={documentId ? 'Cập nhật tài liệu' : 'Thêm mới tài liệu'}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
            width={700}
        >
            <Form form={form} layout="vertical">
                {user.role === 'ADMIN' && (
                    <Form.Item
                        name="departmentId"
                        label="Khoa / Phòng ban"
                        rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
                    >
                        <Select placeholder="Chọn khoa quản lý văn bản này">
                            {departments.map(dept => (
                                <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}

                <Form.Item
                    name="title"
                    label="Tiêu đề văn bản"
                    rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                >
                    <Input placeholder="Nhập tiêu đề văn bản" />
                </Form.Item>

                <Form.Item
                    name="categoryId"
                    label="Loại văn bản"
                    rules={[{ required: true, message: 'Vui lòng chọn loại văn bản' }]}
                >
                    <Select placeholder="Chọn loại văn bản">
                        {categories.map(cat => (
                            <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="code"
                    label="Số/Ký hiệu văn bản"
                >
                    <Input placeholder="Số văn bản (nếu có)" />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Mô tả / Trích yếu"
                >
                    <TextArea rows={4} placeholder="Nội dung tóm tắt..." />
                </Form.Item>

                <Form.Item label="File đính kèm" required={!documentId}>
                    <Upload {...uploadProps} maxCount={1}>
                        <Button icon={<UploadOutlined />}>Chọn file</Button>
                    </Upload>
                    <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                        {documentId && 'Để trống nếu không muốn thay đổi file.'}
                    </div>
                </Form.Item>
                {documentId && (
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Option value="DRAFT">Bản nháp</Option>
                            <Option value="PENDING">Chờ duyệt</Option>
                            <Option value="APPROVED">Đã duyệt</Option>
                            <Option value="SIGNED">Đã ký</Option>
                            <Option value="ARCHIVED">Lưu trữ</Option>
                        </Select>
                    </Form.Item>
                )}

                <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 24, paddingTop: 16 }}>
                    <Form.Item
                        name="visibility"
                        label="Phạm vi chia sẻ"
                        initialValue="PRIVATE"
                    >
                        <Select onChange={(val) => setVisibility(val)}>
                            <Option value="PRIVATE">Riêng tư (Chỉ người được chọn)</Option>
                            <Option value="DEPARTMENT">Toàn bộ phòng ban</Option>
                        </Select>
                    </Form.Item>

                    {visibility === 'PRIVATE' && (
                        <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                            <Form.Item
                                name="sharedWith"
                                label="Danh sách người được chia sẻ"
                                help="Chọn những người bạn muốn chia sẻ tài liệu này (Để trống nếu chỉ bạn mới có quyền xem)."
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Chọn nhân viên..."
                                    style={{ width: '100%' }}
                                    optionFilterProp="children"
                                    allowClear
                                >
                                    {users.map(u => {
                                        const displayName = u.name || u.username;
                                        const displayText = u.position
                                            ? `${displayName} (${u.position})`
                                            : displayName;
                                        return (
                                            <Option key={u.id} value={u.id}>{displayText}</Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="sharedAccessLevel"
                                label="Quyền hạn cho người được chia sẻ"
                                initialValue="VIEW"
                            >
                                <Select>
                                    <Option value="VIEW">Chỉ xem & Tải về</Option>
                                    <Option value="EDIT">Được phép Chỉnh sửa</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    )}
                </div>

            </Form>
        </Modal >
    );
};

export default DocumentModal;
