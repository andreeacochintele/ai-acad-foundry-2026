import { useState } from 'react'
import { BrandMark } from '../components'
import { useLanguage } from '../i18n.jsx'

export default function Login({ onLogin }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [role, setRole] = useState('user')
  const [touched, setTouched] = useState(false)

  function submit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setTouched(true); return }
    onLogin({ name: trimmed, role })
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
        <p className="muted" style={{ marginTop: 0 }}>{t('login.subtitle')}</p>

        <label style={{ marginTop: '.8rem' }}>{t('login.name')}</label>
        <input type="text" value={name} autoFocus
               onChange={(e) => { setName(e.target.value); setTouched(false) }}
               placeholder={t('login.namePlaceholder')} />
        {touched && !name.trim() && (
          <p className="faint" style={{ color: 'var(--c-crimson)', margin: '.3rem 0 0' }}>{t('login.nameRequired')}</p>
        )}

        <label style={{ marginTop: '.9rem' }}>{t('login.role')}</label>
        <div className="row" style={{ gap: '.6rem' }}>
          <label className={`card ${role === 'user' ? '' : ''}`}
                 style={{
                   flex: 1, margin: 0, padding: '.7rem .8rem', cursor: 'pointer',
                   borderColor: role === 'user' ? 'var(--accent)' : 'var(--border)',
                   boxShadow: role === 'user' ? '0 0 0 1px var(--accent)' : 'none',
                 }}>
            <span className="check" style={{ marginBottom: '.25rem' }}>
              <input type="radio" name="role" value="user" checked={role === 'user'}
                     onChange={() => setRole('user')} />
              {t('login.roleUser')}
            </span>
            <span className="faint" style={{ fontSize: '.78rem' }}>{t('login.roleUserHint')}</span>
          </label>
          <label className="card"
                 style={{
                   flex: 1, margin: 0, padding: '.7rem .8rem', cursor: 'pointer',
                   borderColor: role === 'admin' ? 'var(--accent)' : 'var(--border)',
                   boxShadow: role === 'admin' ? '0 0 0 1px var(--accent)' : 'none',
                 }}>
            <span className="check" style={{ marginBottom: '.25rem' }}>
              <input type="radio" name="role" value="admin" checked={role === 'admin'}
                     onChange={() => setRole('admin')} />
              {t('login.roleAdmin')}
            </span>
            <span className="faint" style={{ fontSize: '.78rem' }}>{t('login.roleAdminHint')}</span>
          </label>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.1rem' }}>
          {t('login.enter')}
        </button>
      </form>
    </div>
  )
}
