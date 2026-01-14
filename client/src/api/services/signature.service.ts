import { Document } from '../../types/document';
import client from '../client';
import { getBackendUrl } from '../../utils/config';

const API_URL = `${getBackendUrl()}/v1/documents`;

export const createSignatureRequest = async (documentId: number, userIds: number[], note: string = '') => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/${documentId}/sign-request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userIds, note }),
    });

    if (!response.ok) {
        throw new Error('Failed to send signature request');
    }
    return response.json();
};

export const getPendingSignatures = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/pending-signatures`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch pending signatures');
    }
    return response.json();
};

export const getSignatureHistory = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/history-signatures`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch signature history');
    }
    return response.json();
};
