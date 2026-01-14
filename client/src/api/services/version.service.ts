import client from '../client';

const endpoint = (documentId: number) => `/documents/${documentId}/versions`;

export interface Version {
    id: number;
    documentId: number;
    versionNumber: number;
    filePath: string;
    fileSize: number;
    changeNote?: string;
    createdBy: string;
    createdAt: string;
}

export const getVersions = async (documentId: number) => {
    const response = await client.get<Version[]>(endpoint(documentId));
    return response.data;
};

export const downloadVersion = async (documentId: number, versionNumber: number) => {
    const response = await client.get(`${endpoint(documentId)}/${versionNumber}/download`, {
        responseType: 'blob', // Important for downloading files
    });
    return response.data;
};

export const restoreVersion = async (documentId: number, versionNumber: number) => {
    const response = await client.post(`${endpoint(documentId)}/${versionNumber}/restore`);
    return response.data;
};
