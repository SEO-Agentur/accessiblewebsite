import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { chromium, type Browser } from 'playwright';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { ScanJobPayload, QUEUE_NAMES, type ScanViolation } from '@accessiblewebsite/shared';
import { getDb, scans, scanIssues } from '@accessiblewebsite/db';
import { env } from './env.js';
import { auditPage, computeScore } from './audit.js';
import { discoverUrls } from './crawler.js';

const config = env();
const db = getDb(config.DATABASE_URL);

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// =============================================================================
// Browser pool
// =============================================================================

let browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (browser !== null && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

// =============================================================================
// Generic timeout wrapper. Promise.race + a self-clearing timer so a slow
// op can't leak a setTimeout handle even after it eventually settles.
// =============================================================================

class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// =============================================================================
// Per-job processing
// =============================================================================

async function processScan(job: Job): Promise<void> {
  const payload = ScanJobPayload.parse(job.data);
  return withTimeout(
    runScan(payload),
    config.SCANNER_JOB_TIMEOUT_MS,
    `scan ${payload.scanId}`,
  );
}

async function runScan(payload: typeof ScanJobPayload._type): Promise<void> {
  const { scanId, targetUrl, scanType, maxPages, triggeredBy } = payload;

  console.log(`[scan ${scanId}] start ${targetUrl} type=${scanType} max=${maxPages}`);
  await db
    .update(scans)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(scans.id, scanId));

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; AccessibleWebsiteScanner/0.1; +https://accessiblewebsite.net/methodology)',
    viewport: { width: 1366, height: 900 },
    bypassCSP: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.SCANNER_GOTO_TIMEOUT_MS);

  // Track which URLs we *attempted* and which actually loaded — a homepage
  // scan that fails to load the only URL must NOT complete with a perfect
  // score against an empty violation set.
  let pagesAttempted = 0;
  let pagesLoaded = 0;
  const failedPages: Array<{ url: string; reason: string }> = [];

  try {
    const urls =
      scanType === 'homepage'
        ? [targetUrl]
        : await discoverUrls(page, { startUrl: targetUrl, maxPages });

    const allViolations: ScanViolation[] = [];

    for (const url of urls) {
      pagesAttempted++;
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: config.SCANNER_GOTO_TIMEOUT_MS,
        });
        const pageViolations = await withTimeout(
          auditPage(page, url),
          config.SCANNER_AUDIT_TIMEOUT_MS,
          `audit ${url}`,
        );
        allViolations.push(...pageViolations);
        pagesLoaded++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[scan ${scanId}] page failed ${url}: ${reason}`);
        failedPages.push({ url, reason });
      }
    }

    // Homepage scan where the only URL didn't load is a failed scan, not a
    // free 100/100.
    if (pagesLoaded === 0) {
      await db
        .update(scans)
        .set({
          status: 'failed',
          completedAt: new Date(),
          rawResults: sql`${JSON.stringify({
            pagesAttempted,
            pagesLoaded: 0,
            failedPages,
          })}::jsonb`,
        })
        .where(eq(scans.id, scanId));
      console.warn(
        `[scan ${scanId}] no pages loaded (${pagesAttempted} attempted) — marked failed`,
      );
      return;
    }

    const score = computeScore(allViolations);
    const bySeverity = {
      critical: allViolations.filter((v) => v.severity === 'critical').length,
      serious: allViolations.filter((v) => v.severity === 'serious').length,
      moderate: allViolations.filter((v) => v.severity === 'moderate').length,
      minor: allViolations.filter((v) => v.severity === 'minor').length,
    };

    await db.transaction(async (tx) => {
      await tx
        .update(scans)
        .set({
          status: 'completed',
          completedAt: new Date(),
          score,
          totalIssues: allViolations.length,
          criticalIssues: bySeverity.critical,
          seriousIssues: bySeverity.serious,
          moderateIssues: bySeverity.moderate,
          minorIssues: bySeverity.minor,
          rawResults: sql`${JSON.stringify({
            pagesAttempted,
            pagesLoaded,
            failedPages,
          })}::jsonb`,
        })
        .where(eq(scans.id, scanId));

      if (allViolations.length > 0) {
        await tx.insert(scanIssues).values(
          allViolations.map((v) => ({
            scanId,
            pageUrl: v.pageUrl,
            wcagCriterion: v.wcagCriterion,
            severity: v.severity,
            elementSelector: v.elementSelector ?? null,
            description: v.description,
            remediationHint: v.remediationHint ?? null,
          })),
        );
      }
    });

    console.log(
      `[scan ${scanId}] done score=${score} issues=${allViolations.length} pages=${pagesLoaded}/${pagesAttempted} trigger=${triggeredBy}`,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[scan ${scanId}] fatal: ${reason}`);
    await db
      .update(scans)
      .set({
        status: 'failed',
        completedAt: new Date(),
        rawResults: sql`${JSON.stringify({ error: reason, pagesAttempted, pagesLoaded })}::jsonb`,
      })
      .where(eq(scans.id, scanId));
    throw err;
  } finally {
    try {
      await context.close();
    } catch {
      // context may already be gone if browser crashed
    }
  }
}

// =============================================================================
// Watchdog: sweep scans that have been queued/running too long without a
// terminal status. Belt-and-braces in case a worker died mid-flight without
// catching the exception path (e.g. SIGKILL).
// =============================================================================

async function watchdog(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - config.SCANNER_STALLED_AFTER_MS);
    const stuck = await db
      .update(scans)
      .set({
        status: 'failed',
        completedAt: new Date(),
        rawResults: sql`${JSON.stringify({ error: 'stalled_by_watchdog' })}::jsonb`,
      })
      .where(
        and(
          inArray(scans.status, ['queued', 'running']),
          lt(scans.createdAt, cutoff),
        ),
      )
      .returning({ id: scans.id });

    if (stuck.length > 0) {
      console.warn(
        `[watchdog] marked ${stuck.length} stalled scan(s) as failed`,
        stuck.map((s) => s.id),
      );
    }
  } catch (err) {
    console.error('[watchdog] error:', err);
  }
}

// =============================================================================
// Worker
// =============================================================================

const worker = new Worker(QUEUE_NAMES.scan, processScan, {
  connection,
  concurrency: config.SCANNER_CONCURRENCY,
  // Shorter lock so BullMQ can recover stalled jobs faster. Worker
  // auto-extends every lockDuration/2 while a job is healthy.
  lockDuration: 120_000,
  stalledInterval: 30_000,
  maxStalledCount: 1,
});

worker.on('completed', (job) => {
  console.log(`job ${job.id} completed`);
});
worker.on('failed', (job, err) => {
  console.error(`job ${job?.id} failed: ${err.message}`);
});
worker.on('stalled', (jobId) => {
  console.warn(`job ${jobId} stalled — will be redelivered`);
});

console.log(
  `Scanner started — queue=${QUEUE_NAMES.scan} concurrency=${config.SCANNER_CONCURRENCY} ` +
    `goto=${config.SCANNER_GOTO_TIMEOUT_MS}ms audit=${config.SCANNER_AUDIT_TIMEOUT_MS}ms job=${config.SCANNER_JOB_TIMEOUT_MS}ms`,
);

const watchdogTimer = setInterval(() => {
  void watchdog();
}, config.SCANNER_WATCHDOG_INTERVAL_MS);
// Run once at boot to clean up anything left over from a previous crash.
void watchdog();

async function shutdown(): Promise<void> {
  console.log('shutting down…');
  clearInterval(watchdogTimer);
  await worker.close();
  if (browser) await browser.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
