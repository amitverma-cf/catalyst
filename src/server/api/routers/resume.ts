import { z } from "zod";
import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { resumeAnalysis } from "@/server/db/schema";
import { validatePDFFile, extractPDFData } from "@/lib/types";

// Configure the Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Function declaration for resume analysis
const analyzeResumeFunctionDeclaration = {
  name: 'analyze_resume',
  description: 'Analyzes a resume and provides comprehensive insights including skills, experience, education, strengths, areas for improvement, and recommendations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      extractedText: {
        type: Type.STRING,
        description: 'Full text content extracted from the resume'
      },
      skills: {
        type: Type.OBJECT,
        properties: {
          technical: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Technical skills identified in the resume'
          },
          soft: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Soft skills identified in the resume'
          },
          programming: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Programming languages and technologies identified'
          },
          tools: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Tools, platforms, and technologies used'
          }
        },
        required: ['technical', 'soft', 'programming', 'tools']
      },
      experience: {
        type: Type.OBJECT,
        properties: {
          totalYears: {
            type: Type.NUMBER,
            description: 'Total years of work experience calculated from positions'
          },
          positions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING, description: 'Company name' },
                role: { type: Type.STRING, description: 'Job title/role' },
                duration: { type: Type.STRING, description: 'Employment period (e.g., "01/2024 - 07/2024")' },
                responsibilities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Key responsibilities and achievements'
                }
              },
              required: ['company', 'role', 'duration', 'responsibilities']
            },
            description: 'Work experience positions'
          },
          industries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Industries the candidate has worked in'
          }
        },
        required: ['totalYears', 'positions', 'industries']
      },
      education: {
        type: Type.OBJECT,
        properties: {
          degrees: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING, description: 'Degree name' },
                institution: { type: Type.STRING, description: 'School/university name' },
                year: { type: Type.STRING, description: 'Graduation year or expected year' }
              },
              required: ['degree', 'institution', 'year']
            },
            description: 'Educational degrees and qualifications'
          },
          certifications: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Professional certifications and licenses'
          }
        },
        required: ['degrees', 'certifications']
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key strengths and positive aspects of the resume'
      },
      improvementAreas: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Areas where the resume could be improved'
      },
      overallScore: {
        type: Type.NUMBER,
        description: 'Overall resume quality score from 1-100'
      },
      recommendations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Specific recommendations for improving the resume'
      }
    },
    required: ['extractedText', 'skills', 'experience', 'education', 'strengths', 'improvementAreas', 'overallScore', 'recommendations']
  }
};

const resumeAnalysisPrompt = `
Analyze this resume thoroughly and provide a comprehensive analysis for the target job role. 

Focus on:
- Extracting all relevant text content
- Identifying technical and soft skills
- Analyzing work experience and calculating total years
- Reviewing education and certifications
- Identifying strengths and areas for improvement
- Providing specific, actionable recommendations
- Scoring the resume quality from 1-100

Be thorough and accurate in your analysis. Consider the target job role when evaluating relevance and providing recommendations.
`;

