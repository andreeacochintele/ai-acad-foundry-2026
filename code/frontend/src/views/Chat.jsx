import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Err, RunsOnBadge } from '../components'
import { useLanguage } from '../i18n.jsx'
import { ownerKeyFor } from '../ownerKey'

// The wire shape is snake_case (matching the rest of the API, e.g. use_rag on
// /ask) — these two functions are the only place that boundary is crossed.
function toWire(c, ownerKey) {
  return {
    id: c.id, title: c.title, agent: c.agent, use_rag: c.useRag, mode: c.mode,
    messages: c.messages, created_at: c.createdAt, owner: ownerKey,
  }
}

const DEFAULT_AGENT = 'andreea-cochintele-credit-specialist'

function fromWire(r) {
  return {
    id: r.id, title: r.title || '', createdAt: r.created_at, updatedAt: r.updated_at,
    messages: r.messages || [], agent: r.agent || DEFAULT_AGENT,
    useRag: r.use_rag !== false, mode: r.mode || 'foundry',
  }
}

function makeConversation(overrides = {}) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    agent: DEFAULT_AGENT,
    useRag: true,
    mode: 'foundry',
    ...overrides,
  }
}

// Mirrors conversations into localStorage on every change, synchronously, with no
// network involved — so what you just typed survives a refresh or a flaky backend
// even before (or if) the /sessions POST round-trip lands. Keyed per owner (see
// ownerKeyFor) so a user login and an admin login don't share a local cache either.
function localKey(ownerKey) {
  return `libra-chat-local-sessions:${ownerKey}`
}

function loadLocal(ownerKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(localKey(ownerKey)))
    if (Array.isArray(parsed?.conversations) && parsed.conversations.length) return parsed
  } catch { /* unavailable or corrupted — start fresh */ }
  return null
}

function groupLabel(ts, t) {
  const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000)
  if (diffDays <= 0) return t('chat.group.today')
  if (diffDays === 1) return t('chat.group.yesterday')
  return t('chat.group.older')
}

