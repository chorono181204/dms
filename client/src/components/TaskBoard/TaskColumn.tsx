import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface TaskColumnProps {
    id: string;
    title: string;
    tasks: any[];
    color: string;
    onTaskClick: (task: any) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ id, title, tasks, color, onTaskClick }) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div style={{
            flex: 1,
            minWidth: 280,
            background: '#f4f5f7',
            borderRadius: 12,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
                    <Title level={5} style={{ margin: 0, fontSize: 15 }}>{title}</Title>
                </div>
                <div style={{
                    background: 'rgba(0,0,0,0.05)',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5e6c84'
                }}>
                    {tasks.length}
                </div>
            </div>

            <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} style={{ flex: 1, minHeight: 100 }}>
                    {tasks.map(task => (
                        <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                    ))}
                    {tasks.length === 0 && (
                        <div style={{
                            height: 100,
                            border: '1px dashed #d9d9d9',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#8c8c8c'
                        }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>Thả việc vào đây</Text>
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
};

export default TaskColumn;
