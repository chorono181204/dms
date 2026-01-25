import axiosClient from '../client';

export interface Task {
    id: number;
    title: string;
    description: string;
    status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    assigneeId: number | null;
    assignerId: number;
    departmentId: number | null;
    dueDate: string | null;
    createdAt: string;
    assignee?: { id: number; name: string; username: string; avatar?: string };
    assigner?: { id: number; name: string; username: string };
    attachments?: any[];
}

export const getTasks = async (filter?: string) => {
    const response = await axiosClient.get('/tasks', { params: { filter } });
    return response.data;
};

export const createTask = async (data: any) => {
    // If has files, use formData
    if (data.files && data.files.length > 0) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'files') {
                data.files.forEach((file: any) => {
                    if (file.originFileObj) {
                        formData.append('files', file.originFileObj);
                    } else if (file instanceof File || (file.uid && file.name)) {
                        // It's likely a raw file
                        formData.append('files', file);
                    }
                });
            } else if (data[key] !== null && data[key] !== undefined) {
                formData.append(key, data[key]);
            }
        });
        const response = await axiosClient.post('/tasks', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }

    const response = await axiosClient.post('/tasks', data);
    return response.data;
};

export const updateTaskStatus = async (taskId: number, status: string) => {
    const response = await axiosClient.patch(`/tasks/${taskId}/status`, { status });
    return response.data;
};

export const updateTask = async (taskId: number, data: any) => {
    // Check if files exist to use FormData
    if (data.files && data.files.length > 0) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'files') {
                data.files.forEach((file: any) => {
                    // Check for new files (originFileObj)
                    if (file.originFileObj) {
                        formData.append('files', file.originFileObj);
                    } else if (file instanceof File || (file.uid && file.name)) {
                        formData.append('files', file);
                    }
                    // Existing files (already on server) are usually ignored here 
                    // or user logic might need them? For now, we only upload new ones.
                    // If backend needs list of kept files, we might need another field.
                });
            } else if (data[key] !== null && data[key] !== undefined) {
                formData.append(key, data[key]);
            }
        });
        const response = await axiosClient.patch(`/tasks/${taskId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }

    // Normal JSON update
    const response = await axiosClient.patch(`/tasks/${taskId}`, data);
    return response.data;
};

export const deleteTask = async (taskId: number) => {
    const response = await axiosClient.delete(`/tasks/${taskId}`);
    return response.data;
};

export const getTaskDetails = async (taskId: number) => {
    const response = await axiosClient.get(`/tasks/${taskId}`);
    return response.data;
};

export const addTaskComment = async (taskId: number, data: any) => {
    // data: { content, type, files[] }
    if (data.files && data.files.length > 0) {
        const formData = new FormData();
        formData.append('content', data.content || '');
        formData.append('type', data.type || 'COMMENT');
        data.files.forEach((file: any) => {
            if (file.originFileObj) {
                formData.append('files', file.originFileObj);
            } else {
                formData.append('files', file);
            }
        });

        const response = await axiosClient.post(`/tasks/${taskId}/comments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    }

    const response = await axiosClient.post(`/tasks/${taskId}/comments`, data);
    return response.data;
};
