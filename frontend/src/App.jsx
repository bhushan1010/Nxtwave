import { useState } from 'react'
import ManagerView from './ManagerView'
import EmployeeView from './EmployeeView'
import './App.css'

export default function App() {
  const [role, setRole] = useState(null)

  if (!role) return <RoleSelector onSelect={setRole} />
  if (role === 'manager')  return <ManagerView onBack={() => setRole(null)} />
  if (role === 'employee') return <EmployeeView onBack={() => setRole(null)} />
}

function RoleSelector({ onSelect }) {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.logo}>⚡</div>
        <h1 style={styles.title}>AI Project Pulse</h1>
        <p style={styles.subtitle}>AI-native standup &amp; project health monitoring</p>
        <div style={styles.roleRow}>
          <RoleCard
            icon="📋"
            label="I'm a Manager"
            desc="View today's digest, flagged risks, and take action"
            color="#4f46e5"
            onClick={() => onSelect('manager')}
          />
          <RoleCard
            icon="✍️"
            label="I'm an Employee"
            desc="Submit your daily standup update"
            color="#0891b2"
            onClick={() => onSelect('employee')}
          />
        </div>
      </div>
    </div>
  )
}

function RoleCard({ icon, label, desc, color, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      style={{ ...styles.roleCard, borderColor: hover ? color : '#e2e8f0', transform: hover ? 'translateY(-4px)' : 'none' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ ...styles.roleLabel, color }}>{label}</div>
      <div style={styles.roleDesc}>{desc}</div>
    </button>
  )
}

const styles = {
  page:      { minHeight: '100vh', background: 'linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hero:      { textAlign: 'center', padding: '0 24px' },
  logo:      { fontSize: 56, marginBottom: 12 },
  title:     { fontSize: 36, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' },
  subtitle:  { fontSize: 16, color: '#64748b', margin: '0 0 48px' },
  roleRow:   { display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' },
  roleCard:  { background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: '32px 40px', cursor: 'pointer', width: 240, textAlign: 'center', transition: 'all .2s', boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  roleLabel: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  roleDesc:  { fontSize: 13, color: '#64748b', lineHeight: 1.5 },
}
