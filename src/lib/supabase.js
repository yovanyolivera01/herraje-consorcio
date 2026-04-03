import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

// Si faltan variables se exporta un cliente ficticio para que el módulo cargue;
// el AppContext detecta supabaseConfigured=false y muestra la pantalla de setup.
export const supabase = supabaseConfigured
  ? createClient(url, key)
  : createClient('https://placeholder.supabase.co', 'placeholder')
