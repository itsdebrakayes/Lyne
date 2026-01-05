import React from 'react';
import { GlassmorphicSidebar } from '@/components/GlassmorphicSidebar';
import { useStaffRole } from '@/hooks/useStaffRole';
import { supabase } from '@/integrations/supabase/client';

export const AdminLayout = ({ children }) => {
  const { role } = useStaffRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('adminAuth');
  };

  return (
    <div className="min-h-screen bg-background">
      <GlassmorphicSidebar userRole={role || 'staff'} onLogout={handleLogout} />
      
      {/* Main content with left padding for sidebar */}
      <div className="pl-20">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
