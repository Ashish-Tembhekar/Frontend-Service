"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Sparkles, Save, RotateCcw } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { db } from '../../lib/firebase/config';
import { generateSystemPromptAPI } from '../../services/apiClientNew';

export function RoleConfiguration() {
  const { chatbotRole, setChatbotRole, systemPrompt, setSystemPrompt } = useChat();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [role, setRole] = useState(chatbotRole);
  const [prompt, setPrompt] = useState(systemPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Generate system prompt based on role using LLM
  const generateSystemPrompt = async () => {
    if (!role.trim()) {
      toast({
        title: "Error",
        description: "Please enter a role first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateSystemPromptAPI(role.trim());

      if (result.success && result.system_prompt) {
        setPrompt(result.system_prompt);
        toast({
          title: "Success",
          description: "System prompt generated successfully using AI",
        });
      } else {
        throw new Error("Invalid response from prompt generation");
      }
    } catch (error) {
      console.error('Error generating system prompt:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate system prompt",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save configuration to Firestore
  const saveConfiguration = async () => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "You must be logged in to save configuration",
        variant: "destructive",
      });
      return;
    }

    if (!role.trim() || !prompt.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both role and system prompt",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'users', user.uid, 'config', 'chatbot');
      
      await setDoc(docRef, {
        role: role.trim(),
        systemPrompt: prompt.trim(),
        updatedAt: new Date().toISOString(),
      });

      // Update context
      setChatbotRole(role.trim());
      setSystemPrompt(prompt.trim());

      toast({
        title: "Success",
        description: "Chatbot configuration saved successfully",
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to current values
  const resetChanges = () => {
    setRole(chatbotRole);
    setPrompt(systemPrompt);
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="text-gray-800">Chatbot Role Configuration</CardTitle>
        <CardDescription>
          Customize your chatbot's role and system prompt to tailor its behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Role Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Chatbot Role
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Professional Researcher, Legal Advisor, Technical Expert"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500">
            Define the role or persona for your chatbot (e.g., "Professional Researcher", "Legal Advisor", "Technical Expert")
          </p>
        </div>

        {/* System Prompt Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              System Prompt
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={generateSystemPrompt}
              disabled={isGenerating || !role.trim()}
              className="text-xs"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {isGenerating ? 'Generating...' : 'Auto-Generate'}
            </Button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter the system prompt that will guide the chatbot's responses..."
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            This prompt defines how the chatbot will behave and respond to user queries
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={resetChanges}
            disabled={isSaving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Preview</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>Role:</strong> {role || 'Not set'}</p>
            <p><strong>Prompt:</strong> {prompt.substring(0, 100)}...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

