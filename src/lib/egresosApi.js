
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function apiFetch(path,options= {}){
    const {method = 'GET',body} = options
    const res = await fetch(`${API}/api${path}`,{
        method,
        headers: {'Content-Type': 'application/json'},
        ...(body !== undefined ? {body:JSON.stringify(body)}:{}), 
    })
    const data = await res.json().catch (() => ({}))
    if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
  return data
}

export const insertarEgreso = async ({description,monto,user_insert}) =>{

  return apiFetch('/egresos',{method:'POST',body:{description,monto,user_insert}})

}


export const getEgresos = async () =>{
  return apiFetch('/egresos')
}