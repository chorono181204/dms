import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService from '../services/auth.service';

interface User {
    id: number;
    username: string;
    name: string;
    role: string;
    departmentId?: number;
    signatureImage?: string; // Added field
    [key: string]: any; // Allow other fields
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    updateUser: (user: User) => void; // Added method
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = authService.getCurrentUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        const data = await authService.login(username, password);
        setUser(data.user);
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
