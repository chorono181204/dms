import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import PrivateRoute from './components/PrivateRoute';

function App() {
    return (
        <AuthProvider>
            <HashRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<PrivateRoute />}>
                        <Route path="/*" element={<MainLayout />} />
                    </Route>
                </Routes>
            </HashRouter>
        </AuthProvider>
    );
}

export default App;
