import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { scanIssues, scans, type Scan, type ScanIssue } from '@accessiblewebsite/db';
import { MANUAL_PROCEDURES } from '@accessiblewebsite/shared';
import { db } from '../../lib/db';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RuleSummary = { id: string; help: string; wcagCriterion: string };
type RawResults = {
  scanMode?: string;
  pagesAttempted?: number;
  pagesLoaded?: number;
  passes?: RuleSummary[];
  incomplete?: RuleSummary[];
  inapplicable?: RuleSummary[];
};

const SEV_ORDER = ['critical', 'serious', 'moderate', 'minor'] as const;

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function line(char = '='): string {
  return char.repeat(72);
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// axe-core tags look like "wcag222", "wcag2aa", "cat.keyboard",
// "best-practice", "EN-301-549". The scanner stored the first match it
// could parse: a proper SC number for WCAG-tagged rules, or the bare
// category tag for best-practice rules. Render that fallback as something
// the customer can act on rather than the literal "cat.keyboard".
function wcagLabel(stored: string, locale: 'en' | 'de'): string {
  const isDE = locale === 'de';
  if (/^\d+\.\d+\.\d+$/.test(stored)) return `WCAG ${stored}`;
  if (stored.startsWith('cat.')) {
    const cat = stored.slice(4).replace(/-/g, ' ');
    return isDE ? `Best Practice (${cat})` : `Best practice (${cat})`;
  }
  if (stored === 'best-practice') {
    return isDE ? 'Best Practice' : 'Best practice';
  }
  return stored;
}

function renderReport(
  scan: Scan,
  issues: ScanIssue[],
  raw: RawResults | null,
  locale: 'en' | 'de',
): string {
  const isDE = locale === 'de';
  const out: string[] = [];

  const targetHost = host(scan.targetUrl);

  out.push(line('='));
  out.push(isDE ? '  BARRIEREFREIHEITS-PRÜFUNGSBERICHT' : '  ACCESSIBILITY SCAN REPORT');
  out.push(line('='));
  out.push('');
  out.push(`${isDE ? 'Webseite' : 'Website'}:        ${targetHost}`);
  out.push(`${isDE ? 'URL' : 'URL'}:             ${scan.targetUrl}`);
  out.push(
    `${isDE ? 'Geprüft am' : 'Scanned at'}:      ${
      scan.completedAt
        ? scan.completedAt.toLocaleString(isDE ? 'de-DE' : 'en-GB')
        : '—'
    }`,
  );
  out.push(`${isDE ? 'Scan-ID' : 'Scan ID'}:         ${scan.id}`);
  out.push(`${isDE ? 'Modus' : 'Mode'}:           ${raw?.scanMode ?? 'full'}`);
  if (raw?.scanMode === 'partial_firecrawl') {
    out.push('');
    out.push(
      isDE
        ? '!!! HINWEIS: Teil-Scan über Failover. Farbkontrast, Fokus-Sichtbarkeit'
        : '!!! NOTE: Partial scan via failover. Color contrast, focus visibility,',
    );
    out.push(
      isDE
        ? '    und Berührungsziel-Größe konnten NICHT geprüft werden. Score auf 80 begrenzt.'
        : '    and touch target size could NOT be checked. Score capped at 80.',
    );
  }
  out.push('');
  out.push(line('-'));
  out.push(isDE ? '  GESAMTBEWERTUNG' : '  SCORE');
  out.push(line('-'));
  const score = scan.score ?? 0;
  const seal =
    score >= 95
      ? isDE
        ? 'Gold-Siegel-würdig (≥ 95)'
        : 'Gold Seal-eligible (≥ 95)'
      : score >= 80
        ? isDE
          ? 'Silber-Siegel-würdig (≥ 80)'
          : 'Silver Seal-eligible (≥ 80)'
        : isDE
          ? 'Unter dem Silber-Schwellwert (80). Empfehlung: Umsetzung.'
          : 'Below the Silver threshold (80). Remediation recommended.';
  out.push(`  ${score} / 100`);
  out.push(`  ${seal}`);
  out.push('');

  out.push(line('-'));
  out.push(isDE ? '  PROBLEME NACH SCHWEREGRAD' : '  ISSUES BY SEVERITY');
  out.push(line('-'));
  out.push(`  ${pad(isDE ? 'Kritisch:' : 'Critical:', 14)}${scan.criticalIssues ?? 0}`);
  out.push(`  ${pad(isDE ? 'Schwerwiegend:' : 'Serious:', 14)}${scan.seriousIssues ?? 0}`);
  out.push(`  ${pad(isDE ? 'Mittel:' : 'Moderate:', 14)}${scan.moderateIssues ?? 0}`);
  out.push(`  ${pad(isDE ? 'Gering:' : 'Minor:', 14)}${scan.minorIssues ?? 0}`);
  out.push(`  ${pad(isDE ? 'Summe:' : 'Total:', 14)}${scan.totalIssues ?? 0}`);
  out.push('');

  out.push(line('-'));
  out.push(isDE ? '  WCAG-REGELN ÜBERSICHT' : '  WCAG RULE OVERVIEW');
  out.push(line('-'));
  out.push(
    `  ${pad(isDE ? 'Bestanden:' : 'Passed:', 24)}${raw?.passes?.length ?? 0}`,
  );
  out.push(
    `  ${pad(
      isDE ? 'Manuelle Prüfung nötig:' : 'Manual review recommended:',
      24,
    )}${raw?.incomplete?.length ?? 0}`,
  );
  out.push(
    `  ${pad(isDE ? 'Nicht anwendbar:' : 'Not applicable:', 24)}${
      raw?.inapplicable?.length ?? 0
    }`,
  );
  out.push('');

  // ---------------------------------------------------------------------
  // Violations
  // ---------------------------------------------------------------------
  out.push(line('='));
  out.push(
    isDE
      ? `  GEFUNDENE PROBLEME (${scan.totalIssues ?? 0})`
      : `  ISSUES FOUND (${scan.totalIssues ?? 0})`,
  );
  out.push(line('='));
  out.push('');

  if (issues.length === 0) {
    out.push(
      isDE
        ? '  Keine automatisch erkennbaren Verstöße gefunden.'
        : '  No automatically detectable violations found.',
    );
    out.push('');
  } else {
    let issueIndex = 1;
    for (const sev of SEV_ORDER) {
      const group = issues.filter((i) => i.severity === sev);
      if (group.length === 0) continue;
      const sevLabel = isDE
        ? { critical: 'KRITISCH', serious: 'SCHWERWIEGEND', moderate: 'MITTEL', minor: 'GERING' }[sev]
        : { critical: 'CRITICAL', serious: 'SERIOUS', moderate: 'MODERATE', minor: 'MINOR' }[sev];
      out.push(`--- ${sevLabel} (${group.length}) ---`);
      out.push('');
      for (const iss of group) {
        out.push(`  [${issueIndex++}] ${wcagLabel(iss.wcagCriterion, locale)} — ${iss.description}`);
        out.push(`      ${isDE ? 'Seite' : 'Page'}:   ${iss.pageUrl}`);
        if (iss.elementSelector) {
          out.push(`      ${isDE ? 'Element' : 'Element'}: ${iss.elementSelector}`);
        }
        if (iss.remediationHint) {
          // Indent multi-line remediation hints
          const wrapped = iss.remediationHint
            .split('\n')
            .map((l) => `      ${l.trim()}`)
            .join('\n');
          out.push(wrapped);
        }
        out.push('');
      }
    }
  }

  // ---------------------------------------------------------------------
  // Passed audits
  // ---------------------------------------------------------------------
  const passes = raw?.passes ?? [];
  out.push(line('='));
  out.push(
    isDE
      ? `  BESTANDENE PRÜFUNGEN (${passes.length})`
      : `  PASSED AUDITS (${passes.length})`,
  );
  out.push(line('='));
  out.push('');
  if (passes.length === 0) {
    out.push(isDE ? '  (keine)' : '  (none)');
  } else {
    passes.forEach((p, i) => {
      out.push(`  ${pad(`${i + 1}.`, 5)}${p.help}`);
    });
  }
  out.push('');

  // ---------------------------------------------------------------------
  // Manual review recommended
  // ---------------------------------------------------------------------
  const incomplete = raw?.incomplete ?? [];
  out.push(line('='));
  out.push(
    isDE
      ? `  AUTOMATISCH UNEINDEUTIG — MANUELLE PRÜFUNG EMPFOHLEN (${incomplete.length})`
      : `  AUTOMATION INCONCLUSIVE — MANUAL REVIEW RECOMMENDED (${incomplete.length})`,
  );
  out.push(line('='));
  out.push('');
  if (incomplete.length === 0) {
    out.push(isDE ? '  (keine)' : '  (none)');
  } else {
    incomplete.forEach((r, i) => {
      out.push(`  ${pad(`${i + 1}.`, 5)}${r.help}`);
    });
  }
  out.push('');

  // ---------------------------------------------------------------------
  // Manual-only WCAG procedures (the fixed list)
  // ---------------------------------------------------------------------
  out.push(line('='));
  out.push(
    isDE
      ? `  PROZEDUREN, DIE AUTOMATION NICHT PRÜFEN KANN (${MANUAL_PROCEDURES.length})`
      : `  PROCEDURES AUTOMATION CANNOT VERIFY (${MANUAL_PROCEDURES.length})`,
  );
  out.push(line('='));
  out.push('');
  out.push(
    isDE
      ? '  Diese WCAG-Kriterien können nur durch einen Menschen geprüft werden.'
      : '  These WCAG criteria can only be verified by a human reviewer.',
  );
  out.push(
    isDE
      ? '  Wir paywallen die Liste nicht — wir verkaufen den Review selbst.'
      : '  We do not paywall the list — we sell the review itself.',
  );
  out.push('');
  MANUAL_PROCEDURES.forEach((p, i) => {
    const levels = p.levels.join('/');
    out.push(
      `  ${pad(`${i + 1}.`, 5)}[${levels}] WCAG ${p.wcagCriteria.join(', ')} — ${
        p.title[locale]
      }`,
    );
    const desc = p.description[locale];
    // Soft-wrap at ~66 chars
    const words = desc.split(/\s+/);
    let line2 = '      ';
    for (const w of words) {
      if (line2.length + w.length > 66) {
        out.push(line2.trimEnd());
        line2 = '      ';
      }
      line2 += w + ' ';
    }
    if (line2.trim()) out.push(line2.trimEnd());
    out.push('');
  });

  // ---------------------------------------------------------------------
  // Not applicable
  // ---------------------------------------------------------------------
  const inapplicable = raw?.inapplicable ?? [];
  out.push(line('='));
  out.push(
    isDE
      ? `  NICHT ANWENDBAR (${inapplicable.length})`
      : `  NOT APPLICABLE (${inapplicable.length})`,
  );
  out.push(line('='));
  out.push('');
  out.push(
    isDE
      ? '  Regeln, für die diese Seite keine passenden Elemente enthält.'
      : '  Rules with no matching elements on this page.',
  );
  out.push('');
  if (inapplicable.length === 0) {
    out.push(isDE ? '  (keine)' : '  (none)');
  } else {
    inapplicable.forEach((r, i) => {
      out.push(`  ${pad(`${i + 1}.`, 5)}${r.help}`);
    });
  }
  out.push('');

  out.push(line('='));
  out.push(
    isDE
      ? 'Erstellt von AccessibleWebsite — echte Barrierefreiheit, von Menschen zertifiziert.'
      : 'Generated by AccessibleWebsite — real accessibility, certified by humans.',
  );
  out.push(
    isDE
      ? 'Methodik: https://barrierefreiewebseite.net/methodik'
      : 'Methodology: https://accessiblewebsite.net/methodology',
  );
  out.push(line('='));

  return out.join('\n') + '\n';
}

export const GET: APIRoute = async ({ params, locals }) => {
  const id = params.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return new Response('Scan not found\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const rows = await db().select().from(scans).where(eq(scans.id, id)).limit(1);
  const scan = rows[0];
  if (!scan) {
    return new Response('Scan not found\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (scan.status !== 'completed') {
    return new Response(
      `Scan ${id} is still ${scan.status}. Try again once it completes.\n`,
      {
        status: 409,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    );
  }

  const issues = await db()
    .select()
    .from(scanIssues)
    .where(eq(scanIssues.scanId, id))
    .orderBy(asc(scanIssues.severity), asc(scanIssues.wcagCriterion));

  const raw = (scan.rawResults ?? null) as RawResults | null;
  const text = renderReport(scan, issues, raw, locals.locale);

  return new Response(text, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `inline; filename="scan-${id}.txt"`,
      'cache-control': 'private, max-age=300',
    },
  });
};
