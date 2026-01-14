import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

const PrivateRoute: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
