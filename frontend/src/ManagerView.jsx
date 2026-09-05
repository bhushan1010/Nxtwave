import { useState, useEffect, useCallback } from 'react'
import { api } from './api'

const TODAY = new Date().toISOString().slice(0, 10)

const MANAGER_TABS = [
  { id: 'digest',   label: 'Manager Digest',    icon: '📊' },
  { id: 'standup',  label: 'Team Daily Standup', icon: '🎯' },
  { id: 'blockers', label: 'Blocker Registry',   icon: '⚠️' },
  { id: 'settings', label: 'Settings',           icon: '⚙️' },
]

export default function ManagerView({ onBack }) {
  const [projects, setProjects]      = useState([])
  const [projectId, setProjectId]    = useState('')
  const [date, setDate]              = useState(TODAY)
  const [digest, setDigest]          = useState(null)
  const [blockers, setBlockers]      = useState([])
  const [loading, setLoading]        = useState(false)
  const [genLoading, setGenLoading]  = useState(false)
  const [error, setError]            = useState(null)
  const [toast, setToast]            = useState(null)
  const [resolveModal, setResolveModal] = useState(null)
  const [activeTab, setActiveTab]    = useState('digest')
  const [archiveOpen, setArchiveOpen] = useState(true)

  useEffect(() => {
    api.getProjects().then(ps => {
      setProjects(ps)
      if (ps.length) setProjectId(String(ps[0].id))
    })
  }, [])

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
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [projectId, date])

  useEffect(() => { loadData() }, [loadData])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleGenerate = async () => {
    setGenLoading(true); setError(null)
    try {
      const d = await api.generateDigest(projectId, date)
      setDigest(d)
      await loadData()
      showToast('Digest generated successfully')
    } catch (e) { setError(e.message) }
    finally { setGenLoading(false) }
  }

  const handleAction = async (action, id, reason) => {
    try {
      if (action === 'confirm') { await api.confirmBlocker(id); showToast('Blocker confirmed as validated risk') }
      if (action === 'dismiss') { await api.dismissBlocker(id, reason); showToast('Blocker dismissed') }
      if (action === 'resolve') { await api.resolveBlocker(id); showToast('Blocker marked as resolved and archived') }
      await loadData()
    } catch (e) { setError(e.message) }
  }

  const flaggedRisks  = digest?.flagged_blockers || []
  const flaggedIds    = new Set(flaggedRisks.map(r => r.blocker_id))
  const allOpen       = blockers.filter(b => b.status === 'open' || b.status === 'confirmed')
  const otherBlockers = allOpen.filter(b => !flaggedIds.has(b.id))
  const resolvedBlockers = blockers.filter(b => b.status === 'resolved')

  const projectName = projects.find(p => String(p.id) === projectId)?.name || ''

  return (
    <div className="min-h-screen flex bg-[#F9FAFB] text-slate-800 antialiased font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-[#111927] text-slate-300 flex flex-col justify-between shrink-0 min-h-screen border-r border-slate-800 sticky top-0 h-screen">
        <div className="p-4">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <svg className="w-8 h-8 rounded-lg shadow-sm shrink-0" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#5E6AD2"/>
              <path d="M7 16.5L12 16.5L14.5 10L17.5 22L20 16.5L25 16.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"/>
            </svg>
            <div>
              <div className="font-semibold text-white tracking-tight text-base leading-tight">AI Project Pulse</div>
              <div className="text-xs text-slate-400">Team Intelligence</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1.5">
            {MANAGER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'blockers' && allOpen.length > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">{allOpen.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="px-2 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-xs font-medium text-slate-400 truncate">Workspace: Core Engineering</span>
          </div>
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-all"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
            Switch Role
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-7">

          {activeTab === 'standup'  && <StandupTab blockers={blockers} projectName={projectName} />}
          {activeTab === 'blockers' && <BlockerRegistryTab blockers={blockers} onAction={handleAction} onResolveClick={setResolveModal} />}
          {activeTab === 'settings' && <SettingsStub />}

          {/* ─── Digest Tab (default) ─── */}
          {activeTab === 'digest' && <>

          {/* Control Bar */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manager Digest</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">{projectName}</p>
            </div>
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Project */}
              <div className="relative">
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg pl-3 pr-8 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5E6AD2] cursor-pointer"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                </div>
              </div>
              {/* Date */}
              <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm text-slate-700 text-xs font-medium gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="border-0 p-0 text-xs font-medium focus:ring-0 text-slate-800 bg-transparent"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
              </div>
              {/* Generate */}
              <button
                onClick={handleGenerate}
                disabled={!projectId || genLoading}
                className="inline-flex items-center gap-1.5 bg-[#5E6AD2] hover:bg-[#4D58B8] text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#5E6AD2] focus:ring-offset-2 disabled:opacity-50"
              >
                <span>⚡</span>
                <span>{genLoading ? 'Generating…' : 'Generate Digest'}</span>
              </button>
            </div>
          </header>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">⚠️ {error}</div>
          )}

          {/* Summary Card */}
          {digest && (
            <section>
              <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3.5 text-xs font-bold text-slate-500 tracking-wider uppercase">
                  <svg className="w-4 h-4 text-[#5E6AD2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                  </svg>
                  Today's Summary
                </div>
                <p className="text-base text-slate-800 leading-relaxed" style={{lineHeight:'1.65'}}>
                  {(digest.summary_text || digest.summary)}
                </p>
              </div>
            </section>
          )}

          {!digest && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm font-semibold text-slate-700 mb-1">No digest for this date yet</div>
              <div className="text-xs text-slate-400">Click "Generate Digest" to create one from today's updates</div>
            </div>
          )}

          {/* Flagged Risks */}
          {flaggedRisks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🚨</span>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Flagged Risks</h2>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  {flaggedRisks.filter(r => {
                    const b = blockers.find(x => x.id === r.blocker_id)
                    return b && b.status !== 'dismissed' && b.status !== 'resolved'
                  }).length} escalated
                </span>
              </div>
              {flaggedRisks.map(risk => {
                const blocker = blockers.find(b => b.id === risk.blocker_id)
                return (
                  <FlaggedRiskCard
                    key={risk.blocker_id}
                    risk={risk}
                    blocker={blocker}
                    onAction={handleAction}
                    onResolveClick={() => setResolveModal({ risk, blocker })}
                  />
                )
              })}
            </section>
          )}

          {/* Other Open Blockers */}
          {otherBlockers.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Other Open Blockers</h2>
                  <span className="text-xs text-slate-400 font-medium">(recurring &lt; 2 days)</span>
                </div>
                <span className="text-xs font-medium text-slate-400">{otherBlockers.length} items</span>
              </div>
              <div className="space-y-2">
                {otherBlockers.map(b => (
                  <div key={b.id} className="bg-white hover:bg-slate-50/80 rounded-lg border border-slate-200 px-4 py-3 flex items-center justify-between gap-4 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"/>
                      <p className="text-xs text-slate-700 font-medium truncate">{b.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                        Day {b.days_recurring}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 capitalize">{b.type.replace(/_/g,' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Resolved Archive */}
          {resolvedBlockers.length > 0 && (
            <section className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setArchiveOpen(o => !o)}
                  className="group flex items-center gap-2.5 text-left focus:outline-none rounded-md py-1"
                >
                  <svg className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 shrink-0 ${archiveOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                  </svg>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 uppercase tracking-wider transition-colors">Resolved Blockers</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      {resolvedBlockers.length} resolved this week
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">Last 7 days</span>
                  <button onClick={() => setArchiveOpen(o => !o)} className="text-xs font-medium text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                    {archiveOpen ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {archiveOpen && (
                <div className="space-y-2">
                  {resolvedBlockers.map(b => (
                    <div key={b.id} className="group bg-white hover:bg-slate-50/70 rounded-xl border border-slate-200/80 p-4 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-xs shrink-0 font-bold">✓</span>
                          <h3 className="text-xs font-medium text-slate-600 line-through decoration-slate-300 truncate">{b.description}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 capitalize">{b.type.replace(/_/g,' ')}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            ✓ Resolved in {b.days_recurring} day{b.days_recurring > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="pl-7 flex items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 flex-wrap">
                        <span>Blocker #{b.id}</span>
                        <span>•</span>
                        <span>First seen {b.first_seen_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          </>}  {/* end activeTab === 'digest' */}

        </div>
      </main>

      {/* ── Resolve Modal ── */}
      {resolveModal && (
        <ResolveModal
          risk={resolveModal.risk}
          blocker={resolveModal.blocker}
          onConfirm={async (notes) => {
            setResolveModal(null)
            await handleAction('resolve', resolveModal.risk.blocker_id)
          }}
          onClose={() => setResolveModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-800 text-xs font-medium animate-fade-in">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

// ── Flagged Risk Card ────────────────────────────────────────────────────────

function FlaggedRiskCard({ risk, blocker, onAction, onResolveClick }) {
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason]         = useState('')
  const [acting, setActing]         = useState(false)

  const status   = blocker?.status || 'open'
  const actioned = ['dismissed', 'resolved'].includes(status)

  const typeLabel = {
    waiting_on_person:   'Waiting on person',
    waiting_on_decision: 'Waiting on decision',
    technical:           'Technical',
    other:               'Other',
  }

  const act = async (action, r) => {
    setActing(true)
    if (action === 'resolve') { onResolveClick(); setActing(false); return }
    await onAction(action, risk.blocker_id, r)
    setActing(false); setDismissing(false); setReason('')
  }

  const borderColor = actioned ? 'border-l-slate-300' : 'border-l-amber-500'

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor} border border-slate-200 p-5 shadow-sm space-y-4 transition-all ${actioned ? 'opacity-60' : ''}`}>
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
          {typeLabel[blocker?.type] || 'Unknown'}
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
          <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
          </svg>
          Day {risk.days_recurring}
        </span>
        {status === 'confirmed' && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">✓ Confirmed</span>
        )}
        {status === 'dismissed' && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Dismissed</span>
        )}
        {status === 'resolved' && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Resolved</span>
        )}
      </div>

      {/* Description */}
      <div className="text-sm font-medium text-slate-800">{risk.description}</div>

      {/* Suggested Action */}
      {risk.suggested_action && !actioned && (
        <div className="rounded-lg bg-amber-50/60 border border-amber-200/80 p-3.5 flex items-start gap-2.5">
          <span className="text-sm mt-0.5">💡</span>
          <div className="text-xs text-amber-950 leading-relaxed">
            <span className="font-bold tracking-wide uppercase text-[10px] text-amber-800 block mb-0.5">Suggested Action</span>
            {risk.suggested_action}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!actioned && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setDismissing(d => !d)}
            disabled={acting}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => act('confirm')}
            disabled={acting}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => act('resolve')}
            disabled={acting}
            className="px-3.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
          >
            Resolve
          </button>
        </div>
      )}

      {/* Dismiss inline input */}
      {dismissing && (
        <div className="flex gap-2 items-center pt-1 border-t border-slate-100 flex-wrap">
          <input
            className="flex-1 min-w-48 text-xs border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#5E6AD2] focus:border-[#5E6AD2]"
            placeholder="Reason for dismissal…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => act('dismiss', reason)}
            disabled={!reason.trim() || acting}
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-40"
          >
            Confirm dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ── Resolve Modal ─────────────────────────────────────────────────────────────

function ResolveModal({ risk, blocker, onConfirm, onClose }) {
  const [notes, setNotes] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Resolve Blocker</h3>
              <p className="text-xs text-slate-500 mt-0.5">Confirm resolution and update team visibility</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Blocker to resolve</div>
          <div className="text-xs font-semibold text-slate-900 leading-snug">{risk.description}</div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
              Day {risk.days_recurring} escalated
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Resolution notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows="3"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 border border-slate-300 rounded-lg p-2.5 focus:border-[#5E6AD2] focus:ring-2 focus:ring-[#5E6AD2]/20 outline-none resize-none transition-all"
            placeholder="e.g., Finance shared API keys on Slack #proj-alpha"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
            </svg>
            Confirm Resolution
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Standup Tab ──────────────────────────────────────────────────────────────

function StandupTab({ blockers, projectName }) {
  const [updates, setUpdates] = useState([])
  useEffect(() => {
    fetch('http://127.0.0.1:8000/updates/').then(r => r.json()).then(setUpdates).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Daily Standup</h1>
        <p className="text-sm text-slate-500 mt-0.5">{projectName} — all submitted updates</p>
      </div>
      {updates.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">📝</div>
          <div className="text-sm font-semibold text-slate-700">No updates yet</div>
          <div className="text-xs text-slate-400 mt-1">Updates submitted by team members will appear here</div>
        </div>
      )}
      <div className="space-y-3">
        {updates.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                  {u.user_id}
                </div>
                <span className="text-xs font-semibold text-slate-700 font-mono">User {u.user_id}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{u.date}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">"{u.raw_text}"</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Blocker Registry Tab ─────────────────────────────────────────────────────

function BlockerRegistryTab({ blockers, onAction, onResolveClick }) {
  const statusGroups = {
    open:      blockers.filter(b => b.status === 'open'),
    confirmed: blockers.filter(b => b.status === 'confirmed'),
    dismissed: blockers.filter(b => b.status === 'dismissed'),
    resolved:  blockers.filter(b => b.status === 'resolved'),
  }

  const statusStyle = {
    open:      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Open' },
    confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Confirmed' },
    dismissed: { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   label: 'Dismissed' },
    resolved:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Resolved' },
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blocker Registry</h1>
          <p className="text-sm text-slate-500 mt-0.5">All blockers across all statuses</p>
        </div>
        <div className="flex gap-3">
          {Object.entries(statusGroups).map(([status, list]) => list.length > 0 && (
            <div key={status} className={`text-center px-3 py-1.5 rounded-lg border ${statusStyle[status].bg} ${statusStyle[status].border}`}>
              <div className={`text-base font-bold ${statusStyle[status].text}`}>{list.length}</div>
              <div className="text-[10px] text-slate-500 capitalize">{status}</div>
            </div>
          ))}
        </div>
      </div>

      {blockers.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-sm font-semibold text-slate-700">No blockers registered</div>
        </div>
      )}

      <div className="space-y-2">
        {blockers.map(b => {
          const st = statusStyle[b.status] || statusStyle.open
          return (
            <div key={b.id} className="bg-white rounded-lg border border-slate-200 px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${b.status === 'resolved' || b.status === 'confirmed' ? 'bg-emerald-500' : b.status === 'dismissed' ? 'bg-slate-400' : 'bg-amber-500'}`}/>
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${b.status === 'dismissed' || b.status === 'resolved' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{b.description}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">First seen {b.first_seen_date} · ID #{b.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border font-mono ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 font-mono">Day {b.days_recurring}</span>
                {(b.status === 'open' || b.status === 'confirmed') && (
                  <div className="flex gap-1">
                    {b.status === 'open' && (
                      <button onClick={() => onAction('confirm', b.id)} className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors">Confirm</button>
                    )}
                    <button onClick={() => onResolveClick({ risk: { blocker_id: b.id, description: b.description, days_recurring: b.days_recurring }, blocker: b })} className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Settings Stub ────────────────────────────────────────────────────────────

function SettingsStub() {
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Project configuration and preferences</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-3">⚙️</div>
        <div className="text-sm font-semibold text-slate-700 mb-1">Settings panel</div>
        <div className="text-xs text-slate-400">Notification thresholds, integrations, and project config — coming soon</div>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 text-xs rounded-lg border border-slate-200 font-mono">
          MVP — not yet implemented
        </div>
      </div>
    </div>
  )
}