export default function Chat({ agents, hostedOnly = [], foundry, clientMode = false, session = null }) {
  const { t } = useLanguage()
  const ownerKey = ownerKeyFor(session)
  const [conversations, setConversations] = useState(() => loadLocal(ownerKey)?.conversations || [makeConversation()])
  const [activeId, setActiveId] = useState(() => loadLocal(ownerKey)?.activeId || conversations[0].id)
  const [question, setQuestion] = useState('')
  const [factCheck, setFactCheck] = useState(false)
  const [topK, setTopK] = useState(3)
  const [temperature, setTemperature] = useState(0.2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [speakingIdx, setSpeakingIdx] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [micState, setMicState] = useState('idle')   // idle | recording | transcribing
  const [micLang, setMicLang] = useState('ro-RO')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const endRef = useRef(null)
  const audioRef = useRef(null)
  const settingsRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => () => audioRef.current?.pause(), [])
  useEffect(() => () => recorderRef.current?.stream?.getTracks().forEach((tr) => tr.stop()), [])

  useEffect(() => {
    if (!settingsOpen) return
    function onClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [settingsOpen])

  function pickMicMimeType() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || ''
  }

  function encodeWav(pcm16, sampleRate) {
    const dataSize = pcm16.length * 2
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE')
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    writeStr(36, 'data'); view.setUint32(40, dataSize, true)
    let offset = 44
    for (let i = 0; i < pcm16.length; i++, offset += 2) view.setInt16(offset, pcm16[i], true)
    return buffer
  }

  // Chromium writes MediaRecorder's webm/opus output with an unresolved ("unknown")
  // duration in its container header — a long-standing browser quirk. Azure's speech
  // endpoint apparently trusts that header rather than the actual encoded audio, so it
  // truncates recognition to a near-zero clip regardless of how long you actually spoke.
  // Decoding via Web Audio and re-rendering to a fixed-rate mono WAV sidesteps the bad
  // header entirely (the byte count IS the duration) and matches the 16 kHz mono PCM the
  // backend already assumes for WAV uploads.
  async function toMono16kWav(blob) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const decodeCtx = new AudioCtx()
    let decoded
    try {
      decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer())
    } finally {
      decodeCtx.close()
    }
    const targetRate = 16000
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate) || 1, targetRate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    const samples = rendered.getChannelData(0)
    const pcm16 = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return new Blob([encodeWav(pcm16, targetRate)], { type: 'audio/wav' })
  }

  async function startRecording() {
    setError(null)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(t('chat.micPermissionError'))
      return
    }
    let mimeType
    let recorder
    try {
      mimeType = pickMicMimeType()
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (e) {
      stream.getTracks().forEach((tr) => tr.stop())
      setError(t('chat.micStartError', { msg: e.message }))
      return
    }
    // MediaRecorder already exposes the stream it was built with via a
    // read-only `.stream` getter — no need to (and no way to) set our own.
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onerror = (e) => {
      stream.getTracks().forEach((tr) => tr.stop())
      setError(t('chat.micRecordingFailed', { msg: e.error?.message || e.error?.name || 'unknown error' }))
      setMicState('idle')
    }
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop())
      const type = recorder.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      if (!blob.size) {
        setError(t('chat.micNoAudio'))
        setMicState('idle')
        return
      }
      setMicState('transcribing')
      try {
        let wavBlob
        try {
          wavBlob = await toMono16kWav(blob)
        } catch {
          wavBlob = null   // decoding failed — fall back to the raw recording below
        }
        const file = wavBlob
          ? new File([wavBlob], 'speech.wav', { type: 'audio/wav' })
          : new File([blob], `speech.${type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'}`, { type })
        const result = await api.transcribe(file, micLang)
        if (result.text) {
          setQuestion((q) => (q ? `${q} ${result.text}` : result.text))
        } else {
          setError(t('chat.micNoSpeech', {
            status: result.status || 'unknown',
            duration: result.duration_seconds ?? '?',
            lang: micLang,
          }))
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setMicState('idle')
      }
    }
    recorderRef.current = recorder
    recorder.start()
    setMicState('recording')
  }

  function toggleRecording() {
    if (micState === 'recording') {
      try {
        recorderRef.current?.stop()
      } catch (e) {
        setError(t('chat.micStopError', { msg: e.message }))
        setMicState('idle')
      }
    } else if (micState === 'idle') {
      startRecording()
    }
  }

  async function speakMessage(idx, text) {
    if (speakingIdx === idx) { audioRef.current?.pause(); setSpeakingIdx(null); return }
    audioRef.current?.pause()
    setSpeakingIdx(idx)
    try {
      const blob = await api.speak({ text: text.slice(0, 3000) })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeakingIdx((cur) => (cur === idx ? null : cur)); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeakingIdx((cur) => (cur === idx ? null : cur)); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (e) {
      setError(e.message)
      setSpeakingIdx((cur) => (cur === idx ? null : cur))
    }
  }

  useEffect(() => {
    api.sessions.list(ownerKey).then((list) => {
      const backendIds = new Set(list.map((s) => s.id))
      let activeAfter = null
      setConversations((current) => {
        // Content that never made it to disk — a save that failed while the backend
        // happened to be mid-restart, for instance — gets a second chance here instead
        // of silently vanishing once the backend list becomes the source of truth.
        const orphaned = current.filter((c) => c.messages.length && !backendIds.has(c.id))
        orphaned.forEach((c) => { api.sessions.save(toWire(c, ownerKey)).catch(() => {}) })
        if (!list.length) return current
        const merged = [...orphaned, ...list.map(fromWire)]
        activeAfter = [...merged].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
        return merged
      })
      if (activeAfter) setActiveId(activeAfter)
    }).catch(() => { /* backend unreachable — keep working from localStorage */ })
  }, [ownerKey])

  useEffect(() => {
    try { localStorage.setItem(localKey(ownerKey), JSON.stringify({ conversations, activeId })) } catch { /* storage full/unavailable — the backend save still applies */ }
  }, [conversations, activeId, ownerKey])

  const activeConv = conversations.find((c) => c.id === activeId) || conversations[0]
  const { messages, agent, useRag, mode } = activeConv

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  function patchConversation(id, patcher) {
    let merged = null
    setConversations((cs) => cs.map((c) => {
      if (c.id !== id) return c
      merged = { ...c, ...(typeof patcher === 'function' ? patcher(c) : patcher), updatedAt: Date.now() }
      return merged
    }))
    if (merged) api.sessions.save(toWire(merged, ownerKey)).catch((e) => setError(e.message))
  }

  function setAgent(v) { patchConversation(activeId, { agent: v }) }
  function setUseRag(v) { patchConversation(activeId, { useRag: v }) }
  function setMode(v) { patchConversation(activeId, { mode: v }) }

  // A conversation is not written to disk until it has something worth saving —
  // its first message, via patchConversation inside send(). Persisting it here,
  // on every click, filled the history list with indistinguishable empty shells.
  function newConversation() {
    const conv = makeConversation({ agent: activeConv.agent, useRag: activeConv.useRag, mode: activeConv.mode })
    setConversations((cs) => [conv, ...cs])
    setActiveId(conv.id)
  }

  function deleteConversation(id, e) {
    e?.stopPropagation()
    const remaining = conversations.filter((c) => c.id !== id)
    const finalList = remaining.length ? remaining : [makeConversation()]
    setConversations(finalList)
    if (activeId === id) setActiveId(finalList[0].id)
    // 404 here just means this conversation never got its first message — never
    // written to disk in the first place, so there is nothing to remove.
    api.sessions.remove(id, ownerKey).catch((err) => { if (err.status !== 404) setError(err.message) })
  }

  // Built from the conversation already sitting in local state — no round trip to
  // the backend, so exporting works even for a conversation the server hasn't (yet,
  // or ever successfully) persisted.
  function slugTitle(conv) {
    return (conv.title || 'conversation').replace(/[^\w-]+/g, '-').slice(0, 60)
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function fmtTime(ms) {
    if (!ms) return '—'
    const d = new Date(ms)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function buildMarkdown(conv) {
    const lines = [
      `# ${conv.title || t('chat.newConversationFallback')}`,
      '',
      `_agent: ${conv.agent || '—'} · mode: ${conv.mode || '—'} · ` +
      `created ${fmtTime(conv.createdAt)} · updated ${fmtTime(conv.updatedAt)}_`,
      '',
      '---',
    ]
    for (const m of conv.messages) {
      if (m.role === 'user') lines.push('', '## You', '', m.text || '')
      else if (m.role === 'err') lines.push('', '## Error', '', m.text || '')
      else {
        const d = m.data || {}
        lines.push('', `## ${d.agent?.display_name || 'Assistant'}`, '', d.answer || '')
        if (d.fact_check) {
          lines.push('', `*fact-check: ${d.fact_check.verdict} ` +
            `(${d.fact_check.confidence} confidence, via ${d.fact_check.evidence_from})*`)
        }
        if (d.retrieved?.length) lines.push('', `*${d.retrieved.length} retrieved passage(s) used.*`)
      }
    }
    return lines.join('\n') + '\n'
  }

  function exportMarkdown() {
    downloadBlob(new Blob([buildMarkdown(activeConv)], { type: 'text/markdown' }),
                 `${slugTitle(activeConv)}.md`)
  }

  function exportJson() {
    downloadBlob(new Blob([JSON.stringify(toWire(activeConv, ownerKey), null, 2)], { type: 'application/json' }),
                 `${slugTitle(activeConv)}.json`)
  }

  // The backend keeps no session state (app/sessions.py is disk persistence for
  // the console, not conversation memory for the model) — so a follow-up like
  // "and the second option?" only makes sense to the model if we resend the
  // recent turns ourselves. Captured from `activeConv` before this turn's own
  // messages are appended below, and capped so the prompt doesn't grow forever.
  const MAX_HISTORY_TURNS = 10
  function buildHistory() {
    return activeConv.messages
      .filter((m) => m.role === 'user' || (m.role === 'bot' && m.data?.answer))
      .map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', text: m.role === 'bot' ? m.data.answer : m.text }))
      .slice(-MAX_HISTORY_TURNS)
  }

  async function send(overrideText) {
    const text = (overrideText ?? question).trim()
    if (!text || busy) return
    const convId = activeId
    const isFirst = activeConv.messages.length === 0
    const history = buildHistory()
    setQuestion(''); setError(null); setBusy(true)
    patchConversation(convId, (c) => ({
      messages: [...c.messages, { role: 'user', text }],
      ...(isFirst ? { title: text.length > 48 ? `${text.slice(0, 48)}…` : text } : {}),
    }))
    try {
      const data = await api.ask({ question: text, history, use_rag: useRag, top_k: Number(topK),
                                  temperature: Number(temperature),
                                  agent, agent_mode: mode, fact_check: factCheck })
      patchConversation(convId, (c) => ({ messages: [...c.messages, { role: 'bot', data }] }))
    } catch (e) {
      patchConversation(convId, (c) => ({ messages: [...c.messages, { role: 'err', text: e.message }] }))
      setError(e.message)
    } finally { setBusy(false) }
  }

  const all = [...agents, ...hostedOnly]
  const current = all.find((a) => a.name === agent)

  // Three states, not two. `available === false` is not "we don't know" — it is a
  // definite no: the Agent Service cannot be reached from here at all, whichever agent
  // you pick, because a key was used where Entra is required. Offering the lane anyway
  // is how you get a 503 in the chat window instead of a greyed-out option.
  const foundryReachable = foundry?.available                 // true | false | undefined
  const isHosted = current?.runs_on === 'both' || current?.runs_on === 'foundry'
  const localImpossible = current?.runs_on === 'foundry'      // no JSON file to run here
  const foundryBlocked =
    foundryReachable === false ||                             // no identity — nothing can
    (foundryReachable === true && !isHosted)                  // reachable, but not deployed
  const foundryWhy =
    foundryReachable === false
      ? (foundry?.reason || t('chat.foundryUnreachableTitle'))
      : t('chat.notDeployedTitle')

  // Keep the mode legal whenever the selected agent changes.
  useEffect(() => {
    if (foundryBlocked && mode === 'foundry') setMode('local')
    else if (localImpossible && mode !== 'foundry') setMode('foundry')
  }, [agent, localImpossible, foundryBlocked])   // eslint-disable-line react-hooks/exhaustive-deps

  // Re-seed the temperature override from the newly selected persona's own default,
  // rather than carrying the previous agent's value over to one it was never tuned for.
  useEffect(() => {
    if (current?.temperature != null) setTemperature(current.temperature)
  }, [agent])   // eslint-disable-line react-hooks/exhaustive-deps

  const sortedConvs = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
  const historyGroups = []
  for (const c of sortedConvs) {
    const label = groupLabel(c.updatedAt, t)
    let g = historyGroups.find((g) => g.label === label)
    if (!g) { g = { label, items: [] }; historyGroups.push(g) }
    g.items.push(c)
  }

  return (
    <div className="chat-shell">
      <aside className={`chat-history ${historyOpen ? '' : 'closed'}`}>
        <button className="history-toggle" onClick={() => setHistoryOpen(!historyOpen)}
                title={historyOpen ? t('chat.hideHistory') : t('chat.showHistory')} aria-expanded={historyOpen}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        {historyOpen && (
          <>
            <button className="btn btn-primary btn-sm new-conv-btn" onClick={newConversation}>
              {t('chat.newConversation')}
            </button>
            <div className="history-groups">
              {historyGroups.map((g) => (
                <div key={g.label}>
                  <div className="history-group-label">{g.label}</div>
                  {g.items.map((c) => (
                    <div key={c.id} className={`history-item ${c.id === activeId ? 'active' : ''}`}
                         onClick={() => setActiveId(c.id)}>
                      <span className="history-item-title">{c.title || t('chat.newConversationFallback')}</span>
                      <button className="history-item-delete" title={t('chat.deleteConversation')}
                              onClick={(e) => deleteConversation(c.id, e)}>×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="chat-wrap">
        {!clientMode && (
        <div className="chat-bar">
          <div className="settings-wrap" ref={settingsRef}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSettingsOpen((v) => !v)}
                    title={t('chat.settingsTitle')} aria-expanded={settingsOpen}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t('chat.settings')}
            </button>
            {settingsOpen && (
              <div className="settings-panel">
                <label>{t('chat.agent')}</label>
                <select value={agent} onChange={(e) => setAgent(e.target.value)} title={t('chat.agentTitle')}>
                  {agents.map((a) => <option key={a.name} value={a.name}>{a.display_name}</option>)}
                  {hostedOnly.length > 0 && (
                    <optgroup label={t('chat.hostedInFoundryOnly')}>
                      {hostedOnly.map((a) => <option key={a.name} value={a.name}>{a.display_name}</option>)}
                    </optgroup>
                  )}
                </select>
                {current && <RunsOnBadge runsOn={current.runs_on} reason={foundry?.reason} />}

                <label>{t('chat.whereItRuns')}</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} title={t('chat.whereItRunsTitle')}>
                  <option value="local" disabled={localImpossible}
                          title={localImpossible ? t('chat.noLocalFile') : ''}>
                    {t('chat.localAgent')}
                  </option>
                  <option value="foundry" disabled={foundryBlocked} title={foundryBlocked ? foundryWhy : ''}>
                    {t('chat.foundryAgent')}{foundryReachable === false ? t('chat.noIdentitySuffix')
                                  : foundryBlocked ? t('chat.notDeployedSuffix') : ''}
                  </option>
                </select>
                {foundryReachable === false && (
                  <span className="badge muted" title={foundryWhy}>{t('chat.hostedAgentsOff')}</span>
                )}

                <label className="check" title={t('chat.useRagTitle')}>
                  <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
                  {t('chat.useRag')}
                </label>
                <label className="check" title={t('chat.factCheckTitle')}>
                  <input type="checkbox" checked={factCheck} onChange={(e) => setFactCheck(e.target.checked)} />
                  {t('chat.factCheck')}
                </label>

                <label>{t('chat.micLanguage')}</label>
                <select value={micLang} onChange={(e) => setMicLang(e.target.value)} title={t('chat.micLanguageTitle')}>
                  <option value="ro-RO">RO mic</option>
                  <option value="en-US">EN mic</option>
                </select>

                <label>{t('chat.topK')}</label>
                <input type="number" min="1" max="10" value={topK} onChange={(e) => setTopK(e.target.value)}
                       title={t('chat.topKTitle')} />

                <label>{t('chat.temperature')}</label>
                <input type="number" min="0" max="2" step="0.05" value={temperature}
                       onChange={(e) => setTemperature(e.target.value)}
                       title={t('chat.temperatureTitle')} />

                <div className="settings-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={exportMarkdown} disabled={!messages.length}
                          title={t('chat.exportMdTitle')}>
                    {t('chat.exportMd')}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={exportJson} disabled={!messages.length}
                          title={t('chat.exportJsonTitle')}>
                    {t('chat.exportJson')}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm"
                          onClick={() => { patchConversation(activeId, { messages: [] }); setSettingsOpen(false) }}>
                    {t('chat.clear')}
                  </button>
                </div>
              </div>
            )}
          </div>
          {current && (
            <span className="badge muted" title={current.description}>
              {mode === 'foundry' ? t('chat.foundryAgent') : t('chat.localAgent')} · temp {temperature} · top-{topK}
            </span>
          )}
        </div>
        )}

        <div className="msgs">
          {messages.length === 0 && (
            <div className="card" style={{ alignSelf: 'center', maxWidth: '46rem', textAlign: 'center' }}>
              <h3>{t('chat.emptyTitle')}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {t('chat.emptyBody')}
              </p>
              <div className="suggestion-chips">
                {[t('chat.suggestion1'), t('chat.suggestion2'), t('chat.suggestion3'), t('chat.suggestion4')].map((q) => (
                  <button key={q} type="button" className="suggestion-chip" disabled={busy}
                          onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'user') return (
              <div className="msg-row user" key={i}>
                <span className="msg-avatar">U</span>
                <div className="msg">{m.text}</div>
              </div>
            )
            if (m.role === 'err') return (
              <div className="msg-row err" key={i}>
                <span className="msg-avatar">!</span>
                <div className="msg"><strong>{t('chat.requestFailed')}</strong> {m.text}</div>
              </div>
            )
            const d = m.data
            return (
              <div className="msg-row bot" key={i}>
                <span className="msg-avatar">A</span>
                <div className="msg">
                {d.answer}
                <div className="msg-meta">
                  <button className={`speak-btn ${speakingIdx === i ? 'playing' : ''}`}
                          onClick={() => speakMessage(i, d.answer)}
                          title={speakingIdx === i ? t('chat.stopPlayback') : t('chat.listenToAnswer')}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {speakingIdx === i
                        ? <rect x="6" y="6" width="12" height="12" rx="1.5" />
                        : <>
                            <path d="M11 5 6 9H2v6h4l5 4z" />
                            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                          </>}
                    </svg>
                    {speakingIdx === i ? t('chat.stop') : t('chat.listen')}
                  </button>
                  {!clientMode && <span className="badge">{d.agent?.display_name || t('chat.agentFallback')}</span>}
                  {!clientMode && <span className={`badge ${d.augmented ? 'gold' : 'muted'}`}>{d.augmented ? t('chat.grounded') : t('chat.noRetrieval')}</span>}
                  {!clientMode && <span className="badge muted">{d.agent?.mode}</span>}
                  {!clientMode && <span className="badge muted">{d.model}</span>}
                  {!clientMode && d.usage && <span className="badge muted">{d.usage.prompt_tokens}↑ {d.usage.completion_tokens}↓ {t('chat.tokens')}</span>}
                </div>
                {!clientMode && d.fact_check && (
                  <div className="src" style={{ marginTop: '.55rem',
                       borderLeftColor: d.fact_check.verdict === 'supported' ? 'var(--accent)'
                         : d.fact_check.verdict === 'contradicted' ? 'var(--c-crimson)' : 'var(--c-gold)' }}>
                    <span className={`badge ${d.fact_check.verdict === 'contradicted' ? 'crimson'
                      : d.fact_check.verdict === 'supported' ? '' : 'gold'}`}>
                      {t('chat.factCheckLabel', { verdict: d.fact_check.verdict })}
                    </span>{' '}
                    <span className="faint">{t('chat.confidenceLabel', { confidence: d.fact_check.confidence, source: d.fact_check.evidence_from })}</span>
                    {d.fact_check.error
                      ? <div className="faint" style={{ marginTop: '.3rem' }}>{d.fact_check.error}</div>
                      : <div style={{ marginTop: '.3rem' }}>{d.fact_check.reasoning}</div>}
                    {d.fact_check.sources?.length > 0 && (
                      <ul className="faint" style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem' }}>
                        {d.fact_check.sources.map((sc) => (
                          <li key={sc.rank}>
                            <a href={sc.url} target="_blank" rel="noreferrer">{sc.title || sc.url}</a>
                            {' '}{sc.used ? t('chat.charsRead', { n: sc.chars_read }) : t('chat.couldNotBeRead')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {!clientMode && d.retrieved?.length > 0 && (
                  <details className="sources">
                    <summary>{t(d.retrieved.length > 1 ? 'chat.retrievedPassageMany' : 'chat.retrievedPassageOne', { n: d.retrieved.length })}</summary>
                    {d.retrieved.map((h, j) => (
                      <div className="src" key={h.id}>
                        <span className="score">[{j + 1}] {t('chat.scoreLabel', { n: h.score.toFixed(4) })}</span>
                        <div>{h.text}</div>
                      </div>
                    ))}
                  </details>
                )}
                {!clientMode && (
                <details className="sources">
                  <summary>{t('chat.exactPrompt')}</summary>
                  <pre className="out" style={{ marginTop: '.4rem' }}>{`SYSTEM:\n${d.system_prompt}\n\nUSER:\n${d.prompt_sent}`}</pre>
                </details>
                )}
              </div>
              </div>
            )
          })}
          {busy && (
            <div className="msg-row bot">
              <span className="msg-avatar">A</span>
              <div className="msg"><span className="spin" /> {t('chat.thinking')}</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <Err error={error} />
        <div className="composer">
          {typeof window !== 'undefined' && window.MediaRecorder && (
            <button type="button" className={`btn btn-outline mic-btn ${micState}`} onClick={toggleRecording}
                    disabled={micState === 'transcribing' || busy}
                    title={micState === 'recording' ? t('chat.stopRecording')
                          : micState === 'transcribing' ? t('chat.transcribing') : t('chat.speakYourQuestion')}
                    aria-pressed={micState === 'recording'}>
              {micState === 'transcribing' ? <span className="spin" /> : (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {micState === 'recording'
                    ? <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    : <>
                        <rect x="9" y="2" width="6" height="11" rx="3" />
                        <path d="M5 10a7 7 0 0 0 14 0" />
                        <path d="M12 17v4" /><path d="M8 21h8" />
                      </>}
                </svg>
              )}
            </button>
          )}
          <textarea value={question} placeholder={t('chat.placeholder')}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <button className="btn btn-primary send-btn" onClick={() => send()} disabled={busy || !question.trim()} title={t('chat.send')} aria-label={t('chat.send')}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
