// PDF and File Types
export interface PDFFileData {
  fileBuffer: Buffer;
  fileName: string;
  fileSize?: number;
}

export interface PDFValidationResult {
  isValid: boolean;
  error?: string;
  fileSize?: number;
}

// Resume Analysis Types
export interface ResumeAnalysis {
  id: number;
  userId: string;
  resumeText: string;
  jobRole: string;
  skills: Skills | null;
  experience: Experience | null;
  geminiAnalysis: unknown;
  createdAt: Date;
}

export interface Skills {
  technical: string[];
  soft: string[];
  programming: string[];
  tools: string[];
}

export interface Experience {
  totalYears: number;
  positions: Position[];
  industries: string[];
}

export interface Position {
  company: string;
  role: string;
  duration: string;
  responsibilities: string[];
}

export interface Education {
  degrees: Degree[];
  certifications: string[];
}

export interface Degree {
  degree: string;
  institution: string;
  year: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ResumeAnalysisResponse {
  success: boolean;
  analysisId: number;
  analysis: any;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

// PDF Validation Utilities
export function validatePDFFile(fileBuffer: Buffer): PDFValidationResult {
  if (!fileBuffer || fileBuffer.length === 0) {
    console.log('PDF validation failed: File buffer is empty');
    return {
      isValid: false,
      error: 'File is empty'
    };
  }

  console.log(`PDF validation - File size: ${fileBuffer.length} bytes`);
  
  // Check file size (minimum 50 bytes for a valid PDF)
  if (fileBuffer.length < 50) {
    console.log(`PDF validation failed: File too small (${fileBuffer.length} bytes)`);
    return {
      isValid: false,
      error: 'File is too small to be a valid PDF. Please ensure you are uploading a complete PDF file.'
    };
  }

  // Check if it's a PDF by looking for PDF header
  const pdfHeader = fileBuffer.slice(0, 4).toString('ascii');
  console.log(`PDF validation - Header: "${pdfHeader}"`);
  
  if (pdfHeader !== '%PDF') {
    console.log(`PDF validation failed: Invalid header "${pdfHeader}"`);
    
    // Check if it might be a text file instead
    const textContent = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 200));
    if (textContent.includes('resume') || textContent.includes('experience') || textContent.includes('education')) {
      return {
        isValid: false,
        error: 'This appears to be a text file, not a PDF. Please upload a PDF file or paste the text content directly.'
      };
    }
    
    return {
      isValid: false,
      error: 'File does not appear to be a valid PDF. Please ensure you are uploading a PDF file.'
    };
  }

  console.log('PDF validation passed successfully');
  return {
    isValid: true,
    fileSize: fileBuffer.length
  };
}

export function extractPDFData(resumeText: string): PDFFileData | null {
  // Try JSON format first (newer, more reliable)
  try {
    const jsonData = JSON.parse(resumeText);
    if (jsonData.type === 'PDF_FILE' && jsonData.data && jsonData.fileName) {
      console.log(`Extracted PDF data (JSON) - File: ${jsonData.fileName}, Data length: ${jsonData.data.length} characters`);
      
      try {
        const cleanBase64Data = jsonData.data.split(',')[1] || jsonData.data;
        const fileBuffer = Buffer.from(cleanBase64Data, 'base64');
        
        console.log(`Converted to buffer - Size: ${fileBuffer.length} bytes`);
        
        if (fileBuffer.length < 100) {
          console.log(`Warning: Very small file buffer (${fileBuffer.length} bytes). This might indicate a corrupted or incomplete file.`);
        }
        
        return {
          fileBuffer,
          fileName: jsonData.fileName
        };
      } catch (error) {
        console.log(`Failed to convert base64 to buffer: ${error}`);
        return null;
      }
    }
  } catch {
    // Fallback to old format
  }

  // Legacy format support
  if (!resumeText.startsWith('PDF_FILE|')) {
    return null;
  }

  const parts = resumeText.split('|');
  if (parts.length < 3) {
    console.log('Invalid PDF_FILE format: insufficient parts');
    return null;
  }

  const base64Data = parts[1];
  const fileName = parts[2];

  if (!base64Data || !fileName) {
    console.log('Invalid PDF_FILE format: missing base64Data or fileName');
    return null;
  }

  console.log(`Extracted PDF data - File: ${fileName}, Data length: ${base64Data.length} characters`);
  
  try {
    // Convert base64 to buffer
    const cleanBase64Data = base64Data.split(',')[1] || base64Data;
    const fileBuffer = Buffer.from(cleanBase64Data, 'base64');
    
    console.log(`Converted to buffer - Size: ${fileBuffer.length} bytes`);
    
    // Additional debugging for very small files
    if (fileBuffer.length < 100) {
      console.log(`Warning: Very small file buffer (${fileBuffer.length} bytes). This might indicate a corrupted or incomplete file.`);
    }
    
    return {
      fileBuffer,
      fileName
    };
  } catch (error) {
    console.log(`Failed to convert base64 to buffer: ${error}`);
    return null;
  }
} 

