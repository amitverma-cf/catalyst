import { z } from 'zod';
import { GoogleGenAI, MediaResolution, Modality, StartSensitivity, EndSensitivity } from '@google/genai';
import { eq, and, desc } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { interviews, interviewFeedback, resumeAnalysis } from '../../db/schema';

export const interviewRouter = createTRPCRouter({
  // Create ephemeral token for secure client-side authentication
  createEphemeralToken: protectedProcedure
    .input(z.object({
      jobRole: z.string(),
      resumeAnalysisId: z.number().optional(),
      settings: z.object({
        voiceName: z.string().default('Zephyr'),
        languageCode: z.string().default('en-US'),
        enableVideo: z.boolean().default(true),
        enableAudio: z.boolean().default(true),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });

        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const newSessionExpireTime = new Date(Date.now() + 1 * 60 * 1000).toISOString();

        // Create ephemeral token with interview-specific constraints
        const token = await ai.authTokens.create({
          config: {
            uses: 0,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
              model: 'gemini-2.5-flash-preview-native-audio-dialog',
              config: {
                sessionResumption: {},
                responseModalities: [Modality.AUDIO],
                mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: input.settings.voiceName,
                    },
                  },
                  languageCode: input.settings.languageCode,
                },
                contextWindowCompression: {
                  triggerTokens: '25600',
                  slidingWindow: { targetTokens: '12800' },
                },
                realtimeInputConfig: {
                  automaticActivityDetection: {
                    disabled: false,
                    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                    prefixPaddingMs: 20,
                    silenceDurationMs: 100,
                  },
                },
              },
            },
            httpOptions: { apiVersion: 'v1alpha' },
          },
        });

        // Create interview record in database
        const [interview] = await ctx.db
          .insert(interviews)
          .values({
            userId: ctx.auth.userId,
            resumeAnalysisId: input.resumeAnalysisId,
            jobRole: input.jobRole,
            status: 'in_progress',
            startedAt: new Date(),
          })
          .returning();

        if (!interview) {
          throw new Error('Failed to create interview record');
        }

        return {
          success: true,
          token: token.name,
          interviewId: interview.id,
          config: {
            model: 'gemini-2.5-flash-preview-native-audio-dialog',
            responseModalities: ['AUDIO'],
            mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: input.settings.voiceName,
                },
              },
              languageCode: input.settings.languageCode,
            },
            contextWindowCompression: {
              triggerTokens: '25600',
              slidingWindow: { targetTokens: '12800' },
            },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
                endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                prefixPaddingMs: 20,
                silenceDurationMs: 100,
              },
            },
          },
        };
      } catch (error) {
        console.error('Error creating ephemeral token:', error);
        throw new Error('Failed to create interview session');
      }
    }),

  // Get interview by ID
  getInterview: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const interview = await ctx.db.query.interviews.findFirst({
        where: and(
          eq(interviews.id, input.id),
          eq(interviews.userId, ctx.auth.userId)
        ),
        with: {
          resumeAnalysis: true,
          feedback: true,
        },
      });

      return interview;
    }),

  // Get user's interviews
  getUserInterviews: protectedProcedure
    .input(z.object({
      limit: z.number().default(10),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const userInterviews = await ctx.db.query.interviews.findMany({
        where: eq(interviews.userId, ctx.auth.userId),
        orderBy: [desc(interviews.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          resumeAnalysis: true,
          feedback: true,
        },
      });

      return userInterviews;
    }),

  // Complete interview and save feedback
  completeInterview: protectedProcedure
    .input(z.object({
      interviewId: z.number(),
      feedback: z.object({
        overallRating: z.enum(['excellent', 'good', 'average', 'needs_improvement']),
        strengths: z.string().optional(),
        improvements: z.string().optional(),
        summary: z.string().optional(),
        skillRatings: z.record(z.enum(['excellent', 'good', 'average', 'needs_improvement'])).optional(),
        geminiInsights: z.any().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update interview status
      await ctx.db
        .update(interviews)
        .set({
          status: 'completed',
          endedAt: new Date(),
        })
        .where(and(
          eq(interviews.id, input.interviewId),
          eq(interviews.userId, ctx.auth.userId)
        ));

      // Create feedback record
      const [feedback] = await ctx.db
        .insert(interviewFeedback)
        .values({
          interviewId: input.interviewId,
          overallRating: input.feedback.overallRating,
          strengths: input.feedback.strengths,
          improvements: input.feedback.improvements,
          summary: input.feedback.summary,
          skillRatings: input.feedback.skillRatings,
          geminiInsights: input.feedback.geminiInsights,
        })
        .returning();

      return feedback;
    }),

  // Get interview statistics
  getInterviewStats: protectedProcedure
    .query(async ({ ctx }) => {
      const totalInterviews = await ctx.db
        .select({ count: interviews.id })
        .from(interviews)
        .where(eq(interviews.userId, ctx.auth.userId));

      const completedInterviews = await ctx.db
        .select({ count: interviews.id })
        .from(interviews)
        .where(and(
          eq(interviews.userId, ctx.auth.userId),
          eq(interviews.status, 'completed')
        ));

      const averageRating = await ctx.db
        .select({ rating: interviewFeedback.overallRating })
        .from(interviewFeedback)
        .innerJoin(interviews, eq(interviewFeedback.interviewId, interviews.id))
        .where(eq(interviews.userId, ctx.auth.userId));

      return {
        totalInterviews: totalInterviews.length,
        completedInterviews: completedInterviews.length,
        averageRating: averageRating.length > 0
          ? averageRating.reduce((acc, curr) => {
            const ratingValues = { excellent: 4, good: 3, average: 2, needs_improvement: 1 };
            return acc + ratingValues[curr.rating as keyof typeof ratingValues];
          }, 0) / averageRating.length
          : 0,
      };
    }),

  // Get recent resume analysis for interview context
  getRecentResumeAnalysis: protectedProcedure
    .query(async ({ ctx }) => {
      const recentAnalysis = await ctx.db.query.resumeAnalysis.findFirst({
        where: eq(resumeAnalysis.userId, ctx.auth.userId),
        orderBy: [desc(resumeAnalysis.createdAt)],
      });

      return recentAnalysis;
    }),
});
