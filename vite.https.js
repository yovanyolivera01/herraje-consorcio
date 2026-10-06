// HTTPS para el servidor de desarrollo de Vite — necesario SOLO para que
// navigator.mediaDevices.getUserMedia() (la cámara, usada por ModalCara)
// funcione al abrir la app desde una IP de LAN (http://192.168.x.x). En
// http://localhost la cámara ya funciona sin HTTPS — "contexto seguro"
// incluye localhost por definición del navegador.
//
// Por default sirve por HTTP normal: todos los tests de Playwright y el
// flujo de trabajo diario asumen http://localhost:5173. HTTPS es opt-in
// con VITE_USE_HTTPS=true, para cuando de verdad necesitas probar la
// cámara desde otro dispositivo en la LAN. Ver certs/README.md.
import fs from 'node:fs'
import path from 'node:path'

const CERT_DIR = path.resolve(import.meta.dirname, 'certs')
const KEY_PATH  = path.join(CERT_DIR, 'dev-key.pem')
const CERT_PATH = path.join(CERT_DIR, 'dev-cert.pem')

export function getDevHttpsConfig() {
  if (process.env.VITE_USE_HTTPS !== 'true') return false

  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
    console.warn(
      '[vite.https] VITE_USE_HTTPS=true pero certs/dev-key.pem o ' +
      'dev-cert.pem no existen — sirviendo por HTTP. Corre ' +
      '`bash certs/generate-dev-cert.sh` primero.'
    )
    return false
  }

  return {
    key:  fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
  }
}
