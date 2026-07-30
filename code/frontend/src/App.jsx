import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Agents from './views/Agents'
import Chat from './views/Chat'
import Knowledge from './views/Knowledge'
import Search from './views/Search'
import Status from './views/Status'
import Tools from './views/Tools'

const VIEWS = [
  { id: 'chat', label: 'Chat', group: 'Assistant' },
  { id: 'knowledge', label: 'Knowledge', group: 'Pipeline' },
  { id: 'search', label: 'Retrieval', group: 'Pipeline' },
  { id: 'agents', label: 'Agents', group: 'Platform' },
  { id: 'tools', label: 'Tools', group: 'Platform' },
  { id: 'status', label: 'Status', group: 'Platform' },
]

// Minimal stroke icons (no external assets) — one per nav item, plus the brand mark.
const ICON_PATHS = {
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  knowledge: <>
    <path d="M2 4h5a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" />
    <path d="M22 4h-5a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
  </>,
  search: <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </>,
  agents: <>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M12 8V4H9" />
    <path d="M2 13h2" /><path d="M20 13h2" />
    <path d="M9 13v2" /><path d="M15 13v2" />
  </>,
  tools: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  status: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
}

function Icon({ name, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  )
}

export default function App() {
  const [view, setView] = useState('chat')
  const [agents, setAgents] = useState([])
  const [hostedOnly, setHostedOnly] = useState([])
  const [foundry, setFoundry] = useState(null)
  const [health, setHealth] = useState(null)
  const [azure, setAzure] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [menuOpen, setMenuOpen] = useState(true)

  const loadAgents = useCallback(() => {
    api.agents()
      .then((d) => { setAgents(d.personas || []); setHostedOnly(d.hosted_only || []); setFoundry(d.foundry) })
      .catch(() => { setAgents([]); setHostedOnly([]); setFoundry(null) })
  }, [])
  const loadHealth = useCallback(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])
  const loadAzure = useCallback(() => {
    api.azure().then(setAzure).catch(() => setAzure(null))
  }, [])

  useEffect(() => { loadAgents(); loadHealth(); loadAzure() }, [loadAgents, loadHealth, loadAzure])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const groups = [...new Set(VIEWS.map((v) => v.group))]
  const online = health?.status === 'ok'

  return (
    <div className="app">
      <div className="app-header">
      <header className="topbar">
        <div className="brand">
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}
                  title={menuOpen ? 'Hide menu' : 'Show menu'} aria-label="Toggle menu"
                  aria-expanded={menuOpen}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
            </svg>
          </button>
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5c.55 3.2 1.1 4.7 2.35 5.95S17.3 10.55 20.5 11.1c-3.2.55-4.7 1.1-5.95 2.35S12.55 16.3 12 19.5c-.55-3.2-1.1-4.7-2.35-5.95S6.7 12.45 3.5 11.9c3.2-.55 4.7-1.1 5.95-2.35S11.45 5.7 12 2.5z" />
            </svg>
          </span>
          <span className="brand-name">Libra Assist Credit Specialist</span>
          <span className="brand-tag">console</span>
        </div>

        <div className="topbar-right">
          <span className="conn-pill">
            <span className={`dot ${online ? '' : 'bad'}`} />
            {online ? `${health.llm.provider} · ${health.llm.model}` : 'backend offline'}
          </span>
          {azure?.configured && (
            <span className={`badge ${azure.auth === 'identity' ? '' : 'gold'}`} title={azure.auth === 'identity'
              ? 'Signed in with Microsoft Entra — the Agent Service and control plane are available'
              : 'Key authentication — the Agent Service and control plane cannot be queried'}>
              {azure.auth === 'identity' ? 'Entra identity' : 'key auth'}
            </span>
          )}
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'} aria-label="Toggle theme">
            ◐
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className="subnav">
          {groups.map((g) => (
            <div className="subnav-group" key={g}>
              {VIEWS.filter((v) => v.group === g).map((v) => (
                <button key={v.id} className={`nav-pill ${view === v.id ? 'active' : ''}`}
                        onClick={() => setView(v.id)} title={v.label}>
                  <Icon name={v.id} /><span>{v.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      )}
      </div>

      <main className="main">
        {view === 'chat' && <Chat agents={agents} hostedOnly={hostedOnly} foundry={foundry} />}
        {view === 'knowledge' && <Knowledge />}
        {view === 'search' && <Search />}
        {view === 'agents' && <Agents agents={agents} hostedOnly={hostedOnly} foundry={foundry}
                                      reload={loadAgents} azure={azure} />}
        {view === 'tools' && <Tools />}
        {view === 'status' && <Status health={health} reload={loadHealth}
                                      azure={azure} reloadAzure={loadAzure} />}
      </main>
    </div>
  )
}
