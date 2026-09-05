import { useState, useEffect } from 'react'
import { api } from './api'

const TODAY = new Date().toISOString().slice(0, 10)

export default function EmployeeView({ onBack }) {
  const [users, setUsers]         = useState([])
  const [userId, setUserId]       = useState('')
  const [text, setText]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]  = useState(false)
  const [error, setError]          = useState(null)
  const [history, setHistory]      = useState([])

  // Load employees only
  useEffect(() => {
    api.getUsers().then(all => {
      const employees = all.filter(u => u.role === 'employee')
      setUsers(employees)
      if (employees.length) setUserId(String(employees[0].id))
    })
  }, [])

  // Load recent updates when user changes
  useEffect(() => {
    if (!userId) return
    api.getUserUpdates(userId).then(rows => setHistory(rows.slice(0, 3)))
  }, [userId])

  const selectedUser = users.find(u => String(u.id) === userId)

  const handleSubmit = async () => {
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
      setText('')
      // Refresh history
      const rows = await api.getUserUpdates(userId)
      setHistory(rows.slice(0, 3))
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>✍️ Daily Standup</div>
            <div style={s.sub}>AI Project Pulse</div>
          </div>
          <button style={s.backBtn} onClick={onBack}>← Switch Role</button>
        </div>

        {/* User selector */}
        <div style={s.field}>
          <label style={s.label}>Who are you?</label>
          <select
            style={s.select}
            value={userId}
            onChange={e => { setUserId(e.target.value); setSubmitted(false) }}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {selectedUser && (
            <div style={s.projectTag}>
              📁 Project {selectedUser.project_id}
            </div>
          )}
        </div>

        {/* Single textarea */}
        <div style={s.field}>
          <label style={s.label}>
            What did you do, what's next, what's blocking you?
          </label>
          <textarea
            style={s.textarea}
            placeholder="Write naturally — e.g. 'Finished the login page. Moving on to payments next. Blocked waiting for finance to send API keys.'"
            value={text}
            onChange={e => { setText(e.target.value); setSubmitted(false) }}
            rows={5}
          />
          <div style={s.charCount}>{text.length} chars</div>
        </div>

        {/* Submit */}
        <button
          style={{ ...s.submitBtn, opacity: (!text.trim() || submitting) ? .5 : 1 }}
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
        >
          {submitting ? '⏳ Submitting…' : 'Submit Update'}
        </button>

        {/* Feedback */}
        {submitted && (
          <div style={s.successBanner}>
            ✅ Update submitted — your manager will see it in today's digest.
          </div>
        )}
        {error && <div style={s.errorBanner}>⚠️ {error}</div>}

        {/* Recent history */}
        {history.length > 0 && (
          <div style={s.history}>
            <div style={s.historyTitle}>Your last {history.length} update{history.length > 1 ? 's' : ''}</div>
            {history.map(u => (
              <div key={u.id} style={s.historyItem}>
                <div style={s.historyDate}>{u.date}</div>
                <div style={s.historyText}>{u.raw_text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page:         { minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'system-ui,sans-serif' },
  card:         { background: '#fff', borderRadius: 16, padding: '32px 36px', width: '100%', maxWidth: 560, boxShadow: '0 4px 24px rgba(0,0,0,.08)' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  logo:         { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  sub:          { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  backBtn:      { background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#64748b', cursor: 'pointer' },
  field:        { marginBottom: 20 },
  label:        { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 },
  select:       { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff' },
  projectTag:   { marginTop: 6, fontSize: 12, color: '#64748b' },
  textarea:     { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#1e293b', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' },
  charCount:    { fontSize: 11, color: '#cbd5e1', textAlign: 'right', marginTop: 4 },
  submitBtn:    { width: '100%', padding: '13px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'opacity .2s' },
  successBanner:{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '12px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 },
  errorBanner:  { marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 8, fontSize: 14 },
  history:      { marginTop: 28, borderTop: '1px solid #f1f5f9', paddingTop: 20 },
  historyTitle: { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 },
  historyItem:  { marginBottom: 14, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #e2e8f0' },
  historyDate:  { fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600 },
  historyText:  { fontSize: 13, color: '#475569', lineHeight: 1.6 },
}
