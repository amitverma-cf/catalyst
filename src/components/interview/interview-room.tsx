'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Mic, 
  MicOff,
  PhoneOff, 
  Settings, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { InterviewSettings, LiveServerMessage, InterviewState } from '@/lib/types';

// Audio utility functions from the reference implementation
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
    int16[i] = (data[i] ?? 0) * 32768;
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
  const buffer = ctx.createBuffer(
    numChannels,
    data.length / 2 / numChannels,
    sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = (dataInt16[i] ?? 0) / 32768.0;
  }
  
  // Extract interleaved channels
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
        (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
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

  // Refs for media handling (audio only)
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
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

  // Initialize interview session
  useEffect(() => {
    // Suppress specific console warnings during initialization
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      if (
        !message.includes('non-text parts inlineData') &&
        !message.includes('AbortError') &&
        !message.includes('NotSupportedError')
      ) {
        originalWarn(...args);
      }
    };

    initializeSession();
    
    return () => {
      console.warn = originalWarn;
      cleanupSession();
    };
  }, []);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Only request audio permissions (no video)
      if (settings.enableAudio) {
        try {
          const constraints = {
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          mediaStreamRef.current = stream;

          // Set up audio processing
          await setupAudioProcessing(stream);
        } catch (mediaError) {
          console.warn('Media access error:', mediaError);
          
          // Provide user-friendly error messages
          if (mediaError instanceof Error) {
            if (mediaError.name === 'NotAllowedError') {
              throw new Error('Microphone permission denied. Please allow microphone access.');
            } else if (mediaError.name === 'NotFoundError') {
              throw new Error('No microphone found. Please check your microphone.');
            } else if (mediaError.name === 'NotReadableError') {
              throw new Error('Microphone is already in use by another application.');
            } else {
              throw new Error(`Microphone access failed: ${mediaError.message}`);
            }
          } else {
            throw new Error('Failed to access microphone');
          }
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
      // Create separate contexts for input and output
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error('AudioContext not supported in this browser');
      }

      // Input context for microphone (16kHz)
      const inputContext = new AudioContextConstructor({ sampleRate: 16000 });
      if (inputContext.state === 'suspended') {
        await inputContext.resume();
      }

      // Output context for AI voice (24kHz) 
      const outputContext = new AudioContextConstructor({ sampleRate: 24000 });
      if (outputContext.state === 'suspended') {
        await outputContext.resume();
      }
      
      // Store output context as the main audio context for playback
      audioContextRef.current = outputContext;

      // Create output gain node for AI voice
      const outputGain = outputContext.createGain();
      outputGain.gain.value = 1.0; // Full volume for AI voice
      outputGain.connect(outputContext.destination);
      outputGainRef.current = outputGain;
      
      // Initialize timing for smooth audio playback
      nextStartTimeRef.current = outputContext.currentTime;

      // Setup microphone input processing
      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(1024, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (state.isRecording && sessionRef.current) {
          try {
            const inputBuffer = event.inputBuffer;
            const pcmData = inputBuffer.getChannelData(0);
            
            // Create blob for Gemini (expects 16kHz)
            const blob = createBlob(pcmData);
            sessionRef.current.sendRealtimeInput({ media: blob });
          } catch (error) {
            console.warn('Audio processing error:', error);
          }
        }
      };

      // Connect input processing chain (muted to avoid feedback)
      source.connect(processor);
      const inputGain = inputContext.createGain();
      inputGain.gain.value = 0; // Mute input to prevent feedback
      processor.connect(inputGain);
      inputGain.connect(inputContext.destination);

      console.log('Audio processing setup completed');

    } catch (err) {
      console.error('Failed to setup audio processing:', err);
      throw new Error(`Audio setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
            try {
              responseQueue.push(message);
              handleGeminiMessage(message);
            } catch (error) {
              console.warn('Message handling error:', error);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini session error:', e.message);
            // Filter out common non-critical errors
            if (!e.message?.includes('non-text parts') && !e.message?.includes('AbortError')) {
              setError(`Session error: ${e.message}`);
              toast.error('Interview session error');
            }
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

      // Start the interview immediately by sending a simple trigger message
      console.log('Starting interview conversation...');
      
      // Send a simple message to trigger the AI to start speaking
      setTimeout(() => {
        if (sessionRef.current) {
          console.log('Sending initial message to trigger AI response');
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
      console.error('Failed to initialize Gemini session:', err);
      throw new Error(`Session initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleGeminiMessage = async (message: any) => {
    console.log('Received Gemini message:', message);
    
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      currentTurn: [...prev.currentTurn, message],
    }));

    // Handle audio output - check multiple possible locations for audio data
    let audioData = null;
    
    // Check different possible locations for audio data
    if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
      audioData = message.serverContent.modelTurn.parts[0].inlineData.data;
      console.log('Found audio in modelTurn.parts.inlineData');
    } else if (message.data) {
      audioData = message.data;
      console.log('Found audio in message.data');
    } else if (message.serverContent?.modelTurn?.parts?.[0]?.audio?.data) {
      audioData = message.serverContent.modelTurn.parts[0].audio.data;
      console.log('Found audio in modelTurn.parts.audio');
    }

    if (audioData && audioContextRef.current && outputGainRef.current) {
      try {
        console.log('Processing audio data...', { audioDataLength: audioData.length });
        
        // Stop any currently playing audio sources
        if (audioSourcesRef.current.size > 0) {
          console.log('Stopping existing audio sources');
          audioSourcesRef.current.forEach(source => {
            try {
              source.stop();
            } catch (e) {
              console.warn('Error stopping audio source:', e);
            }
          });
          audioSourcesRef.current.clear();
        }

        // Decode audio data
        const decodedData = decode(audioData);
        const audioBuffer = await decodeAudioData(
          decodedData,
          audioContextRef.current,
          24000, // Expected sample rate from Gemini
          1 // Mono
        );

        console.log('Audio buffer created:', { 
          duration: audioBuffer.duration, 
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels
        });

        // Calculate next start time for smooth playback
        const currentTime = audioContextRef.current.currentTime;
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);

        // Create and configure audio source
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputGainRef.current);
        
        // Handle source cleanup when it ends
        source.onended = () => {
          console.log('Audio playback ended');
          audioSourcesRef.current.delete(source);
          if (audioSourcesRef.current.size === 0) {
            setState(prev => ({ ...prev, isSpeaking: false }));
          }
        };

        // Start playback
        console.log('Starting audio playback at time:', nextStartTimeRef.current);
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
        audioSourcesRef.current.add(source);
        
        setState(prev => ({ ...prev, isSpeaking: true }));
        console.log('Audio playback started successfully');

      } catch (error) {
        console.error('Audio processing error:', error);
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
    } else {
      if (!audioData) {
        console.log('No audio data found in message');
      }
      if (!audioContextRef.current) {
        console.log('No audio context available');
      }
      if (!outputGainRef.current) {
        console.log('No output gain node available');
      }
    }

    // Handle interruptions
    if (message.serverContent?.interrupted) {
      // Stop all playing audio sources
      if (audioSourcesRef.current.size > 0) {
        audioSourcesRef.current.forEach(source => {
          try {
            source.stop();
          } catch {
            // Source might already be stopped
          }
        });
        audioSourcesRef.current.clear();
      }
      nextStartTimeRef.current = 0;
      setState(prev => ({ ...prev, isSpeaking: false }));
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

  const toggleRecording = async () => {
    if (!state.isConnected) return;

    console.log('Toggle recording called, current state:', { 
      isRecording: state.isRecording, 
      audioContextState: audioContextRef.current?.state,
      outputGainState: outputGainRef.current?.context?.state 
    });

    // Handle AudioContext resume for user interaction requirement
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        console.log('Resuming main audio context...');
        await audioContextRef.current.resume();
        console.log('Main audio context resumed');
      } catch (error) {
        console.warn('Failed to resume AudioContext:', error);
        toast.error('Audio context activation failed');
        return;
      }
    }

    // Also ensure output gain context is resumed
    if (outputGainRef.current && outputGainRef.current.context.state === 'suspended') {
      try {
        console.log('Resuming output gain context...');
        const context = outputGainRef.current.context as AudioContext;
        await context.resume();
        console.log('Output gain context resumed');
      } catch (error) {
        console.warn('Failed to resume output AudioContext:', error);
      }
    }

    setState(prev => ({ ...prev, isRecording: !prev.isRecording }));
    
    if (!state.isRecording) {
      console.log('Starting recording...');
      toast.success('Recording started - speak now!');
    } else {
      console.log('Stopping recording...');
      toast.info('Recording stopped');
    }
  };

  const cleanupSession = () => {
    try {
      // Close Gemini session
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }

      // Stop all audio sources
      if (audioSourcesRef.current.size > 0) {
        audioSourcesRef.current.forEach((source: AudioBufferSourceNode) => {
          try {
            source.stop();
          } catch {
            // Source might already be stopped
          }
        });
        audioSourcesRef.current.clear();
      }

      // Stop media streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }

      // Clean up audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.warn);
        audioContextRef.current = null;
      }

      // Clean up audio processor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }

      // Clean up output gain
      if (outputGainRef.current) {
        outputGainRef.current.disconnect();
        outputGainRef.current = null;
      }

      // Reset timing
      nextStartTimeRef.current = 0;

      // Clean up audio element (keep as fallback)
      if (audioRef.current) {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
        
        // Clean up blob URLs to prevent memory leaks
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        
        audioRef.current.src = '';
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }

      // Clean up video element (removed)
      // videoRef is no longer used

      setState(prev => ({ ...prev, isConnected: false, isSpeaking: false, isRecording: false }));
      
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audio Controls Area */}
        <div className="space-y-4">
          {/* Audio Controls */}
          {settings.enableAudio && (
            <Card>
              <CardHeader>
                <CardTitle>Voice Interview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Click `&quot;Start Recording&quot;` to begin speaking with the AI interviewer
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-6">
                  {/* Large microphone button */}
                  <div className="relative">
                    <Button
                      variant={state.isRecording ? 'destructive' : 'default'}
                      onClick={toggleRecording}
                      disabled={!state.isConnected}
                      size="lg"
                      className="w-24 h-24 rounded-full text-lg"
                    >
                      {state.isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    </Button>
                    {state.isRecording && (
                      <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-pulse" />
                    )}
                  </div>
                  
                  {/* Status indicator */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        state.isSpeaking ? 'bg-blue-500 animate-pulse' : 
                        state.isRecording ? 'bg-green-500 animate-pulse' : 
                        'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium">
                        {state.isSpeaking ? 'AI is speaking...' : 
                         state.isRecording ? 'Listening to you...' : 
                         state.isConnected ? 'Ready to start' : 'Connecting...'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {state.isRecording ? 'Click the microphone again to stop recording' : 
                       state.isConnected ? 'Click the microphone to start speaking' : 
                       'Initializing audio system...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status and Controls Area */}
        <div className="space-y-4">
          {/* Session Status */}
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
                <span className="text-sm">Connection</span>
                <Badge variant={state.isConnected ? 'default' : 'secondary'}>
                  {state.isConnected ? '🟢 Connected' : '🔴 Connecting...'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Job Role</span>
                <Badge variant="outline">{settings.jobRole}</Badge>
              </div>
              
              {/* Test Audio Button */}
              {state.isConnected && (
                <Button
                  onClick={() => {
                    if (sessionRef.current) {
                      console.log('Sending test message to trigger AI response...');
                      sessionRef.current.sendClientContent({
                        turns: [{
                          role: 'user',
                          parts: [{
                            text: "Please say 'Hello, I am your AI interviewer. Can you hear me clearly?'"
                          }]
                        }]
                      });
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  🔊 Test AI Voice
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Wait for the AI to greet you and ask the first question</p>
              <p>2. Click the microphone to start recording your answer</p>
              <p>3. Speak clearly and click again when finished</p>
              <p>4. The AI will respond and ask follow-up questions</p>
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