import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { usersApi, redemptionUrl } from '@/api/users'
import type { RedemptionLink, UserSummary } from '@/api/users'
import { ApiError } from '@/lib/api'
import { ShareLink } from '@/components/ShareLink'
import { useConfirm } from '@/components/confirm/ConfirmDialog'

const ease = [0.22, 1, 0.36, 1] as const

type IssuedLink = RedemptionLink & { kind: 'invite' | 'reset' }

export default function UsersPage() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const confirm = useConfirm()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [issuedLink, setIssuedLink] = useState<IssuedLink | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const resetMutation = useMutation({
    mutationFn: ({ userId }: { userId: string; kind: 'invite' | 'reset' }) =>
      usersApi.resetPassword(userId),
    onSuccess: (link, vars) => {
      setError(null)
      setIssuedLink({ ...link, kind: vars.kind })
    },
    onError: (err) => setError(extractError(err)),
  })

  const setAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      usersApi.setAdmin(userId, isAdmin),
    onSuccess: () => {
      setError(null)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => setError(extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersApi.remove(userId),
    onSuccess: () => {
      setError(null)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => setError(extractError(err)),
  })

  async function handleDelete(u: UserSummary) {
    const ok = await confirm.ask({
      title: `Remove ${u.email}?`,
      body: 'They will lose access immediately. The recipes they added stay in the cookbook.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (ok) deleteMutation.mutate(u.id)
  }

  async function handleToggleAdmin(u: UserSummary) {
    const next = !u.isAdmin
    const ok = await confirm.ask({
      title: next ? `Promote ${u.email} to admin?` : `Demote ${u.email}?`,
      body: next
        ? 'Admins can invite, remove, and manage other members.'
        : 'They keep their access but can no longer manage the cookbook.',
      confirmLabel: next ? 'Promote' : 'Demote',
    })
    if (ok) setAdminMutation.mutate({ userId: u.id, isAdmin: next })
  }

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-16 grain min-h-[80vh]">
      <header className="flex items-baseline justify-between gap-6 flex-wrap mb-10 pb-4 border-b border-cream-shadow">
        <div>
          <p className="eyebrow mb-2">Cookbook · Keys</p>
          <h1
            className="font-display text-ink"
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.6rem)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
            }}
          >
            Members
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.72rem] hover:bg-paprika-deep transition-colors"
        >
          <span aria-hidden>+</span>
          Invite someone
        </button>
      </header>

      <AnimatePresence>
        {issuedLink && (
          <motion.div
            key={issuedLink.userId + issuedLink.token}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease }}
            className="mb-10 grain border border-paprika/40 bg-paprika-tint rounded-sm p-6 md:p-8 max-w-2xl"
          >
            <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
              <p className="eyebrow text-paprika">
                {issuedLink.kind === 'invite' ? 'Invite ready' : 'Reset link ready'}
              </p>
              <button
                type="button"
                onClick={() => setIssuedLink(null)}
                className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors"
              >
                Dismiss ×
              </button>
            </div>
            <p
              className="font-display text-ink text-2xl mb-1"
              style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1', letterSpacing: '-0.02em' }}
            >
              For {issuedLink.email}
            </p>
            <p className="font-mono text-[0.72rem] text-chestnut mb-5">
              {issuedLink.kind === 'invite'
                ? 'Share through any channel — they set their password on first visit. The link stops working once they have.'
                : 'Share through any channel. The link stops working once they pick a new password.'}
            </p>
            <ShareLink
              url={redemptionUrl(issuedLink)}
              title="Join my Cookmate"
              text={
                issuedLink.kind === 'invite'
                  ? `You've been invited to Cookmate. Open this link to set your password:`
                  : `Open this link to set a new Cookmate password:`
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mb-6 font-mono text-[0.72rem] text-paprika-deep">{error}</p>
      )}

      {query.isPending ? (
        <p className="eyebrow">Loading the directory…</p>
      ) : query.isError ? (
        <p className="text-paprika-deep font-mono text-[0.72rem]">
          Could not load members. Try refreshing.
        </p>
      ) : query.data.length === 0 ? (
        <p className="text-chestnut italic">No one here yet — invite the first guest.</p>
      ) : (
        <ul className="divide-y divide-cream-shadow">
          {query.data.map((u, i) => (
            <UserRow
              key={u.id}
              index={i}
              user={u}
              isMe={me?.id === u.id}
              busy={
                resetMutation.isPending ||
                setAdminMutation.isPending ||
                deleteMutation.isPending
              }
              onReset={() => resetMutation.mutate({ userId: u.id, kind: u.hasPassword ? 'reset' : 'invite' })}
              onToggleAdmin={() => handleToggleAdmin(u)}
              onDelete={() => handleDelete(u)}
            />
          ))}
        </ul>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onIssued={(link) => {
          setIssuedLink({ ...link, kind: 'invite' })
          setInviteOpen(false)
          qc.invalidateQueries({ queryKey: ['users'] })
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type UserRowProps = {
  user: UserSummary
  index: number
  isMe: boolean
  busy: boolean
  onReset: () => void
  onToggleAdmin: () => void
  onDelete: () => void
}

function UserRow({ user, index, isMe, busy, onReset, onToggleAdmin, onDelete }: UserRowProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease }}
      className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-y-3 gap-x-6 py-5 items-center"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="font-display text-ink text-xl truncate max-w-full"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            {user.email}
          </span>
          {isMe && (
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-paprika">
              · you
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1.5">
          <Badge tone={user.isAdmin ? 'paprika' : 'muted'}>
            {user.isAdmin ? 'Admin' : 'Member'}
          </Badge>
          {!user.hasPassword && (
            <Badge tone="muted">Pending invite</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap md:justify-end">
        <RowAction
          onClick={onReset}
          disabled={busy || (!isMe && user.isAdmin && user.hasPassword)}
        >
          {user.hasPassword ? 'Reset password' : 'Show invite link'}
        </RowAction>
        <RowAction onClick={onToggleAdmin} disabled={busy || isMe}>
          {user.isAdmin ? 'Demote' : 'Promote'}
        </RowAction>
        <RowAction onClick={onDelete} disabled={busy || isMe} destructive>
          Remove
        </RowAction>
      </div>
    </motion.li>
  )
}

function RowAction({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'font-mono text-[0.7rem] uppercase tracking-[0.18em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        destructive
          ? 'text-paprika-deep hover:text-paprika'
          : 'text-chestnut hover:text-paprika',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'paprika' | 'muted' }) {
  return (
    <span
      className={[
        'font-mono text-[0.6rem] uppercase tracking-[0.22em] px-2 py-0.5 border rounded-sm',
        tone === 'paprika'
          ? 'text-paprika border-paprika/40 bg-paprika-tint'
          : 'text-chestnut border-cream-shadow',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type InviteDialogProps = {
  open: boolean
  onClose: () => void
  onIssued: (link: RedemptionLink) => void
}

function InviteDialog({ open, onClose, onIssued }: InviteDialogProps) {
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: () => usersApi.invite(email.trim(), isAdmin),
    onSuccess: (link) => {
      setEmail('')
      setIsAdmin(false)
      setError(null)
      onIssued(link)
    },
    onError: (err) => setError(extractError(err)),
  })

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => emailRef.current?.focus(), 60)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !mutation.isPending) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
      clearTimeout(t)
    }
  }, [open, mutation.isPending, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm"
            onClick={() => !mutation.isPending && onClose()}
            aria-hidden
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (email.trim()) mutation.mutate()
              }}
              className="grain w-full max-w-lg bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm"
            >
              <div className="px-7 pt-7 pb-6">
                <p className="eyebrow mb-3">Invite</p>
                <h2
                  id="invite-title"
                  className="font-display text-ink text-3xl md:text-4xl mb-5"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                  }}
                >
                  Hand out a key.
                </h2>

                <label className="block mb-5">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut">
                    Email
                  </span>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="someone@example.com"
                    required
                    disabled={mutation.isPending}
                    className="mt-1.5 w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-display text-ink text-xl placeholder:text-chestnut-soft placeholder:font-mono placeholder:text-sm transition-colors disabled:opacity-60"
                    style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                  />
                </label>

                <label className="flex items-center gap-3 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    disabled={mutation.isPending}
                    className="accent-paprika w-4 h-4"
                  />
                  <span className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-chestnut">
                    Make them an admin
                  </span>
                </label>
                <p className="font-mono text-[0.66rem] text-chestnut-soft leading-relaxed pl-7">
                  Admins can invite, remove, and reset other members.
                </p>

                {error && (
                  <p className="mt-4 font-mono text-[0.72rem] text-paprika-deep">{error}</p>
                )}
              </div>

              <div className="border-t border-cream-shadow px-7 py-4 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={mutation.isPending}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending || !email.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.72rem] hover:bg-paprika transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? 'Issuing key…' : 'Generate link'}
                  <span aria-hidden>→</span>
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; title?: string; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    if (firstError) return firstError
    if (err.status === 409) return body?.detail ?? 'A user with that email already exists.'
    if (err.status === 403) return body?.detail ?? body?.title ?? 'Only an administrator can do that.'
    return body?.detail ?? body?.title ?? `Request failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
