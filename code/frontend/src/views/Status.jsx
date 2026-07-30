import { useEffect, useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, RawJson, Spinner, StatGrid, StatTile } from '../components'
import { useLanguage } from '../i18n.jsx'

const STAT_ICONS = {
  api: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
  vector: <><path d="M2 4h5a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" /><path d="M22 4h-5a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" /></>,
  model: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4H9" /></>,
  embed: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  agent: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /></>,
}
function StatIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STAT_ICONS[name]}
    </svg>
  )
}

export default function Status({ health, reload, azure, reloadAzure }) {
  const { t } = useLanguage()
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }, [])

  const tiles = health ? [
    ['api', t('status.tileApi'), health.status, health.status === 'ok'],
    ['vector', t('status.tileVectorStore'), `${health.qdrant} · ${health.qdrant_url}`, health.qdrant === 'ok'],
    ['model', t('status.tileChatModel'), `${health.llm.provider} · ${health.llm.model}`, true],
    ['embed', t('status.tileEmbeddings'), `${health.embeddings.provider} · ${health.embeddings.model}`, true],
    ['agent', t('status.tileAgentMode'), `${health.agents?.mode} · ${t('status.defaultPersona', { name: health.agents?.default_persona })}`, true],
    ['agent', t('status.tilePersonas'), (health.agents?.available || []).join(', ') || '—', true],
    ['api', t('status.tileSpeech'), health.speech?.configured ? t('status.configuredAt', { region: health.speech.region }) : t('status.notConfigured'), !!health.speech?.configured],
  ] : []

  return (
    <>
      <PageHeader title={t('status.title')}>
        {t('status.description')}
      </PageHeader>

      <Panel title={t('status.health')} actions={<button className="btn btn-outline btn-sm" onClick={reload}>{t('status.refresh')}</button>}>
        {health ? (
          <StatGrid>
            {tiles.map(([icon, k, v, ok]) => (
              <StatTile key={k} icon={<StatIcon name={icon} />} label={k} value={v} ok={ok} />
            ))}
          </StatGrid>
        ) : <p className="faint">{t('status.backendUnreachable')}</p>}
      </Panel>

      <Panel title={t('status.azureEnvironment')} actions={<>
        <button className="btn btn-outline btn-sm" onClick={reloadAzure}>{t('status.refresh')}</button>
        {azure?.foundry_url && (
          <a className="btn btn-outline btn-sm" href={azure.foundry_url} target="_blank" rel="noreferrer">
            {t('status.foundryPortal')}
          </a>
        )}
        {azure?.portal_url && (
          <a className="btn btn-outline btn-sm" href={azure.portal_url} target="_blank" rel="noreferrer">
            {t('status.azurePortal')}
          </a>
        )}
      </>}>
        {!azure ? <p className="faint">{t('status.loading')}</p> : !azure.configured ? (
          <p className="faint">{t('status.noEndpointPrefix')} <code>AZURE_AI_ENDPOINT</code> {t('status.noEndpointSuffix')}</p>
        ) : (
          <>
            <table>
              <tbody>
                {[
                  [t('status.resource'), azure.resource],
                  [t('status.resourceGroup'), azure.resource_group],
                  [t('status.project'), azure.project],
                  [t('status.region'), azure.location],
                  [t('status.subscription'), azure.subscription_id],
                  [t('status.authentication'), azure.auth === 'identity' ? t('status.identityAuth') : t('status.keyAuth')],
                  [t('status.chatDeployment'), azure.chat_deployment],
                  [t('status.embeddingDeployment'), azure.embedding_deployment],
                  [t('status.inferenceEndpoint'), azure.inference_endpoint],
                  [t('status.projectEndpoint'), azure.project_endpoint],
                  [t('status.openaiEndpoint'), azure.openai_endpoint],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ width: '12rem' }} className="muted">{k}</td>
                    <td className="mono" style={{ wordBreak: 'break-all' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {azure.auth_note && (
              <div className="err" style={{ marginTop: '.8rem', borderLeftColor: 'var(--c-gold)',
                                            background: 'rgba(228,192,46,.10)' }}>
                {azure.auth_note}
              </div>
            )}

            <label style={{ marginTop: '1rem' }}>{t('status.modelDeployments')}</label>
            {azure.deployments.available ? (
              <table>
                <thead>
                  <tr><th>{t('status.colDeployment')}</th><th>{t('status.colModel')}</th><th>{t('status.colVersion')}</th><th>{t('status.colSku')}</th><th>{t('status.colTpm')}</th><th>{t('status.colState')}</th></tr>
                </thead>
                <tbody>
                  {azure.deployments.items.map((d) => (
                    <tr key={d.name}>
                      <td className="mono"><strong>{d.name}</strong></td>
                      <td className="mono">{d.model}</td>
                      <td className="faint mono">{d.version}</td>
                      <td className="mono">{d.sku}</td>
                      <td className="mono">{d.capacity}</td>
                      <td><span className="badge">{d.state}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="faint" style={{ marginTop: '.3rem' }}>{azure.deployments.reason}</p>
            )}
            <RawJson data={azure} label="raw /azure" />
          </>
        )}
      </Panel>

      <Panel title={t('status.configuration')} actions={<span className="faint">{t('status.secretsMasked')}</span>}>
        {busy && <Spinner label={t('status.loadingSpinner')} />}
        <Err error={error} />
        {config && (
          <div className="grid2">
            <div>
              <label>{t('status.chunking')}</label>
              <pre className="out">{JSON.stringify(config.chunking, null, 2)}</pre>
              <label style={{ marginTop: '.7rem' }}>{t('status.retrieval')}</label>
              <pre className="out">{JSON.stringify(config.retrieval, null, 2)}</pre>
            </div>
            <div>
              <label>{t('status.generation')}</label>
              <pre className="out">{JSON.stringify(config.generation, null, 2)}</pre>
              <label style={{ marginTop: '.7rem' }}>{t('status.providers')}</label>
              <pre className="out">{JSON.stringify(config.providers, null, 2)}</pre>
            </div>
          </div>
        )}
        <RawJson data={health} label="raw /health" />
      </Panel>
    </>
  )
}
