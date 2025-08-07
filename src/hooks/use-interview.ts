'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { InterviewSettings, InterviewState, LiveServerMessage } from '@/lib/types';

interface UseInterviewOptions {
  onComplete?: (feedback: any) => void;
  onError?: (error: string) => void;
}

export function useInterview(options: UseInterviewOptions = {}) {
  const [state, setState] = useState<InterviewState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    sessionId: undefined,
    messages: [],
    currentTurn: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((updates: Partial<InterviewState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addMessage = useCallback((message: LiveServerMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      currentTurn: [...prev.currentTurn, message],
    }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    toast.error(errorMessage);
    options.onError?.(errorMessage);
  }, [options]);

  const handleComplete = useCallback((feedback: any) => {
    toast.success('Interview completed successfully!');
    options.onComplete?.(feedback);
  }, [options]);

  const resetState = useCallback(() => {
    setState({
      isConnected: false,
      isRecording: false,
      isSpeaking: false,
      sessionId: undefined,
      messages: [],
      currentTurn: [],
    });
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    state,
    isLoading,
    error,
    updateState,
    addMessage,
    clearError,
    setLoading,
    handleError,
    handleComplete,
    resetState,
  };
}

export function useInterviewSettings(initialSettings: InterviewSettings) {
  const [settings, setSettings] = useState<InterviewSettings>(initialSettings);

  const updateSettings = useCallback((updates: Partial<InterviewSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
} 