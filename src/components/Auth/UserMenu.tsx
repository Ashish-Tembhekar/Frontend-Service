// src/components/Auth/UserMenu.tsx
"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Mail, LogOut, LayoutDashboard, Wifi, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { appConfig } from '@/lib/config';

// Connection Status Component
function ConnectionStatus() {
  const { ttsIsConnected, ttsProvider } = useChat();

  // For now, we'll assume backend is connected if we can render this component
  // You can add actual backend health check later
  const backendConnected = true;

  const StatusIndicator = ({ connected, label }: { connected: boolean; label: string }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-600">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs font-medium text-gray-700">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="px-2 py-2 space-y-1">
      <div className="flex items-center gap-2 mb-2">
        {ttsIsConnected ? (
          <Wifi className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-red-600" />
        )}
        <span className="text-xs font-semibold text-gray-700">Connection Status</span>
      </div>
      <StatusIndicator connected={backendConnected} label="Backend API" />
      <StatusIndicator
        connected={ttsProvider === 'chatterbox' && ttsIsConnected}
        label="Chatterbox TTS"
      />
      <StatusIndicator
        connected={ttsProvider === 'kokoro' && ttsIsConnected}
        label="Kokoro TTS"
      />
    </div>
  );
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return null;
  }

  // Get initials from username or email
  const getInitials = () => {
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'GU';
  };

  const displayName = user.username || 'Guest';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-gray-600 text-white text-xs font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-600 hidden sm:inline">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-medium leading-none">{displayName}</p>
            </div>
            {user.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Connection Status Section - Developer Mode Only */}
        {appConfig.developerMode && (
          <>
            <ConnectionStatus />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

