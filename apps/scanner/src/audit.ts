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

export async function auditPage(
  page: Page,
  pageUrl: string,
): Promise<ScanViolation[]> {
  await page.addScriptTag({ content: AXE_SOURCE });

  const result = (await page.evaluate(async () => {
    // axe is now on window
    // @ts-expect-error injected at runtime
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
  })) as AxeRunResult;

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

  return violations;
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
