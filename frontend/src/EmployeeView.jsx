import { useState, useEffect, useCallback } from 'react'
import { api } from './api'

const TODAY = new Date().toISOString().slice(0, 10)
const AVATAR_COLORS = ['bg-amber-500', 'bg-indigo-500', 'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-rose-500']

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function EmployeeView({ onBack }) {
  const [users, setUsers]           = useState([])
  const [projects, setProjects]     = useState([])
  const [userId, setUserId]         = useState('')
  const [text, setText]             = useState('')
  const [charCount, setCharCount]   = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)
  const [history, setHistory]       = useState([])
  const [myBlockers, setMyBlockers] = useState([])
  const [teamUpdates, setTeamUpdates] = useState([])
  const [activeTab, setActiveTab]   = useState('standup')

  useEffect(() => {
    Promise.all([api.getUsers(), api.getProjects()]).then(([us, ps]) => {
      setProjects(ps)
      const employees = us.filter(u => u.role === 'employee')
      setUsers(employees)
      if (employees.length) setUserId(String(employees[0].id))
    })
  }, [])

  const loadUserData = useCallback(async () => {
    if (!userId) return
    const selectedUser = users.find(u => String(u.id) === userId)
    if (!selectedUser) return
    const [hist, blks, teamUp] = await Promise.all([
      api.getUserUpdates(userId),
      api.getBlockers(selectedUser.project_id),
      api.getBlockers(selectedUser.project_id),
    ])
    setHistory(hist.slice(0, 3))
    setMyBlockers(blks.filter(b => b.status === 'open' || b.status === 'confirmed'))
    // Get project updates for team pulse (all recent)
    try {
      const updates = await api.getAllUpdates(selectedUser.project_id)
      setTeamUpdates(updates.slice(0, 5))
    } catch {}
  }, [userId, users])

  useEffect(() => { loadUserData() }, [loadUserData])

  const selectedUser    = users.find(u => String(u.id) === userId)
  const selectedProject = projects.find(p => p.id === selectedUser?.project_id)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!text.trim() || !userId) return
    setSubmitting(true); setError(null)
    try {
      await api.submitUpdate({
        user_id:    Number(userId),
        project_id: selectedUser.project_id,
        date:       TODAY,
        raw_text:   text.trim(),
      })
      setSubmitted(true)
      setText(''); setCharCount(0)
      await loadUserData()
      // Auto-dismiss toast
      setTimeout(() => setSubmitted(false), 4000)
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    setCharCount(e.target.value.length)
    setSubmitted(false)
  }

  const escalatedBlockers = myBlockers.filter(b => b.days_recurring >= 2)

  return (
    <div className="min-h-screen flex bg-[#0F172A] text-slate-800 antialiased font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-[#0B1120] text-slate-300 flex flex-col justify-between border-r border-slate-800 shrink-0 h-screen sticky top-0">
        <div>
          {/* Brand */}
          <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 32 32" fill="none">
                <path d="M7 16.5L12 16.5L14.5 10L17.5 22L20 16.5L25 16.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                AI Project Pulse
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Team</span>
              </div>
              <div className="text-[11px] text-slate-400">Team Intelligence Hub</div>
            </div>
          </div>

          {/* Nav */}
          <div className="px-3 py-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Employee Workspace</div>

            {/* Daily Standup & Hub */}
            <button onClick={() => setActiveTab('standup')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${activeTab === 'standup' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>Daily Standup & Hub</span>
            </button>

            {/* My Tracked Blockers */}
            <button onClick={() => setActiveTab('blockers')} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${activeTab === 'blockers' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span>My Tracked Blockers</span>
              </div>
              {escalatedBlockers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">{escalatedBlockers.length}</span>
              )}
            </button>

            {/* Team Pulse Stream */}
            <button onClick={() => setActiveTab('pulse')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${activeTab === 'pulse' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>Team Pulse Stream</span>
            </button>

            {/* Weekly Sprint Digest */}
            <button onClick={() => setActiveTab('sprint')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${activeTab === 'sprint' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <span>Weekly Sprint Digest</span>
            </button>
          </div>

          <div className="px-5 py-3 border-t border-slate-800/80 mt-4">
            <div className="text-[11px] text-slate-500 mb-2">Management Sync</div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                Linear Sync Active
              </span>
              <span className="font-mono text-[10px] text-slate-500">v1.2</span>
            </div>
          </div>
        </div>

        {/* User footer */}
        <div className="p-4 border-t border-slate-800 bg-[#090E1A]">
          {selectedUser && (
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[(Number(userId) - 1) % AVATAR_COLORS.length]} text-white font-semibold text-xs flex items-center justify-center shrink-0 border border-white/10`}>
                {initials(selectedUser.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{selectedUser.name}</div>
                <div className="text-[11px] text-slate-400 truncate">Proj {selectedUser.project_id}</div>
              </div>
            </div>
          )}
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Switch Role
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 bg-[#F9FAFB] min-h-screen overflow-y-auto">
        {/* Top App Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-8 py-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Employee Hub</h1>
              {selectedProject && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {selectedProject.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Submit standup, track blockers raised to leads, and see team pulse</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span className="font-medium text-slate-700">Today, {new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
            </div>
            <button
              onClick={() => document.getElementById('standup-textarea')?.focus()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5E6AD2] hover:bg-[#4D58B8] text-white rounded-md text-xs font-medium transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Post Quick Update
            </button>
          </div>
        </header>

        <div className="px-8 py-6 max-w-7xl mx-auto space-y-6">

          {/* ── Tab: My Tracked Blockers ── */}
          {activeTab === 'blockers' && (
            <EmpBlockersTab blockers={myBlockers} />
          )}

          {/* ── Tab: Team Pulse Stream ── */}
          {activeTab === 'pulse' && (
            <EmpPulseTab teamUpdates={teamUpdates} users={users} selectedProject={selectedProject} />
          )}

          {/* ── Tab: Weekly Sprint Digest ── */}
          {activeTab === 'sprint' && (
            <EmpSprintTab history={history} myBlockers={myBlockers} selectedUser={selectedUser} />
          )}

          {/* ── Tab: Daily Standup & Hub (default) ── */}
          {activeTab === 'standup' && <>

          {/* Active Blocker Banner */}
          {escalatedBlockers.length > 0 && (
            <section className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-sm bg-gradient-to-r from-amber-50/40 via-white to-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900">Active Blocker Follow-Up</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Day {escalatedBlockers[0].days_recurring} Escalated
                      </span>
                      {escalatedBlockers[0].status === 'confirmed' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          Lead Acknowledged & Actioned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1 font-medium">"{escalatedBlockers[0].description}"</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: Standup + Blockers + History */}
            <div className="lg:col-span-7 space-y-6">

              {/* Standup Form */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">✍️</span>
                    <div>
                      <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Today's Standup</h2>
                      <p className="text-[11px] text-slate-500">Auto-categorized by AI Project Pulse for manager digest</p>
                    </div>
                  </div>
                  {history.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono">Last: {history[0]?.date}</span>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* Selectors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Acting As</label>
                      <select
                        value={userId}
                        onChange={e => { setUserId(e.target.value); setSubmitted(false) }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Target Project</label>
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 flex items-center gap-1.5">
                        <span>📁</span>
                        <span className="truncate">{selectedProject?.name || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-800">
                        What did you do, what's next, what's blocking you?
                      </label>
                      <span className="text-[11px] font-mono text-slate-400">{charCount} chars</span>
                    </div>
                    <textarea
                      id="standup-textarea"
                      rows="4"
                      value={text}
                      onChange={handleTextChange}
                      placeholder="Write naturally — e.g. 'Finished deep link router. Tomorrow tackling Stripe modal. Blocked on staging CI intermittent failure.'"
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 leading-relaxed"
                    />
                  </div>

                  {/* AI Preview */}
                  {submitted && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-900 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        AI Pulse Preview Extraction
                        <span className="ml-auto text-[10px] text-indigo-500 font-mono">Will roll into {TODAY} Manager Digest</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                          <span className="text-slate-500">Parsed and saved to digest queue</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">⚠️ {error}</div>}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div/>
                    <div className="flex items-center gap-2">
                      <button type="button" className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
                        Save Draft
                      </button>
                      <button
                        type="submit"
                        disabled={!text.trim() || submitting}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#5E6AD2] hover:bg-[#4D58B8] text-white transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>{submitting ? 'Submitting…' : 'Submit Daily Update'}</span>
                        {!submitting && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* My Blockers */}
              {myBlockers.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Blockers Raised By Me ({myBlockers.length})</h2>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"/>
                      Lead view in sync
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {myBlockers.map(b => (
                      <div key={b.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                                {b.type.replace(/_/g,' ')}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100">Day {b.days_recurring}</span>
                              {b.status === 'confirmed' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Confirmed in Digest</span>
                              )}
                              {b.escalated && b.status === 'open' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">Escalated</span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-800">{b.description}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>First seen: <strong className="text-slate-600 font-medium">{b.first_seen_date}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent History */}
              {history.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Your Recent Standup Submissions</h2>
                    <span className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">Export Logs</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {history.map(u => (
                      <div key={u.id} className="p-3.5 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-mono font-medium text-slate-400">{u.date}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">Synced</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{u.raw_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Team Pulse + Sprint Stats */}
            <div className="lg:col-span-5 space-y-6">

              {/* Team Pulse */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                      <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Teammate Pulse (Today)</h2>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{selectedProject?.name} peer updates in real-time</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    {teamUpdates.length} of {users.filter(u => u.project_id === selectedUser?.project_id).length} Submitted
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {teamUpdates.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">No updates yet today</div>
                  )}
                  {teamUpdates.map((u, i) => {
                    const member = users.find(x => x.id === u.user_id) || { name: `User ${u.user_id}` }
                    const avatarColor = AVATAR_COLORS[(u.user_id - 1) % AVATAR_COLORS.length]
                    return (
                      <div key={u.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${avatarColor} text-white text-[10px] font-semibold flex items-center justify-center`}>
                              {initials(member.name)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-800">{member.name}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{u.date}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed pl-8 line-clamp-3">"{u.raw_text}"</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Sprint Stats */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Sprint Retrospective Pulse</h2>
                  <span className="text-[10px] font-mono text-slate-400">This week</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-sm font-bold text-slate-900">{history.length}/5</div>
                    <div className="text-[10px] text-slate-400">Days Submitted</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-sm font-bold text-emerald-600">{myBlockers.filter(b => b.status === 'resolved').length}</div>
                    <div className="text-[10px] text-slate-400">Blockers Cleared</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="text-sm font-bold text-indigo-600">{myBlockers.length}</div>
                    <div className="text-[10px] text-slate-400">Active Blockers</div>
                  </div>
                </div>
                {escalatedBlockers.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs">
                    <div className="font-medium text-slate-800 mb-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      AI Weekly Synthesis for {selectedUser?.name?.split(' ')[0]}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      You have {myBlockers.length} active blocker{myBlockers.length > 1 ? 's' : ''} this sprint.
                      {escalatedBlockers.length > 0 && ` The finance API keys blocker has been escalated to management and is now Day ${escalatedBlockers[0].days_recurring}.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          </>}  {/* end activeTab === 'standup' */}

        </div>
      </main>

      {/* Success toast */}
      {submitted && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          <span>Daily standup update posted and synced!</span>
        </div>
      )}
    </div>
  )
}

// ── Employee Tab: My Tracked Blockers ────────────────────────────────────────

function EmpBlockersTab({ blockers }) {
  const statusStyle = {
    open:      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Open' },
    confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Confirmed' },
    dismissed: { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   label: 'Dismissed' },
    resolved:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Resolved' },
  }
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">My Tracked Blockers</h1>
        <p className="text-sm text-slate-500 mt-0.5">Blockers you've raised — tracked until resolved</p>
      </div>
      {blockers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-sm font-semibold text-slate-700">No active blockers</div>
          <div className="text-xs text-slate-400 mt-1">You're unblocked — keep shipping!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {blockers.map(b => {
            const st = statusStyle[b.status] || statusStyle.open
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100">Day {b.days_recurring}</span>
                      {b.days_recurring >= 2 && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">Escalated</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800">{b.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span>First seen: <span className="text-slate-600 font-medium">{b.first_seen_date}</span></span>
                  <span>•</span>
                  <span>Type: <span className="text-slate-600 font-medium capitalize">{b.type?.replace(/_/g,' ')}</span></span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Employee Tab: Team Pulse Stream ─────────────────────────────────────────

function EmpPulseTab({ teamUpdates, users, selectedProject }) {
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Team Pulse Stream</h1>
          <p className="text-sm text-slate-500 mt-0.5">{selectedProject?.name} — what your teammates are working on</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
          {teamUpdates.length} updates today
        </span>
      </div>
      {teamUpdates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-3">👀</div>
          <div className="text-sm font-semibold text-slate-700">No teammate updates yet</div>
        </div>
      ) : (
        <div className="space-y-3">
          {teamUpdates.map((u, i) => {
            const member = users.find(x => x.id === u.user_id) || { name: `User ${u.user_id}` }
            const colors = ['bg-amber-500','bg-indigo-500','bg-blue-600','bg-purple-600','bg-emerald-600','bg-rose-500']
            const avatarColor = colors[(u.user_id - 1) % colors.length]
            const inits = member.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
            return (
              <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${avatarColor} text-white text-xs font-semibold flex items-center justify-center`}>{inits}</div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{member.name}</div>
                      <div className="text-[10px] text-slate-400">{member.role}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{u.date}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed pl-10">"{u.raw_text}"</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Employee Tab: Weekly Sprint Digest ───────────────────────────────────────

function EmpSprintTab({ history, myBlockers, selectedUser }) {
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Weekly Sprint Digest</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your contribution summary this sprint</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: `${history.length}/5`, label: 'Days Submitted', color: 'text-slate-900' },
          { value: myBlockers.filter(b=>b.status==='resolved').length, label: 'Blockers Cleared', color: 'text-emerald-600' },
          { value: myBlockers.length, label: 'Active Blockers', color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
            <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Your Recent Submissions</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.length === 0 && <div className="p-6 text-center text-xs text-slate-400">No submissions yet this sprint</div>}
          {history.map(u => (
            <div key={u.id} className="p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-slate-400">{u.date}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">Synced</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{u.raw_text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-indigo-900">
          <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          AI Weekly Synthesis for {selectedUser?.name?.split(' ')[0]}
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {history.length === 0
            ? 'No standup submissions recorded yet this sprint.'
            : `You've submitted ${history.length} standup${history.length > 1 ? 's' : ''} this sprint with ${myBlockers.length} active blocker${myBlockers.length !== 1 ? 's' : ''}. ${myBlockers.filter(b=>b.days_recurring>=2).length > 0 ? 'Escalated blockers have been flagged to management.' : 'No escalated blockers — great momentum!'}`
          }
        </p>
      </div>
    </div>
  )
}
