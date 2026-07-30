import { useEffect, useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, RawJson, Spinner, StatGrid, StatTile } from '../components'

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
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }, [])

  const tiles = health ? [
    ['api', 'API', health.status, health.status === 'ok'],
    ['vector', 'Vector store', `${health.qdrant} · ${health.qdrant_url}`, health.qdrant === 'ok'],
    ['model', 'Chat model', `${health.llm.provider} · ${health.llm.model}`, true],
    ['embed', 'Embeddings', `${health.embeddings.provider} · ${health.embeddings.model}`, true],
    ['agent', 'Agent mode', `${health.agents?.mode} · default “${health.agents?.default_persona}”`, true],
    ['agent', 'Personas', (health.agents?.available || []).join(', ') || '—', true],
    ['api', 'Speech', health.speech?.configured ? `configured · ${health.speech.region}` : 'not configured', !!health.speech?.configured],
  ] : []

  return (
    <>
      <PageHeader title="Status">
        What this console is talking to. Every value here comes from the backend's own
        <code> /health</code> and <code>/config</code> endpoints.
      </PageHeader>

      <Panel title="Health" actions={<button className="btn btn-outline btn-sm" onClick={reload}>refresh</button>}>
        {health ? (
          <StatGrid>
            {tiles.map(([icon, k, v, ok]) => (
              <StatTile key={k} icon={<StatIcon name={icon} />} label={k} value={v} ok={ok} />
            ))}
          </StatGrid>
        ) : <p className="faint">Backend unreachable — is it running on port 7799?</p>}
      </Panel>

      <Panel title="Azure environment" actions={<>
        <button className="btn btn-outline btn-sm" onClick={reloadAzure}>refresh</button>
        {azure?.foundry_url && (
          <a className="btn btn-outline btn-sm" href={azure.foundry_url} target="_blank" rel="noreferrer">
            Foundry portal ↗
          </a>
        )}
        {azure?.portal_url && (
          <a className="btn btn-outline btn-sm" href={azure.portal_url} target="_blank" rel="noreferrer">
            Azure portal ↗
          </a>
        )}
      </>}>
        {!azure ? <p className="faint">Loading…</p> : !azure.configured ? (
          <p className="faint">No Azure endpoint configured — set <code>AZURE_AI_ENDPOINT</code> in <code>.env</code>.</p>
        ) : (
          <>
            <table>
              <tbody>
                {[
                  ['Resource', azure.resource],
                  ['Resource group', azure.resource_group],
                  ['Project', azure.project],
                  ['Region', azure.location],
                  ['Subscription', azure.subscription_id],
                  ['Authentication', azure.auth === 'identity' ? 'identity (Microsoft Entra)' : 'key'],
                  ['Chat deployment', azure.chat_deployment],
                  ['Embedding deployment', azure.embedding_deployment],
                  ['Inference endpoint', azure.inference_endpoint],
                  ['Project endpoint', azure.project_endpoint],
                  ['Azure OpenAI endpoint', azure.openai_endpoint],
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

            <label style={{ marginTop: '1rem' }}>model deployments</label>
            {azure.deployments.available ? (
              <table>
                <thead>
                  <tr><th>deployment</th><th>model</th><th>version</th><th>sku</th><th>TPM</th><th>state</th></tr>
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

      <Panel title="Configuration" actions={<span className="faint">(secrets masked by the API)</span>}>
        {busy && <Spinner label="loading" />}
        <Err error={error} />
        {config && (
          <div className="grid2">
            <div>
              <label>chunking</label>
              <pre className="out">{JSON.stringify(config.chunking, null, 2)}</pre>
              <label style={{ marginTop: '.7rem' }}>retrieval</label>
              <pre className="out">{JSON.stringify(config.retrieval, null, 2)}</pre>
            </div>
            <div>
              <label>generation</label>
              <pre className="out">{JSON.stringify(config.generation, null, 2)}</pre>
              <label style={{ marginTop: '.7rem' }}>providers</label>
              <pre className="out">{JSON.stringify(config.providers, null, 2)}</pre>
            </div>
          </div>
        )}
        <RawJson data={health} label="raw /health" />
      </Panel>
    </>
  )
}
