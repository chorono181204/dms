import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import templateService, { Template } from '../services/template.service';
import { getBackendUrl } from '../utils/config';

interface TemplateModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    templateId?: number | null; // If present, we are editing
}

export default function TemplateModal({
    visible,
    onCancel,
    onSuccess,
    templateId
}: TemplateModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [fileList, setFileList] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchCategories = async (deptId?: number) => {
            try {
                const { getCategories } = await import('../api/services/category.service');
                const result = await getCategories({
                    isActive: true,
                    limit: 100,
                    departmentId: deptId
                });
                setCategories(result.results || []);
            } catch (error) {
                console.error('Failed to fetch categories');
            }
        };

        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (visible) {
            setFileList([]); // Reset files
            fetchCategories(user.departmentId);
            if (templateId) {
                setLoading(true);
                templateService.getTemplate(templateId)
                    .then((data) => {
                        form.setFieldsValue({
                            name: data.name,
                            categoryId: data.categoryId,
                            isActive: data.isActive
                        });
                        setEditorContent(data.content || '');
                    })
                    .catch((err) => {
                        message.error('Lỗi tải thông tin mẫu');
                        console.error(err);
                    })
                    .finally(() => setLoading(false));
            } else {
                // New mode
                form.resetFields();
                setEditorContent('');
            }
        }
    }, [visible, templateId, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // Construct FormData
            const formData = new FormData();
            formData.append('name', values.name);
            if (values.categoryId) formData.append('categoryId', values.categoryId);
            formData.append('isActive', values.isActive);
            if (values.content) formData.append('content', values.content); // Preserve old content if no new file

            if (fileList.length > 0) {
                // New file selected
                formData.append('file', fileList[0]);
            } else if (!editorContent) {
                // No file and no previous content
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
            if (error?.errorFields) return; // Form validation error
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
            width={700}
            centered
            confirmLoading={loading}
            okText="Lưu"
            cancelText="Hủy"
        >
            <Form form={form} layout="vertical">
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item
                        name="name"
                        label="Tên mẫu"
                        rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}
                        style={{ flex: 1 }}
                    >
                        <Input placeholder="Nhập tên mẫu" />
                    </Form.Item>
                    <Form.Item
                        name="categoryId"
                        label="Loại tài liệu"
                        rules={[{ required: true, message: 'Vui lòng chọn loại' }]}
                        style={{ width: 200 }}
                    >
                        <Select placeholder="Chọn loại">
                            {categories.map((cat) => (
                                <Select.Option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="isActive" label="Hoạt động" valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Form.Item
                        label="File mẫu"
                        required
                        help="Chọn file từ máy tính. File sẽ được lưu khi bấm nút Lưu."
                    >
                        {/* Display existing or selected path */}
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
                                    setEditorContent(file.name); // Show filename transiently
                                    return false; // Prevent auto upload
                                }}
                                fileList={fileList}
                                onRemove={() => {
                                    setFileList([]);
                                    setEditorContent('');
                                }}
                                maxCount={1}
                            >
                                <Button icon={<UploadOutlined />}>Chọn file</Button>
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
                </div>
            </Form>
        </Modal>
    );
}
