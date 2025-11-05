// src/app/popup/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../../app/globals.css'; // Ensure global styles are applied
import { AuthProvider } from '../../contexts/AuthContext';
import { ChatProvider } from '../../contexts/ChatContext';
import { Toaster } from "../../components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nexus Chat - Popup',
  // You might want a different or no description for the popup
};

export default function PopupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning> {/* Ensure html takes full height of iframe */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-full`}> {/* body also takes full height */}
        <AuthProvider>
          <ChatProvider>
            {children}
            <Toaster />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
