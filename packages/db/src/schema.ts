import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// Enums
// =============================================================================

export const languageEnum = pgEnum('language', ['en', 'de']);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free',
  'gold',
  'gold_pro',
  'enterprise',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',
  'verified',
  'failed',
]);

export const sealTierEnum = pgEnum('seal_tier', ['none', 'silver', 'gold']);

export const scanTypeEnum = pgEnum('scan_type', ['homepage', 'full_site']);

export const scanTriggerEnum = pgEnum('scan_trigger', [
  'user',
  'cron',
  'post_remediation',
  'anonymous',
]);

export const scanStatusEnum = pgEnum('scan_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

export const issueSeverityEnum = pgEnum('issue_severity', [
  'critical',
  'serious',
  'moderate',
  'minor',
]);

export const remediationPackageEnum = pgEnum('remediation_package', [
  'starter',
  'business',
  'enterprise',
  'guide_only',
]);

export const remediationStatusEnum = pgEnum('remediation_status', [
  'quote_requested',
  'quoted',
  'accepted',
  'in_progress',
  'review',
  'completed',
  'canceled',
]);

export const urgencyEnum = pgEnum('urgency', ['standard', 'rush']);

export const quoteStatusEnum = pgEnum('quote_status', [
  'new',
  'contacted',
  'quoted',
  'converted',
  'lost',
]);

export const emailSequenceTypeEnum = pgEnum('email_sequence_type', [
  'failed_scan_nurture',
  'trial_expiring',
  'scan_failure_alert',
  'post_remediation',
]);

export const emailSequenceStatusEnum = pgEnum('email_sequence_status', [
  'active',
  'completed',
  'unsubscribed',
  'converted',
]);

export const staffRoleEnum = pgEnum('staff_role', [
  'admin',
  'specialist',
  'support',
]);

// =============================================================================
// users
// =============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash'),
    fullName: varchar('full_name', { length: 200 }),
    companyName: varchar('company_name', { length: 200 }),
    preferredLanguage: languageEnum('preferred_language').notNull().default('en'),
    countryCode: varchar('country_code', { length: 2 }),
    oauthProvider: varchar('oauth_provider', { length: 32 }),
    oauthId: varchar('oauth_id', { length: 128 }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
    oauthIdx: index('users_oauth_idx').on(t.oauthProvider, t.oauthId),
  }),
);

// =============================================================================
// sessions (Lucia)
// =============================================================================

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// =============================================================================
// subscriptions
// =============================================================================

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 64 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 64 }),
    tier: subscriptionTierEnum('tier').notNull().default('free'),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdx: index('subscriptions_user_idx').on(t.userId),
    stripeSubIdx: index('subscriptions_stripe_sub_idx').on(t.stripeSubscriptionId),
  }),
);

// =============================================================================
// monitored_sites
// =============================================================================

export const monitoredSites = pgTable(
  'monitored_sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 253 }).notNull(),
    verificationToken: varchar('verification_token', { length: 128 }).notNull(),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('pending'),
    sealTier: sealTierEnum('seal_tier').notNull().default('none'),
    silverSealExpiresAt: timestamp('silver_seal_expires_at', { withTimezone: true }),
    lastScanAt: timestamp('last_scan_at', { withTimezone: true }),
    nextScanAt: timestamp('next_scan_at', { withTimezone: true }),
    currentScore: integer('current_score'),
    pagesDiscovered: integer('pages_discovered'),
    isPublicInDirectory: boolean('is_public_in_directory')
      .notNull()
      .default(true),
    // Optional user-supplied sitemap URL. When set, the scanner uses it
    // verbatim for full-site scans instead of guessing /sitemap.xml.
    // Sitemap-index files (with <sitemapindex>) are followed one level.
    sitemapUrl: text('sitemap_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userDomainUnique: uniqueIndex('monitored_sites_user_domain_unique').on(
      t.userId,
      t.domain,
    ),
    domainIdx: index('monitored_sites_domain_idx').on(t.domain),
    directoryIdx: index('monitored_sites_directory_idx').on(
      t.isPublicInDirectory,
      t.sealTier,
    ),
  }),
);

// =============================================================================
// scans
// =============================================================================

export const scans = pgTable(
  'scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitoredSiteId: uuid('monitored_site_id').references(() => monitoredSites.id, {
      onDelete: 'cascade',
    }),
    scanType: scanTypeEnum('scan_type').notNull().default('homepage'),
    triggeredBy: scanTriggerEnum('triggered_by').notNull(),
    status: scanStatusEnum('status').notNull().default('queued'),
    score: integer('score'),
    totalIssues: integer('total_issues'),
    criticalIssues: integer('critical_issues'),
    seriousIssues: integer('serious_issues'),
    moderateIssues: integer('moderate_issues'),
    minorIssues: integer('minor_issues'),
    rawResults: jsonb('raw_results'),
    reportPdfUrl: text('report_pdf_url'),
    anonymousEmail: varchar('anonymous_email', { length: 320 }),
    targetUrl: text('target_url').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    siteIdx: index('scans_site_idx').on(t.monitoredSiteId),
    statusIdx: index('scans_status_idx').on(t.status),
    anonEmailIdx: index('scans_anon_email_idx').on(t.anonymousEmail),
  }),
);

