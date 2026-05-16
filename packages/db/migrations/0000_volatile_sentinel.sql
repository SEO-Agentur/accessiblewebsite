CREATE TYPE "public"."email_sequence_status" AS ENUM('active', 'completed', 'unsubscribed', 'converted');--> statement-breakpoint
CREATE TYPE "public"."email_sequence_type" AS ENUM('failed_scan_nurture', 'trial_expiring', 'scan_failure_alert', 'post_remediation');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('critical', 'serious', 'moderate', 'minor');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'de');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('new', 'contacted', 'quoted', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."remediation_package" AS ENUM('starter', 'business', 'enterprise', 'guide_only');--> statement-breakpoint
CREATE TYPE "public"."remediation_status" AS ENUM('quote_requested', 'quoted', 'accepted', 'in_progress', 'review', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_trigger" AS ENUM('user', 'cron', 'post_remediation', 'anonymous');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('homepage', 'full_site');--> statement-breakpoint
CREATE TYPE "public"."seal_tier" AS ENUM('none', 'silver', 'gold');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'specialist', 'support');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'trialing');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'gold', 'gold_pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('standard', 'rush');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(320) NOT NULL,
	"sequence_type" "email_sequence_type" NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_send_at" timestamp with time zone,
	"status" "email_sequence_status" DEFAULT 'active' NOT NULL,
	"language" "language" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitored_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" varchar(253) NOT NULL,
	"verification_token" varchar(128) NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"seal_tier" "seal_tier" DEFAULT 'none' NOT NULL,
	"silver_seal_expires_at" timestamp with time zone,
	"last_scan_at" timestamp with time zone,
	"next_scan_at" timestamp with time zone,
	"current_score" integer,
	"pages_discovered" integer,
	"is_public_in_directory" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(200),
	"company_name" varchar(200),
	"scanned_domain" varchar(253) NOT NULL,
	"scan_id" uuid,
	"platform_cms" varchar(64),
	"estimated_pages" varchar(32),
	"urgency" "urgency" DEFAULT 'standard' NOT NULL,
	"message" text,
	"language" "language" NOT NULL,
	"status" "quote_status" DEFAULT 'new' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remediation_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"monitored_site_id" uuid,
	"package" "remediation_package" NOT NULL,
	"status" "remediation_status" DEFAULT 'quote_requested' NOT NULL,
	"assigned_specialist_id" uuid,
	"quote_amount_eur" integer,
	"quote_sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"estimated_completion_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"stripe_invoice_id" varchar(64),
	"notes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scan_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"page_url" text NOT NULL,
	"wcag_criterion" varchar(16) NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"element_selector" text,
	"description" text NOT NULL,
	"remediation_hint" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitored_site_id" uuid,
	"scan_type" "scan_type" DEFAULT 'homepage' NOT NULL,
	"triggered_by" "scan_trigger" NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"score" integer,
	"total_issues" integer,
	"critical_issues" integer,
	"serious_issues" integer,
	"moderate_issues" integer,
	"minor_issues" integer,
	"raw_results" jsonb,
	"report_pdf_url" text,
	"anonymous_email" varchar(320),
	"target_url" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"role" "staff_role" NOT NULL,
	"certifications" text[],
	"profile_visible_in_team_page" boolean DEFAULT false NOT NULL,
	"linkedin_url" text,
	"photo_url" text,
	"bio_en" text,
	"bio_de" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(64),
	"stripe_subscription_id" varchar(64),
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"full_name" varchar(200),
	"company_name" varchar(200),
	"preferred_language" "language" DEFAULT 'en' NOT NULL,
	"country_code" varchar(2),
	"oauth_provider" varchar(32),
	"oauth_id" varchar(128),
	"email_verified_at" timestamp with time zone,
	"marketing_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitored_sites" ADD CONSTRAINT "monitored_sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remediation_projects" ADD CONSTRAINT "remediation_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remediation_projects" ADD CONSTRAINT "remediation_projects_monitored_site_id_monitored_sites_id_fk" FOREIGN KEY ("monitored_site_id") REFERENCES "public"."monitored_sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remediation_projects" ADD CONSTRAINT "remediation_projects_assigned_specialist_id_staff_id_fk" FOREIGN KEY ("assigned_specialist_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scan_issues" ADD CONSTRAINT "scan_issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scans" ADD CONSTRAINT "scans_monitored_site_id_monitored_sites_id_fk" FOREIGN KEY ("monitored_site_id") REFERENCES "public"."monitored_sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sequences_email_type_idx" ON "email_sequences" USING btree ("email","sequence_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sequences_next_send_idx" ON "email_sequences" USING btree ("next_send_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monitored_sites_user_domain_unique" ON "monitored_sites" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monitored_sites_domain_idx" ON "monitored_sites" USING btree ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monitored_sites_directory_idx" ON "monitored_sites" USING btree ("is_public_in_directory","seal_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_requests_status_idx" ON "quote_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_requests_email_idx" ON "quote_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remediation_projects_user_idx" ON "remediation_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remediation_projects_status_idx" ON "remediation_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_issues_scan_idx" ON "scan_issues" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_issues_severity_idx" ON "scan_issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_site_idx" ON "scans" USING btree ("monitored_site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_status_idx" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_anon_email_idx" ON "scans" USING btree ("anonymous_email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_email_unique" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_sub_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_oauth_idx" ON "users" USING btree ("oauth_provider","oauth_id");