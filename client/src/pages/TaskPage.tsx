import React, { useEffect, useState } from 'react';
import { Typography, Button, Radio, Space, Spin, message, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import TaskColumn from '../components/TaskBoard/TaskColumn';
import TaskCard from '../components/TaskBoard/TaskCard';
import TaskModal from '../components/TaskBoard/TaskModal';
import * as taskService from '../api/services/task.service';
import { socketService } from '../api/services/socket.service';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const TaskPage: React.FC = () => {
    const { user } = useAuth();
    const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.isChief;
    const [tasks, setTasks] = useState<any[]>([]);
    const [filter, setFilter] = useState(canManage ? 'all' : 'assigned'); // 'all', 'assigned', 'created'
    const [dateRange, setDateRange] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [activeDragId, setActiveDragId] = useState<any>(null);

    // Columns
    const columns = [
        { id: 'TODO', title: 'Cần làm', color: '#ff4d4f' },
        { id: 'IN_PROGRESS', title: 'Đang làm', color: '#1890ff' },
        { id: 'REVIEW', title: 'Chờ duyệt', color: '#fa8c16' },
        { id: 'DONE', title: 'Hoàn thành', color: '#52c41a' }
    ];

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        loadTasks();

        // Socket listeners for real-time updates
        const handleUpdate = () => loadTasks(); // Reload on any update for simplicity
        socketService.on('new_task', handleUpdate);
        socketService.on('task_updated', handleUpdate);

        return () => {
            socketService.off('new_task', handleUpdate);
            socketService.off('task_updated', handleUpdate);
        };
    }, [filter, dateRange]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            let startStr = undefined;
            let endStr = undefined;
            if (dateRange && dateRange[0]) {
                startStr = dateRange[0].startOf('day').toISOString();
                endStr = dateRange[1].endOf('day').toISOString();
            }
            const data = await taskService.getTasks(filter === 'all' ? undefined : filter, startStr, endStr);
            setTasks(data);
        } catch (error) {
            message.error('Lỗi tải danh sách công việc');
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: any) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Find task
        const task = tasks.find(t => t.id === activeId);
        if (!task) return;

        // Check if dropped in a container or another item
        let newStatus = overId;

        // If dropped over a card, find that card's column
        /* In simple vertical list strategy, overId might be another task ID. 
           But our TaskColumn is a Droppable container with ID = STATUS. 
           If useSortable is used, items are draggable. If dropped ON a Sortable item, 
           we need to know which container it belongs to.
           
           Actually, dnd-kit is flexible. If I made columns SortableContext, then dropping on a card 
           means I need to map card ID to column ID or check if overId is in columns list.
        */

        const isColumn = columns.some(c => c.id === overId);
        if (!isColumn) {
            // Find which column the 'over' task belongs to
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) {
                newStatus = overTask.status;
            } else {
                return; // Invalid drop
            }
        }

        // Specific Rule: Backend handles permission and workflow (e.g. converting DONE to REVIEW)
        // However, if task IS ALREADY in REVIEW, only Approver (or Assigner/Admin) can move to DONE.
        // We block Assignee from moving REVIEW -> DONE here to avoid backend error 403.
        if (task.status === 'REVIEW' && newStatus === 'DONE') {
            const isApprover = task.approver?.id === user?.id || task.approverId === user?.id; // Check both if possible
            const isAssigner = task.assigner?.id === user?.id || task.assignerId === user?.id;

            if (!isApprover && !isAssigner && user?.role !== 'ADMIN') {
                message.error('Bạn chờ người duyệt xác nhận nhé!');
                return;
            }
        }

        if (task.status !== newStatus) {
            // Optimistic update
            setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: newStatus } : t));

            try {
                await taskService.updateTaskStatus(activeId, newStatus);
                message.success('Đã cập nhật trạng thái');
            } catch (error) {
                message.error('Lỗi cập nhật trạng thái');
                loadTasks(); // Revert
            }
        }
    };

    const getTasksByStatus = (status: string) => {
        return tasks.filter(t => t.status === status);
    };

    const handleAddTask = () => {
        setSelectedTask(null);
        setModalVisible(true);
    };

    const handleEditTask = (task: any) => {
        setSelectedTask(task);
        setModalVisible(true);
    };

    const handleModalSuccess = () => {
        setModalVisible(false);
        loadTasks();
    };

    const activeTask = tasks.find(t => t.id === activeDragId);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                    <Title level={4} style={{ margin: 0 }}>Quản lý công việc</Title>
                    <Radio.Group value={filter} onChange={e => setFilter(e.target.value)} buttonStyle="solid">
                        {canManage && <Radio.Button value="all">Tất cả</Radio.Button>}
                        <Radio.Button value="assigned">Việc của tôi</Radio.Button>
                        {canManage && <Radio.Button value="created">Việc tôi giao</Radio.Button>}
                    </Radio.Group>
                    <RangePicker
                        onChange={(dates) => setDateRange(dates)}
                        style={{ width: 250 }}
                        placeholder={['Từ ngày', 'Đến ngày']}
                        format="DD/MM/YYYY"
                    />
                </Space>
                {canManage && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTask}>
                        Thêm việc mới
                    </Button>
                )}
            </div>

            <Spin spinning={loading}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, height: 'calc(100vh - 180px)' }}>
                        {columns.map(col => (
                            <TaskColumn
                                key={col.id}
                                id={col.id}
                                title={col.title}
                                color={col.color}
                                tasks={getTasksByStatus(col.id)}
                                onTaskClick={handleEditTask}
                            />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeTask ? <TaskCard task={activeTask} onClick={() => { }} /> : null}
                    </DragOverlay>
                </DndContext>
            </Spin>

            <TaskModal
                visible={modalVisible}
                task={selectedTask}
                onCancel={() => setModalVisible(false)}
                onSuccess={handleModalSuccess}
            />
        </div>
    );
};

export default TaskPage;
