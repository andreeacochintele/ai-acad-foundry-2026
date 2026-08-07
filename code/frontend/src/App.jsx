import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { BrandMark } from './components'
import { useLanguage } from './i18n.jsx'
import Agents from './views/Agents'
import Analytics from './views/Analytics'
import Calculator from './views/Calculator'
import Chat from './views/Chat'
import Home from './views/Home'
import Knowledge from './views/Knowledge'
import Login from './views/Login'
import Search from './views/Search'
import Status from './views/Status'
import Tools from './views/Tools'

// label is a translation key, resolved with t() at render time so the nav
// relabels itself instantly when the language switches. clientVisible marks
// the screens a customer-facing "client" view is allowed to show — the rest
// (chunking internals, retrieval scores, agent management, raw tool calls,
// system health) are console/internal-only.
const VIEWS = [
  { id: 'chat', label: 'nav.chat', group: 'Assistant', clientVisible: true },
  { id: 'calculator', label: 'nav.calculator', group: 'Assistant', clientVisible: true },
  { id: 'knowledge', label: 'nav.knowledge', group: 'Pipeline' },
  { id: 'search', label: 'nav.search', group: 'Pipeline' },
  { id: 'agents', label: 'nav.agents', group: 'Platform' },
  { id: 'tools', label: 'nav.tools', group: 'Platform' },
  { id: 'status', label: 'nav.status', group: 'Platform' },
  { id: 'analytics', label: 'nav.analytics', group: 'Platform' },
]

const UI_MODE_KEY = 'libra-console-ui-mode'
const ACCENT_KEY = 'libra-console-accent'
const SESSION_KEY = 'libra-console-session'

