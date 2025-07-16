import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ChatProvider } from '../contexts/ChatContext';
import { Toaster } from "../components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nexus Chat',
  description: 'AI Chat application by Firebase Studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}  antialiased flex flex-col h-screen overflow-hidden`}>
        <ChatProvider>
          {children}
          <Toaster />
        </ChatProvider>
      </body>
    </html>
  );
}
