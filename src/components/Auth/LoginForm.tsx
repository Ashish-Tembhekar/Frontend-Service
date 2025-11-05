// src/components/Auth/LoginForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import Link from "next/link";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const { signInEmail, signInGoogle, signInMicrosoft, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInEmail(values.email, values.password);
      // Success is handled by the useEffect in the protected page
    } catch (err: any) {
      console.error(err);
      setError("Login failed. Check your email and password.");
    } finally {
      setIsLoggingIn(false);
    }
  }
  
  async function handleSocialLogin(provider: 'google' | 'microsoft') {
    setError(null);
    try {
      if (provider === 'google') {
        await signInGoogle();
      } else {
        await signInMicrosoft();
      }
      // Success is handled by the useEffect in the protected page
    } catch (err: any) {
      console.error(err);
      setError(`Login with ${provider} failed.`);
    }
  }

  const isLoading = isLoggingIn || authLoading;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Sign in to your account</CardTitle>
        <CardDescription>Enter your email and password below</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* Social Logins */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            // onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
            className="flex items-center justify-center gap-2"
          >
            <Image
              src="https://png.pngtree.com/png-vector/20230817/ourmid/pngtree-google-internet-icon-vector-png-image_9183287.png"
              alt="Google"
              width={20}
              height={20}
              className="object-contain"
            />
            Google
          </Button>
          <Button
            variant="outline"
            // onClick={() => handleSocialLogin('microsoft')}
            disabled={isLoading}
            className="flex items-center justify-center gap-2"
          >
            <Image
              src="https://cdn4.iconfinder.com/data/icons/social-media-logos-6/512/78-microsoft-512.png"
              alt="Microsoft"
              width={20}
              height={20}
              className="object-contain"
            />
            Microsoft
          </Button>
        </div>
        
        <Separator className="my-0.5" />

        {/* Email/Password Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="name@example.com" {...field} className="pl-10" disabled={isLoading} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    <span>Password</span>
                    <button 
                      type="button" 
                      onClick={onForgotPassword} 
                      className="text-xs text-blue-600 hover:underline"
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••" {...field} className="pl-10" disabled={isLoading} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing In...' : <><LogIn className="h-4 w-4 mr-2" />Sign In</>}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-center text-sm">
        <p>
          Don't have an account?{" "}
          <Link href="/signup" className="font-semibold text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}