// =============================================================================
// scan_issues
// =============================================================================

export const scanIssues = pgTable(
  'scan_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => scans.id, { onDelete: 'cascade' }),
    pageUrl: text('page_url').notNull(),
    wcagCriterion: varchar('wcag_criterion', { length: 16 }).notNull(),
    severity: issueSeverityEnum('severity').notNull(),
    elementSelector: text('element_selector'),
    description: text('description').notNull(),
    remediationHint: text('remediation_hint'),
  },
  (t) => ({
    scanIdx: index('scan_issues_scan_idx').on(t.scanId),
    severityIdx: index('scan_issues_severity_idx').on(t.severity),
  }),
);

// =============================================================================
// remediation_projects
// =============================================================================

export const remediationProjects = pgTable(
  'remediation_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    monitoredSiteId: uuid('monitored_site_id').references(
      () => monitoredSites.id,
      { onDelete: 'set null' },
    ),
    package: remediationPackageEnum('package').notNull(),
    status: remediationStatusEnum('status').notNull().default('quote_requested'),
    assignedSpecialistId: uuid('assigned_specialist_id').references(() => staff.id),
    quoteAmountEur: integer('quote_amount_eur'),
    quoteSentAt: timestamp('quote_sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    estimatedCompletionDate: timestamp('estimated_completion_date', {
      withTimezone: true,
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 64 }),
    notes: jsonb('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdx: index('remediation_projects_user_idx').on(t.userId),
    statusIdx: index('remediation_projects_status_idx').on(t.status),
  }),
);

// =============================================================================
// quote_requests
// =============================================================================

export const quoteRequests = pgTable(
  'quote_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 320 }).notNull(),
    fullName: varchar('full_name', { length: 200 }),
    companyName: varchar('company_name', { length: 200 }),
    scannedDomain: varchar('scanned_domain', { length: 253 }).notNull(),
    scanId: uuid('scan_id').references(() => scans.id, { onDelete: 'set null' }),
    platformCms: varchar('platform_cms', { length: 64 }),
    estimatedPages: varchar('estimated_pages', { length: 32 }),
    urgency: urgencyEnum('urgency').notNull().default('standard'),
    message: text('message'),
    language: languageEnum('language').notNull(),
    status: quoteStatusEnum('status').notNull().default('new'),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    statusIdx: index('quote_requests_status_idx').on(t.status),
    emailIdx: index('quote_requests_email_idx').on(t.email),
  }),
);

// =============================================================================
// email_sequences
// =============================================================================

export const emailSequences = pgTable(
  'email_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 320 }).notNull(),
    sequenceType: emailSequenceTypeEnum('sequence_type').notNull(),
    currentStep: integer('current_step').notNull().default(0),
    nextSendAt: timestamp('next_send_at', { withTimezone: true }),
    status: emailSequenceStatusEnum('status').notNull().default('active'),
    language: languageEnum('language').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    emailTypeIdx: index('email_sequences_email_type_idx').on(t.email, t.sequenceType),
    nextSendIdx: index('email_sequences_next_send_idx').on(t.nextSendAt, t.status),
  }),
);

// =============================================================================
// staff
// =============================================================================

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    role: staffRoleEnum('role').notNull(),
    certifications: text('certifications').array(),
    profileVisibleInTeamPage: boolean('profile_visible_in_team_page')
      .notNull()
      .default(false),
    linkedinUrl: text('linkedin_url'),
    photoUrl: text('photo_url'),
    bioEn: text('bio_en'),
    bioDe: text('bio_de'),
  },
  (t) => ({
    emailIdx: uniqueIndex('staff_email_unique').on(t.email),
  }),
);

// =============================================================================
// Inferred types
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MonitoredSite = typeof monitoredSites.$inferSelect;
export type NewMonitoredSite = typeof monitoredSites.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type ScanIssue = typeof scanIssues.$inferSelect;
export type NewScanIssue = typeof scanIssues.$inferInsert;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type NewQuoteRequest = typeof quoteRequests.$inferInsert;
export type RemediationProject = typeof remediationProjects.$inferSelect;
export type NewRemediationProject = typeof remediationProjects.$inferInsert;
export type EmailSequence = typeof emailSequences.$inferSelect;
export type NewEmailSequence = typeof emailSequences.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
export type Session = typeof sessions.$inferSelect;
