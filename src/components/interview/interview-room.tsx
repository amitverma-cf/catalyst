'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Mic, 
  MicOff, 
  VideoOff, 
  PhoneOff, 
  Settings, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { InterviewSettings, LiveServerMessage, InterviewState } from '@/lib/types';

interface InterviewRoomProps {
  token: string;
  interviewId: number;
  settings: InterviewSettings;
  onComplete: (feedback: any) => void;
  onBack: () => void;
}

export function InterviewRoom({
  token,
  settings,
  onComplete,
  onBack,
}: InterviewRoomProps) {
  const [state, setState] = useState<InterviewState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    sessionId: undefined,
    messages: [],
    currentTurn: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);

  // Refs for media handling
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Timer for session duration
  useEffect(() => {
    if (state.isConnected) {
      const interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.isConnected]);

  // Initialize interview session
  useEffect(() => {
    initializeSession();
    return () => {
      cleanupSession();
    };
  }, []);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Request media permissions
      if (settings.enableVideo || settings.enableAudio) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: settings.enableVideo ? { width: 640, height: 480 } : false,
          audio: settings.enableAudio ? {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          } : false,
        });

        mediaStreamRef.current = stream;

        // Set up video
        if (settings.enableVideo && videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Set up audio processing
        if (settings.enableAudio) {
          await setupAudioProcessing(stream);
        }
      }

      // Initialize Gemini Live API session
      await initializeGeminiSession();

      setIsLoading(false);
      setState(prev => ({ ...prev, isConnected: true }));
      toast.success('Interview session started!');

    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview session');
      setIsLoading(false);
      toast.error('Failed to start interview session');
    }
  };

  const setupAudioProcessing = async (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (state.isRecording && sessionRef.current) {
          const inputData = event.inputBuffer.getChannelData(0);
          const audioData = convertFloat32ToInt16(inputData);
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));

          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64Audio,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (err) {
      console.error('Failed to setup audio processing:', err);
      throw err;
    }
  };

  const convertFloat32ToInt16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i] ?? 0));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  const initializeGeminiSession = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { GoogleGenAI, Modality, MediaResolution } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: token, // Use ephemeral token
        httpOptions: { apiVersion: 'v1alpha' }
      });

      const model = 'gemini-2.5-flash-preview-native-audio-dialog';
      const config = {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: settings.voiceName,
            }
          },
          languageCode: settings.languageCode,
        },
        contextWindowCompression: {
          triggerTokens: '25600',
          slidingWindow: { targetTokens: '12800' },
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW' as any,
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW' as any,
            prefixPaddingMs: 20,
            silenceDurationMs: 100,
          }
        },
      };

      const responseQueue: LiveServerMessage[] = [];

      const session = await ai.live.connect({
        model,
        callbacks: {
          onopen: () => {
            console.log('Gemini session opened');
            setState(prev => ({ ...prev, isConnected: true }));
          },
          onmessage: (message: any) => {
            responseQueue.push(message);
            handleGeminiMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini session error:', e.message);
            setError(`Session error: ${e.message}`);
            toast.error('Interview session error');
          },
          onclose: (e: CloseEvent) => {
            console.log('Gemini session closed:', e.reason);
            setState(prev => ({ ...prev, isConnected: false }));
            if (e.reason !== 'user_initiated') {
              toast.error('Interview session ended unexpectedly');
            }
          },
        },
        config
      });

      sessionRef.current = session;

      // Send initial context
      const systemPrompt = `You are an AI interviewer conducting a professional interview for a ${settings.jobRole} position. 
      Be professional, ask relevant questions, and provide constructive feedback. 
      Keep responses concise and natural.`;

      session.sendClientContent({
        turns: systemPrompt
      });

    } catch (err) {
      console.error('Failed to initialize Gemini session:', err);
      throw err;
    }
  };

  const handleGeminiMessage = (message: any) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      currentTurn: [...prev.currentTurn, message],
    }));

    // Handle audio output
    if (message.data && audioRef.current) {
      const audioBuffer = new Int16Array(
        new Uint8Array(message.data.split('').map((c: string) => c.charCodeAt(0))).buffer
      );
      
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(console.error);
      
      setState(prev => ({ ...prev, isSpeaking: true }));
      
      audioRef.current.onended = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
      };
    }

    // Handle text output
    if (message.serverContent?.modelTurn?.parts) {
      const part = message.serverContent.modelTurn.parts[0];
      if (part?.text) {
        console.log('AI Response:', part.text);
      }
    }

    // Handle turn completion
    if (message.serverContent?.turnComplete) {
      setState(prev => ({ ...prev, currentTurn: [] }));
    }

    // Handle interruptions
    if (message.serverContent?.interrupted) {
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  const toggleRecording = () => {
    if (!state.isConnected) return;

    setState(prev => ({ ...prev, isRecording: !prev.isRecording }));
    
    if (!state.isRecording) {
      toast.success('Recording started');
    } else {
      toast.info('Recording stopped');
    }
  };

  const cleanupSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }

    setState(prev => ({ ...prev, isConnected: false }));
  };

  const handleEndInterview = () => {
    cleanupSession();
    
    // Generate basic feedback based on session
    const feedback = {
      overallRating: 'good' as const,
      strengths: 'Good communication and technical knowledge demonstrated.',
      improvements: 'Consider providing more specific examples in responses.',
      summary: 'Interview completed successfully with good engagement.',
      skillRatings: {
        communication: 'good' as const,
        technical: 'good' as const,
        behavioral: 'good' as const,
      },
      geminiInsights: {
        sessionDuration: sessionDuration,
        messagesCount: state.messages.length,
        jobRole: settings.jobRole,
      },
    };

    onComplete(feedback);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p>Initializing interview session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Session Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={onBack}>Back to Setup</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Interview</h2>
          <p className="text-muted-foreground">
            {settings.jobRole} • {formatDuration(sessionDuration)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.isConnected ? 'default' : 'secondary'}>
            {state.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Interview Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video/Audio Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Feed */}
          {settings.enableVideo && (
            <Card>
              <CardHeader>
                <CardTitle>Your Video</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!mediaStreamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <VideoOff className="h-12 w-12" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audio Controls */}
          {settings.enableAudio && (
            <Card>
              <CardHeader>
                <CardTitle>Audio Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant={state.isRecording ? 'destructive' : 'default'}
                    onClick={toggleRecording}
                    disabled={!state.isConnected}
                  >
                    {state.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {state.isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-muted-foreground">
                      {state.isSpeaking ? 'AI Speaking' : 'Listening'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat/Status Area */}
        <div className="space-y-4">
          {/* Session Status */}
          <Card>
            <CardHeader>
              <CardTitle>Session Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Duration</span>
                <span className="font-mono">{formatDuration(sessionDuration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Messages</span>
                <span>{state.messages.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <Badge variant={state.isConnected ? 'default' : 'secondary'}>
                  {state.isConnected ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {state.messages.slice(-5).map((message, index) => (
                  <div key={index} className="text-sm p-2 bg-muted rounded">
                    {message.serverContent?.modelTurn?.parts?.[0]?.text || 
                     message.text || 
                     'Audio message'}
                  </div>
                ))}
                {state.messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleEndInterview}
              variant="destructive"
              className="w-full"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              End Interview
            </Button>
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full"
            >
              Back to Setup
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden audio element for AI responses */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
} 