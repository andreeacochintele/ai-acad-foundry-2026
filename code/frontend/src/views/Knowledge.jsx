import { useEffect, useState } from 'react'
import { api } from '../api'
import { ChunkList, Err, PageHeader, Panel, PanelGrid, RawJson, Spinner } from '../components'
import { useLanguage } from '../i18n.jsx'

const SAMPLE = `Libra Bank issues debit and credit cards to retail customers. A card is blocked automatically after three failed PIN attempts, after the fraud engine flags a suspicious transaction, or at the customer's own request in the mobile application. A blocked card is unblocked in the branch after identity verification, or through the call centre using the phone banking password.

Mortgage loans require a down payment of at least fifteen percent for a first home. Early repayment is free of charge during the variable-rate period; during the fixed-rate period an early repayment fee of one percent applies.

Term deposits can be opened in RON, EUR or USD, with maturities from one month to two years. Breaking a deposit before maturity forfeits the accrued interest.`

export default function Knowledge() {
  const { t } = useLanguage()
  const [text, setText] = useState(SAMPLE)
  const [strategy, setStrategy] = useState('dynamic')
  const [size, setSize] = useState(400)
  const [overlap, setOverlap] = useState(80)
  const [sentences, setSentences] = useState(3)
  const [threshold, setThreshold] = useState(0.75)
  const [preview, setPreview] = useState(null)
  const [ingested, setIngested] = useState(null)
  const [collection, setCollection] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)

  const refresh = () => api.collection().then(setCollection).catch(() => setCollection(null))
  useEffect(() => { refresh() }, [])

  const payload = () => ({
    text, strategy,
    chunk_size: Number(size), chunk_overlap: Number(overlap),
    sentences_per_chunk: Number(sentences), semantic_threshold: Number(threshold),
  })

  async function run(kind) {
    setBusy(kind); setError(null)
    try {
      if (kind === 'chunk') { setPreview(await api.chunk(payload())); setIngested(null) }
      else { const r = await api.ingest({ ...payload(), source: 'console' }); setIngested(r); setPreview(null); refresh() }
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function reset() {
    setBusy('reset'); setError(null)
    try { await api.resetCollection(); setIngested(null); setPreview(null); refresh() }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <>
      <PageHeader title={t('knowledge.title')}>
        {t('knowledge.description')}
      </PageHeader>

      <Panel>
        <label>{t('knowledge.document')}</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 160 }} />

        <div className="row" style={{ marginTop: '.8rem' }}>
          <div>
            <label>{t('knowledge.strategy')}</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="static">{t('knowledge.strategyStatic')}</option>
              <option value="sentence">{t('knowledge.strategySentence')}</option>
              <option value="dynamic">{t('knowledge.strategyDynamic')}</option>
              <option value="semantic">{t('knowledge.strategySemantic')}</option>
            </select>
          </div>
          {(strategy === 'static' || strategy === 'dynamic') && (<>
            <div><label>{t('knowledge.chunkSize')}</label><input type="number" value={size} onChange={(e) => setSize(e.target.value)} /></div>
            <div><label>{t('knowledge.overlap')}</label><input type="number" value={overlap} onChange={(e) => setOverlap(e.target.value)} /></div>
          </>)}
          {strategy === 'sentence' && (
            <div><label>{t('knowledge.sentencesPerChunk')}</label><input type="number" value={sentences} onChange={(e) => setSentences(e.target.value)} /></div>
          )}
          {strategy === 'semantic' && (
            <div><label>{t('knowledge.similarityThreshold')}</label><input type="number" step="0.05" min="0.05" max="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          )}
        </div>

        <div className="row" style={{ marginTop: '.9rem' }}>
          <button className="btn btn-outline shrink" onClick={() => run('chunk')} disabled={!!busy}>{t('knowledge.previewChunks')}</button>
          <button className="btn btn-primary shrink" onClick={() => run('ingest')} disabled={!!busy}>{t('knowledge.chunkEmbedStore')}</button>
          <div className="shrink" style={{ alignSelf: 'center' }}>{busy && <Spinner label={busy} />}</div>
        </div>
        <Err error={error} />
      </Panel>

      <PanelGrid>
        {preview && (
          <Panel title={t('knowledge.chunksStrategy', { count: preview.count, strategy: preview.strategy })}
                 actions={<span className="faint">{t('knowledge.nothingStored')}</span>}>
            <ChunkList chunks={preview.chunks} />
            <RawJson data={preview} />
          </Panel>
        )}

        {ingested && (
          <Panel title={t('knowledge.storedChunks', { count: ingested.count })}>
            <p className="muted" style={{ marginTop: 0 }}>
              {t('knowledge.embeddedWith', {
                model: ingested.embedding_model.model, dim: ingested.vector_dimension,
              })}
            </p>
            <pre className="out">{JSON.stringify(ingested.embedding_preview)}</pre>
            <ChunkList chunks={ingested.chunks} />
            <RawJson data={ingested} />
          </Panel>
        )}

        <Panel title={t('knowledge.collection')}>
          {collection ? (
            <div className="row">
              <div><label>{t('knowledge.name')}</label><div className="mono">{collection.name}</div></div>
              <div><label>{t('knowledge.points')}</label><div className="mono">{collection.points_count}</div></div>
              <div><label>{t('knowledge.dimensions')}</label><div className="mono">{collection.vector_dimension ?? '—'}</div></div>
              <div><label>{t('knowledge.distance')}</label><div className="mono">{collection.distance ?? '—'}</div></div>
              <button className="btn btn-outline shrink" onClick={reset} disabled={!!busy}>{t('knowledge.resetCollection')}</button>
            </div>
          ) : <p className="faint">{t('knowledge.vectorStoreUnreachable')}</p>}
        </Panel>
      </PanelGrid>
    </>
  )
}
