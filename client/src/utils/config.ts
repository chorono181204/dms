// Backend URL configuration utilities

const BACKEND_URL_KEY = 'backendUrl';
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

export const getBackendUrl = (): string => {
    const savedUrl = localStorage.getItem(BACKEND_URL_KEY);
    return savedUrl || DEFAULT_BACKEND_URL;
};

export const setBackendUrl = (url: string): void => {
    const trimmedUrl = url.trim();
    if (trimmedUrl) {
        // Remove trailing slash if present
        const normalizedUrl = trimmedUrl.endsWith('/') ? trimmedUrl.slice(0, -1) : trimmedUrl;
        localStorage.setItem(BACKEND_URL_KEY, normalizedUrl);
    } else {
        // If empty, use default
        localStorage.setItem(BACKEND_URL_KEY, DEFAULT_BACKEND_URL);
    }
};

export const getApiUrl = (): string => {
    return `${getBackendUrl()}/v1`;
};
