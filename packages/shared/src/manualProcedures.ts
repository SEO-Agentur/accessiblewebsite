/**
 * Fixed list of WCAG checks that no automated scanner can verify, because
 * they require human judgment about meaning, context, or interaction flow.
 * These are surfaced on every scan report as a transparent "things we
 * physically can't test for you, but a human reviewer can" list.
 *
 * Compiled from the WCAG 2.2 quick-reference + axe-core's documentation
 * on rules marked needs-review. We deliberately do NOT paywall these like
 * some competitors do — our business model is selling the human review,
 * not gating the list of things that need one.
 */

export interface ManualProcedure {
  id: string;
  title: { en: string; de: string };
  wcagCriteria: string[];
  levels: Array<'A' | 'AA' | 'AAA'>;
  description: { en: string; de: string };
}

export const MANUAL_PROCEDURES: readonly ManualProcedure[] = [
  {
    id: 'reading-order',
    title: {
      en: 'Reading order matches visual order',
      de: 'Leseabfolge entspricht der visuellen Reihenfolge',
    },
    wcagCriteria: ['1.3.2'],
    levels: ['A'],
    description: {
      en: 'A screen reader must encounter the page content in the same order a sighted user reads it. Automation can detect DOM order but not whether it makes semantic sense.',
      de: 'Ein Screenreader muss den Seiteninhalt in derselben Reihenfolge antreffen, in der ein sehender Nutzer ihn liest. Automation prüft DOM-Reihenfolge, nicht ob sie semantisch sinnvoll ist.',
    },
  },
  {
    id: 'meaningful-sequence',
    title: {
      en: 'Information conveyed by position, shape, or sound has a non-sensory alternative',
      de: 'Informationen via Position, Form oder Ton haben eine nicht-sensorische Alternative',
    },
    wcagCriteria: ['1.3.3'],
    levels: ['A'],
    description: {
      en: '"Click the button on the right" or "the red box below" is not enough — instructions must work without sight, color, or sound.',
      de: '"Klicken Sie auf den Button rechts" oder "das rote Feld unten" reicht nicht — Anweisungen müssen ohne Sicht, Farbe oder Ton funktionieren.',
    },
  },
  {
    id: 'sensory-characteristics',
    title: {
      en: 'Color is not the only means of conveying information',
      de: 'Farbe ist nicht das einzige Mittel, Information zu vermitteln',
    },
    wcagCriteria: ['1.4.1'],
    levels: ['A'],
    description: {
      en: 'Required fields, error states, link distinction, status indicators — anything color-coded must also have a non-color cue.',
      de: 'Pflichtfelder, Fehlerzustände, Link-Unterscheidung, Status-Indikatoren — alles farbcodierte braucht zusätzlich einen nicht-farblichen Hinweis.',
    },
  },
  {
    id: 'audio-control',
    title: {
      en: 'Auto-playing audio longer than 3 seconds has a pause/stop control',
      de: 'Automatisch abspielendes Audio über 3 Sekunden hat eine Pause/Stop-Steuerung',
    },
    wcagCriteria: ['1.4.2'],
    levels: ['A'],
    description: {
      en: "Background music, autoplay videos with sound, audio ads — all must be pausable. Automation can detect the <audio>/<video> element but not whether the source actually has sound.",
      de: 'Hintergrundmusik, Autoplay-Videos mit Ton, Audio-Werbung — alles muss pausierbar sein. Automation erkennt das <audio>/<video>-Element, aber nicht ob die Quelle Ton hat.',
    },
  },
  {
    id: 'keyboard-trap',
    title: {
      en: 'No keyboard traps — focus can always leave any component',
      de: 'Keine Tastatur-Fallen — Fokus kann jede Komponente verlassen',
    },
    wcagCriteria: ['2.1.2'],
    levels: ['A'],
    description: {
      en: 'A user who reaches a date picker, custom dropdown, or modal must be able to leave it with the keyboard alone. The most common failure: a JS widget that captures Tab but never releases it.',
      de: 'Ein Nutzer, der einen Datumswähler, ein Custom-Dropdown oder ein Modal erreicht, muss ihn mit der Tastatur verlassen können. Häufigster Fehler: ein JS-Widget, das Tab abfängt und nicht freigibt.',
    },
  },
  {
    id: 'focus-order',
    title: {
      en: 'Keyboard focus moves in a meaningful order',
      de: 'Tastatur-Fokus bewegt sich in einer sinnvollen Reihenfolge',
    },
    wcagCriteria: ['2.4.3'],
    levels: ['A'],
    description: {
      en: 'Tabbing through the page should produce an order that preserves meaning. CSS-reordered content frequently breaks this.',
      de: 'Tabben durch die Seite muss eine sinnerhaltende Reihenfolge erzeugen. Per CSS umsortierte Inhalte brechen das oft.',
    },
  },
  {
    id: 'link-purpose-context',
    title: {
      en: 'Each link\'s purpose is clear from its text or surrounding context',
      de: 'Der Zweck jedes Links ist aus Text oder Kontext klar',
    },
    wcagCriteria: ['2.4.4'],
    levels: ['A'],
    description: {
      en: '"Read more", "Click here", "Learn more" — these only pass if surrounding context makes the destination clear. Automation can spot empty links; only a human can judge if "read more" actually conveys purpose.',
      de: '"Mehr erfahren", "Hier klicken" — diese bestehen nur, wenn der umgebende Kontext das Ziel klar macht. Automation erkennt leere Links; nur ein Mensch beurteilt, ob "mehr erfahren" den Zweck vermittelt.',
    },
  },
  {
    id: 'pointer-gestures',
    title: {
      en: 'Multi-point or path-based gestures have single-pointer alternatives',
      de: 'Multi-Touch- oder Pfad-Gesten haben Einzeiger-Alternativen',
    },
    wcagCriteria: ['2.5.1'],
    levels: ['A'],
    description: {
      en: 'Pinch-to-zoom, drag-to-reorder, swipe-to-delete — must each have a button-or-tap equivalent for users who can\'t perform complex gestures.',
      de: 'Pinch-Zoom, Drag-Sortieren, Wisch-Löschen — jedes braucht eine Button- oder Tap-Alternative für Nutzer, die komplexe Gesten nicht ausführen können.',
    },
  },
  {
    id: 'pointer-cancellation',
    title: {
      en: 'Actions trigger on pointer-up, not pointer-down (and can be aborted)',
      de: 'Aktionen werden auf Pointer-Up ausgelöst, nicht Pointer-Down (und sind abbrechbar)',
    },
    wcagCriteria: ['2.5.2'],
    levels: ['A'],
    description: {
      en: "A user with motor difficulties who taps the wrong button must be able to drag off before releasing to cancel. Automation can't verify this without firing real pointer events.",
      de: 'Ein Nutzer mit motorischen Einschränkungen, der den falschen Button tippt, muss vor dem Loslassen wegziehen können, um abzubrechen. Automation kann das nicht ohne echte Pointer-Events prüfen.',
    },
  },
  {
    id: 'label-in-name',
    title: {
      en: 'Visible label text appears at the start of the accessible name',
      de: 'Sichtbarer Beschriftungstext erscheint am Anfang des barrierefreien Namens',
    },
    wcagCriteria: ['2.5.3'],
    levels: ['A'],
    description: {
      en: 'A button labelled "Submit" with aria-label="Send form" breaks voice control. The visible text must be in the accessible name.',
      de: 'Ein Button mit der Beschriftung "Absenden" und aria-label="Formular senden" bricht Sprachsteuerung. Der sichtbare Text muss im barrierefreien Namen enthalten sein.',
    },
  },
  {
    id: 'motion-actuation',
    title: {
      en: 'Functions activated by device motion have UI alternatives',
      de: 'Per Gerätebewegung ausgelöste Funktionen haben UI-Alternativen',
    },
    wcagCriteria: ['2.5.4'],
    levels: ['A'],
    description: {
      en: 'Shake-to-undo, tilt-to-rotate — anyone unable to move the device must have an on-screen alternative.',
      de: 'Schütteln zum Rückgängig, Kippen zum Drehen — wer das Gerät nicht bewegen kann, braucht eine Bildschirm-Alternative.',
    },
  },
  {
    id: 'consistent-help',
    title: {
      en: 'Help mechanisms appear in the same relative order on every page',
      de: 'Hilfe-Mechanismen erscheinen auf jeder Seite an derselben relativen Stelle',
    },
    wcagCriteria: ['3.2.6'],
    levels: ['A'],
    description: {
      en: 'New in WCAG 2.2: contact info, FAQ links, chat widgets must be in the same place on every page where they appear.',
      de: 'Neu in WCAG 2.2: Kontakt, FAQ-Links, Chat-Widgets müssen auf jeder Seite, auf der sie erscheinen, am selben Ort sein.',
    },
  },
  {
    id: 'redundant-entry',
    title: {
      en: 'Information previously entered is not requested again in the same session',
      de: 'Bereits eingegebene Information wird in derselben Session nicht erneut abgefragt',
    },
    wcagCriteria: ['3.3.7'],
    levels: ['A'],
    description: {
      en: 'New in WCAG 2.2: multi-step checkouts must auto-fill or skip fields the user already provided.',
      de: 'Neu in WCAG 2.2: Mehrschritt-Checkouts müssen Felder, die der Nutzer bereits ausgefüllt hat, vorbefüllen oder überspringen.',
    },
  },
  {
    id: 'accessible-authentication',
    title: {
      en: 'Authentication does not require cognitive function tests',
      de: 'Authentifizierung verlangt keinen kognitiven Funktionstest',
    },
    wcagCriteria: ['3.3.8'],
    levels: ['AA'],
    description: {
      en: 'New in WCAG 2.2: typing-captchas, image-puzzles, math problems must have an alternative (password manager, magic link, biometric).',
      de: 'Neu in WCAG 2.2: Tipp-Captchas, Bilderrätsel, Matheaufgaben brauchen eine Alternative (Passwort-Manager, Magic Link, Biometrie).',
    },
  },
  {
    id: 'time-limits',
    title: {
      en: 'Time limits can be turned off, adjusted, or extended',
      de: 'Zeitlimits können deaktiviert, angepasst oder verlängert werden',
    },
    wcagCriteria: ['2.2.1'],
    levels: ['A'],
    description: {
      en: 'Session timeouts, form-fill timers, slow-reader unfriendly UIs. Automation can find timers but not whether they are user-adjustable.',
      de: 'Session-Timeouts, Formular-Timer, leseunfreundliche UIs. Automation findet Timer, aber nicht ob sie nutzerseitig anpassbar sind.',
    },
  },
  {
    id: 'pause-stop-hide',
    title: {
      en: 'Moving, blinking, or auto-updating content can be paused or hidden',
      de: 'Bewegte, blinkende oder auto-aktualisierende Inhalte können pausiert oder ausgeblendet werden',
    },
    wcagCriteria: ['2.2.2'],
    levels: ['A'],
    description: {
      en: 'Carousels, news tickers, auto-advancing slides. The user must be able to stop them.',
      de: 'Karussells, News-Ticker, automatisch fortschreitende Folien. Der Nutzer muss sie stoppen können.',
    },
  },
  {
    id: 'three-flashes',
    title: {
      en: 'No content flashes more than 3 times in any 1-second period',
      de: 'Kein Inhalt blinkt mehr als 3-mal pro Sekunde',
    },
    wcagCriteria: ['2.3.1'],
    levels: ['A'],
    description: {
      en: 'Photosensitive epilepsy trigger. Automation can\'t reliably measure animation timing without rendering it.',
      de: 'Auslöser für photosensitive Epilepsie. Automation kann Animations-Timing ohne Rendering nicht zuverlässig messen.',
    },
  },
  {
    id: 'error-suggestion',
    title: {
      en: 'Form errors suggest a correction when one is known',
      de: 'Formular-Fehler schlagen eine Korrektur vor, wenn bekannt',
    },
    wcagCriteria: ['3.3.3'],
    levels: ['AA'],
    description: {
      en: '"Invalid email" is not enough — "Email must contain @" is. Automation can find error messages but not judge their helpfulness.',
      de: '"Ungültige E-Mail" reicht nicht — "E-Mail muss @ enthalten" schon. Automation findet Fehlermeldungen, beurteilt aber nicht ihre Hilfreichkeit.',
    },
  },
  {
    id: 'context-change',
    title: {
      en: 'Changing a form field does not unexpectedly submit or redirect',
      de: 'Eine Formularfeld-Änderung löst keine unerwartete Übermittlung oder Weiterleitung aus',
    },
    wcagCriteria: ['3.2.2'],
    levels: ['A'],
    description: {
      en: 'A select dropdown that auto-submits, a checkbox that immediately reloads the page — both are surprises that fail this criterion.',
      de: 'Ein Select, der automatisch abschickt, eine Checkbox, die die Seite sofort neu lädt — beides sind Überraschungen, die hier durchfallen.',
    },
  },
  {
    id: 'multiple-ways',
    title: {
      en: 'There are multiple ways to find each page (nav, search, sitemap)',
      de: 'Es gibt mehrere Wege, jede Seite zu finden (Nav, Suche, Sitemap)',
    },
    wcagCriteria: ['2.4.5'],
    levels: ['AA'],
    description: {
      en: 'A site of more than one page should have at least two navigation paths to every page that isn\'t a step in a process.',
      de: 'Eine Site mit mehr als einer Seite sollte zu jeder Seite (die nicht Teil eines Prozesses ist) mindestens zwei Navigationswege haben.',
    },
  },
  {
    id: 'consistent-navigation',
    title: {
      en: 'Navigation is in the same place on every page',
      de: 'Navigation ist auf jeder Seite am selben Ort',
    },
    wcagCriteria: ['3.2.3'],
    levels: ['AA'],
    description: {
      en: 'The primary nav, search box, and logo link must appear in consistent locations across the site.',
      de: 'Hauptnavigation, Suchfeld und Logo-Link müssen seitenübergreifend an konsistenten Stellen erscheinen.',
    },
  },
  {
    id: 'consistent-identification',
    title: {
      en: 'Components with the same function are identified consistently',
      de: 'Komponenten mit gleicher Funktion werden konsistent gekennzeichnet',
    },
    wcagCriteria: ['3.2.4'],
    levels: ['AA'],
    description: {
      en: 'A "Search" icon should always be a magnifying glass, the cart icon always a cart. Inconsistency confuses screen reader users.',
      de: 'Ein "Suchen"-Icon sollte immer eine Lupe sein, das Warenkorb-Icon immer ein Warenkorb. Inkonsistenz verwirrt Screenreader-Nutzer.',
    },
  },
] as const;

export type ManualProcedureId = (typeof MANUAL_PROCEDURES)[number]['id'];
