ALTER TABLE "questions" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "image_credit" text;--> statement-breakpoint
ALTER TABLE "answer_disputes" ADD COLUMN "status" varchar(16) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "answer_disputes" ADD COLUMN "resolution" varchar(16);--> statement-breakpoint
ALTER TABLE "answer_disputes" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "answer_disputes_status_idx" ON "answer_disputes" USING btree ("status");
