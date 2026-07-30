import { useState } from 'react'
import { api } from '../api'
import { Err, Hits, PageHeader, Panel, RawJson, Spinner } from '../components'
import { useLanguage } from '../i18n.jsx'

export default function Search() {
  const { t } = useLanguage()
  const EXAMPLES = [t('search.example1'), t('search.example2'), t('search.example3'), t('search.example4')]
  const [query, setQuery] = useState(EXAMPLES[0])
  const [topK, setTopK] = useState(3)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(q = query) {
    setBusy(true); setError(null)
    try { setResult(await api.search({ query: q, top_k: Number(topK) })) }
    catch (e) { setError(e.message); setResult(null) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title={t('search.title')}>
        {t('search.description')}
      </PageHeader>

      <Panel>
        <div className="row">
          <div style={{ flex: 3 }}>
            <label>{t('search.query')}</label>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && run()} />
          </div>
          <div style={{ maxWidth: '6rem' }}><label>{t('search.topK')}</label>
            <input type="number" min="1" max="20" value={topK} onChange={(e) => setTopK(e.target.value)} /></div>
          <button className="btn btn-primary shrink" onClick={() => run()} disabled={busy}>{t('search.search')}</button>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
          {EXAMPLES.map((e) => (
            <button key={e} className="btn btn-outline btn-sm" onClick={() => { setQuery(e); run(e) }}>{e}</button>
          ))}
        </div>
        {busy && <div style={{ marginTop: '.7rem' }}><Spinner label={t('search.searching')} /></div>}
        <Err error={error} />
      </Panel>

      {result && (
        <Panel title={t('search.hitsFor', { count: result.hits.length, query: result.query })}>
          <p className="faint" style={{ marginTop: 0 }}>
            {t('search.embeddedWith', {
              model: result.embedding_model.model,
              preview: `[${result.query_embedding_preview.slice(0, 4).join(', ')}…]`,
            })}
          </p>
          <Hits hits={result.hits} />
          <RawJson data={result} />
        </Panel>
      )}
    </>
  )
}
