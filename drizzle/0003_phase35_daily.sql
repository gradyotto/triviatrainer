CREATE TABLE "answer_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_id" varchar(64),
	"question_id" uuid,
	"question_key" varchar(80) NOT NULL,
	"response" text NOT NULL,
	"expected_answer" text NOT NULL,
	"context" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"response" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"base_points" integer DEFAULT 0 NOT NULL,
	"speed_points" integer DEFAULT 0 NOT NULL,
	"streak_points" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"multiplier_hundredths" integer DEFAULT 100 NOT NULL,
	"elapsed_ms" integer,
	"served_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bonus_response" text,
	"bonus_correct" boolean,
	"bonus_skipped" boolean DEFAULT false NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"bonus_resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid,
	"anonymous_id" varchar(64),
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"phase" varchar(16) DEFAULT 'question' NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"current_served_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_date" varchar(10) NOT NULL,
	"question_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "bonus_prompt" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "bonus_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "answers_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar(20);--> statement-breakpoint
ALTER TABLE "answer_disputes" ADD CONSTRAINT "answer_disputes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_disputes" ADD CONSTRAINT "answer_disputes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_attempt_id_daily_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."daily_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_attempts" ADD CONSTRAINT "daily_attempts_challenge_id_daily_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."daily_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_attempts" ADD CONSTRAINT "daily_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_disputes_question_idx" ON "answer_disputes" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "answer_disputes_created_idx" ON "answer_disputes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_answers_ordinal_idx" ON "daily_answers" USING btree ("attempt_id","ordinal");--> statement-breakpoint
CREATE INDEX "daily_answers_attempt_idx" ON "daily_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_attempts_user_idx" ON "daily_attempts" USING btree ("challenge_id","user_id") WHERE "daily_attempts"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_attempts_guest_idx" ON "daily_attempts" USING btree ("challenge_id","anonymous_id") WHERE "daily_attempts"."anonymous_id" is not null;--> statement-breakpoint
CREATE INDEX "daily_attempts_status_idx" ON "daily_attempts" USING btree ("status","challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_challenges_date_idx" ON "daily_challenges" USING btree ("game_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));