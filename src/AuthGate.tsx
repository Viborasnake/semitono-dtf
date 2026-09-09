import {useState, type FormEvent, type ReactNode} from 'react'
import {authenticate, AUTH_USER, hasAuthSession} from './auth'

export default function AuthGate({children}:{children:ReactNode}) {
  const [authenticated,setAuthenticated]=useState(hasAuthSession)
  const [user,setUser]=useState(AUTH_USER)
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  if(authenticated)return <>{children}</>
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('')
    try {
      if(await authenticate(user,password)){setAuthenticated(true);setPassword('')}
      else {setPassword('');setError('Usuario o contraseña incorrectos.')}
    }catch {setError('No se pudo verificar el acceso en este navegador.')}
    finally{setBusy(false)}
  }
  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <span className="eyebrow">TRAMA · DTF LAB</span>
    <h1 id="auth-title">Acceso privado</h1>
    <p>Ingresa tus credenciales para continuar.</p>
    <form onSubmit={submit}>
      <label className="field">Usuario<input aria-label="Usuario" type="email" autoComplete="username" value={user} onChange={e=>setUser(e.target.value)} required /></label>
      <label className="field">Contraseña<input aria-label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button className="btn export" disabled={busy}>{busy?'Verificando…':'Ingresar'}</button>
    </form>
    {error&&<p className="error-text" role="alert">{error}</p>}
  </section></main>
}
