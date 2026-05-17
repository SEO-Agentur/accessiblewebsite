import { JSDOM, VirtualConsole } from 'jsdom';
import type { ScanViolation } from '@accessiblewebsite/shared';
import {
  AXE_SOURCE_STRING,
  severityFromImpact,
  wcagCriterionFromTags,
  type AxeRunResult,
} from './audit.js';

// axe-core rules that require a real browser layout pass — computed styles,
// scrolling, focus visibility, paint timing, real touch-target geometry.
// JSDOM can't faithfully evaluate any of these. We disable them explicitly
// so axe doesn't report misleading results.
const BROWSER_ONLY_RULES = [
  'color-contrast',
  'color-contrast-enhanced',
  'focus-order-semantics',
  'target-size',
  'avoid-inline-spacing',
  'css-orientation-lock',
  'meta-viewport-large',
  'scrollable-region-focusable',
  'autocomplete-valid',
];

/**
 * Run axe-core against a Firecrawl-returned HTML string inside JSDOM.
 * Semantic rules only (alt text, label associations, heading hierarchy,
 * ARIA validity, etc.). Color contrast and other layout-dependent rules
 * are disabled — the caller MUST surface this as a partial scan in the UI.
 */
export async function auditStaticHtml(
  html: string,
  pageUrl: string,
): Promise<ScanViolation[]> {
  // Silence JSDOM's noisy CSS parse errors and JS errors from external scripts —
  // we don't care, we only walk the DOM.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});
  virtualConsole.on('error', () => {});

  const dom = new JSDOM(html, {
    url: pageUrl,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });

  try {
    const win = dom.window as unknown as {
      eval: (s: string) => unknown;
      document: Document;
      axe?: {
        run: (
          context: Document,
          options: Record<string, unknown>,
        ) => Promise<AxeRunResult>;
      };
    };

    // axe-core publishes a self-contained UMD bundle as `axe.source` — eval
    // it inside the JSDOM window so the window.axe global is installed.
    win.eval(AXE_SOURCE_STRING);

    if (typeof win.axe?.run !== 'function') {
      throw new Error('axe-core failed to initialise inside JSDOM');
    }

    const rulesConfig: Record<string, { enabled: boolean }> = {};
    for (const r of BROWSER_ONLY_RULES) rulesConfig[r] = { enabled: false };

    const result = await win.axe.run(win.document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
      resultTypes: ['violations'],
      rules: rulesConfig,
    });

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
  } finally {
    dom.window.close();
  }
}
