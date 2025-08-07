CREATE TYPE "public"."interview_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."rating" AS ENUM('excellent', 'good', 'average', 'needs_improvement');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('technical', 'behavioral', 'communication');--> statement-breakpoint
CREATE TABLE "interview_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"interview_id" integer NOT NULL,
	"overall_rating" "rating" NOT NULL,
	"strengths" text,
	"improvements" text,
	"summary" text,
	"skill_ratings" jsonb,
	"gemini_insights" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resume_analysis_id" integer,
	"job_role" text NOT NULL,
	"status" "interview_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"gemini_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resume_text" text NOT NULL,
	"job_role" text NOT NULL,
	"skills" jsonb,
	"experience" jsonb,
	"gemini_analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_resume_analysis_id_resume_analysis_id_fk" FOREIGN KEY ("resume_analysis_id") REFERENCES "public"."resume_analysis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;