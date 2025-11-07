"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PendingApproval } from '@/components/Auth/PendingApproval';
import { Loader2 } from 'lucide-react';

export default function PendingApprovalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in, redirect to login
        router.push('/login');
      } else if (user.isApproved) {
        // User is approved, redirect to dashboard
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Only show pending approval if user exists and is not approved
  if (user && !user.isApproved) {
    return <PendingApproval />;
  }

  return null;
}

