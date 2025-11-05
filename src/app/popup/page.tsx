// src/app/popup/page.tsx
"use client";

import { ChatView } from '../../components/Chat/ChatView';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function PopupChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect logic - protect the popup chat interface
  useEffect(() => {
    if (!loading && !user) {
      // User is not logged in, redirect to login page
      router.push('/login');
    }
  }, [user, loading, router]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Only render the popup chat if the user is authenticated
  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    // The main element should take full height of its parent (body, which is now h-full)
    // max-h and max-w will constrain it further if the iframe is larger.
    // overflow-hidden on main will ensure its own content doesn't cause scrollbars if ChatView misbehaves.
    <main className="flex flex-col h-full w-full max-h-[600px] max-w-[400px] mx-auto shadow-xl rounded-lg overflow-hidden border border-border bg-background">
      <ChatView isPopupMode={true} />
    </main>
  );
}
