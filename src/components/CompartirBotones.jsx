// Botones reutilizables para compartir una cotizacion o pedido por WhatsApp o correo.
// Uso: <CompartirBotones tipo="cotizacion" folio={cot.folio} total={total} partidas={partidas} clienteNombre={..} telefono={..} correo={..} />
import { construirMensajeCompartir } from '../lib/compartirTexto'

function soloDigitos(str) {
  return (str ?? '').replace(/\D/g, '')
}

export default function CompartirBotones({ tipo = 'cotizacion', folio, total, partidas, clienteNombre, telefono, correo, mensaje }) {
  const texto = mensaje ?? construirMensajeCompartir({ tipo, folio, total, clienteNombre, partidas })

  const compartirWhatsapp = () => {
    const numero = soloDigitos(telefono)
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  const compartirCorreo = () => {
    const asunto = tipo === 'pedido' ? `Pedido ${folio}` : `Cotizacion ${folio}`
    const url = `mailto:${correo ?? ''}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`
    window.location.href = url
  }

  return (
    <>
      <button className="btn btn-outline" onClick={compartirWhatsapp}>📱 WhatsApp</button>
      <button className="btn btn-outline" onClick={compartirCorreo}>✉️ Correo</button>
    </>
  )
}
