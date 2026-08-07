import { useEffect, useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, Spinner, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'

const STAT_ICONS = {
  users: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M17 3.13a4 4 0 0 1 0 7.75" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
  conversations: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  messages: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
}
function StatIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STAT_ICONS[name]}
    </svg>
  )
}

function fmtInt(n) {
  return (n || 0).toLocaleString()
}

// A compact stacked bar for grounded / risk / ungrounded — reads at a glance
// where a user's answers actually came from, without any of the text itself.
function GroundingBar({ row }) {
  const total = row.grounded + row.risk + row.ungrounded || 1
  return (
    <div className="grounding-bar" title={
      `${row.grounded_pct}% grounded · ${row.risk_pct}% nothing retrieved · ${row.ungrounded_pct}% RAG off`
    }>
      <span className="grounding-bar-seg grounded" style={{ width: `${(row.grounded / total) * 100}%` }} />
      <span className="grounding-bar-seg risk" style={{ width: `${(row.risk / total) * 100}%` }} />
      <span className="grounding-bar-seg ungrounded" style={{ width: `${(row.ungrounded / total) * 100}%` }} />
    </div>
  )
}

export default function Audit() {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)

  function load() {
    setBusy(true); setError(null)
    api.analyticsAudit().then(setData).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }
  useEffect(load, [])

  const rows = data?.by_owner || []
  const totals = rows.reduce((acc, r) => ({
    conversations: acc.conversations + r.conversations,
    messages: acc.messages + r.messages,
  }), { conversations: 0, messages: 0 })

  return (
    <>
      <PageHeader title={t('audit.title')} actions={
        <button className="btn btn-outline btn-sm" onClick={load}>{t('audit.refresh')}</button>
      }>
        {t('audit.description')}
      </PageHeader>

      {busy && <Spinner label={t('audit.loading')} />}
      <Err error={error} />

      {!busy && !error && rows.length === 0 && (
        <p className="faint">{t('audit.noConversations')}</p>
      )}

      {!busy && rows.length > 0 && (
        <>
          <StatGrid>
            <StatTile icon={<StatIcon name="users" />} label={t('audit.tileUsers')} value={rows.length} />
            <StatTile icon={<StatIcon name="conversations" />} label={t('audit.tileConversations')} value={fmtInt(totals.conversations)} />
            <StatTile icon={<StatIcon name="messages" />} label={t('audit.tileMessages')} value={fmtInt(totals.messages)} />
          </StatGrid>

          <Panel title={t('audit.byUser')}
                 actions={<span className="faint">{t('audit.confidentialityNote')}</span>}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('audit.colUser')}</th>
                    <th>{t('audit.colConversations')}</th>
                    <th>{t('audit.colMessages')}</th>
                    <th>{t('audit.colAvgLength')}</th>
                    <th style={{ minWidth: '10rem' }}>{t('audit.colGrounding')}</th>
                    <th>{t('audit.colAvgPassages')}</th>
                    <th>{t('audit.colFactCheck')}</th>
                    <th>{t('audit.colAvgTokens')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.owner}>
                      <td><strong>{r.owner}</strong></td>
                      <td className="mono">{fmtInt(r.conversations)}</td>
                      <td className="mono">{fmtInt(r.messages)}</td>
                      <td className="mono">{r.messages ? t('audit.charsValue', { n: r.avg_answer_chars }) : '—'}</td>
                      <td>
                        {r.messages ? (
                          <>
                            <GroundingBar row={r} />
                            <div className="faint" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                              {t('audit.groundingSummary', { grounded: r.grounded_pct, risk: r.risk_pct, ungrounded: r.ungrounded_pct })}
                            </div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="mono">{r.messages ? r.avg_retrieved : '—'}</td>
                      <td>
                        {r.fact_checked > 0
                          ? t('audit.factCheckSummary', { checked: r.fact_checked, supported: r.fact_supported, contradicted: r.fact_contradicted })
                          : <span className="faint">{t('audit.factCheckNone')}</span>}
                      </td>
                      <td className="mono">{r.messages ? fmtInt(r.avg_completion_tokens) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  )
}
