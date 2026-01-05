import { useState, useEffect } from 'react';

interface AdminData {
  name: string;
  idNumber: string;
  loggedInAt: string;
}

export const useAdminAuth = () => {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const adminData = localStorage.getItem('adminAuth');
      if (adminData) {
        try {
          setAdmin(JSON.parse(adminData));
        } catch (error) {
          console.error('Failed to parse admin auth data:', error);
          localStorage.removeItem('adminAuth');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('adminAuth');
    setAdmin(null);
  };

  return { admin, loading, logout };
};
