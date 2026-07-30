import { useState } from 'react'
import { api } from '../api'
import { Err, PageHeader, Panel, PanelGrid, RawJson, Spinner } from '../components'

export default function Tools() {
  // --- web fetch --------------------------------------------------------------
  const [url, setUrl] = useState('https://example.com')
  const [page, setPage] = useState(null)
  // --- speech -----------------------------------------------------------------
  const VOICES = [
    { voice: 'en-US-AvaMultilingualNeural', language: 'en-US', label: 'English (Ava)' },
    { voice: 'ro-RO-AlinaNeural', language: 'ro-RO', label: 'Romanian (Alina)' },
  ]
  const [text, setText] = useState('Your card was blocked after three failed PIN attempts.')
  const [voiceIdx, setVoiceIdx] = useState(0)
  const [audio, setAudio] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const selectedVoice = VOICES[voiceIdx]

  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)

  async function fetchPage() {
    setBusy('fetching'); setError(null)
    try { setPage(await api.webFetch({ url })) } catch (e) { setError(e.message); setPage(null) } finally { setBusy('') }
  }

  async function speak() {
    setBusy('synthesizing'); setError(null)
    try {
      const blob = await api.speak({ text, voice: selectedVoice.voice })
      setAudio({ url: URL.createObjectURL(blob), blob, size: blob.size })
    } catch (e) { setError(e.message); setAudio(null) } finally { setBusy('') }
  }

  async function transcribeGenerated() {
    if (!audio) return
    setBusy('transcribing'); setError(null)
    try {
      const file = new File([audio.blob], 'libra-assist.wav', { type: 'audio/wav' })
      setTranscript(await api.transcribe(file, selectedVoice.language))
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function transcribeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('transcribing'); setError(null)
    try { setTranscript(await api.transcribe(file, selectedVoice.language)) } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  return (
    <>
      <PageHeader title="Tools">
        The capabilities an agent can call — and what they cost to build yourself. Each of these
        is a separate service with its own endpoint and its own permissions.
      </PageHeader>

      <PanelGrid>
      <Panel title="Web fetch — the do-it-yourself lane">
        <p className="muted" style={{ marginTop: 0 }}>
          A plain scraper: fetch, parse, strip to text. Read the warnings — they are everything
          the naive approach could not handle, and the argument for managed grounding.
        </p>
        <div className="row">
          <div style={{ flex: 3 }}><label>URL</label>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && fetchPage()} /></div>
          <button className="btn btn-primary shrink" onClick={fetchPage} disabled={!!busy}>Fetch</button>
        </div>
        {page && (
          <div style={{ marginTop: '.9rem' }}>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
              <span className="badge muted">HTTP {page.status_code}</span>
              <span className="badge muted">{page.chars} chars</span>
              <span className="badge muted">~{page.approx_tokens} tokens</span>
              <span className="badge muted">signal {(page.stats.signal_ratio * 100).toFixed(1)}%</span>
              <span className="badge muted">{page.stats.script_tags} scripts</span>
              <span className={`badge ${page.warnings.length ? 'crimson' : 'gold'}`}>
                {page.warnings.length} warning{page.warnings.length === 1 ? '' : 's'}
              </span>
            </div>
            {page.warnings.length > 0 && (
              <ul className="muted" style={{ fontSize: '.85rem', marginTop: 0 }}>
                {page.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            <label>extracted text</label>
            <pre className="out" style={{ maxHeight: '16rem', overflowY: 'auto' }}>{page.text || '(nothing extracted)'}</pre>
            <RawJson data={page} />
          </div>
        )}
      </Panel>

      <Panel title="Speech — the voice loop, in two calls">
        <p className="muted" style={{ marginTop: 0 }}>
          Text becomes audio; that audio becomes text again. Needs an Azure Speech resource
          (its own key and region — a different service from the model).
        </p>
        <label>Text to speak</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 70 }} />
        <div className="row" style={{ marginTop: '.6rem' }}>
          <div className="shrink">
            <label>Voice / language</label>
            <select value={voiceIdx} onChange={(e) => setVoiceIdx(Number(e.target.value))} style={{ width: 'auto' }}>
              {VOICES.map((v, i) => <option key={v.voice} value={i}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <p className="faint" style={{ margin: '.4rem 0 0' }}>
          Transcription only reads back correctly if the language here matches what was actually spoken —
          Azure's speech-to-text needs to know which language model to apply.
        </p>
        <div className="row" style={{ marginTop: '.7rem' }}>
          <button className="btn btn-primary shrink" onClick={speak} disabled={!!busy}>Synthesize</button>
          <button className="btn btn-outline shrink" onClick={transcribeGenerated} disabled={!!busy || !audio}>
            Transcribe it back
          </button>
          <label className="btn btn-outline btn-sm shrink" style={{ textTransform: 'none', letterSpacing: 0, margin: 0 }}>
            or upload a WAV
            <input type="file" accept="audio/*" onChange={transcribeUpload} style={{ display: 'none' }} />
          </label>
        </div>
        {audio && (
          <div style={{ marginTop: '.8rem' }}>
            <audio controls src={audio.url} style={{ width: '100%' }} />
            <p className="faint" style={{ margin: '.3rem 0 0' }}>{(audio.size / 1024).toFixed(0)} KB of WAV</p>
          </div>
        )}
        {transcript && (
          <div style={{ marginTop: '.8rem' }}>
            <label>transcription</label>
            <pre className="out">{transcript.text}</pre>
            <p className="faint" style={{ margin: '.3rem 0 0' }}>
              status {transcript.status} · confidence {transcript.confidence ?? '—'} · {transcript.duration_seconds}s
            </p>
          </div>
        )}
      </Panel>
      </PanelGrid>

      {busy && <Spinner label={busy} />}
      <Err error={error} />
    </>
  )
}
