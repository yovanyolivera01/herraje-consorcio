/**
 * Módulo para impresión directa en impresoras térmicas mediante Web Serial API.
 *
 * Requisitos:
 *  - Navegador: Google Chrome o Microsoft Edge (no Firefox)
 *  - Conexión: USB o Serial (COM)
 *  - Protocolo: ESC/POS (compatible con 99% de impresoras térmicas de recibo)
 *
 * Uso:
 *   import { connectPrinter, printThermal, isPrinterConnected, disconnectPrinter } from './thermalPrinter'
 */

import { buildTicketEscPos } from './escpos.js'

// Estado de módulo — persiste entre renders y navegaciones
let _port   = null
let _writer = null

/** ¿El navegador soporta Web Serial API? */
export const isWebSerialSupported = () => 'serial' in navigator

/** ¿Hay una impresora conectada actualmente? */
export const isPrinterConnected = () => _port !== null

/**
 * Muestra el selector de puerto serial y abre la conexión.
 * @param {object} options
 * @param {number} options.baudRate - Velocidad (default 9600; prueba 38400 o 115200 si no funciona)
 * @param {number} options.cols     - Columnas: 32 para papel 58mm, 42 para papel 80mm
 */
export async function connectPrinter({ baudRate = 9600 } = {}) {
  if (!isWebSerialSupported()) {
    throw new Error(
      'Tu navegador no soporta Web Serial API.\n' +
      'Usa Google Chrome o Microsoft Edge para conectar la impresora de calor.'
    )
  }

  // Cierra conexión anterior si existe
  await disconnectPrinter()

  try {
    // Abre el selector de puertos nativos del OS
    _port = await navigator.serial.requestPort()
    await _port.open({ baudRate })
    _writer = _port.writable.getWriter()
  } catch (err) {
    _port = null
    _writer = null
    // El usuario canceló el diálogo
    if (err.name === 'NotFoundError') return false
    throw err
  }
  return true
}

/** Cierra la conexión con la impresora */
export async function disconnectPrinter() {
  if (_writer) {
    try { _writer.releaseLock() } catch {}
    _writer = null
  }
  if (_port) {
    try { await _port.close() } catch {}
    _port = null
  }
}

/**
 * Imprime un ticket en la impresora térmica conectada.
 * @param {object} venta - objeto con folio, fecha, hora, total, partidas[]
 * @param {object} options
 * @param {number} options.cols - columnas de la impresora (32 ó 42)
 */
export async function printThermal(venta, { cols = 42 } = {}) {
  if (!isPrinterConnected()) {
    throw new Error('No hay impresora conectada. Usa el botón "Conectar impresora".')
  }
  try {
    const bytes = buildTicketEscPos(venta, cols)
    await _writer.write(bytes)
  } catch (err) {
    // Si el puerto fue desconectado físicamente, limpiamos estado
    if (err.name === 'InvalidStateError' || err.message?.includes('closed')) {
      _writer = null
      _port   = null
      throw new Error('La impresora fue desconectada. Vuelve a conectarla.')
    }
    throw err
  }
}
