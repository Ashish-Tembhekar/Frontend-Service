"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext'; // Import the new hook
import { DashboardView } from '../../components/Dashboard/DashboardView';
import { Loader2 } from 'lucide-react';

export default function ProtectedDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect logic
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // User is not logged in, redirect to login page
        router.push('/login');
      } else if (!user.isApproved) {
        // User is not approved, redirect to pending approval page
        router.push('/pending-approval');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    // Show a loading screen while Firebase initializes
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Only render the dashboard if the user is authenticated and approved
  if (user && user.isApproved) {
    return (
      <div className="min-h-screen bg-white relative overflow-y-auto">
        {/* Clean subtle pattern like reference */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] bg-[length:32px_32px] opacity-40 pointer-events-none"></div>

        {/* Very subtle accent areas */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-50/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <DashboardView />
        </div>
      </div>
    );
  }

  return null;
}