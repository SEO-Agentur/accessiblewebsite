import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { chromium, type Browser } from 'playwright';
import { eq, sql } from 'drizzle-orm';
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

// Reuse a single browser across jobs to avoid the ~400 MB startup cost on
// every scan. Pages and contexts are disposed per job.
let browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (browser !== null && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

async function processScan(job: Job): Promise<void> {
  const payload = ScanJobPayload.parse(job.data);
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
  page.setDefaultTimeout(config.SCANNER_PAGE_TIMEOUT_MS);

  try {
    const urls =
      scanType === 'homepage'
        ? [targetUrl]
        : await discoverUrls(page, { startUrl: targetUrl, maxPages });

    const allViolations: ScanViolation[] = [];
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const pageViolations = await auditPage(page, url);
        allViolations.push(...pageViolations);
      } catch (err) {
        console.warn(`[scan ${scanId}] page failed ${url}:`, err);
      }
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
          rawResults: sql`${JSON.stringify({ pagesScanned: urls.length })}::jsonb`,
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
      `[scan ${scanId}] done score=${score} issues=${allViolations.length} trigger=${triggeredBy}`,
    );
  } catch (err) {
    console.error(`[scan ${scanId}] fatal`, err);
    await db
      .update(scans)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(scans.id, scanId));
    throw err;
  } finally {
    await context.close();
  }
}

const worker = new Worker(QUEUE_NAMES.scan, processScan, {
  connection,
  concurrency: config.SCANNER_CONCURRENCY,
  lockDuration: 5 * 60 * 1000,
});

worker.on('completed', (job) => {
  console.log(`job ${job.id} completed`);
});
worker.on('failed', (job, err) => {
  console.error(`job ${job?.id} failed:`, err);
});

console.log(
  `Scanner started — queue=${QUEUE_NAMES.scan} concurrency=${config.SCANNER_CONCURRENCY}`,
);

async function shutdown(): Promise<void> {
  console.log('shutting down…');
  await worker.close();
  if (browser) await browser.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
