import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion } from 'motion/react'
import type { CreateRecipeInput } from '@/api/types'

const ease = [0.22, 1, 0.36, 1] as const

export type RecipeFormValues = CreateRecipeInput

type IngredientRow = {
  key: string
  name: string
  amount: string
  unit: string
  notes: string
}

type StepRow = {
  key: string
  text: string
}

type RecipeFormProps = {
  initial?: RecipeFormValues
  submitLabel: string
  isSubmitting: boolean
  error: string | null
  onSubmit: (values: RecipeFormValues) => void
  onCancel: () => void
  extraAction?: ReactNode
}

let rowSeed = 0
const nextKey = () => `r${rowSeed++}`

export function RecipeForm({
  initial,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  extraAction,
}: RecipeFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [baseServings, setBaseServings] = useState(initial?.baseServings ?? 4)
  const [totalTime, setTotalTime] = useState<string>(
    initial?.totalTimeMinutes != null ? String(initial.totalTimeMinutes) : '',
  )
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '')

  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initial?.ingredients?.length
      ? initial.ingredients.map((i) => ({
          key: nextKey(),
          name: i.name,
          amount: i.amount ? String(i.amount) : '',
          unit: i.unit ?? '',
          notes: i.notes ?? '',
        }))
      : [emptyIngredient()],
  )

  const [steps, setSteps] = useState<StepRow[]>(() =>
    initial?.steps?.length
      ? initial.steps.map((text) => ({ key: nextKey(), text }))
      : [emptyStep()],
  )

  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')

  function commitTag(raw: string) {
    const normalised = raw.trim().toLowerCase()
    if (!normalised) return
    if (tags.includes(normalised)) {
      setTagDraft('')
      return
    }
    if (tags.length >= 10) return
    setTags([...tags, normalised])
    setTagDraft('')
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pending = tagDraft.trim().toLowerCase()
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags
    const timeNumber = totalTime.trim() ? Number(totalTime) : null

    onSubmit({
      title: title.trim(),
      baseServings,
      summary: summary.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      totalTimeMinutes: timeNumber != null && Number.isFinite(timeNumber) && timeNumber > 0 ? timeNumber : null,
      ingredients: ingredients
        .filter((i) => i.name.trim().length > 0)
        .map((i) => ({
          name: i.name.trim(),
          amount: Number(i.amount) || 0,
          unit: i.unit.trim() || null,
          notes: i.notes.trim() || null,
        })),
      steps: steps.map((s) => s.text.trim()).filter((t) => t.length > 0),
      tags: finalTags,
    })
  }

  function moveItem<T>(arr: T[], from: number, dir: -1 | 1): T[] {
    const to = from + dir
    if (to < 0 || to >= arr.length) return arr
    const next = [...arr]
    ;[next[from], next[to]] = [next[to], next[from]]
    return next
  }

  return (
    <form onSubmit={handleSubmit} className="grain pb-32">
      {/* Headline-as-input  ─ what the user types is also what the page will look like */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="px-6 md:px-12 lg:px-20 pt-6"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Untitled recipe"
          aria-label="Title"
          className="w-full bg-transparent border-0 border-b-2 border-transparent focus:border-paprika focus:outline-none py-2 font-display text-ink placeholder:text-chestnut-soft transition-colors"
          style={{
            fontSize: 'clamp(2.4rem, 6.5vw, 5.5rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.035em',
            fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
          }}
        />

        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="A short, honest description."
          aria-label="Summary"
          className="w-full bg-transparent border-0 focus:outline-none py-2 mt-2 max-w-3xl font-display text-ink-soft placeholder:text-chestnut-soft transition-colors resize-none"
          style={{
            fontSize: '1.25rem',
            lineHeight: 1.5,
            fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0',
          }}
        />
      </motion.section>

      {/* Masthead — base servings, time, source URL, tags */}
      <section className="px-6 md:px-12 lg:px-20 mt-8 pt-6 border-t border-cream-shadow grid grid-cols-12 gap-y-6 gap-x-6 items-baseline">
        <div className="col-span-6 md:col-span-3">
          <p className="eyebrow mb-1.5">Serves</p>
          <ServingsField value={baseServings} onChange={setBaseServings} />
        </div>

        <label className="col-span-6 md:col-span-3 block">
          <span className="eyebrow block mb-1.5">Total time · min</span>
          <input
            value={totalTime}
            onChange={(e) => setTotalTime(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="—"
            className="w-full bg-transparent border-0 border-b border-chestnut/30 focus:border-paprika focus:outline-none py-1 num text-paprika text-3xl placeholder:text-chestnut-soft transition-colors"
          />
        </label>

        <label className="col-span-12 md:col-span-6 block">
          <span className="eyebrow block mb-1.5">Source URL</span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            type="url"
            maxLength={2048}
            placeholder="https://dagelijksekost.vrt.be/…"
            className="w-full bg-transparent border-0 border-b border-chestnut/30 focus:border-paprika focus:outline-none py-1 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
          />
        </label>

        <div className="col-span-12">
          <p className="eyebrow block mb-2">Tags</p>
          <div className="flex flex-wrap items-center gap-2 border-b border-chestnut/30 focus-within:border-paprika py-1 transition-colors">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 bg-paprika-tint text-paprika-deep font-mono text-[0.7rem] uppercase tracking-[0.16em] px-2.5 py-1 rounded-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  aria-label={`Remove ${tag}`}
                  className="text-paprika-deep hover:text-ink transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
                  if (tagDraft.trim()) {
                    e.preventDefault()
                    commitTag(tagDraft)
                  }
                } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
                  setTags(tags.slice(0, -1))
                }
              }}
              onBlur={() => tagDraft.trim() && commitTag(tagDraft)}
              maxLength={50}
              placeholder={tags.length ? '' : 'dinner, vegetarisch, snel, …'}
              className="flex-1 min-w-[8rem] bg-transparent border-0 focus:outline-none py-1 font-mono text-sm text-ink placeholder:text-chestnut-soft"
            />
          </div>
          <p className="font-mono text-[0.65rem] text-chestnut-soft mt-1">
            Press enter or comma to add. Backspace removes the last tag.
          </p>
        </div>
      </section>

      <Ornament />

      <section className="px-6 md:px-12 lg:px-20 grid grid-cols-12 gap-x-10 gap-y-16">
        <div className="col-span-12 lg:col-span-5">
          <SectionMark numeral="I" count={ingredients.length}>
            Ingredients
          </SectionMark>

          <ul className="mt-6 space-y-2">
            {ingredients.map((row, i) => (
              <li key={row.key} className="group">
                <div className="grid grid-cols-[5rem_3.5rem_1fr_auto] items-baseline gap-x-2 py-1.5 border-b border-transparent hover:border-cream-shadow transition-colors">
                  <input
                    value={row.amount}
                    onChange={(e) => updateRow(setIngredients, i, { amount: e.target.value })}
                    placeholder="0"
                    inputMode="decimal"
                    className="bg-transparent border-0 focus:outline-none text-right num text-paprika text-base placeholder:text-chestnut-soft"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  />
                  <input
                    value={row.unit}
                    onChange={(e) => updateRow(setIngredients, i, { unit: e.target.value })}
                    placeholder="unit"
                    maxLength={50}
                    className="bg-transparent border-0 focus:outline-none font-mono text-[0.7rem] uppercase tracking-[0.14em] text-chestnut placeholder:text-chestnut-soft"
                  />
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(setIngredients, i, { name: e.target.value })}
                    placeholder="ingredient"
                    className="bg-transparent border-0 focus:outline-none font-display text-ink text-lg placeholder:text-chestnut-soft"
                    style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                  />
                  <RowActions
                    onUp={() => setIngredients((arr) => moveItem(arr, i, -1))}
                    onDown={() => setIngredients((arr) => moveItem(arr, i, +1))}
                    onRemove={() => setIngredients((arr) => arr.filter((_, idx) => idx !== i))}
                    canUp={i > 0}
                    canDown={i < ingredients.length - 1}
                  />
                </div>
                <input
                  value={row.notes}
                  onChange={(e) => updateRow(setIngredients, i, { notes: e.target.value })}
                  placeholder=""
                  maxLength={500}
                  aria-label="Notes"
                  className="w-full pl-[5.5rem] bg-transparent border-0 focus:outline-none -mt-1 mb-2 text-chestnut text-sm italic placeholder:text-chestnut-soft"
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setIngredients((arr) => [...arr, emptyIngredient()])}
            className="mt-3 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline"
          >
            + Add ingredient
          </button>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <SectionMark numeral="II" count={steps.length}>
            Method
          </SectionMark>

          <ol className="mt-8 space-y-10">
            {steps.map((row, i) => (
              <li
                key={row.key}
                className="group grid grid-cols-[3.5rem_1fr_auto] md:grid-cols-[5rem_1fr_auto] gap-x-5 items-baseline"
              >
                <span
                  className="num text-paprika leading-none text-5xl md:text-6xl text-right select-none opacity-70 group-hover:opacity-100 transition-opacity"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <textarea
                  value={row.text}
                  onChange={(e) => updateRow(setSteps, i, { text: e.target.value })}
                  rows={2}
                  maxLength={2000}
                  placeholder="What happens at this step…"
                  className="bg-transparent border-0 border-b border-transparent group-hover:border-cream-shadow focus:border-paprika focus:outline-none py-2 font-display text-ink-soft text-lg md:text-xl leading-relaxed placeholder:text-chestnut-soft resize-none transition-colors"
                  style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                />
                <RowActions
                  onUp={() => setSteps((arr) => moveItem(arr, i, -1))}
                  onDown={() => setSteps((arr) => moveItem(arr, i, +1))}
                  onRemove={() => setSteps((arr) => arr.filter((_, idx) => idx !== i))}
                  canUp={i > 0}
                  canDown={i < steps.length - 1}
                />
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => setSteps((arr) => [...arr, emptyStep()])}
            className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline"
          >
            + Add step
          </button>
        </div>
      </section>

      {error && (
        <p className="px-6 md:px-12 lg:px-20 font-mono text-[0.78rem] text-paprika-deep mt-10">{error}</p>
      )}

      <SaveBar
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        extraAction={extraAction}
      />
    </form>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function SaveBar({
  submitLabel,
  isSubmitting,
  onCancel,
  extraAction,
}: {
  submitLabel: string
  isSubmitting: boolean
  onCancel: () => void
  extraAction?: ReactNode
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-cream/95 backdrop-blur-sm border-t border-cream-shadow">
      <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center gap-6 flex-wrap">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-3 px-6 py-3 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.78rem] hover:bg-paprika transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
          <span aria-hidden>→</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
        >
          Cancel
        </button>
        {extraAction}
      </div>
    </div>
  )
}

function SectionMark({
  numeral,
  count,
  children,
}: {
  numeral: string
  count: number
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-chestnut/30 pb-3">
      <span
        className="font-display text-paprika text-2xl leading-none"
        style={{ fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1' }}
      >
        {numeral}.
      </span>
      <h2
        className="font-display text-ink text-2xl"
        style={{
          fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
          letterSpacing: '-0.015em',
        }}
      >
        {children}
      </h2>
      <span className="ml-auto font-mono text-[0.7rem] tracking-tight text-chestnut-soft">{count}</span>
    </div>
  )
}

function Ornament() {
  return (
    <div className="flex items-center gap-6 my-12 max-w-3xl mx-auto" aria-hidden>
      <span className="flex-1 h-px bg-cream-shadow" />
      <span
        className="text-paprika text-2xl font-display leading-none"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
      >
        ❦
      </span>
      <span className="flex-1 h-px bg-cream-shadow" />
    </div>
  )
}

function ServingsField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Fewer servings"
        className="w-7 h-7 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
      >
        −
      </button>
      <span className="num text-paprika text-3xl min-w-[2.5rem] text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="More servings"
        className="w-7 h-7 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
      >
        +
      </button>
    </div>
  )
}

type RowActionsProps = {
  onUp: () => void
  onDown: () => void
  onRemove: () => void
  canUp: boolean
  canDown: boolean
}

function RowActions({ onUp, onDown, onRemove, canUp, canDown }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      <IconButton onClick={onUp} disabled={!canUp} label="Move up">↑</IconButton>
      <IconButton onClick={onDown} disabled={!canDown} label="Move down">↓</IconButton>
      <IconButton onClick={onRemove} label="Remove" danger>×</IconButton>
    </div>
  )
}

function IconButton({
  onClick,
  disabled,
  label,
  danger,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        'w-6 h-6 flex items-center justify-center font-mono text-sm leading-none',
        'border border-cream-shadow transition-colors',
        danger ? 'hover:border-paprika hover:text-paprika' : 'hover:border-chestnut hover:text-ink',
        'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-cream-shadow',
        'text-chestnut',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function emptyIngredient(): IngredientRow {
  return { key: nextKey(), name: '', amount: '', unit: '', notes: '' }
}

function emptyStep(): StepRow {
  return { key: nextKey(), text: '' }
}

function updateRow<T>(setter: (fn: (rows: T[]) => T[]) => void, index: number, patch: Partial<T>) {
  setter((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}
