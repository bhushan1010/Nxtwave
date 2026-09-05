// EmployeeView.jsx — stub for Stage 6
export default function EmployeeView({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✍️</div>
        <h2 style={{ color: '#1e293b', marginBottom: 8 }}>Employee Update Form</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Coming in Stage 6…</p>
        <button onClick={onBack} style={{ padding: '10px 24px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ← Back
        </button>
      </div>
    </div>
  )
}
