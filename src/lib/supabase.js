// Supabase ya no se usa — el frontend llama al backend local.
// Se exportan los símbolos para no romper imports existentes.

export const supabaseConfigured = true

export const supabase = {
  from: () => { throw new Error('Supabase no disponible — usa el backend local') },
  rpc:  () => { throw new Error('Supabase no disponible — usa el backend local') },
}
