import type { Page } from 'playwright';
import axeSource from 'axe-core';
import type { ScanViolation, WcagSeverity } from '@accessiblewebsite/shared';

// axe-core ships a self-contained string of its source we can inject into any
// page context. We avoid `eval` by using page.addScriptTag with the source.
const AXE_SOURCE = (axeSource as unknown as { source: string }).source;

interface AxeNode {
  target: string[];
  failureSummary?: string;
}

export interface AxeResult {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  tags: string[];
  nodes: AxeNode[];
}

export interface AxeRunResult {
  violations: AxeResult[];
  passes: AxeResult[];
  incomplete: AxeResult[];
  inapplicable: AxeResult[];
}

export const AXE_SOURCE_STRING = AXE_SOURCE;

// Tag set we ask axe to run. This is the full audit:
//   wcag2a / wcag2aa            — WCAG 2.0 Level A + AA
//   wcag21a / wcag21aa          — WCAG 2.1 Level A + AA (delta vs 2.0)
//   wcag22a / wcag22aa          — WCAG 2.2 Level A + AA (delta vs 2.1)
//   best-practice               — additional axe-curated checks (landmarks,
//                                 heading order, list semantics, etc.)
//                                 Competitors (WAVE, AccessibilityChecker)
//                                 include these — leaving them off was why
//                                 our scanner found 1 issue where they found 76+.
//   EN-301-549                  — European harmonised standard
//   section508                  — US federal procurement
//   ACT                         — W3C Accessibility Conformance Testing
export const AXE_RUN_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
  'best-practice',
  'EN-301-549',
  'section508',
  'ACT',
] as const;

/**
 * The bits of an axe-core rule result we want to surface to humans:
 * the rule's stable id, its plain-English help text, and the most
 * specific WCAG SC reference we can tease out of its tags.
 */
export interface RuleMeta {
  id: string;
  help: string;
  helpUrl?: string;
  wcagCriterion: string;
  tags: string[];
}

export interface AuditResult {
  violations: ScanViolation[];
  passes: RuleMeta[];
  incomplete: RuleMeta[];
  inapplicable: RuleMeta[];
}

function toRuleMeta(r: AxeResult): RuleMeta {
  return {
    id: r.id,
    help: r.help,
    helpUrl: r.helpUrl,
    wcagCriterion: wcagCriterionFromTags(r.tags),
    tags: r.tags,
  };
}

export function wcagCriterionFromTags(tags: string[]): string {
  // axe tags look like "wcag2aa", "wcag111", "wcag2.4.7" depending on version.
  // Prefer the most specific SC reference.
  const sc = tags.find((t) => /^wcag\d{3,4}$/.test(t));
  if (sc) {
    const digits = sc.slice(4);
    if (digits.length === 3) {
      return `${digits[0]}.${digits[1]}.${digits[2]}`;
    }
    if (digits.length === 4) {
      return `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
    }
  }
  return tags[0] ?? 'unknown';
}

export function severityFromImpact(impact: AxeResult['impact']): WcagSeverity {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'serious':
      return 'serious';
    case 'moderate':
      return 'moderate';
    case 'minor':
    case null:
    default:
      return 'minor';
  }
}

export async function auditPage(page: Page, pageUrl: string): Promise<AuditResult> {
  await page.addScriptTag({ content: AXE_SOURCE });

  const result = (await page.evaluate(
    async (tags: readonly string[]) => {
      // axe is now on window
      // @ts-expect-error injected at runtime
      return await window.axe.run(document, {
        runOnly: { type: 'tag', values: [...tags] },
        // Ask for everything so the UI can show pass / incomplete /
        // inapplicable counts (AC-style breakdown).
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
      });
    },
    AXE_RUN_TAGS,
  )) as AxeRunResult;

  return toAuditResult(result, pageUrl);
}

// Shared shape transformer — used by both auditPage (Playwright) and
// auditStaticHtml (JSDOM failover).
export function toAuditResult(result: AxeRunResult, pageUrl: string): AuditResult {
  const violations: ScanViolation[] = [];
  for (const v of result.violations) {
    const wcagCriterion = wcagCriterionFromTags(v.tags);
    const severity = severityFromImpact(v.impact);
    for (const node of v.nodes) {
      violations.push({
        pageUrl,
        wcagCriterion,
        severity,
        elementSelector: node.target.join(' '),
        description: v.help,
        remediationHint: node.failureSummary ?? v.helpUrl,
      });
    }
  }
  return {
    violations,
    passes: result.passes.map(toRuleMeta),
    incomplete: result.incomplete.map(toRuleMeta),
    inapplicable: result.inapplicable.map(toRuleMeta),
  };
}

// Crude score: start at 100, subtract weighted issues. Tuned to match the
// brief's seal thresholds (>=80 passes Silver). Tweak after real-world data.
export function computeScore(violations: ScanViolation[]): number {
  const weights: Record<WcagSeverity, number> = {
    critical: 12,
    serious: 6,
    moderate: 3,
    minor: 1,
  };
  let penalty = 0;
  for (const v of violations) penalty += weights[v.severity];
  return Math.max(0, 100 - penalty);
}
