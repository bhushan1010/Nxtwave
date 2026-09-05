import { useState } from 'react'
import ManagerView from './ManagerView'
import EmployeeView from './EmployeeView'

export default function App() {
  const [role, setRole] = useState(null)
  if (role === 'manager')  return <ManagerView onBack={() => setRole(null)} />
  if (role === 'employee') return <EmployeeView onBack={() => setRole(null)} />
  return <RoleSelector onSelect={setRole} />
}

function RoleSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#5E6AD2] flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" viewBox="0 0 32 32" fill="none">
              <path d="M7 16.5L12 16.5L14.5 10L17.5 22L20 16.5L25 16.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-left">
            <div className="text-white font-semibold text-lg tracking-tight">AI Project Pulse</div>
            <div className="text-slate-400 text-xs">Team Intelligence Hub</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Who are you today?</h1>
        <p className="text-slate-400 text-sm mb-10">Select your role to continue</p>

        <div className="flex gap-4 justify-center flex-wrap">
          <RoleCard
            onClick={() => onSelect('employee')}
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="Employee"
            desc="Submit your daily standup and track your blockers"
            tag="Daily Hub"
          />
          <RoleCard
            onClick={() => onSelect('manager')}
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="Manager"
            desc="View today's digest and act on flagged risks"
            tag="Digest"
          />
        </div>
      </div>
    </div>
  )
}

function RoleCard({ onClick, icon, label, desc, tag }) {
  return (
    <button
      onClick={onClick}
      className="w-56 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-6 text-left transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-slate-700/60 group-hover:bg-indigo-500/20 border border-slate-600 group-hover:border-indigo-500/40 flex items-center justify-center mb-4 transition-colors">
        {icon}
      </div>
      <div className="text-sm font-semibold text-white mb-1">{label}</div>
      <div className="text-xs text-slate-400 leading-relaxed mb-3">{desc}</div>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">{tag}</span>
    </button>
  )
}
