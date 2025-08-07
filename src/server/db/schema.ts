import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ENUMs for basic feedback and status tracking
export const ratingEnum = pgEnum('rating', ['excellent', 'good', 'average', 'needs_improvement']);
export const interviewStatusEnum = pgEnum('interview_status', ['in_progress', 'completed']);
export const skillCategoryEnum = pgEnum('skill_category', ['technical', 'behavioral', 'communication']);

/**
 * User profile
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Resume analysis
 */
export const resumeAnalysis = pgTable('resume_analysis', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resumeText: text('resume_text').notNull(),
  jobRole: text('job_role').notNull(),
  skills: jsonb('skills'),
  experience: jsonb('experience'),
  geminiAnalysis: jsonb('gemini_analysis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Live AI Interview sessions
 */
export const interviews = pgTable('interviews', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resumeAnalysisId: integer('resume_analysis_id').references(() => resumeAnalysis.id),
  jobRole: text('job_role').notNull(),
  status: interviewStatusEnum('status').default('in_progress').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  geminiSessionId: text('gemini_session_id'), // Gemini Audio Native session
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Interview feedback and results
 */
export const interviewFeedback = pgTable('interview_feedback', {
  id: serial('id').primaryKey(),
  interviewId: integer('interview_id').notNull().references(() => interviews.id, { onDelete: 'cascade' }),
  overallRating: ratingEnum('overall_rating').notNull(),
  strengths: text('strengths'),
  improvements: text('improvements'),
  summary: text('summary'),
  skillRatings: jsonb('skill_ratings'), // {technical: 'good', communication: 'excellent'}
  geminiInsights: jsonb('gemini_insights'), // Complete AI analysis
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  resumeAnalyses: many(resumeAnalysis),
  interviews: many(interviews),
}));

export const resumeAnalysisRelations = relations(resumeAnalysis, ({ one, many }) => ({
  user: one(users, {
    fields: [resumeAnalysis.userId],
    references: [users.id],
  }),
  interviews: many(interviews),
}));

export const interviewRelations = relations(interviews, ({ one }) => ({
  user: one(users, {
    fields: [interviews.userId],
    references: [users.id],
  }),
  resumeAnalysis: one(resumeAnalysis, {
    fields: [interviews.resumeAnalysisId],
    references: [resumeAnalysis.id],
  }),
  feedback: one(interviewFeedback),
}));

export const interviewFeedbackRelations = relations(interviewFeedback, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewFeedback.interviewId],
    references: [interviews.id],
  }),
}));
