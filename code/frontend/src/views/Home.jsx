import { useEffect, useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, Spinner, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'
import { ownerKeyFor } from '../ownerKey'

const STAT_ICONS = {
  conversations: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  messages: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
}
function StatIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STAT_ICONS[name]}
    </svg>
  )
}

function fmtRelative(ms, t) {
  const diffMin = Math.round((Date.now() - ms) / 60000)
  if (diffMin < 1) return t('home.justNow')
  if (diffMin < 60) return t('home.minutesAgo', { n: diffMin })
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return t('home.hoursAgo', { n: diffH })
  const diffD = Math.round(diffH / 24)
  return t('home.daysAgo', { n: diffD })
}

// Auto-generated from App.jsx's VIEWS so this list can never drift out of
// sync with the real nav — every non-client screen except this one becomes
// a shortcut card here, for the console/admin view only.
const ADMIN_SHORTCUT_ICONS = {
  knowledge: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  agents: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /></>,
  tools: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /></>,
  status: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4H9" /></>,
  analytics: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  audit: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
}
function ShortcutIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ADMIN_SHORTCUT_ICONS[name]}
    </svg>
  )
}

export default function Home({ session, setView, clientMode }) {
  const { t } = useLanguage()
  const ownerKey = ownerKeyFor(session)
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    api.sessions.list(ownerKey).then(setSessions).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }, [ownerKey])

  const totalConversations = sessions?.length || 0
  const totalMessages = sessions?.reduce((sum, s) => sum + (s.messages?.length || 0), 0) || 0
  const last = sessions?.[0] || null   // /sessions is already newest-first

  return (
    <>
      <PageHeader title={t('home.welcome', { name: session?.name || '' })}>
        {t('home.description')}
      </PageHeader>

      {busy && <Spinner label={t('home.loading')} />}
      <Err error={error} />

      {!busy && (
        <>
          <StatGrid>
            <StatTile icon={<StatIcon name="conversations" />} label={t('home.tileConversations')} value={totalConversations} />
            <StatTile icon={<StatIcon name="messages" />} label={t('home.tileMessages')} value={totalMessages} />
            <StatTile icon={<StatIcon name="clock" />} label={t('home.tileLastActivity')}
                      value={last ? fmtRelative(last.updated_at, t) : t('home.never')} />
          </StatGrid>

          <div className="home-actions">
            <button className="card home-action-card" onClick={() => setView('chat')}>
              <h3>{last ? t('home.continueChat') : t('home.startChat')}</h3>
              <p className="faint">{last ? (last.title || t('home.untitledConversation')) : t('home.startChatHint')}</p>
            </button>
            <button className="card home-action-card" onClick={() => setView('calculator')}>
              <h3>{t('home.openCalculator')}</h3>
              <p className="faint">{t('home.openCalculatorHint')}</p>
            </button>
          </div>

          {!clientMode && (
            <Panel title={t('home.adminShortcuts')}>
              <div className="home-shortcut-grid">
                {Object.keys(ADMIN_SHORTCUT_ICONS).map((id) => (
                  <button key={id} className="btn btn-outline home-shortcut" onClick={() => setView(id)}>
                    <ShortcutIcon name={id} />
                    {t(`nav.${id}`)}
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  )
}
