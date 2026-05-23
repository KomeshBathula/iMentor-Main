// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setTokenState] = useState(localStorage.getItem('authToken'));
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);

    const setToken = (newToken) => {
        if (newToken) localStorage.setItem('authToken', newToken);
        else localStorage.removeItem('authToken');
        setTokenState(newToken);
    };

    const setUser = (newUser) => setUserState(newUser);

    const processAuthData = useCallback((authApiResponse) => {
        if (authApiResponse && authApiResponse.token && authApiResponse._id && authApiResponse.email) {
            setToken(authApiResponse.token);
            const userObject = {
                id: authApiResponse._id,
                email: authApiResponse.email,
                username: authApiResponse.username,
                isAdmin: !!authApiResponse.isAdmin,
                hasCompletedOnboarding: authApiResponse.hasCompletedOnboarding
            };
            setUser(userObject);
            return authApiResponse;
        } else {
            setToken(null);
            setUser(null);
            console.error("AuthContext: processAuthData received incomplete data for a regular user.", authApiResponse);
            throw new Error("Authentication response from server was incomplete for a regular user.");
        }
    }, []);

    useEffect(() => {
        const verifyTokenAndLoadUser = async () => {
            // If this is an active admin session, skip user-verification entirely.
            // The admin token is validated per-request by the server.
            const adminSessionActive = sessionStorage.getItem('isAdminSessionActive') === 'true';
            const storedToken = localStorage.getItem('authToken');

            if (adminSessionActive) {
                // Keep the token, mark loading done — admin auth is handled by adminAuthMiddleware.
                if (storedToken) setTokenState(storedToken);
                setLoading(false);
                return;
            }

            if (storedToken) {
                setTokenState(storedToken);
                try {
                    const userDataFromMe = await api.getMe();
                    if (userDataFromMe && userDataFromMe._id && userDataFromMe.email) {
                        setUser({
                            id: userDataFromMe._id,
                            email: userDataFromMe.email,
                            username: userDataFromMe.username,
                            isAdmin: !!userDataFromMe.isAdmin,
                            hasCompletedOnboarding: userDataFromMe.hasCompletedOnboarding
                        });
                    } else {
                        setToken(null);
                        setUser(null);
                    }
                } catch (error) {
                    // Only clear the token on definitive auth failures (401/403).
                    // Network errors / server restarts should NOT wipe a valid token.
                    const status = error?.response?.status;
                    if (status === 401 || status === 403) {
                        setToken(null);
                        setUser(null);
                    }
                    // Otherwise leave the token intact — the user can retry.
                }
            }
            setLoading(false);
        };
        verifyTokenAndLoadUser();
    }, []);

    const login = async (credentials) => {
        setLoading(true);
        try {
            const data = await api.login(credentials);
            if (data && data.isAdminLogin && data.token) {
                // Admin login: Set token for API calls, but DON'T set user object.
                // This is intentional - admin routes check isAdminSessionActive from AppState,
                // and the missing user object prevents regularUserToken && regularUser checks from passing.
                setToken(data.token);
                return data;
            }

            return processAuthData(data);
        } catch (error) {
            setToken(null);
            setUser(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signup = async (signupData) => {
        setLoading(true);
        try {
            const data = await api.signup(signupData);
            return processAuthData(data);
        } catch (error) {
            setToken(null);
            setUser(null);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {

        setToken(null);
        setUser(null);
        toast.success("You have been logged out.");
    };

    return (
        <AuthContext.Provider value={{ token, user, loading, login, signup, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};