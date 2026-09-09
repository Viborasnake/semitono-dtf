const AUTH_USER = 'viborasnake@gmail.com'
const PASSWORD_SHA256 = 'ea9f503828bcde861fa882c193c13a7a6bb26ce00c07332d1e51af2590f2cabd'
const SESSION_KEY = 'trama-dtf-authenticated'

function digest(value: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(bytes =>
    [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''))
}

export function hasAuthSession() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
}

export async function authenticate(user: string, password: string) {
  if (user.trim().toLocaleLowerCase() !== AUTH_USER) return false
  if (!crypto.subtle) return false
  const passwordHash = await digest(password)
  if (passwordHash !== PASSWORD_SHA256) return false
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* private browsing can reject storage */ }
  return true
}

export {AUTH_USER}
