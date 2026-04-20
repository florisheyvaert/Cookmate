import type { RecipeIngredientDto } from '@/api/types'

/**
 * Best-effort match of which ingredients are referenced in a given step's
 * instruction text. Pure client-side; no schema change needed.
 *
 * Strategy: lowercase word-boundary regex against the ingredient name plus a
 * few Dutch plural/diminutive stem variations (rozijnen → rozijn, eieren → eier,
 * broodjes → broodje, …). Word boundaries prevent "ei" matching inside "schei",
 * and stemming catches the common case where a recipe writes "rozijntjes" while
 * the ingredient list says "rozijnen".
 *
 * Multi-word ingredient names are matched as a phrase ("witte chocolade").
 */
export function findStepIngredients(
  stepText: string,
  ingredients: RecipeIngredientDto[],
): RecipeIngredientDto[] {
  if (!stepText) return []
  const haystack = ` ${stepText.toLowerCase()} `

  const matches: RecipeIngredientDto[] = []
  for (const ing of ingredients) {
    if (variationsOf(ing.name).some((v) => containsWord(haystack, v))) {
      matches.push(ing)
    }
  }
  return matches
}

function variationsOf(rawName: string): string[] {
  const name = rawName.trim().toLowerCase()
  if (!name) return []

  const out = new Set<string>([name])

  // Dutch endings — drop them off the LAST word so multi-word phrases keep their head.
  const tail = (s: string, suffix: string) =>
    s.endsWith(suffix) && s.length > suffix.length + 2 ? s.slice(0, -suffix.length) : null

  const lastWord = name.split(/\s+/).pop() ?? name
  for (const stripped of [
    tail(lastWord, 'tjes'),
    tail(lastWord, 'tje'),
    tail(lastWord, 'en'),
    tail(lastWord, 's'),
  ]) {
    if (stripped) out.add(name.replace(new RegExp(`${escapeRegex(lastWord)}$`), stripped))
  }

  // Also try just the last word on its own (catches "klontje boter" → "boter").
  if (lastWord && lastWord !== name && lastWord.length > 3) {
    out.add(lastWord)
  }

  return [...out]
}

function containsWord(haystackWithSpaces: string, needle: string): boolean {
  const escaped = escapeRegex(needle)
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystackWithSpaces)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
