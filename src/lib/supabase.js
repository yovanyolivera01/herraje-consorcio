import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n' +
    'Copia .env.example a .env y rellena los valores de tu proyecto en Supabase.'
  )
}

export const supabase = createClient(url, key)
