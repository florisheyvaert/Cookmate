import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

export type ListboxOption = { value: string; label: string }

type ListboxProps = {
  value: string
  onChange: (value: string) => void
  options: ListboxOption[]
  ariaLabel?: string
}

/**
 * Themed, accessible single-select dropdown — replaces the native <select> so the
 * options panel follows the Garden Market palette. Closes on outside click / Escape,
 * supports arrow-key navigation, and marks the selected option.
 */
export function Listbox({ value, onChange, options, ariaLabel }: ListboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const i = options.findIndex((o) => o.value === value)
    setActiveIndex(i < 0 ? 0 : i)
  }, [open, value, options])

  function choose(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        else setActiveIndex((i) => Math.min(options.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) setOpen(true)
        else setActiveIndex((i) => Math.max(0, i - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) choose(options[activeIndex].value)
        else setOpen(true)
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="group w-full flex items-center justify-between gap-2 bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 pr-1 font-mono text-sm text-ink cursor-pointer transition-colors text-left"
      >
        <span className="truncate">{selected?.label}</span>
        <span
          aria-hidden
          className={`shrink-0 text-chestnut-soft group-hover:text-paprika group-focus:text-paprika transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <svg width={11} height={11} viewBox="0 0 10 10" aria-hidden>
            <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            tabIndex={-1}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease }}
            className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-cream-shadow bg-cream-deep shadow-lg shadow-ink/5 py-1"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value
              const isActive = i === activeIndex
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(o.value)}
                  className={[
                    'px-3 py-2 cursor-pointer font-mono text-sm flex items-center justify-between gap-2 transition-colors',
                    isActive ? 'bg-cream-shadow/50' : '',
                    isSelected ? 'text-paprika' : 'text-ink',
                  ].join(' ')}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && (
                    <span aria-hidden className="shrink-0 text-paprika">
                      ✓
                    </span>
                  )}
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
