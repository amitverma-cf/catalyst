import { z } from "zod";
import { GoogleGenAI } from '@google/genai';
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { resumeAnalysis } from "@/server/db/schema";

// Configure the Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const resumeAnalysisPrompt = `
Analyze this resume thoroughly and provide a comprehensive analysis. Return your response as a JSON object with the following structure:

{
  "extractedText": "Full text content of the resume",
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "programming": ["language1", "language2"],
    "tools": ["tool1", "tool2"]
  },
  "experience": {
    "totalYears": number,
    "positions": [
      {
        "company": "Company Name",
        "role": "Job Title",
        "duration": "Start - End",
        "responsibilities": ["resp1", "resp2"]
      }
    ],
    "industries": ["industry1", "industry2"]
  },
  "education": {
    "degrees": [
      {
        "degree": "Degree Name",
        "institution": "School Name",
        "year": "Graduation Year"
      }
    ],
    "certifications": ["cert1", "cert2"]
  },
  "strengths": ["strength1", "strength2"],
  "improvementAreas": ["area1", "area2"],
  "overallScore": number (1-100),
  "recommendations": ["rec1", "rec2"]
}

Be thorough and accurate in your analysis.
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
        if (input.resumeText.startsWith('PDF_FILE:')) {
          const parts = input.resumeText.split(':');
          const base64Data = parts[1];
          const fileName = parts[2];
          
          if (!base64Data || !fileName) {
            throw new Error("Invalid PDF file format");
          }
          
          prompt += `\nPlease analyze this PDF resume file for the target role and provide detailed insights.`;

          const contents = [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data.split(',')[1] || base64Data // Remove data:application/pdf;base64, if present
              }
            }
          ];

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents
          });

          const analysisText = response.text || "";
          
          let geminiAnalysis;
          try {
            geminiAnalysis = JSON.parse(analysisText);
          } catch {
            geminiAnalysis = { rawAnalysis: analysisText };
          }

          // Use extracted text from analysis or fallback to filename
          const finalResumeText = geminiAnalysis.extractedText || `PDF Resume: ${fileName}`;

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
        } else {
          // Handle text input
          prompt += `\nResume Content: ${input.resumeText}
          
          Please analyze this resume for the target role and provide detailed insights.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          });

          const analysisText = response.text || "";
          
          let geminiAnalysis;
          try {
            geminiAnalysis = JSON.parse(analysisText);
          } catch {
            geminiAnalysis = { rawAnalysis: analysisText };
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
