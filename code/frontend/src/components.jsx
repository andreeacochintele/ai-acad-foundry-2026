import { useState } from 'react'
import { useLanguage } from './i18n.jsx'

/** The brand mark: just the sparkle. */
export function BrandMark({ size = 21 }) {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d="M12 .8c.8 8.15 1.8 9.15 9.95 9.95-8.15.8-9.15 1.8-9.95 9.95-.8-8.15-1.8-9.15-9.95-9.95C10.2 9.95 11.2 8.95 12 .8z" />
      </svg>
    </span>
  )
}

/** Page title + description, with an optional right-aligned actions slot. */
export function PageHeader({ title, actions, children }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  )
}

/** Thin, consistent wrapper over .card — title + optional actions, then content. */
export function Panel({ title, actions, className = '', children }) {
  return (
    <div className={`card panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/** Responsive grid of Panels/cards — the dashboard layout primitive. */
export function PanelGrid({ children, className = '' }) {
  return <div className={`panel-grid ${className}`}>{children}</div>
}

/** One metric — icon, label, value, and an optional status dot. */
export function StatTile({ icon, label, value, ok, title }) {
  return (
    <div className="stat-tile" title={title}>
      <div className="stat-tile-icon">{icon}</div>
      <div className="stat-tile-body">
        <div className="stat-tile-label">
          {label}
          {ok !== undefined && <span className={`dot ${ok ? '' : 'bad'}`} />}
        </div>
        <div className="stat-tile-value">{value}</div>
      </div>
    </div>
  )
}

export function StatGrid({ children }) {
  return <div className="stat-grid">{children}</div>
}

export function Err({ error }) {
  const { t } = useLanguage()
  if (!error) return null
  return <div className="err" style={{ marginTop: '.8rem' }}><strong>{t('common.error')}</strong> {error}</div>
}

export function Spinner({ label }) {
  const { t } = useLanguage()
  return <span className="muted" style={{ fontSize: '.85rem' }}><span className="spin" /> {label || t('common.working')}…</span>
}

/** Collapsible raw JSON — the bridge between the GUI and what Swagger would show. */
export function RawJson({ data, label }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <div style={{ marginTop: '.8rem' }}>
      <button className="btn btn-outline btn-sm" onClick={() => setOpen(!open)}>
        {open ? t('common.hide') : t('common.show')} {label || t('common.rawResponse')}
      </button>
      {open && <pre className="out" style={{ marginTop: '.5rem' }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}

/** Where an agent can run — the four states, with the reason on hover. tone drives the
 * CSS class; label/hint are resolved via translation keys in RunsOnBadge, not stored here. */
export const RUNS_ON = {
  local:   { tone: 'muted' },
  both:    { tone: '' },
  foundry: { tone: 'gold' },
  unknown: { tone: 'muted' },
}

export function RunsOnBadge({ runsOn, reason }) {
  const { t } = useLanguage()
  const key = RUNS_ON[runsOn] ? runsOn : 'unknown'
  const tone = RUNS_ON[key].tone
  return <span className={`badge ${tone}`} title={key === 'unknown' && reason ? reason : t(`runsOn.${key}Hint`)}>{t(`runsOn.${key}`)}</span>
}

export function ChunkList({ chunks }) {
  if (!chunks?.length) return null
  return (
    <div>
      {chunks.map((c) => (
        <div className="chunk" key={c.index}>
          <div className="chunk-head">
            <span>chunk [{c.index}]</span>
            <span>{c.chars} chars · ~{c.approx_tokens} tokens</span>
          </div>
          {c.text}
        </div>
      ))}
    </div>
  )
}

export function Hits({ hits }) {
  if (!hits?.length) return <p className="faint">No hits.</p>
  return (
    <table>
      <thead>
        <tr><th style={{ width: '5.5rem' }}>score</th><th>chunk</th><th style={{ width: '7rem' }}>source</th></tr>
      </thead>
      <tbody>
        {hits.map((h) => (
          <tr key={h.id}>
            <td className="mono" style={{ color: 'var(--c-gold)' }}>{h.score.toFixed(4)}</td>
            <td>{h.text}</td>
            <td className="faint">{h.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
