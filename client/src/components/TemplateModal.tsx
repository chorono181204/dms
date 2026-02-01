import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message, Button, Upload, Card, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import templateService from '../services/template.service';
import { getBackendUrl } from '../utils/config';
import { useAuth } from '../contexts/AuthContext';

interface TemplateModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    templateId?: number | null; // If present, we are editing
    defaultCategoryId?: number | null; // New prop
    initialValues?: { isGlobal?: boolean; departmentId?: number | null }; // Context prop
}

export default function TemplateModal({
    visible,
    onCancel,
    onSuccess,
    templateId,
    defaultCategoryId,
    initialValues // Destructure
}: TemplateModalProps) {
    const { user } = useAuth();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [fileList, setFileList] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [visibility, setVisibility] = useState('PRIVATE');

    const fetchUsers = async () => {
        try {
            const { getUsers } = await import('../api/services/user.service');
            const result = await getUsers({ limit: 1000, scope: 'all' });
            setUsers(result.results.filter((u: any) => u.id !== user?.id) || []);
        } catch (error) {
            console.error('Failed to fetch users');
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



    useEffect(() => {
        if (visible) {
            setFileList([]); // Reset files
            fetchDepartments();
            fetchUsers();

            if (templateId) {
                setLoading(true);
                templateService.getTemplate(templateId)
                    .then((data) => {
                        const sharedUserIds = data.permissions
                            ? [...new Set(data.permissions.filter((p: any) => p.userId).map((p: any) => p.userId).filter(Boolean))]
                            : [];
                        const sharedDeptIds = data.permissions
                            ? [...new Set(data.permissions.filter((p: any) => p.departmentId).map((p: any) => p.departmentId).filter(Boolean))]
                            : [];
                        const generalAccessLevel = data.permissions?.[0]?.permission || data.accessLevel || 'VIEW';

                        form.setFieldsValue({
                            name: data.name,
                            categoryId: data.categoryId,
                            isActive: data.isActive,
                            visibility: data.visibility || 'PRIVATE',
                            sharedWith: sharedUserIds,
                            sharedDepartments: sharedDeptIds,
                            sharedAccessLevel: generalAccessLevel,
                        });
                        setEditorContent(data.content || '');
                        setVisibility(data.visibility || 'PRIVATE');
                    })
                    .catch((err) => {
                        message.error('Lỗi tải thông tin mẫu');
                        console.error(err);
                    })
                    .finally(() => setLoading(false));
            } else {
                form.resetFields();

                // Determine default visibility based on context
                let defaultVisibility = 'PRIVATE';
                if (initialValues) {
                    if (initialValues.isGlobal) {
                        defaultVisibility = 'PUBLIC';
                    } else if (initialValues.departmentId === user?.departmentId) {
                        // If in department folder, default to Department? Or Private?
                        // Usually department folder -> Department visibility
                        defaultVisibility = 'DEPARTMENT';
                    }
                }

                form.setFieldsValue({
                    isActive: true,
                    visibility: defaultVisibility,
                    sharedAccessLevel: 'VIEW',
                    categoryId: defaultCategoryId // Pre-select category
                });
                setEditorContent('');
                setVisibility(defaultVisibility);
            }
        }
    }, [visible, templateId, form, initialValues, user]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            const formData = new FormData();
            formData.append('name', values.name);
            if (values.categoryId) formData.append('categoryId', values.categoryId);
            formData.append('isActive', String(values.isActive));

            // New Sharing Fields
            const formVisibility = values.visibility || 'PRIVATE';
            formData.append('visibility', formVisibility);
            formData.append('accessLevel', values.sharedAccessLevel || 'VIEW');
            formData.append('sharedUserIds', JSON.stringify(values.sharedWith || []));
            formData.append('sharedDepartmentIds', JSON.stringify(values.sharedDepartments || []));
            formData.append('permission', values.sharedAccessLevel || 'VIEW');

            // If inherited department context exists, we might want to ensure the template is linked to it?
            // But Template creation currently relies on user.departmentId or explicit departmentId.
            // If initialValues.departmentId exists and is different from user.departmentId, maybe we should pass it?
            // Currently backend `createTemplate` logic:
            // const deptId = req.body.departmentId ? ... : user.departmentId;
            // So if we don't send it, it uses user's dept.
            // If I am Admin creating a template in "Dept B" folder, it should belong to "Dept B".
            if (initialValues?.departmentId) {
                formData.append('departmentId', String(initialValues.departmentId));
            }
            // If public (isGlobal) usually dept is null? Or keeps creator dept?
            // "Public" folder has null department?
            // If I create template in Public Folder, maybe I want it to be Dept-neutral? 
            // Or "My Dept contributed this Public Template".
            // Let's stick to: If folder has explicit department, use it. If folder is Global (dept=null), use User's dept.

            if (fileList.length > 0) {
                formData.append('file', fileList[0]);
            } else if (!editorContent) {
                message.error('Vui lòng chọn file mẫu');
                return;
            }

            setLoading(true);
            if (templateId) {
                await templateService.updateTemplate(templateId, formData);
                message.success('Cập nhật mẫu thành công');
            } else {
                await templateService.createTemplate(formData);
                message.success('Thêm mẫu thành công');
            }
            onSuccess();
        } catch (error: any) {
            console.error(error);
            if (error?.errorFields) return;
            message.error(error.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={templateId ? 'Chỉnh sửa mẫu' : 'Thêm mẫu mới'}
            open={visible}
            onOk={handleSubmit}
            onCancel={onCancel}
            width={800}
            centered
            confirmLoading={loading}
            okText="Lưu"
            cancelText="Hủy"
        >
            <Form form={form} layout="vertical">
                <Row gutter={16}>
                    <Col span={20}>
                        <Form.Item
                            name="name"
                            label="Tên mẫu"
                            rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}
                        >
                            <Input placeholder="Nhập tên mẫu" />
                        </Form.Item>
                        {/* Hidden categoryId field to maintain context */}
                        <Form.Item name="categoryId" hidden>
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>

                <Card size="small" title="Phạm vi chia sẻ & Truy cập" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="visibility" label="Ai có thể thấy mẫu này?">
                                <Select onChange={(v) => setVisibility(v)}>
                                    <Select.Option value="PRIVATE">Chỉ tôi hoặc những người được chia sẻ</Select.Option>
                                    <Select.Option value="DEPARTMENT">Nội bộ khoa/phòng</Select.Option>
                                    <Select.Option value="PUBLIC">Cả hệ thống (Công khai)</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="sharedAccessLevel" label="Quyền hạn mặc định">
                                <Select>
                                    <Select.Option value="VIEW">Chỉ xem & Sử dụng</Select.Option>
                                    <Select.Option value="EDIT">Được phép chỉnh sửa mẫu</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    {(visibility === 'PRIVATE' || visibility === 'DEPARTMENT') && (
                        <>
                            <Form.Item name="sharedDepartments" label="Chia sẻ thêm với các Khoa/Phòng khác">
                                <Select mode="multiple" placeholder="Chọn khoa/phòng" style={{ width: '100%' }} allowClear>
                                    <Select.Option key="all" value={-99}>[Tất cả các khoa/phòng]</Select.Option>
                                    {departments.map(dept => (
                                        <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="sharedWith" label="Chia sẻ cho cá nhân cụ thể">
                                <Select mode="multiple" placeholder="Chọn nhân viên" style={{ width: '100%' }} allowClear optionFilterProp="children">
                                    {users.map(u => (
                                        <Select.Option key={u.id} value={u.id}>
                                            {u.name} ({u.username}) {u.department?.name ? `- ${u.department.name}` : ''}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </>
                    )}
                </Card>

                <Form.Item
                    label="File mẫu"
                    required
                    help="Chọn file từ máy tính. File sẽ được lưu khi bấm nút Lưu."
                >
                    {editorContent && (
                        <div style={{ marginBottom: 8, padding: '8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                            <span style={{ color: '#52c41a', fontWeight: 500 }}>
                                {editorContent.includes('G:\\') ? '✓ Đã có file lưu trên hệ thống' : '✓ Đã chọn file (chờ lưu)'}
                            </span>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Upload
                            beforeUpload={(file) => {
                                setFileList([file]);
                                setEditorContent(file.name);
                                return false;
                            }}
                            showUploadList={false}
                        >
                            <Button icon={<UploadOutlined />}>Chọn file mới</Button>
                        </Upload>

                        <Button
                            disabled={!editorContent || !editorContent.includes('G:\\')}
                            onClick={() => {
                                if (editorContent && editorContent.includes('G:\\')) {
                                    const downloadUrl = `${getBackendUrl()}/v1/upload/download?path=${encodeURIComponent(editorContent)}&token=${localStorage.getItem('accessToken')}`;
                                    window.location.href = downloadUrl;
                                }
                            }}
                        >
                            Tải file về
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
}