// Each entry: `dark`/`darkLight` drive the accent gradient (theme-independent —
// the gradient always wants two saturated stops); `lightInk` is the deeper,
// higher-contrast tone used for --accent specifically on the light theme,
// mirroring how the original red accent already had --c-red (dark) vs
// --c-red-ink (light) as two different tones of the same hue.
const ACCENTS = {
  red:    { dark: '#e0342f', darkLight: '#ff5b52', lightInk: '#b3261e' },
  blue:   { dark: '#3b82f6', darkLight: '#60a5fa', lightInk: '#1d4ed8' },
  teal:   { dark: '#14b8a6', darkLight: '#5eead4', lightInk: '#0f766e' },
  purple: { dark: '#a855f7', darkLight: '#c084fc', lightInk: '#7e22ce' },
  green:  { dark: '#22c55e', darkLight: '#86efac', lightInk: '#15803d' },
  gold:   { dark: '#e4c02e', darkLight: '#f5df6e', lightInk: '#8a6d00' },
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Minimal stroke icons (no external assets) — one per nav item, plus the brand mark.
const ICON_PATHS = {
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  calculator: <>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M9 6h6" />
    <path d="M8 11h.01" /><path d="M12 11h.01" /><path d="M16 11h.01" />
    <path d="M8 15h.01" /><path d="M12 15h.01" /><path d="M16 15h.01" />
    <path d="M8 19h.01" /><path d="M12 19h.01" />
  </>,
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
  const { lang, setLang, t } = useLanguage()
  const [view, setView] = useState('home')
  const [agents, setAgents] = useState([])
  const [hostedOnly, setHostedOnly] = useState([])
  const [foundry, setFoundry] = useState(null)
  const [health, setHealth] = useState(null)
  const [azure, setAzure] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [menuOpen, setMenuOpen] = useState(true)
  const [uiMode, setUiMode] = useState(() => {
    try { return localStorage.getItem(UI_MODE_KEY) || 'console' } catch { return 'console' }
  })
  const isClient = uiMode === 'client'
  const [accentKey, setAccentKey] = useState(() => {
    try { return localStorage.getItem(ACCENT_KEY) || 'red' } catch { return 'red' }
  })
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })
  const isUserRole = session?.role === 'user'
  // A "user" role never sees the console — an admin can still flip between the
  // two, same as before.
  const effectiveIsClient = isUserRole || isClient

  function login(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
    setSession(s)
    setView('home')   // land on the dashboard, not wherever a previous session left off
    if (s.role === 'user') setUiMode('client')
  }
  function logout() {
    try { localStorage.removeItem(SESSION_KEY) } catch { /* storage unavailable */ }
    setSession(null)
  }

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
  // Auto-collapse the nav menu at roughly half a normal desktop screen, so the
  // logo never has to compete with a row of nav pills for space — the hamburger
  // still opens it manually at any width.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const apply = () => setMenuOpen(!mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  useEffect(() => {
    try { localStorage.setItem(UI_MODE_KEY, uiMode) } catch { /* storage unavailable */ }
  }, [uiMode])
  useEffect(() => {
    const a = ACCENTS[accentKey] || ACCENTS.red
    const root = document.documentElement.style
    const inkOrBright = theme === 'dark' ? a.dark : a.lightInk
    root.setProperty('--accent', inkOrBright)
    root.setProperty('--accent-soft', hexToRgba(inkOrBright, theme === 'dark' ? 0.15 : 0.11))
    root.setProperty('--grad-accent', `linear-gradient(135deg, ${a.dark} 0%, ${a.darkLight} 100%)`)
    try { localStorage.setItem(ACCENT_KEY, accentKey) } catch { /* storage unavailable */ }
  }, [accentKey, theme])

  const visibleViews = effectiveIsClient ? VIEWS.filter((v) => v.clientVisible) : VIEWS
  useEffect(() => {
    // 'home' isn't in VIEWS (it's reached from the brand title, not a nav pill)
    // but is always valid — every role can see it.
    if (view !== 'home' && !visibleViews.some((v) => v.id === view)) setView('home')
  }, [effectiveIsClient])   // eslint-disable-line react-hooks/exhaustive-deps

  const groups = [...new Set(visibleViews.map((v) => v.group))]
  const online = health?.status === 'ok'

  if (!session) return <Login onLogin={login} />

  return (
    <div className="app">
      <div className="app-header">
      <header className="topbar">
        <div className="brand">
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}
                  title={menuOpen ? t('topbar.hideMenu') : t('topbar.showMenu')} aria-label={t('topbar.toggleMenu')}
                  aria-expanded={menuOpen}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
            </svg>
          </button>
          <button type="button" className="brand-link" onClick={() => setView('home')}
                  title={t('nav.home')} aria-label={t('nav.home')}>
            <BrandMark size={28} />
            <span className="brand-name">Libra Assist Credit Specialist</span>
          </button>
          <span className="brand-tag">{t('topbar.consoleTag')}</span>
        </div>

        <div className="topbar-right">
          {!isUserRole && (
            <span className="conn-pill">
              <span className={`dot ${online ? '' : 'bad'}`} />
              {online ? `${health.llm.provider} · ${health.llm.model}` : t('topbar.backendOffline')}
            </span>
          )}
          {!isUserRole && azure?.configured && (
            <span className={`badge ${azure.auth === 'identity' ? '' : 'gold'}`} title={azure.auth === 'identity'
              ? t('topbar.entraTitle')
              : t('topbar.keyAuthTitle')}>
              {azure.auth === 'identity' ? t('topbar.entraIdentity') : t('topbar.keyAuth')}
            </span>
          )}
          {!isUserRole && (
            <button className="theme-toggle" onClick={() => setUiMode(isClient ? 'console' : 'client')}
                    title={t('topbar.modeToggleTitle')} aria-label={t('topbar.modeToggleTitle')}
                    style={{ width: 'auto', padding: '0 .6rem', borderRadius: 'var(--r-pill)' }}>
              {isClient ? t('topbar.modeClient') : t('topbar.modeConsole')}
            </button>
          )}
          <select value={accentKey} onChange={(e) => setAccentKey(e.target.value)}
                  title={t('topbar.accentColor')} aria-label={t('topbar.accentColor')}
                  style={{ width: 'auto', minWidth: 0, height: '34px', padding: '0 .6rem',
                           borderRadius: 'var(--r-pill)', background: 'var(--surface-2)',
                           border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '.8rem' }}>
            {Object.keys(ACCENTS).map((key) => <option key={key} value={key}>{t(`accent.${key}`)}</option>)}
          </select>
          <button className="theme-toggle" onClick={() => setLang(lang === 'en' ? 'ro' : 'en')}
                  title={t('topbar.language')} aria-label={t('topbar.language')}>
            {lang === 'en' ? 'RO' : 'EN'}
          </button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  title={theme === 'dark' ? t('topbar.switchToLight') : t('topbar.switchToDark')}
                  aria-label={t('topbar.toggleTheme')}>
            ◐
          </button>
          <span className="brand-tag" title={session.role}>{t('topbar.loggedInAs', { name: session.name })}</span>
          <button className="theme-toggle" onClick={logout}
                  title={t('topbar.logout')} aria-label={t('topbar.logout')}
                  style={{ width: 'auto', padding: '0 .6rem', borderRadius: 'var(--r-pill)' }}>
            {t('topbar.logout')}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className="subnav">
          {groups.map((g) => (
            <div className="subnav-group" key={g}>
              {visibleViews.filter((v) => v.group === g).map((v) => (
                <button key={v.id} className={`nav-pill ${view === v.id ? 'active' : ''}`}
                        onClick={() => setView(v.id)} title={t(v.label)}>
                  <Icon name={v.id} /><span>{t(v.label)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      )}
      </div>

      <main className="main">
        {view === 'home' && <Home session={session} setView={setView} clientMode={effectiveIsClient} />}
        {view === 'chat' && <Chat agents={agents} hostedOnly={hostedOnly} foundry={foundry} clientMode={effectiveIsClient} session={session} />}
        {view === 'calculator' && <Calculator />}
        {view === 'knowledge' && <Knowledge />}
        {view === 'search' && <Search />}
        {view === 'agents' && <Agents agents={agents} hostedOnly={hostedOnly} foundry={foundry}
                                      reload={loadAgents} azure={azure} session={session} />}
        {view === 'tools' && <Tools />}
        {view === 'status' && <Status health={health} reload={loadHealth}
                                      azure={azure} reloadAzure={loadAzure} />}
        {view === 'analytics' && <Analytics />}
      </main>
    </div>
  )
}
