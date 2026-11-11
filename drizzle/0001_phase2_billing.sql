CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"clerk_id" varchar(128),
	"event" varchar(64) NOT NULL,
	"plan_config_version" varchar(64) NOT NULL,
	"limits" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(128) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(128) NOT NULL,
	"stripe_subscription_id" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"interval" varchar(16),
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"price_lookup_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_answers" ADD COLUMN "response_ms" integer;--> statement-breakpoint
ALTER TABLE "session_answers" ADD COLUMN "kind" varchar(32) DEFAULT 'question' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_zone" varchar(64) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_zone_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversion_events_event_idx" ON "conversion_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "conversion_events_clerk_idx" ON "conversion_events" USING btree ("clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversion_events_dedupe_idx" ON "conversion_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_idx" ON "users" USING btree ("stripe_customer_id");