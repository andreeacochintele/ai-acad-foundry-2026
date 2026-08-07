import { useState } from 'react'
import { BrandMark } from '../components'
import { useLanguage } from '../i18n.jsx'

export default function Login({ onLogin }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const isAdminName = name.trim().toLowerCase() === 'admin'

  function submit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setTouched(true); return }
    if (isAdminName) {
      if (password !== 'admin') { setPasswordError(true); return }
      onLogin({ name: trimmed, role: 'admin' })
      return
    }
    onLogin({ name: trimmed, role: 'user' })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: '26rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.3rem' }}>
          <BrandMark size={30} />
          <span className="brand-name" style={{ fontSize: '1.3rem' }}>Libra Assist</span>
        </div>
        <h3 style={{ marginTop: '.6rem' }}>{t('login.title')}</h3>

        <label style={{ marginTop: '.8rem' }}>{t('login.name')}</label>
        <input type="text" value={name} autoFocus
               onChange={(e) => { setName(e.target.value); setTouched(false); setPasswordError(false) }}
               placeholder={t('login.namePlaceholder')} />
        {touched && !name.trim() && (
          <p className="faint" style={{ color: 'var(--c-crimson)', margin: '.3rem 0 0' }}>{t('login.nameRequired')}</p>
        )}

        {isAdminName && (
          <>
            <label style={{ marginTop: '.8rem' }}>{t('login.password')}</label>
            <input type="password" value={password}
                   onChange={(e) => { setPassword(e.target.value); setPasswordError(false) }}
                   placeholder={t('login.passwordPlaceholder')} />
            {passwordError && (
              <p className="faint" style={{ color: 'var(--c-crimson)', margin: '.3rem 0 0' }}>{t('login.passwordIncorrect')}</p>
            )}
          </>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.1rem' }}>
          {t('login.enter')}
        </button>
      </form>
    </div>
  )
}