export const resumeRouter = createTRPCRouter({
  // Upload and analyze resume
  analyzeResume: publicProcedure
    .input(z.object({ 
      resumeText: z.string().min(1, "Resume text is required"),
      jobRole: z.string().min(1, "Job role is required"),
      userId: z.string().min(1, "User ID is required")
    }))
    .mutation(async ({ input }) => {
      try {
        let prompt = `${resumeAnalysisPrompt}
        
        Target Job Role: ${input.jobRole}`;

        // Check if this is a PDF file upload
        const pdfData = extractPDFData(input.resumeText);
        
                if (pdfData) {
          console.log(`Processing PDF file: ${pdfData.fileName}`);
          
          // Validate the PDF data
          const validation = validatePDFFile(pdfData.fileBuffer);
          
          if (!validation.isValid) {
            console.error(`PDF validation failed for ${pdfData.fileName}: ${validation.error}`);
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `PDF validation failed: ${validation.error}. Please ensure you are uploading a valid PDF file.`
            });
          }

          console.log(`PDF validation passed. File size: ${validation.fileSize} bytes`);
          
          try {
            // Upload file to Gemini File API
            console.log('Uploading PDF to Gemini File API...');
            const file = await ai.files.upload({
              file: new Blob([new Uint8Array(pdfData.fileBuffer)], { type: 'application/pdf' }),
              config: {
                displayName: pdfData.fileName,
              },
            });

            // Wait for the file to be processed
            if (!file.name) {
              throw new Error('File upload failed - no file name returned');
            }
            
            let getFile = await ai.files.get({ name: file.name });
            while (getFile.state === 'PROCESSING') {
              getFile = await ai.files.get({ name: file.name });
              console.log(`File processing status: ${getFile.state}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (getFile.state === 'FAILED') {
              throw new Error('File processing failed');
            }

            console.log('File uploaded successfully, analyzing with Gemini...');
            
            if (!file.uri) {
              throw new Error('File upload failed - no URI returned');
            }
            
            // Analyze the file with Gemini using function calling
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                { text: prompt },
                { fileData: { fileUri: file.uri, mimeType: 'application/pdf' } }
              ],
              config: {
                tools: [{
                  functionDeclarations: [analyzeResumeFunctionDeclaration]
                }],
                toolConfig: {
                  functionCallingConfig: {
                    mode: FunctionCallingConfigMode.ANY
                  }
                }
              }
            });

            console.log('Gemini analysis completed successfully');
            
            let geminiAnalysis;
            if (response.functionCalls && response.functionCalls.length > 0) {
              const functionCall = response.functionCalls[0];
              if (functionCall) {
                console.log('Function call received:', functionCall.name);
                geminiAnalysis = functionCall.args;
              } else {
                console.log('No valid function call received, using text response');
                const analysisText = response.text || "";
                try {
                  geminiAnalysis = JSON.parse(analysisText);
                } catch {
                  geminiAnalysis = { rawAnalysis: analysisText };
                }
              }
            } else {
              console.log('No function call received, using text response');
              const analysisText = response.text || "";
              try {
                geminiAnalysis = JSON.parse(analysisText);
              } catch {
                geminiAnalysis = { rawAnalysis: analysisText };
              }
            }

          // Use extracted text from analysis or fallback to filename
          const finalResumeText = geminiAnalysis.extractedText || `PDF Resume: ${pdfData.fileName}`;

          // Save to database
          const savedAnalysisArray = await db.insert(resumeAnalysis).values({
            userId: input.userId,
            resumeText: finalResumeText,
            jobRole: input.jobRole,
            skills: geminiAnalysis.skills || null,
            experience: geminiAnalysis.experience || null,
            geminiAnalysis: geminiAnalysis,
          }).returning();

          const savedAnalysis = savedAnalysisArray[0];
          if (!savedAnalysis) {
            throw new Error("Failed to save analysis");
          }

          return {
            success: true,
            analysisId: savedAnalysis.id,
            analysis: geminiAnalysis
          };
        } catch (error) {
          console.error('PDF processing error:', error);
          
          // Handle specific Gemini API errors
          if (error instanceof Error) {
            if (error.message.includes('document has no pages')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'The uploaded PDF appears to be empty or corrupted. Please upload a valid PDF file with readable content.'
              });
            }
            
            if (error.message.includes('INVALID_ARGUMENT')) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'The PDF file format is not supported or the file is corrupted. Please try uploading a different PDF file.'
              });
            }
            
            if (error.message.includes('PERMISSION_DENIED')) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'API access denied. Please check your API configuration.'
              });
            }
          }
          
          // For PDF processing errors, provide a helpful message
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to process PDF file. Please try again or upload a different file. If the problem persists, try copying the text content from your PDF and paste it directly.'
          });
        }
        } else {
          // Handle text input
          prompt += `\nResume Content: ${input.resumeText}
          
          Please analyze this resume for the target role and provide detailed insights.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              tools: [{
                functionDeclarations: [analyzeResumeFunctionDeclaration]
              }],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.ANY
                }
              }
            }
          });

          let geminiAnalysis;
          if (response.functionCalls && response.functionCalls.length > 0) {
            const functionCall = response.functionCalls[0];
            if (functionCall) {
              console.log('Function call received:', functionCall.name);
              geminiAnalysis = functionCall.args;
            } else {
              console.log('No valid function call received, using text response');
              const analysisText = response.text || "";
              try {
                geminiAnalysis = JSON.parse(analysisText);
              } catch {
                geminiAnalysis = { rawAnalysis: analysisText };
              }
            }
          } else {
            console.log('No function call received, using text response');
            const analysisText = response.text || "";
            try {
              geminiAnalysis = JSON.parse(analysisText);
            } catch {
              geminiAnalysis = { rawAnalysis: analysisText };
            }
          }

          // Save to database
          const savedAnalysisArray = await db.insert(resumeAnalysis).values({
            userId: input.userId,
            resumeText: input.resumeText,
            jobRole: input.jobRole,
            skills: geminiAnalysis.skills || null,
            experience: geminiAnalysis.experience || null,
            geminiAnalysis: geminiAnalysis,
          }).returning();

          const savedAnalysis = savedAnalysisArray[0];
          if (!savedAnalysis) {
            throw new Error("Failed to save analysis");
          }

          return {
            success: true,
            analysisId: savedAnalysis.id,
            analysis: geminiAnalysis
          };
        }
      } catch (error) {
        console.error('Resume analysis error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze resume'
        });
      }
    }),  // Get user's resume analyses
  getUserAnalyses: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const analyses = await db.query.resumeAnalysis.findMany({
        where: (resume, { eq }) => eq(resume.userId, input.userId),
        orderBy: (resume, { desc }) => [desc(resume.createdAt)]
      });
      
      return analyses;
    }),

  // Get specific resume analysis
  getAnalysis: publicProcedure
    .input(z.object({ analysisId: z.number() }))
    .query(async ({ input }) => {
      const analysis = await db.query.resumeAnalysis.findFirst({
        where: (resume, { eq }) => eq(resume.id, input.analysisId)
      });
      
      if (!analysis) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Resume analysis not found'
        });
      }
      
      return analysis;
    }),

  // Delete resume analysis
  deleteAnalysis: publicProcedure
    .input(z.object({ 
      analysisId: z.number(),
      userId: z.string() 
    }))
    .mutation(async ({ input }) => {
      const deleted = await db.delete(resumeAnalysis)
        .where(
          and(
            eq(resumeAnalysis.id, input.analysisId),
            eq(resumeAnalysis.userId, input.userId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Resume analysis not found or unauthorized'
        });
      }

      return { success: true };
    })
});
