import { useEffect, useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, Spinner, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'

const STAT_ICONS = {
  conversations: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  messages: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  tokensIn: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  tokensOut: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  cost: <><circle cx="12" cy="12" r="9" /><path d="M9.5 15c0 1.1 1.1 2 2.5 2s2.5-.9 2.5-2-1-1.7-2.5-2-2.5-.9-2.5-2 1.1-2 2.5-2 2.5.9 2.5 2" /></>,
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

function fmtCost(n) {
  if (!n) return '$0.00'
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

// A single-series bar chart: one metric (cost) across a handful of
// categories. One hue (the console's own accent) since there's only one
// series to identify — the category names are the labels, not a legend.
function BarChart({ rows, labelKey, format }) {
  const max = Math.max(...rows.map((r) => r.cost_usd), 0.000001)
  return (
    <div className="bar-chart">
      {rows.map((r) => (
        <div className="bar-chart-row" key={r[labelKey]}>
          <div className="bar-chart-label" title={r[labelKey]}>{format ? format(r[labelKey]) : r[labelKey]}</div>
          <div className="bar-chart-track" title={`${fmtCost(r.cost_usd)} · ${fmtInt(r.messages)} msg`}>
            <div className="bar-chart-fill" style={{ width: `${Math.max((r.cost_usd / max) * 100, r.cost_usd > 0 ? 2 : 0)}%` }} />
          </div>
          <div className="bar-chart-value">{fmtCost(r.cost_usd)}</div>
        </div>
      ))}
    </div>
  )
}

function shortDay(iso) {
  return iso.slice(5) // "2026-07-30" -> "07-30"
}

export default function Analytics() {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)

  function load() {
    setBusy(true)
    api.analyticsUsage().then(setData).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }
  useEffect(load, [])

  return (
    <>
      <PageHeader title={t('analytics.title')} actions={
        <button className="btn btn-outline btn-sm" onClick={load}>{t('analytics.refresh')}</button>
      }>
        {t('analytics.description')}
      </PageHeader>

      {busy && <Spinner label={t('analytics.loading')} />}
      <Err error={error} />

      {!busy && !error && data && data.total_messages === 0 && (
        <p className="faint">{t('analytics.empty')}</p>
      )}

      {data && data.total_messages > 0 && (
        <>
          <StatGrid>
            <StatTile icon={<StatIcon name="conversations" />} label={t('analytics.tileConversations')} value={fmtInt(data.total_conversations)} />
            <StatTile icon={<StatIcon name="messages" />} label={t('analytics.tileMessages')} value={fmtInt(data.total_messages)} />
            <StatTile icon={<StatIcon name="tokensIn" />} label={t('analytics.tilePromptTokens')} value={fmtInt(data.total_prompt_tokens)} />
            <StatTile icon={<StatIcon name="tokensOut" />} label={t('analytics.tileCompletionTokens')} value={fmtInt(data.total_completion_tokens)} />
            <StatTile icon={<StatIcon name="cost" />} label={t('analytics.tileCost')} value={fmtCost(data.total_estimated_cost_usd)} />
          </StatGrid>

          {data.messages_without_cost_estimate > 0 && (
            <p className="faint" style={{ marginTop: '-.4rem', marginBottom: '1rem' }}>
              {t('analytics.noCostNote', { n: data.messages_without_cost_estimate })}
            </p>
          )}

          <div className="grid2">
            <Panel title={t('analytics.byDay')}>
              <BarChart rows={data.by_day} labelKey="day" format={shortDay} />
            </Panel>
            <Panel title={t('analytics.byAgent')}>
              <BarChart rows={data.by_agent} labelKey="agent" />
            </Panel>
          </div>

          <Panel title={t('analytics.byModel')}>
            <table>
              <thead>
                <tr>
                  <th>{t('analytics.colModel')}</th>
                  <th>{t('analytics.colMessages')}</th>
                  <th>{t('analytics.colPromptTokens')}</th>
                  <th>{t('analytics.colCompletionTokens')}</th>
                  <th>{t('analytics.colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_model.map((row) => (
                  <tr key={row.model}>
                    <td className="mono">{row.model}</td>
                    <td className="mono">{fmtInt(row.messages)}</td>
                    <td className="mono">{fmtInt(row.prompt_tokens)}</td>
                    <td className="mono">{fmtInt(row.completion_tokens)}</td>
                    <td className="mono">{fmtCost(row.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={t('analytics.byOwner')}>
            <table>
              <thead>
                <tr>
                  <th>{t('analytics.colOwner')}</th>
                  <th>{t('analytics.colMessages')}</th>
                  <th>{t('analytics.colPromptTokens')}</th>
                  <th>{t('analytics.colCompletionTokens')}</th>
                  <th>{t('analytics.colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_owner.map((row) => (
                  <tr key={row.owner}>
                    <td className="mono">{row.owner}</td>
                    <td className="mono">{fmtInt(row.messages)}</td>
                    <td className="mono">{fmtInt(row.prompt_tokens)}</td>
                    <td className="mono">{fmtInt(row.completion_tokens)}</td>
                    <td className="mono">{fmtCost(row.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </>
  )
}
