import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Upload, Button, message, Space, Row, Col, Tabs, InputNumber, Tooltip, DatePicker, Checkbox, Tag } from 'antd';
import { UploadOutlined, FileOutlined, DeleteOutlined, UserOutlined, NumberOutlined } from '@ant-design/icons';
import { createDocument, updateDocument, getDocument } from '../api/services/document.service';
import { getCategories } from '../api/services/category.service';
import { getUsers } from '../api/services/user.service';
import { createSignatureRequest } from '../api/services/signature.service';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface DocumentModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    documentId?: number | null;
    defaultCategoryId?: number | null;
}

const DocumentModal: React.FC<DocumentModalProps> = ({ visible, onCancel, onSuccess, documentId, defaultCategoryId }) => {
    const [form] = Form.useForm();
    const { user } = useAuth();
    const canCreateConfidential = user.role === 'ADMIN' || user.department?.isSupervisory;

    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);
    const [referenceFileList, setReferenceFileList] = useState<any[]>([]); // New files to upload
    const [existingAttachments, setExistingAttachments] = useState<any[]>([]); // Existing attachments from DB
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]); // IDs to delete
    const [departments, setDepartments] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]); // List of all users to share with
    const [visibility, setVisibility] = useState(canCreateConfidential ? 'PRIVATE' : 'DEPARTMENT');
    const [isReference, setIsReference] = useState(false);

    // Signing Flow State
    const [signers, setSigners] = useState<{ userId: number, step: number, note?: string }[]>([]);
    const [activeTab, setActiveTab] = useState('1');

    // Auth info to get department
    // Auth info to get department
    // const user = ... (moved to top)

    // Reset form when modal opens
    useEffect(() => {
        if (visible) {
            form.resetFields();
            setFileList([]);
            setReferenceFileList([]); // Clear new references
            setExistingAttachments([]); // Clear existing
            setDeletedAttachmentIds([]); // Clear deleted
            setSigners([]);
            setActiveTab('1');
            fetchCategories(); // Fetch categories for all users
            fetchUsers(); // Fetch users for sharing
            if (documentId) {
                fetchDocument(documentId);
            }
            fetchDepartments(); // Always fetch for sharing
            if (defaultCategoryId && !documentId) {
                form.setFieldsValue({ categoryId: defaultCategoryId, status: 'DRAFT' });
            } else if (!documentId) {
                form.setFieldsValue({ status: 'DRAFT' });
            }
        }
    }, [visible, documentId, defaultCategoryId]);

    const fetchUsers = async () => {
        try {
            const params: any = { limit: 1000, scope: 'all' };
            // Allow fetching all users for cross-department sharing
            // if (user.departmentId) {
            //     params.departmentId = user.departmentId;
            // }
            console.log('Fetching users with params:', params);
            const result = await getUsers(params);
            console.log('API Result:', result);
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

            const sharedUserIds = data.permissions
                ? [...new Set(data.permissions.filter((p: any) => p.userId).map((p: any) => p.userId).filter(Boolean))]
                : [];
            const sharedDeptIds = data.permissions
                ? [...new Set(data.permissions.filter((p: any) => p.departmentId).map((p: any) => p.departmentId).filter(Boolean))]
                : [];

            // Assume the first permission's level represents the general level (simplification)
            const generalAccessLevel = data.permissions?.[0]?.permission || data.accessLevel || 'VIEW';

            form.setFieldsValue({
                title: data.title,
                code: data.code,
                description: data.description,
                status: data.status,
                departmentId: data.departmentId,
                categoryId: data.categoryId,
                visibility: data.visibility || 'PRIVATE',
                sharedWith: sharedUserIds,
                sharedDepartments: sharedDeptIds,
                sharedAccessLevel: generalAccessLevel,
                effectiveDate: data.effectiveDate ? dayjs(data.effectiveDate) : null,
                expirationDate: data.expirationDate ? dayjs(data.expirationDate) : null,
                isReference: data.isReference || false,
            });
            setVisibility(data.visibility || 'PRIVATE');
            setIsReference(data.isReference || false);

            // Set existing attachments
            if (data.attachments) {
                setExistingAttachments(data.attachments);
            }
        } catch (error) {
            message.error('Không thể tải thông tin tài liệu');
        }
    };

    // Simplified sharing logic: remove auto-selection overrides
    useEffect(() => {
        if (visibility === 'PRIVATE') {
            // form.setFieldsValue({ sharedAccessLevel: 'VIEW' });
        }
    }, [visibility, form]);

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
            formData.append('isReference', values.isReference ? 'true' : 'false');

            if (values.effectiveDate) formData.append('effectiveDate', values.effectiveDate.toISOString());
            if (values.expirationDate) formData.append('expirationDate', values.expirationDate.toISOString());

            // Handle visibility
            formData.append('visibility', values.visibility || 'PRIVATE');
            formData.append('accessLevel', values.sharedAccessLevel || 'VIEW');

            // Handle sharedWithViewers and sharedWithEditors (Simplification Map)
            const sharedUsers = values.sharedWith || [];
            const sharedDepartments = values.sharedDepartments || [];
            const level = values.sharedAccessLevel || 'VIEW';

            // Map to backend fields
            formData.append('sharedUserIds', JSON.stringify(sharedUsers));
            formData.append('sharedDepartmentIds', JSON.stringify(sharedDepartments));
            formData.append('permission', level);

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

            // Append Reference Files
            referenceFileList.forEach((file) => {
                formData.append('references', file);
            });

            // Append Deleted Attachment IDs
            if (deletedAttachmentIds.length > 0) {
                formData.append('deletedAttachmentIds', JSON.stringify(deletedAttachmentIds));
            }

            if (documentId) {
                await updateDocument(documentId, formData);
                message.success('Cập nhật tài liệu thành công');

                // For Update, handle adding signers
                if (signers.length > 0) {
                    try {
                        await createSignatureRequest(documentId, { signers });
                        message.success('Đã gửi thêm yêu cầu ký');
                    } catch (err) {
                        message.warning('Cập nhật xong nhưng gửi yêu cầu ký thất bại');
                    }
                }
            } else {
                if (fileList.length === 0) {
                    message.error('Vui lòng chọn file văn bản');
                    setLoading(false);
                    return;
                }
                const newDoc = await createDocument(formData);
                message.success('Thêm mới tài liệu thành công');

                // If new doc and signers present, create signature request
                if (signers.length > 0) {
                    try {
                        await createSignatureRequest(newDoc.id, { signers });
                        message.success('Đã gửi yêu cầu ký');
                    } catch (err) {
                        console.error(err);
                        message.warning('Tài liệu đã tạo nhưng gửi yêu cầu ký thất bại');
                    }
                }
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
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                {/* TAB 1: THÔNG TIN VĂN BẢN */}
                <TabPane tab="Thông tin chung" key="1">
                    <Form form={form} layout="vertical">
                        <Row gutter={16}>
                            <Col span={10}>
                                <Form.Item
                                    name="title"
                                    label="Tiêu đề văn bản"
                                    rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                                >
                                    <Input placeholder="Nhập tiêu đề văn bản" />
                                </Form.Item>
                            </Col>
                            <Col span={7}>
                                <Form.Item
                                    name="code"
                                    label="Số/Ký hiệu"
                                >
                                    <Input placeholder="Số văn bản" />
                                </Form.Item>
                            </Col>
                            <Col span={7}>
                                {(user.role === 'ADMIN' || user.role === 'MANAGER' || documentId) ? (
                                    <Form.Item name="status" label="Trạng thái" initialValue="DRAFT">
                                        <Select>
                                            <Option value="DRAFT">Bản nháp</Option>
                                            <Option value="PENDING">Chờ duyệt</Option>
                                            <Option value="APPROVED">Đã duyệt</Option>
                                            <Option value="SIGNED">Đã ký</Option>
                                            <Option value="ARCHIVED">Lưu trữ</Option>
                                            <Option value="REJECTED">Từ chối</Option>
                                        </Select>
                                    </Form.Item>
                                ) : (
                                    <Form.Item label="Trạng thái">
                                        <Tag color="default">Bản nháp</Tag>
                                    </Form.Item>
                                )}
                            </Col>
                        </Row>

                        {user.role === 'ADMIN' && (
                            <Form.Item
                                name="departmentId"
                                label="Khoa / Phòng ban"
                                rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
                            >
                                <Select placeholder="Chọn khoa quản lý">
                                    {departments.map(dept => (
                                        <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="effectiveDate" label="Ngày hiệu lực">
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        format="DD/MM/YYYY"
                                        disabled={user.role !== 'ADMIN' && user.role !== 'MANAGER'}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="expirationDate" label="Ngày hết hiệu lực">
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        format="DD/MM/YYYY"
                                        disabled={user.role !== 'ADMIN' && user.role !== 'MANAGER'}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="isReference" valuePropName="checked" style={{ marginBottom: 12 }}>
                            <Checkbox onChange={(e) => setIsReference(e.target.checked)}>
                                <b>Là tài liệu tham khảo (Nguồn ngoài)</b>
                            </Checkbox>
                        </Form.Item>

                        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 12, paddingTop: 12 }}>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item
                                        name="visibility"
                                        label="Nhãn bảo mật (Watermark)"
                                        initialValue={canCreateConfidential ? 'PRIVATE' : 'DEPARTMENT'}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Select onChange={(val) => setVisibility(val)}>
                                            {(user.role === 'ADMIN' || user.department?.isSupervisory) && (
                                                <Option value="PRIVATE">03 - Bảo mật</Option>
                                            )}
                                            <Option value="DEPARTMENT">02 - Nội bộ</Option>
                                            <Option value="PUBLIC">01 - Công khai</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="File đính kèm" required={!documentId} style={{ marginBottom: 0 }}>
                                        <Upload {...uploadProps} maxCount={1}>
                                            <Button icon={<UploadOutlined />} block>Chọn file</Button>
                                        </Upload>
                                        <div style={{ marginTop: 2, color: '#999', fontSize: 10 }}>
                                            {documentId && '(Để trống nếu không đổi)'}
                                        </div>
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="Tài liệu tham khảo" style={{ marginBottom: 0 }}>
                                        {existingAttachments.length > 0 && (
                                            <div style={{ marginBottom: 4 }}>
                                                {existingAttachments.filter(att => !deletedAttachmentIds.includes(att.id)).map(att => (
                                                    <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, background: '#f0f0f0', padding: '1px 4px', marginBottom: 1, borderRadius: 2 }}>
                                                        <span style={{ maxWidth: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{att.fileName}</span>
                                                        <DeleteOutlined onClick={() => setDeletedAttachmentIds([...deletedAttachmentIds, att.id])} style={{ color: 'red', cursor: 'pointer' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Upload
                                            onRemove={(file) => setReferenceFileList(prev => prev.filter(f => f.uid !== file.uid))}
                                            beforeUpload={(file) => { setReferenceFileList(prev => [...prev, file]); return false; }}
                                            fileList={referenceFileList}
                                            multiple={true}
                                        >
                                            <Button icon={<UploadOutlined />} block>Thêm file</Button>
                                        </Upload>
                                    </Form.Item>
                                </Col>
                            </Row>

                            {(visibility === 'PRIVATE' || visibility === 'DEPARTMENT' || visibility === 'PUBLIC') && (
                                <div style={{ background: '#f9f9f9', padding: '12px 16px', borderRadius: 8, marginTop: 12, border: '1px solid #f0f0f0' }}>
                                    <h4 style={{ marginBottom: 16, color: '#143C72' }}>Phạm vi chia sẻ & Truy cập</h4>
                                    <Row gutter={16}>
                                        <Col span={24} style={{ marginBottom: 12 }}>
                                            <Form.Item
                                                name="sharedDepartments"
                                                label="Chia sẻ với (Khoa / Phòng ban)"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Select
                                                    mode="multiple"
                                                    placeholder="Chọn các khoa được quyền xem..."
                                                    style={{ width: '100%' }}
                                                    optionFilterProp="children"
                                                    allowClear
                                                >
                                                    <Option key="all" value="all" style={{ fontWeight: 'bold', color: '#1890ff' }}>-- TẤT CẢ KHOA (CÔNG KHAI) --</Option>
                                                    {departments.map(dept => (
                                                        <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={16}>
                                            <Form.Item
                                                name="sharedWith"
                                                label="Chia sẻ với (Cá nhân)"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Select
                                                    mode="multiple"
                                                    placeholder="Chọn nhân viên..."
                                                    style={{ width: '100%' }}
                                                    optionFilterProp="label"
                                                    maxTagCount={2}
                                                    allowClear
                                                >
                                                    {users
                                                        .filter(u => u.role !== 'ADMIN')
                                                        .map(u => (
                                                            <Option
                                                                key={u.id}
                                                                value={u.id}
                                                                label={u.name || u.username}
                                                            >
                                                                {u.name || u.username} {u.department?.name ? ` - ${u.department.name}` : ''}
                                                            </Option>
                                                        ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>

                                        <Col span={8}>
                                            <Form.Item
                                                name="sharedAccessLevel"
                                                label="Quyền hạn chung"
                                                initialValue="VIEW"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Select>
                                                    <Option value="VIEW">Chỉ xem</Option>
                                                    <Option value="DOWNLOAD">Được tải về</Option>
                                                    <Option value="EDIT">Được chỉnh sửa</Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            )}
                        </div>

                        <Form.Item
                            name="description"
                            label="Mô tả / Trích yếu"
                            style={{ marginTop: 16 }}
                        >
                            <TextArea rows={3} placeholder="Nội dung tóm tắt..." />
                        </Form.Item>
                    </Form>
                </TabPane>

                {/* TAB 2: TRÌNH KÝ */}
                {!isReference && (
                    <TabPane tab="Trình ký (Luồng ký)" key="2">
                        <div style={{ marginBottom: 16, background: '#e6f7ff', padding: 12, borderRadius: 6, border: '1px solid #91d5ff' }}>
                            <p style={{ margin: 0, fontSize: 13 }}>
                                Thiết lập luồng ký cho văn bản này. <br />
                                Các bước ký sẽ được thực hiện tuần tự. Người ở Bước 2 chỉ nhận được yêu cầu sau khi người ở Bước 1 đã ký.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <Select
                                showSearch
                                style={{ flex: 1 }}
                                placeholder="Chọn người ký..."
                                optionFilterProp="children"
                                onChange={(val) => {
                                    // Add to list with default step = last step + 1 or 1
                                    const lastStep = signers.length > 0 ? Math.max(...signers.map(s => s.step)) : 0;
                                    setSigners([...signers, { userId: val, step: lastStep + 1 }]);
                                }}
                                value={null} // Reset always
                            >
                                {users
                                    .filter(u => u.role !== 'ADMIN')
                                    .map(u => {
                                        const displayName = u.name || u.username;
                                        const deptName = u.department?.name ? ` - ${u.department.name}` : '';
                                        const displayText = u.position
                                            ? `${displayName}${deptName} (${u.position})`
                                            : `${displayName}${deptName}`;
                                        // Filter out already selected
                                        if (signers.find(s => s.userId === u.id)) return null;
                                        return (
                                            <Option key={u.id} value={u.id}>{displayText}</Option>
                                        );
                                    })}
                            </Select>
                        </div>

                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {signers.sort((a, b) => a.step - b.step).map((signer, index) => {
                                const userObj = users.find(u => u.id === signer.userId);
                                return (
                                    <div key={signer.userId} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: 8,
                                        padding: 8,
                                        border: '1px solid #f0f0f0',
                                        borderRadius: 6,
                                        background: '#fff'
                                    }}>
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
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>
                                                {userObj?.name || userObj?.username}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                                {userObj?.position || 'Chưa cập nhật chức vụ'}
                                            </div>
                                            <Input
                                                placeholder="Ghi chú cho người này..."
                                                size="small"
                                                value={signer.note}
                                                onChange={(e) => {
                                                    const newSigners = [...signers];
                                                    newSigners[index].note = e.target.value;
                                                    setSigners(newSigners);
                                                }}
                                                style={{ fontSize: 12 }}
                                            />
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
                                );
                            })}
                            {signers.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                    Chưa có người ký nào được chọn.
                                </div>
                            )}
                        </div>
                    </TabPane>
                )}
            </Tabs>
        </Modal >
    );
};

export default DocumentModal;
