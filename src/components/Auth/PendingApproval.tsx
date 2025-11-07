// src/components/Auth/PendingApproval.tsx
"use client";

import { AlertCircle, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export function PendingApproval() {
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-yellow-100 p-3">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Approval Pending</CardTitle>
          <CardDescription>Your account is awaiting administrator approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Account Not Yet Approved</p>
              <p>
                Your account has been created successfully, but you need administrator approval before you can access the chatbot interface.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <Mail className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Contact Administrator</p>
                <p>Please contact the administrator to request approval for your account.</p>
                {user?.email && (
                  <p className="mt-1 text-xs text-gray-500">
                    Your email: <span className="font-medium">{user.email}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Once approved, you'll be able to access all features of the chatbot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

