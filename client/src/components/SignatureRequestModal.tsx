import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, message, Radio, InputNumber, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
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

    // Signing Flow State
    const [signers, setSigners] = useState<{ userId: number, step: number, note?: string }[]>([]);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setSubmitType(1);
            setSigners([]);
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
                // Note: userIds field is used here if approvers selected
                const approverIds = values.userIds || [];
                // If submitDocument supports specific approvers, pass them. 
                // Currently submitDocument usually just sets status to PENDING.
                // Assuming existing logic is fine or irrelevant to sequential signing user request.
                await submitDocument(documentId);
                message.success('Đã gửi yêu cầu duyệt thành công!');
            } else {
                // Request Signature
                if (signers.length === 0) {
                    message.error('Vui lòng chọn ít nhất 1 người ký');
                    setLoading(false);
                    return;
                }

                // Use new payload structure
                await createSignatureRequest(documentId, { signers });
                message.success('Đã gửi yêu cầu trình ký thành công!');
            }

            onSuccess();
            onCancel();
        } catch (error) {
            console.error(error);
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
            width={600}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Chọn loại yêu cầu">
                    <Radio.Group onChange={(e) => setSubmitType(e.target.value)} value={submitType}>
                        <Radio value={1}>Gửi Lãnh đạo duyệt</Radio>
                        <Radio value={2}>Gửi đồng nghiệp ký nháy / ký số</Radio>
                    </Radio.Group>
                </Form.Item>

                {submitType === 1 ? (
                    <Form.Item
                        name="userIds"
                        label="Chọn người duyệt (tùy chọn)"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Để trống sẽ gửi cho Trưởng khoa..."
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
                ) : (
                    // SEQUENTIAL SIGNING UI
                    <div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', color: '#ff4d4f', marginBottom: 4 }}>
                                * Chọn người ký:
                            </label>

                            <Select
                                showSearch
                                style={{ width: '100%' }}
                                placeholder="Tìm và chọn người ký..."
                                optionFilterProp="children"
                                onChange={(val) => {
                                    // Add to list with default step = last step + 1 or 1
                                    const lastStep = signers.length > 0 ? Math.max(...signers.map(s => s.step)) : 0;
                                    setSigners([...signers, { userId: val, step: lastStep + 1 }]);
                                }}
                                value={null} // Reset always
                            >
                                {users.map(u => {
                                    // Filter out already selected
                                    if (signers.find(s => s.userId === u.id)) return null;
                                    return (
                                        <Option key={u.id} value={u.id}>
                                            {u.name || u.username} - {u.department?.name || '---'}
                                        </Option>
                                    );
                                })}
                            </Select>
                        </div>

                        <div style={{ background: '#fafafa', padding: 8, borderRadius: 6, border: '1px solid #f0f0f0', maxHeight: 300, overflowY: 'auto' }}>
                            {signers.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#ccc', padding: '20px 0' }}>
                                    Chưa chọn người ký
                                </div>
                            ) : (
                                signers.sort((a, b) => a.step - b.step).map((signer, index) => {
                                    const userObj = users.find(u => u.id === signer.userId);
                                    return (
                                        <div key={signer.userId} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            marginBottom: 8,
                                            padding: 8,
                                            border: '1px solid #e6e6e6',
                                            borderRadius: 6,
                                            background: '#fff'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ width: 80, marginRight: 8 }}>
                                                    <span style={{ fontSize: 12, color: '#888' }}>Bước:</span>
                                                    <InputNumber
                                                        min={1}
                                                        value={signer.step}
                                                        onChange={(val) => {
                                                            const newSigners = [...signers];
                                                            newSigners[index].step = val || 1;
                                                            setSigners(newSigners);
                                                        }}
                                                        style={{ width: 50, marginLeft: 4 }}
                                                        size="small"
                                                    />
                                                </div>
                                                <div style={{ flex: 1, fontWeight: 500 }}>
                                                    {userObj?.name || userObj?.username}
                                                </div>
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => {
                                                        setSigners(signers.filter(s => s.userId !== signer.userId));
                                                    }}
                                                />
                                            </div>

                                            <Input.TextArea
                                                placeholder="Ghi chú riêng cho người này..."
                                                autoSize={{ minRows: 1, maxRows: 3 }}
                                                value={signer.note}
                                                onChange={(e) => {
                                                    const newSigners = [...signers];
                                                    newSigners[index].note = e.target.value;
                                                    setSigners(newSigners);
                                                }}
                                                style={{ fontSize: 12 }}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            <i>* Nhập số bước để quy định thứ tự ký (Người ở bước sau phải đợi người bước trước ký xong).</i>
                        </div>
                    </div>
                )}
            </Form>
        </Modal>
    );
};

export default SignatureRequestModal;
