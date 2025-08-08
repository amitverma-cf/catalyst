'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  PhoneOff,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import type { InterviewSettings, InterviewState } from '@/lib/types';

// Audio utility functions based on the reference
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = Math.max(-32768, Math.min(32767, Math.round((data[i] ?? 0) * 32767)));
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const samplesPerChannel = Math.floor(data.length / 2 / numChannels);
  const buffer = ctx.createBuffer(numChannels, samplesPerChannel, sampleRate);

  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const dataFloat32 = new Float32Array(samplesPerChannel * numChannels);
  
  for (let i = 0; i < dataInt16.length; i++) {
    dataFloat32[i] = (dataInt16[i] ?? 0) / 32768.0;
  }

  // Extract channels
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = new Float32Array(samplesPerChannel);
      for (let i = 0; i < samplesPerChannel; i++) {
        channelData[i] = dataFloat32[i * numChannels + ch] ?? 0;
      }
      buffer.copyToChannel(channelData, ch);
    }
  }

  return buffer;
}

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

  console.log(token);
  // State management
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
  const [status, setStatus] = useState<string>('Initializing...');
  const [sessionDuration, setSessionDuration] = useState<number>(0);

  // Audio contexts - separate for input and output like the reference
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Timer for session duration
  useEffect(() => {
    if (state.isConnected) {
      const interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.isConnected]);

  // Initialize audio contexts
  const initAudio = useCallback(() => {
    try {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      
      // Create separate contexts like the reference
      const inputContext = new AudioContextConstructor({ sampleRate: 16000 });
      const outputContext = new AudioContextConstructor({ sampleRate: 24000 });

      inputAudioContextRef.current = inputContext;
      outputAudioContextRef.current = outputContext;

      // Create gain nodes
      const inputNode = inputContext.createGain();
      const outputNode = outputContext.createGain();
      
      inputNodeRef.current = inputNode;
      outputNodeRef.current = outputNode;

      // Connect output to destination
      outputNode.connect(outputContext.destination);

      // Initialize timing
      nextStartTimeRef.current = outputContext.currentTime;

      console.log('Audio contexts initialized:', {
        inputSampleRate: inputContext.sampleRate,
        outputSampleRate: outputContext.sampleRate
      });

      return true;
    } catch (err) {
      console.error('Failed to initialize audio:', err);
      setError('Failed to initialize audio system');
      return false;
    }
  }, []);

  // Initialize Gemini session
  const initSession = useCallback(async () => {
    if (!inputAudioContextRef.current || !outputAudioContextRef.current) {
      throw new Error('Audio contexts not initialized');
    }

    try {
      // Dynamic import to avoid SSR issues
      const { GoogleGenAI, Modality } = await import('@google/genai');

      const client = new GoogleGenAI({
        apiKey: "AIzaSyA5b2lVRs20xs7IFaaVLPFGm9zWlsoYLww", // Use your API key
        httpOptions: { apiVersion: 'v1alpha' }
      });

      const model = 'gemini-2.5-flash-preview-native-audio-dialog';

      const session = await client.live.connect({
        model,
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus('Connected - Ready to start');
            setState(prev => ({ ...prev, isConnected: true }));
          },
          onmessage: async (message: any) => {
            console.log('Received message:', message);
            
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, message],
              currentTurn: [...prev.currentTurn, message],
            }));

            // Handle audio data
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
            if (audio && outputAudioContextRef.current && outputNodeRef.current) {
              try {
                setState(prev => ({ ...prev, isSpeaking: true }));

                // Calculate timing like the reference
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  outputAudioContextRef.current.currentTime,
                );

                // Decode and play audio
                const audioBuffer = await decodeAudioData(
                  decode(audio.data),
                  outputAudioContextRef.current,
                  24000,
                  1,
                );

                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                    setState(prev => ({ ...prev, isSpeaking: false }));
                  }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
                sourcesRef.current.add(source);

                console.log('Playing audio:', {
                  duration: audioBuffer.duration,
                  startTime: nextStartTimeRef.current - audioBuffer.duration
                });

              } catch (audioError) {
                console.error('Audio playback error:', audioError);
                setState(prev => ({ ...prev, isSpeaking: false }));
              }
            }

            // Handle interruptions
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              console.log('Handling interruption');
              for (const source of sourcesRef.current.values()) {
                try {
                  source.stop();
                } catch (e) {
                  console.warn('Error stopping source:', e);
                }
                sourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
              setState(prev => ({ ...prev, isSpeaking: false }));
            }

            // Handle turn completion
            if (message.serverContent?.turnComplete) {
              setState(prev => ({ ...prev, currentTurn: [] }));
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e.message);
            setError(e.message);
            setStatus(`Error: ${e.message}`);
          },
          onclose: (e: CloseEvent) => {
            console.log('Session closed:', e.reason);
            setStatus(`Closed: ${e.reason}`);
            setState(prev => ({ ...prev, isConnected: false }));
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: settings.voiceName || 'Orus',
              }
            },
            languageCode: settings.languageCode || 'en-US',
          },
        },
      });

      sessionRef.current = session;

      // Start interview conversation
      setTimeout(() => {
        if (sessionRef.current) {
          sessionRef.current.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{
                text: `You are conducting an interview for a ${settings.jobRole} position. Please greet the candidate and start the interview with your first question.`
              }]
            }]
          });
        }
      }, 500);

    } catch (err) {
      console.error('Session initialization error:', err);
      throw err;
    }
  }, [settings]);

  // Initialize everything
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setStatus('Initializing audio...');
        
        if (!initAudio()) {
          return;
        }

        setStatus('Connecting to interview service...');
        await initSession();

        setIsLoading(false);
        toast.success('Interview session ready!');
        
      } catch (err) {
        console.error('Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
        setStatus('Failed to initialize');
        setIsLoading(false);
        toast.error('Failed to start interview session');
      }
    };

    initialize();

    // Cleanup
    return () => {
      cleanup();
    };
  }, [initAudio, initSession]);

  // Start recording function based on reference
  const startRecording = useCallback(async () => {
    if (state.isRecording || !inputAudioContextRef.current || !sessionRef.current) {
      return;
    }

    try {
      // Resume audio context
      await inputAudioContextRef.current.resume();
      setStatus('Requesting microphone access...');

      // Get media stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      mediaStreamRef.current = mediaStream;
      setStatus('Microphone access granted. Starting capture...');

      // Create audio processing chain
      const sourceNode = inputAudioContextRef.current.createMediaStreamSource(mediaStream);
      sourceNodeRef.current = sourceNode;

      if (inputNodeRef.current) {
        sourceNode.connect(inputNodeRef.current);
      }

      // Create script processor like the reference
      const bufferSize = 256;
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (!state.isRecording || !sessionRef.current) return;

        const inputBuffer = event.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Send to Gemini
        try {
          sessionRef.current.sendRealtimeInput({ media: createBlob(pcmData) });
        } catch (error) {
          console.warn('Failed to send audio data:', error);
        }
      };

      // Connect processing chain
      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

      setState(prev => ({ ...prev, isRecording: true }));
      setStatus('🔴 Recording... Speak now!');
      toast.success('Recording started - speak now!');

    } catch (err) {
      console.error('Recording start error:', err);
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error('Failed to start recording');
      stopRecording();
    }
  }, [state.isRecording]);

  // Stop recording function
  const stopRecording = useCallback(() => {
    if (!state.isRecording && !mediaStreamRef.current) {
      return;
    }

    setStatus('Stopping recording...');

    setState(prev => ({ ...prev, isRecording: false }));

    // Disconnect audio nodes
    if (scriptProcessorRef.current && sourceNodeRef.current) {
      scriptProcessorRef.current.disconnect();
      sourceNodeRef.current.disconnect();
    }

    scriptProcessorRef.current = null;
    sourceNodeRef.current = null;

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setStatus('Recording stopped. Click Start to begin again.');
    toast.info('Recording stopped');
  }, [state.isRecording]);

  // Reset session
  const resetSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    
    setState(prev => ({
      ...prev,
      messages: [],
      currentTurn: [],
      isConnected: false,
      isSpeaking: false,
    }));

    // Reinitialize
    initSession();
    setStatus('Session reset.');
    toast.info('Interview session reset');
  }, [initSession]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop recording
    stopRecording();

    // Stop all audio sources
    for (const source of sourcesRef.current.values()) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        console.warn('Error stopping audio source:', e);
      }
    }
    sourcesRef.current.clear();

    // Close session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Close audio contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(console.warn);
      inputAudioContextRef.current = null;
    }

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(console.warn);
      outputAudioContextRef.current = null;
    }

    // Reset refs
    inputNodeRef.current = null;
    outputNodeRef.current = null;
    nextStartTimeRef.current = 0;
  }, [stopRecording]);

  // End interview
  const handleEndInterview = useCallback(() => {
    cleanup();

    // Generate feedback
    const feedback = {
      overallRating: 'good' as const,
      strengths: 'Good communication and engagement demonstrated during the interview.',
      improvements: 'Consider providing more specific examples in future responses.',
      summary: 'Interview completed successfully with active participation.',
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
  }, [cleanup, sessionDuration, state.messages.length, settings.jobRole, onComplete]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p>{status}</p>
        </div>
      </div>
    );
  }

  // Error state
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
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
            <Button onClick={onBack}>Back to Setup</Button>
          </div>
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
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                state.isSpeaking ? 'bg-blue-500 animate-pulse' :
                state.isRecording ? 'bg-red-500 animate-pulse' :
                state.isConnected ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">{status}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Interview Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interview Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {/* Reset Button */}
                <Button
                  variant="outline"
                  onClick={resetSession}
                  disabled={state.isRecording}
                  className="w-16 h-16 rounded-full"
                >
                  <RotateCcw className="h-6 w-6" />
                </Button>

                {/* Record Button */}
                <Button
                  variant={state.isRecording ? 'destructive' : 'default'}
                  onClick={startRecording}
                  disabled={state.isRecording || !state.isConnected}
                  className="w-20 h-20 rounded-full"
                >
                  {state.isRecording ? (
                    <div className="w-8 h-8 bg-white rounded-sm" />
                  ) : (
                    <div className="w-8 h-8 bg-red-500 rounded-full" />
                  )}
                </Button>

                {/* Stop Button */}
                <Button
                  variant="outline"
                  onClick={stopRecording}
                  disabled={!state.isRecording}
                  className="w-16 h-16 rounded-full"
                >
                  <div className="w-4 h-4 bg-current rounded-sm" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interview Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Duration</span>
                <span className="font-mono text-lg">{formatDuration(sessionDuration)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">AI Responses</span>
                <span className="text-lg font-semibold">{state.messages.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Job Role</span>
                <Badge variant="outline">{settings.jobRole}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Wait for the AI to greet you and ask the first question</p>
              <p>2. Click the red record button to start speaking</p>
              <p>3. Click the stop button when you finish your answer</p>
              <p>4. The AI will respond and ask follow-up questions</p>
              <p>5. Use the reset button to start over if needed</p>
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
    </div>
  );
}
