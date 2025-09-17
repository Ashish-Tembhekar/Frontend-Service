'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Check if this is a client-side route that should be handled by the app
    const path = window.location.pathname;
    const validRoutes = ['/dashboard', '/popup'];
    
    if (validRoutes.includes(path) || validRoutes.includes(path.replace(/\/$/, ''))) {
      // This is a valid client-side route, redirect to it
      console.log('🔄 Redirecting to valid client-side route:', path);
      router.replace(path);
    } else {
      // Invalid route, redirect to home after a delay
      console.log('❌ Invalid route, redirecting to home:', path);
      setTimeout(() => {
        router.replace('/');
      }, 3000);
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
        <p className="text-gray-600">Redirecting to the requested page...</p>
      </div>
    </div>
  );
}
