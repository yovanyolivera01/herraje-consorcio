import { useState } from 'react'
import { SquareDashed } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HOME_POR_ROL, PERMISOS } from '../context/AuthContext'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [usuario,  setUsuario]  = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const from = location.state?.from?.pathname ?? null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const session = await login(usuario.trim(), password.trim())
      const home    = HOME_POR_ROL[session.rol] ?? '/cot/nueva'
      const permitidas = PERMISOS[session.rol]
      const puedeVolver = from && (permitidas === null || permitidas?.some(r => from.startsWith(r)))
      navigate(puedeVolver ? from : home, { replace: true })
    } catch (e) {
      setError(e.message ?? 'Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a3a6b 0%, #0f2347 60%, #1a3a6b 100%)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <SquareDashed size={48} color="white" />
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, margin: 0 }}>VIDRIO TEMPLADO ROSALES </h1>
          <p style={{ fontSize: 13, color: 'rgba(180,210,255,.8)', margin: '4px 0 0', letterSpacing: 4 }}>
            
          </p>
        </div>

        <div style={{
          background: '#fff', borderRadius: 14, padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#1a3a6b' }}>
            Iniciar sesión
          </h2>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px' }}>
            Ingresa tu usuario y contraseña
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input
                className="form-input"
                type="text"
                value={usuario}
                onChange={e => { setUsuario(e.target.value); setError(null) }}
                placeholder=""
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '8px 32px', fontSize: 13 }}
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(180,210,255,.4)', fontSize: 11, marginTop: 24 }}>
          Templados Consorcio · Sistema interno
        </p>
      </div>
    </div>
  )
}