// Interview Types
export interface Interview {
  id: number;
  userId: string;
  resumeAnalysisId?: number | null;
  jobRole: string;
  status: 'in_progress' | 'completed';
  startedAt: Date;
  endedAt?: Date | null;
  geminiSessionId?: string | null;
  createdAt: Date;
}

export interface InterviewFeedback {
  id: number;
  interviewId: number;
  overallRating: 'excellent' | 'good' | 'average' | 'needs_improvement';
  strengths?: string | null;
  improvements?: string | null;
  summary?: string | null;
  skillRatings?: Record<string, 'excellent' | 'good' | 'average' | 'needs_improvement'> | null;
  geminiInsights?: unknown;
  createdAt: Date;
}

export interface EphemeralToken {
  name: string;
  expireTime: string;
  newSessionExpireTime: string;
}

export interface InterviewSession {
  id: string;
  token: string;
  model: string;
  config: InterviewConfig;
}

export interface InterviewConfig {
  responseModalities: string[];
  mediaResolution?: string;
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: string;
      };
    };
    languageCode?: string;
  };
  contextWindowCompression?: {
    triggerTokens: string;
    slidingWindow: { targetTokens: string };
  };
  sessionResumption?: { handle?: string };
  realtimeInputConfig?: {
    automaticActivityDetection?: {
      disabled?: boolean;
      startOfSpeechSensitivity?: string;
      endOfSpeechSensitivity?: string;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
}

export interface LiveServerMessage {
  serverContent?: {
    turnComplete?: boolean;
    modelTurn?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data: string;
          mimeType: string;
        };
        fileData?: {
          fileUri: string;
        };
      }>;
    };
    interrupted?: boolean;
    generationComplete?: boolean;
    outputTranscription?: {
      text: string;
    };
    inputTranscription?: {
      text: string;
    };
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
    }>;
  };
  sessionResumptionUpdate?: {
    resumable: boolean;
    newHandle: string;
  };
  goAway?: {
    timeLeft: string;
  };
  usageMetadata?: {
    totalTokenCount: string;
    responseTokensDetails: any[];
  };
  data?: string;
  text?: string;
}

export interface InterviewState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  sessionId?: string;
  messages: LiveServerMessage[];
  currentTurn: LiveServerMessage[];
}

export interface InterviewSettings {
  jobRole: string;
  voiceName: string;
  languageCode: string;
  enableVideo: boolean;
  enableAudio: boolean;
}

// Database result types (matching actual schema)
export interface ResumeAnalysisDB {
  id: number;
  userId: string;
  resumeText: string;
  jobRole: string;
  skills: unknown;
  experience: unknown;
  geminiAnalysis: unknown;
  createdAt: Date;
}

export interface InterviewFeedbackDB {
  id: number;
  interviewId: number;
  overallRating: 'excellent' | 'good' | 'average' | 'needs_improvement';
  strengths: string | null;
  improvements: string | null;
  summary: string | null;
  skillRatings: unknown;
  geminiInsights: unknown;
  createdAt: Date;
}

export interface InterviewDB {
  id: number;
  userId: string;
  resumeAnalysisId: number | null;
  jobRole: string;
  status: 'in_progress' | 'completed';
  startedAt: Date;
  endedAt: Date | null;
  geminiSessionId: string | null;
  createdAt: Date;
  resumeAnalysis?: ResumeAnalysisDB | null;
  feedback?: InterviewFeedbackDB | null;
} 