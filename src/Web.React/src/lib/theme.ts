export type Theme = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'cookmate.theme'

/** What's currently stored — or 'system' if nothing/unparsable. */
export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // Storage may be disabled (private browsing, etc.). Fall back to system.
  }
  return 'system'
}

/** Persist the choice. 'system' clears the key so future system changes are followed. */
export function writeStoredTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

/** Adds/removes the `dark` class on <html> based on the resolved (system-aware) theme. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
