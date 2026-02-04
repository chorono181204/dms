import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Upload, Button, message, Row, Col, Avatar, Tabs, List, Skeleton, Divider } from 'antd';
import { UploadOutlined, UserOutlined, SendOutlined, PaperClipOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as taskService from '../../api/services/task.service';
import * as userService from '../../api/services/user.service';
import { useAuth } from '../../contexts/AuthContext';

interface TaskModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    task?: any; // If task is provided, it's edit mode
}

const { Option } = Select;

const TaskModal: React.FC<TaskModalProps> = ({ visible, onCancel, onSuccess, task }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const { user: currentUser } = useAuth();
    const [fileList, setFileList] = useState<any[]>([]);

    // Detailed task state (for comments)
    const [detailedTask, setDetailedTask] = useState<any>(null);
    const [commentContent, setCommentContent] = useState('');
    const [commentFiles, setCommentFiles] = useState<any[]>([]);
    const [submittingComment, setSubmittingComment] = useState(false);

    // Check if user is owner (assigner) - Only if task exists. New task starts as owner.
    // If not task (create mode), user is implicitly owner.
    // Ensure task?.assignerId is compared correctly (both numbers usually)
    const isOwner = !task || (currentUser?.id === task.assignerId);

    const token = localStorage.getItem('accessToken');

    // Admin override?
    const canEdit = isOwner || currentUser?.role === 'ADMIN';

    const [attachments, setAttachments] = useState<any[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);

    useEffect(() => {
        if (visible) {
            loadUsers();
            if (task) {
                // Fetch full details
                loadTaskDetails(task.id);

                form.setFieldsValue({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    status: task.status,
                    assigneeIds: task.assignees?.map((a: any) => a.id) || [],
                    approverId: task.approverId,
                    dueDate: task.dueDate ? dayjs(task.dueDate) : null,
                });

                // Set initial files
                setFileList([]);
                setAttachments(task.attachments || []);
                setDeletedAttachmentIds([]);
            } else {
                setDetailedTask(null);
                form.resetFields();
                form.setFieldsValue({
                    status: 'TODO',
                    priority: 'NORMAL',
                    assigneeIds: []
                });
                setFileList([]);
                setAttachments([]);
                setDeletedAttachmentIds([]);
            }
        }
    }, [visible, task, currentUser]);

    const loadTaskDetails = async (taskId: number) => {
        try {
            const data = await taskService.getTaskDetails(taskId);
            setDetailedTask(data);
            // Also update attachments from details in case the prop was stale, 
            // but strictly only if we haven't modified them locally yet? 
            // Actually, usually we trust the prop or the detail fetch. 
            // Let's rely on prop for initial load as per existing logic, or sync here if safer.
            // If we just opened, we can sync.
            if (data.attachments) {
                setAttachments(data.attachments);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddComment = async (type: 'COMMENT' | 'RESULT') => {
        if (!detailedTask) return;
        if (!commentContent.trim() && commentFiles.length === 0) return;

        setSubmittingComment(true);
        try {
            await taskService.addTaskComment(detailedTask.id, {
                content: commentContent,
                type: type,
                files: commentFiles
            });
            message.success(type === 'RESULT' ? 'Đã gửi kết quả' : 'Đã gửi bình luận');
            setCommentContent('');
            setCommentFiles([]);
            loadTaskDetails(detailedTask.id); // Reload
        } catch (error) {
            message.error('Gửi thất bại');
        } finally {
            setSubmittingComment(false);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await userService.getUsers({ limit: 100, scope: 'all' });
            setUsers(data.results || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Process deletions first
            if (deletedAttachmentIds.length > 0 && task) {
                await Promise.all(deletedAttachmentIds.map(id => taskService.deleteTaskAttachment(task.id, id)));
            }

            const submitData = {
                ...values,
                dueDate: values.dueDate ? values.dueDate.toISOString() : null,
                files: fileList
            };

            if (task) {
                // Edit
                await taskService.updateTask(task.id, submitData);
                message.success('Cập nhật công việc thành công');
            } else {
                // Create
                await taskService.createTask(submitData);
                message.success('Tạo công việc mới thành công');
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            message.error('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!task) return;
        Modal.confirm({
            title: 'Xóa công việc',
            content: 'Bạn có chắc chắn muốn xóa công việc này không?',
            onOk: async () => {
                try {
                    await taskService.deleteTask(task.id);
                    message.success('Xóa thành công');
                    onSuccess();
                } catch (error) {
                    message.error('Không thể xóa');
                }
            }
        });
    };

    const handleRemoveAttachment = (attId: number) => {
        setDeletedAttachmentIds(prev => [...prev, attId]);
        setAttachments(prev => prev.filter(item => item.id !== attId));
    };

    return (
        <Modal
            title={task ? (canEdit ? "Chi tiết & Cập nhật công việc" : "Chi tiết công việc (Chỉ xem)") : "Thêm công việc mới"}
            open={visible}
            onCancel={onCancel}
            width={700}
            footer={[
                task && canEdit && (
                    <Button key="delete" danger onClick={handleDelete} style={{ float: 'left' }}>
                        Xóa
                    </Button>
                ),
                <Button key="cancel" onClick={onCancel}>
                    Hủy
                </Button>,
                canEdit && <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    {task ? 'Cập nhật' : 'Tạo mới'}
                </Button>
            ]}
            style={{ top: 20 }}
            bodyStyle={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', overflowX: 'hidden' }}
        >
            <Form form={form} layout="vertical" disabled={!canEdit}>
                <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
                    <Input placeholder="Nhập tên công việc..." />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="priority" label="Mức độ ưu tiên">
                            <Select>
                                <Option value="LOW">Thấp</Option>
                                <Option value="NORMAL">Bình thường</Option>
                                <Option value="HIGH">Cao</Option>
                                <Option value="URGENT">Khẩn cấp</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="dueDate" label="Hạn hoàn thành">
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="assigneeIds" label="Giao cho (nhiều người)">
                            <Select
                                mode="multiple"
                                showSearch
                                placeholder="Chọn người thực hiện"
                                optionFilterProp="children"
                                filterOption={(input, option: any) =>
                                    (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {users
                                    .filter(u => {
                                        return true;
                                    })
                                    .map(u => (
                                        <Option key={u.id} value={u.id}>
                                            {u.name || u.username} {u.department?.name ? ` - ${u.department.name}` : ''} {u.isChief ? '(KTV Trưởng)' : ''}
                                        </Option>
                                    ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="approverId" label="Người duyệt (Tùy chọn)">
                            <Select
                                showSearch
                                allowClear
                                placeholder="Chọn người duyệt"
                                optionFilterProp="children"
                                filterOption={(input, option: any) =>
                                    (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {users.map(u => (
                                    <Option key={u.id} value={u.id}>
                                        {u.name || u.username}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="status" label="Trạng thái">
                            <Select disabled={true}>
                                <Option value="TODO">Cần làm</Option>
                                <Option value="IN_PROGRESS">Đang làm</Option>
                                <Option value="REVIEW">Chờ duyệt</Option>
                                <Option value="DONE">Hoàn thành</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="description" label="Mô tả">
                    <Input.TextArea rows={4} placeholder="Mô tả chi tiết công việc..." />
                </Form.Item>

                {/* Existing Attachments Display */}
                {task && attachments && attachments.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8 }}>Tài liệu đính kèm:</div>
                        {attachments.map((att: any) => (
                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <a href={`/api/v1/upload/download?path=${encodeURIComponent(att.filePath)}&token=${token}`} target="_blank" rel="noopener noreferrer">
                                    {att.fileName}
                                </a>
                                {canEdit && (
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemoveAttachment(att.id)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Only show upload if can edit */}
                {canEdit && (
                    <Form.Item label="Đính kèm tệp">
                        <Upload
                            beforeUpload={(file) => {
                                setFileList([...fileList, file]);
                                return false;
                            }}
                            onRemove={(file) => {
                                setFileList(fileList.filter(f => f.uid !== file.uid));
                            }}
                            fileList={fileList}
                        >
                            <Button icon={<UploadOutlined />}>Chọn tệp</Button>
                        </Upload>
                    </Form.Item>
                )}
            </Form>

            {detailedTask && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                    <h3>Thảo luận & Kết quả</h3>
                    <div style={{ marginBottom: 16, padding: 8, background: '#fafafa', borderRadius: 8 }}>
                        {detailedTask.comments && detailedTask.comments.length > 0 ? (
                            <List
                                dataSource={detailedTask.comments}
                                renderItem={(item: any) => (
                                    <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #eee' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                            <strong>{item.user?.name || item.user?.username}</strong>
                                            <span style={{ fontSize: 12, color: '#999' }}>{dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                                        </div>
                                        <div style={{ marginTop: 4 }}>
                                            {item.type === 'RESULT' && <span style={{ fontWeight: 'bold', color: '#1890ff', marginRight: 8 }}>[Báo cáo kết quả]</span>}
                                            {item.type === 'SYSTEM' && <span style={{ fontStyle: 'italic', color: '#8c8c8c', marginRight: 8 }}>[Hệ thống]</span>}
                                            <span style={item.type === 'SYSTEM' ? { fontStyle: 'italic', color: '#595959' } : {}}>
                                                {item.content}
                                            </span>
                                        </div>
                                        {item.attachments && item.attachments.length > 0 && (
                                            <div style={{ marginTop: 8 }}>
                                                {item.attachments.map((att: any) => (
                                                    <div key={att.id}>
                                                        <PaperClipOutlined />
                                                        <a href={`/api/v1/upload/download?path=${encodeURIComponent(att.filePath)}&token=${token}`} style={{ marginLeft: 4 }}>
                                                            {att.fileName}
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>Chưa có thảo luận nào</div>
                        )}
                    </div>

                    {/* Comment Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Input.TextArea
                            rows={3}
                            placeholder={detailedTask.assignees?.some((a: any) => a.id === currentUser?.id) ? "Nhập nội dung báo cáo kết quả..." : "Nhập bình luận / phản hồi..."}
                            value={commentContent}
                            onChange={e => setCommentContent(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Upload
                                beforeUpload={(file) => { setCommentFiles([...commentFiles, file]); return false; }}
                                onRemove={(file) => setCommentFiles(commentFiles.filter(f => f.uid !== file.uid))}
                                fileList={commentFiles}
                            >
                                <Button icon={<PaperClipOutlined />} size="small">Đính kèm</Button>
                            </Upload>

                            <div style={{ display: 'flex', gap: 8 }}>
                                {/* Strict Role Separation */}
                                {detailedTask.assignees?.some((a: any) => a.id === currentUser?.id) ? (
                                    <Button
                                        type="primary"
                                        ghost
                                        onClick={() => handleAddComment('RESULT')}
                                        loading={submittingComment}
                                        icon={<SendOutlined />}
                                    >
                                        Gửi kết quả
                                    </Button>
                                ) : (
                                    <Button
                                        type="primary"
                                        onClick={() => handleAddComment('COMMENT')}
                                        loading={submittingComment}
                                        icon={<SendOutlined />}
                                    >
                                        Gửi bình luận
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default TaskModal;
