import { useState, useEffect, useCallback } from 'react'
import { api } from './api'

const TODAY = new Date().toISOString().slice(0, 10)

export default function ManagerView({ onBack }) {
  const [projects, setProjects]     = useState([])
  const [projectId, setProjectId]   = useState('')
  const [date, setDate]             = useState(TODAY)
  const [digest, setDigest]         = useState(null)
  const [blockers, setBlockers]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [error, setError]           = useState(null)

  // Load projects on mount
  useEffect(() => {
    api.getProjects().then(ps => {
      setProjects(ps)
      if (ps.length) setProjectId(String(ps[0].id))
    })
  }, [])

  // When project/date changes, auto-load stored digest + blockers
  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true); setError(null)
    try {
      const [digests, blks] = await Promise.all([
        api.getDigests(projectId, date),
        api.getBlockers(projectId),
      ])
      setDigest(digests.length ? digests[0] : null)
      setBlockers(blks)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId, date])

  useEffect(() => { loadData() }, [loadData])

  const handleGenerate = async () => {
    setGenLoading(true); setError(null)
    try {
      const d = await api.generateDigest(projectId, date)
      setDigest(d)
      await loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setGenLoading(false)
    }
  }

  const handleAction = async (action, id, reason) => {
    try {
      if (action === 'confirm') await api.confirmBlocker(id)
      if (action === 'dismiss') await api.dismissBlocker(id, reason)
      if (action === 'resolve') await api.resolveBlocker(id)
      await loadData()
    } catch (e) {
      setError(e.message)
    }
  }

  // Split blockers: flagged (in digest) vs other open
  const flaggedRisks   = digest?.flagged_blockers || []
  const flaggedIds     = new Set(flaggedRisks.map(r => r.blocker_id))
  const openBlockers   = blockers.filter(b => b.status === 'open' || b.status === 'confirmed')
  const otherBlockers  = openBlockers.filter(b => !flaggedIds.has(b.id))

  const projectName = projects.find(p => String(p.id) === projectId)?.name || ''

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.brand}>⚡ Pulse</div>
          <nav style={s.nav}>
            <div style={{ ...s.navItem, ...s.navActive }}>📊 Manager View</div>
          </nav>
        </div>
        <button style={s.backBtn} onClick={onBack}>← Switch Role</button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <div>
            <div style={s.toolbarTitle}>Manager Digest</div>
            <div style={s.toolbarSub}>{projectName}</div>
          </div>
          <div style={s.toolbarRight}>
            <select style={s.select} value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" style={s.select} value={date} onChange={e => setDate(e.target.value)} />
            <button style={s.genBtn} onClick={handleGenerate} disabled={!projectId || genLoading}>
              {genLoading ? '⏳ Generating…' : '✨ Generate Digest'}
            </button>
          </div>
        </div>

        {error && <div style={s.errorBanner}>⚠️ {error}</div>}
        {loading && <div style={s.loading}>Loading…</div>}

        {/* Digest Summary */}
        {digest && (
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>📝 Today's Summary</div>
            <p style={s.summaryText}>{digest.summary_text || digest.summary}</p>
          </div>
        )}

        {!digest && !loading && (
          <div style={s.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>No digest for this date yet</div>
            <div style={{ color: '#64748b', marginTop: 6 }}>Click "Generate Digest" to create one</div>
          </div>
        )}

        {/* Flagged Risks */}
        {flaggedRisks.length > 0 && (
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>🚨 Flagged Risks</span>
              <span style={s.badge}>{flaggedRisks.length} escalated</span>
            </div>
            {flaggedRisks.map(risk => {
              const blocker = blockers.find(b => b.id === risk.blocker_id)
              return (
                <BlockerCard
                  key={risk.blocker_id}
                  risk={risk}
                  blocker={blocker}
                  onAction={handleAction}
                  escalated
                />
              )
            })}
          </section>
        )}

        {/* Other open blockers */}
        {otherBlockers.length > 0 && (
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>📌 Other Open Blockers</span>
              <span style={{ ...s.badge, background: '#f1f5f9', color: '#64748b' }}>{otherBlockers.length} day-1</span>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
              Not yet escalated — act early if you spot a pattern.
            </p>
            {otherBlockers.map(b => (
              <BlockerCard
                key={b.id}
                risk={{ blocker_id: b.id, description: b.description, days_recurring: b.days_recurring, suggested_action: null }}
                blocker={b}
                onAction={handleAction}
                escalated={false}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

// ── Blocker Card ─────────────────────────────────────────────────────────────

function BlockerCard({ risk, blocker, onAction, escalated }) {
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason]         = useState('')
  const [acting, setActing]         = useState(false)

  const status = blocker?.status || 'open'
  const actioned = ['confirmed', 'dismissed', 'resolved'].includes(status)

  const act = async (action, r) => {
    setActing(true)
    await onAction(action, risk.blocker_id, r)
    setActing(false); setDismissing(false); setReason('')
  }

  const typeColor = {
    waiting_on_person:   '#f59e0b',
    waiting_on_decision: '#8b5cf6',
    technical:           '#ef4444',
    other:               '#64748b',
  }

  const typeLabel = {
    waiting_on_person:   'Waiting on person',
    waiting_on_decision: 'Waiting on decision',
    technical:           'Technical',
    other:               'Other',
  }

  const color = typeColor[blocker?.type] || '#64748b'

  return (
    <div style={{ ...s.card, borderLeft: `4px solid ${escalated ? color : '#cbd5e1'}`, opacity: actioned ? .55 : 1 }}>
      <div style={s.cardTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...s.typePill, background: color + '18', color }}>{typeLabel[blocker?.type] || 'Unknown'}</span>
          <span style={{ ...s.daysPill, background: escalated ? '#fef2f2' : '#f8fafc', color: escalated ? '#dc2626' : '#64748b' }}>
            🔁 Day {risk.days_recurring}
          </span>
          {status !== 'open' && (
            <span style={{ ...s.typePill, background: '#f0fdf4', color: '#16a34a' }}>✓ {status}</span>
          )}
        </div>
      </div>

      <p style={s.cardDesc}>{risk.description}</p>

      {risk.suggested_action && (
        <div style={s.actionBox}>
          <span style={s.actionLabel}>💡 Suggested action</span>
          <span style={s.actionText}>{risk.suggested_action}</span>
        </div>
      )}

      {/* Action buttons — hide once actioned */}
      {!actioned && (
        <div style={s.btnRow}>
          <button style={{ ...s.btn, ...s.btnConfirm }} onClick={() => act('confirm')} disabled={acting}>
            ✅ Confirm
          </button>
          <button style={{ ...s.btn, ...s.btnDismiss }} onClick={() => setDismissing(d => !d)} disabled={acting}>
            ❌ Dismiss
          </button>
          <button style={{ ...s.btn, ...s.btnResolve }} onClick={() => act('resolve')} disabled={acting}>
            ✔ Resolve
          </button>
        </div>
      )}

      {dismissing && (
        <div style={s.dismissBox}>
          <input
            style={s.dismissInput}
            placeholder="Reason for dismissal…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
          <button
            style={{ ...s.btn, ...s.btnDismiss, marginTop: 0 }}
            onClick={() => act('dismiss', reason)}
            disabled={!reason.trim() || acting}
          >
            Confirm dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  shell:        { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui,sans-serif', background: '#f8fafc' },
  sidebar:      { width: 220, background: '#1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 0' },
  sideTop:      {},
  brand:        { padding: '0 20px 24px', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -.5 },
  nav:          { padding: '0 12px' },
  navItem:      { padding: '10px 12px', borderRadius: 8, color: '#94a3b8', fontSize: 14, cursor: 'pointer' },
  navActive:    { background: '#334155', color: '#fff' },
  backBtn:      { margin: '0 16px', padding: '10px 0', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  main:         { flex: 1, padding: '28px 36px', overflowY: 'auto', maxWidth: 900 },
  toolbar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  toolbarTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b' },
  toolbarSub:   { fontSize: 13, color: '#64748b', marginTop: 2 },
  toolbarRight: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  select:       { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#1e293b', background: '#fff' },
  genBtn:       { padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  errorBanner:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  loading:      { color: '#64748b', padding: 20 },
  summaryCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  summaryLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  summaryText:  { fontSize: 15, color: '#334155', lineHeight: 1.7, margin: 0 },
  emptyState:   { textAlign: 'center', padding: '60px 20px', color: '#94a3b8' },
  section:      { marginBottom: 32 },
  sectionHeader:{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  badge:        { background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 },
  card:         { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.05)', transition: 'opacity .3s' },
  cardTop:      { marginBottom: 10 },
  typePill:     { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 },
  daysPill:     { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999 },
  cardDesc:     { fontSize: 14, color: '#334155', margin: '0 0 12px', lineHeight: 1.6 },
  actionBox:    { background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 14 },
  actionLabel:  { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 },
  actionText:   { fontSize: 13, color: '#334155', lineHeight: 1.5 },
  btnRow:       { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn:          { padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' },
  btnConfirm:   { background: '#dcfce7', color: '#16a34a' },
  btnDismiss:   { background: '#fee2e2', color: '#dc2626' },
  btnResolve:   { background: '#ede9fe', color: '#7c3aed' },
  dismissBox:   { marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  dismissInput: { flex: 1, minWidth: 200, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 },
}
