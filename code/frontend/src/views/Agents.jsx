import { useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, RawJson, RUNS_ON, RunsOnBadge, Spinner, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'

const COUNT_ICON = <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4H9" /></>
function CountIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {COUNT_ICON}
    </svg>
  )
}

export default function Agents({ agents, hostedOnly = [], foundry, reload, azure }) {
  const { t } = useLanguage()
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const all = [...agents, ...hostedOnly]
  const counts = {
    local: all.filter((a) => a.runs_on === 'local').length,
    both: all.filter((a) => a.runs_on === 'both').length,
    foundry: all.filter((a) => a.runs_on === 'foundry').length,
  }

  async function act(name, fn, done) {
    setBusy(name); setError(null); setNotice(null)
    try { const r = await fn(); if (done) setNotice(done(r)); reload() }
    catch (e) { setError(e.message) } finally { setBusy(''); setConfirming(null) }
  }

  async function showPrompt(name) {
    setBusy(name); setError(null)
    try { setDetail(await api.agent(name)) }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <>
      <PageHeader title={t('agents.title')}>
        {t('agents.description')}
      </PageHeader>

      <StatGrid>
        <StatTile icon={<CountIcon />} label={t('agents.totalAgents')} value={all.length} />
        <StatTile icon={<CountIcon />} label={t('agents.localOnly')} value={counts.local} />
        <StatTile icon={<CountIcon />} label={t('agents.localAndFoundry')} value={counts.both} />
        <StatTile icon={<CountIcon />} label={t('agents.foundryOnly')} value={counts.foundry} />
      </StatGrid>

      <Panel actions={<>
        <button className="btn btn-outline btn-sm" onClick={reload}>{t('agents.refresh')}</button>
        {azure?.foundry_url && (
          <a className="btn btn-outline btn-sm" href={azure.foundry_url} target="_blank" rel="noreferrer">
            {t('agents.openFoundryPortal')}
          </a>
        )}
      </>}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.9rem' }}>
          {Object.keys(RUNS_ON).map((k) => (
            <span key={k} className="faint" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
              <span className={`badge ${RUNS_ON[k].tone}`}>{t(`runsOn.${k}`)}</span> {t(`runsOn.${k}Hint`)}
            </span>
          ))}
        </div>

        {foundry && !foundry.available && (
          <div className="err" style={{ marginBottom: '.9rem', borderLeftColor: 'var(--c-gold)',
                                        background: 'rgba(228,192,46,.10)' }}>
            <strong>{t('agents.hostedUnknown')}</strong> {foundry.reason}
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>{t('agents.colAgent')}</th><th style={{ width: '11rem' }}>{t('agents.colRunsOn')}</th>
              <th>{t('agents.colDescription')}</th><th style={{ width: '5rem' }}>{t('agents.colTemp')}</th>
              <th style={{ width: '16rem' }}>{t('agents.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((a) => (
              <tr key={a.name}>
                <td>
                  <strong>{a.display_name}</strong>
                  <div className="faint mono">{a.name}</div>
                  {a.hosted && <div className="faint mono" style={{ fontSize: '.68rem' }}>{a.hosted.agent_id}</div>}
                </td>
                <td>
                  <RunsOnBadge runsOn={a.runs_on} reason={foundry?.reason} />
                  {a.hosted?.model && <div className="faint mono" style={{ marginTop: '.3rem' }}>{a.hosted.model}</div>}
                </td>
                <td>
                  {a.description}
                  {a.style_rules?.length > 0 && (
                    <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }} className="faint">
                      {a.style_rules.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </td>
                <td className="mono">{a.temperature ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                    {a.runs_on !== 'foundry' && (
                      <button className="btn btn-outline btn-sm" disabled={!!busy}
                              title={t('agents.promptTitle')}
                              onClick={() => showPrompt(a.name)}>
                        {t('agents.prompt')}
                      </button>
                    )}
                    {a.runs_on !== 'foundry' && (
                      <button className="btn btn-outline btn-sm" disabled={!!busy}
                              title={a.runs_on === 'both' ? t('agents.updateInFoundryTitle') : t('agents.deployToFoundryTitle')}
                              onClick={() => act(a.name, () => api.deployAgent(a.name),
                                (r) => t('agents.deployedAction', { action: r.action, id: r.agent_id }))}>
                        {a.runs_on === 'both' ? t('agents.updateInFoundry') : t('agents.deployToFoundry')}
                      </button>
                    )}
                    {a.hosted && (
                      confirming === a.name ? (
                        <>
                          <button className="btn btn-sm" style={{ background: 'var(--grad-cta)', color: '#fff' }}
                                  disabled={!!busy}
                                  onClick={() => act(a.name, () => api.deleteHostedAgent(a.hosted.agent_id),
                                    () => t('agents.removedAction', { name: a.name }))}>
                            {t('agents.confirmDelete')}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => setConfirming(null)}>{t('agents.cancel')}</button>
                        </>
                      ) : (
                        <button className="btn btn-outline btn-sm" disabled={!!busy}
                                title={t('agents.removeFromFoundryTitle')}
                                onClick={() => setConfirming(a.name)}>
                          {t('agents.removeFromFoundry')}
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {busy && <div style={{ marginTop: '.7rem' }}><Spinner label={busy} /></div>}
        {notice && <div className="card" style={{ marginTop: '.8rem', padding: '.6rem .8rem' }}>
          <span className="badge">{t('agents.done')}</span> <span className="mono">{notice}</span>
        </div>}
        <Err error={error} />
      </Panel>

      {detail && (
        <Panel title={t('agents.promptPanelTitle', { name: detail.display_name })}>
          <p className="faint" style={{ marginTop: 0 }}>{detail.file}</p>
          <label style={{ marginTop: '.6rem' }}>{t('agents.grounded')}</label>
          <pre className="out">{detail.system_prompt_grounded}</pre>
          <label style={{ marginTop: '.8rem' }}>{t('agents.plain')}</label>
          <pre className="out">{detail.system_prompt_plain}</pre>
          <RawJson data={detail} label="persona JSON" />
        </Panel>
      )}
    </>
  )
}
