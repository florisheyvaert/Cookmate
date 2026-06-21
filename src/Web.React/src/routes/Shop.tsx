import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import { PageHeader } from '@/components/PageHeader'
import { Listbox, type ListboxOption } from '@/components/Listbox'
import { btnPrimary, btnGhostSm } from '@/lib/ui'

const ease = [0.22, 1, 0.36, 1] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function dayCount(from: string, to: string): number {
  if (!from || !to || from > to) return 0
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

export default function Shop() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const today = useMemo(() => new Date(), [])

  const [storeCode, setStoreCode] = useState(params.get('store') || 'ah')
  const [from, setFrom] = useState(params.get('from') || toISO(today))
  const [to, setTo] = useState(params.get('to') || toISO(addDays(today, 7)))

  const storesQ = useQuery({ queryKey: ['shop-stores'], queryFn: () => shoppingApi.listStores() })

  const storeOptions: ListboxOption[] = (storesQ.data ?? [{ code: 'ah', displayName: 'Albert Heijn' }]).map((s) => ({
    value: s.code,
    label: s.displayName,
  }))

  const days = dayCount(from, to)
  const valid = !!storeCode && !!from && !!to && from <= to

  function next() {
    if (!valid) return
    navigate(`/shop/cart?store=${encodeURIComponent(storeCode)}&from=${from}&to=${to}`)
  }

  function setThisWeek() {
    setFrom(toISO(today))
    setTo(toISO(addDays(today, 7)))
  }

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-24">
      <PageHeader
        eyebrow="Cookbook · Shop"
        title="Plan a shop"
        subtitle="Pick a period and a store. We'll add up every ingredient across the meals you planned and turn it into one basket."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="max-w-xl rounded-2xl border border-cream-shadow bg-cream-deep p-5 sm:p-7"
      >
        {/* Period */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-1 h-5 rounded-full bg-paprika" aria-hidden />
          <h2 className="text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>Period</h2>
          {days > 0 && (
            <span className="num text-[0.66rem] px-2 py-0.5 rounded-full bg-paprika/15 text-paprika-deep">
              {days} day{days === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <label className="block">
            <span className="eyebrow block mb-1.5">From</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">To</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={dateInput} />
          </label>
        </div>
        <button type="button" onClick={setThisWeek} className={btnGhostSm}>
          This week (today + 7)
        </button>

        {/* Store */}
        <div className="flex items-center gap-2.5 mt-8 mb-4">
          <span className="w-1 h-5 rounded-full bg-butter" aria-hidden />
          <h2 className="text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>Store</h2>
        </div>
        <Listbox ariaLabel="Store" value={storeCode} onChange={setStoreCode} options={storeOptions} />

        {/* Next */}
        <div className="mt-9 flex items-center justify-between gap-4">
          <p className="font-mono text-[0.62rem] text-chestnut-soft leading-snug">
            {valid ? 'Amounts get summed across the week before counting packs.' : 'Pick a valid date range to continue.'}
          </p>
          <button type="button" onClick={next} disabled={!valid} className={btnPrimary + ' shrink-0'}>
            Next →
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const dateInput =
  'w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink transition-colors'
