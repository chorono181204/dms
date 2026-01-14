import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, message, Radio } from 'antd';
import { getUsers } from '../api/services/user.service';
import { createSignatureRequest } from '../api/services/signature.service';
import { submitDocument } from '../api/services/document.service';

interface SignatureRequestModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    documentId: number | null;
}

const { Option } = Select;
const { TextArea } = Input;

const SignatureRequestModal: React.FC<SignatureRequestModalProps> = ({ visible, onCancel, onSuccess, documentId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [submitType, setSubmitType] = useState<number>(1);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setSubmitType(1);
            fetchUsers();
        }
    }, [visible]);

    const fetchUsers = async () => {
        try {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const result = await getUsers({ limit: 1000 });
            setUsers(result.results.filter((u: any) => u.id !== currentUser.id) || []);
        } catch (error) {
            console.error('Failed to fetch users');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (!documentId) {
                message.error('Không tìm thấy tài liệu');
                return;
            }

            if (submitType === 1) {
                // Submit for Approval - can optionally select specific approvers
                await submitDocument(documentId);
                message.success('Đã gửi yêu cầu duyệt thành công!');
            } else {
                // Request Signature
                await createSignatureRequest(documentId, values.userIds, values.note || '');
                message.success('Đã gửi yêu cầu trình ký thành công!');
            }

            onSuccess();
            onCancel();
        } catch (error) {
            message.error('Gửi yêu cầu thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Trình ký văn bản"
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
            okText="Gửi yêu cầu"
            cancelText="Hủy"
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Chọn loại yêu cầu">
                    <Radio.Group onChange={(e) => setSubmitType(e.target.value)} value={submitType}>
                        <Radio value={1}>Gửi Lãnh đạo duyệt</Radio>
                        <Radio value={2}>Gửi đồng nghiệp ký nháy / ký số</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name="userIds"
                    label={submitType === 1 ? "Chọn người duyệt (tùy chọn)" : "Chọn người ký"}
                    rules={submitType === 2 ? [{ required: true, message: 'Vui lòng chọn ít nhất 1 người ký' }] : []}
                >
                    <Select
                        mode="multiple"
                        placeholder={submitType === 1 ? "Để trống sẽ gửi cho Trưởng khoa..." : "Chọn danh sách người cần ký..."}
                        filterOption={(input, option) =>
                            (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                        }
                    >
                        {users.map(u => (
                            <Option key={u.id} value={u.id}>
                                {u.name || u.username} - {u.department?.name || '---'}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item name="note" label="Ghi chú">
                    <TextArea rows={4} placeholder="Ví dụ: Sếp ký duyệt giúp em..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default SignatureRequestModal;
