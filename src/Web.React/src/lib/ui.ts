// Canonical button styles for the whole app (Garden Market).
// One source of truth so every page's buttons match. Append layout utilities
// (w-full, mt-…) when needed: className={`${btnPrimary} w-full`}.

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold leading-none ' +
  'no-underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

/** Primary action — herb green. */
export const btnPrimary = `${base} px-5 py-2.5 text-[0.9rem] bg-paprika text-cream hover:bg-paprika-deep`
/** Strongest action — deep ink, turns green on hover. */
export const btnDark = `${base} px-5 py-2.5 text-[0.9rem] bg-ink text-cream hover:bg-paprika`
/** Secondary action — outline. */
export const btnGhost = `${base} px-5 py-2.5 text-[0.9rem] border border-cream-shadow text-ink hover:border-paprika hover:text-paprika`

/** Compact variants. */
export const btnPrimarySm = `${base} px-4 py-2 text-[0.82rem] bg-paprika text-cream hover:bg-paprika-deep`
export const btnGhostSm = `${base} px-4 py-2 text-[0.82rem] border border-cream-shadow text-ink hover:border-paprika hover:text-paprika`

/** Tertiary / quiet text action (edit, cancel, change…). */
export const quietBtn =
  'font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors no-underline'
