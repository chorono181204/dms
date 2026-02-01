import React from 'react';
import { Card, Tag, Typography, Avatar, Tooltip } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClockCircleOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TaskCardProps {
    task: any;
    onClick: (task: any) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, data: { ...task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: 12,
        cursor: 'move'
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'URGENT': return '#f5222d';
            case 'HIGH': return '#fa8c16';
            case 'NORMAL': return '#1890ff';
            case 'LOW': return '#52c41a';
            default: return '#d9d9d9';
        }
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onClick(task)}>
            <Card
                size="small"
                hoverable
                style={{
                    borderRadius: 8,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    border: '1px solid #f0f0f0'
                }}
                bodyStyle={{ padding: '12px' }}
            >
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text strong style={{ fontSize: 14, lineHeight: 1.4, flex: 1, marginRight: 8 }}>
                        {task.title}
                    </Text>
                    {task.priority !== 'NORMAL' && (
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: getPriorityColor(task.priority),
                            flexShrink: 0, marginTop: 6
                        }} />
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {task.dueDate && (
                            <Tooltip title={`Hạn chót: ${dayjs(task.dueDate).format('DD/MM/YYYY')}`}>
                                <Tag
                                    color={dayjs().isAfter(dayjs(task.dueDate)) ? 'error' : 'default'}
                                    style={{ margin: 0, fontSize: 11, border: 'none', background: '#f5f5f5' }}
                                >
                                    <ClockCircleOutlined /> {dayjs(task.dueDate).format('DD/MM')}
                                </Tag>
                            </Tooltip>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                            <Tag style={{ margin: 0, fontSize: 11, border: 'none', background: '#f5f5f5' }}>
                                <PaperClipOutlined /> {task.attachments.length}
                            </Tag>
                        )}
                    </div>

                    {task.assignees && task.assignees.length > 0 ? (
                        <Avatar.Group maxCount={3} maxStyle={{ backgroundColor: '#f56a00', fontSize: 12 }} size={24}>
                            {task.assignees.map((assignee: any) => (
                                <Tooltip key={assignee.id} title={`Giao cho: ${assignee.name || assignee.username}`}>
                                    <Avatar src={assignee.avatar} style={{ background: '#1890ff', fontSize: 12 }}>
                                        {(assignee.name?.[0] || assignee.username?.[0]).toUpperCase()}
                                    </Avatar>
                                </Tooltip>
                            ))}
                        </Avatar.Group>
                    ) : (
                        <Tooltip title="Chưa giao">
                            <Avatar size={24} icon={<ClockCircleOutlined />} style={{ background: '#f0f0f0', color: '#bfbfbf' }} />
                        </Tooltip>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default TaskCard;
