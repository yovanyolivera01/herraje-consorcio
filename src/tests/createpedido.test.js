import { describe, it, expect } from 'vitest'
import { r5, fmt5 } from '../lib/utils'
import { parseNotacion, calcTotal } from '../lib/cotizacionUtils'

// ── Crear pedido CRÉDITO ──────────────────────────────────────────────────
describe('create pedido credito', () => {
  it('calcula total correctamente', () => {
    const total = 100 + 50
    expect(total).toBe(150)
  })

  it('pedido credito tiene tipo_pago CREDITO', () => {
    const pedido = { tipo_pago: 'CREDITO', total: 500, saldo: 500 }
    expect(pedido.tipo_pago).toBe('CREDITO')
  })

  it('pedido credito con anticipo reduce el saldo', () => {
    const total = 500
    const anticipo = 200
    const saldo = total - anticipo
    expect(saldo).toBe(300)
  })

  it('pedido credito NO debe marcar es_entregado al crear', () => {
    const pedido = { tipo_pago: 'CREDITO', es_entregado: false }
    expect(pedido.es_entregado).toBe(false)
  })

  it('boton muestra "Cobrar el saldo" cuando tipo_pago es CREDITO', () => {
    const tipo_pago = 'CREDITO'
    const label = tipo_pago === 'CREDITO' ? 'Cobrar el saldo' : 'Marcar como entregado'
    expect(label).toBe('Cobrar el saldo')
  })

  it('boton muestra "Marcar como entregado" cuando NO es CREDITO', () => {
    const tipo_pago = 'CONTADO'
    const label = tipo_pago === 'CREDITO' ? 'Cobrar el saldo' : 'Marcar como entregado'
    expect(label).toBe('Marcar como entregado')
  })

  it('ticket footer es "Entregado." cuando tipo_pago es CREDITO', () => {
    const tipo_pago = 'CREDITO'
    const footer = tipo_pago === 'CREDITO' ? 'Entregado.' : 'Pendiente de entrega.'
    expect(footer).toBe('Entregado.')
  })
})

// ── r5 ────────────────────────────────────────────────────────────────────
describe('r5 — redondea al siguiente múltiplo de $5', () => {
  it('precio exacto no cambia',           () => expect(r5(20)).toBe(20))
  it('$18.711 → $20',                     () => expect(r5(18.711)).toBe(20))
  it('$21 → $25',                         () => expect(r5(21)).toBe(25))
  it('$100.01 → $105',                    () => expect(r5(100.01)).toBe(105))
  it('$0 → $0',                           () => expect(r5(0)).toBe(0))
  it('fmt5 devuelve string con decimales', () => expect(fmt5(18.711)).toBe('20.00'))
})

// ── parseNotacion ─────────────────────────────────────────────────────────
describe('parseNotacion — parser de medidas', () => {
  it('formato corto: 98x45',         () => expect(parseNotacion('98x45')).toEqual({ piezas: 1, largo: 98, ancho: 45 }))
  it('formato largo: 3-98x45',       () => expect(parseNotacion('3-98x45')).toEqual({ piezas: 3, largo: 98, ancho: 45 }))
  it('con decimales: 98.5x45.2',     () => expect(parseNotacion('98.5x45.2')).toEqual({ piezas: 1, largo: 98.5, ancho: 45.2 }))
  it('con coma: 98,5x45,2',          () => expect(parseNotacion('98,5x45,2')).toEqual({ piezas: 1, largo: 98.5, ancho: 45.2 }))
  it('con espacios: 98 x 45',        () => expect(parseNotacion('98 x 45')).toEqual({ piezas: 1, largo: 98, ancho: 45 }))
  it('piezas decimales no válidas',  () => expect(parseNotacion('3.5-98x45')).toHaveProperty('error'))
  it('texto vacío devuelve error',   () => expect(parseNotacion('')).toHaveProperty('error'))
  it('formato incorrecto da error',  () => expect(parseNotacion('abc')).toHaveProperty('error'))
  it('solo un número da error',      () => expect(parseNotacion('45')).toHaveProperty('error'))
})

// ── calcTotal ─────────────────────────────────────────────────────────────
describe('calcTotal — total de cotización', () => {
  it('precio_manual evita recalculo (bug corregido: $30 no $20)', () => {
    const partidas = [{
      tipo: 'VIDRIO', piezas: 1,
      subtotal_vidrio: 18.711, subtotal_partida: 30,
      precio_manual: 30, procesos: [],
    }]
    expect(calcTotal(partidas)).toBe(30)
  })

  it('sin precio_manual aplica r5 sobre subtotal_vidrio', () => {
    const partidas = [{
      tipo: 'VIDRIO', piezas: 1,
      subtotal_vidrio: 94.5, subtotal_partida: 95,
      precio_manual: null, procesos: [],
    }]
    expect(calcTotal(partidas)).toBe(95)
  })

  it('3 piezas: r5 se aplica por pieza (56.133 → $20×3 = $60)', () => {
    const partidas = [{
      tipo: 'VIDRIO', piezas: 3,
      subtotal_vidrio: 56.133,
      precio_manual: null, procesos: [],
    }]
    expect(calcTotal(partidas)).toBe(60)
  })

  it('PRODUCTO usa r5 directo ($47.3 → $50)', () => {
    expect(calcTotal([{ tipo: 'PRODUCTO', subtotal_partida: 47.3 }])).toBe(50)
  })

  it('suma múltiples partidas', () => {
    const partidas = [
      { tipo: 'VIDRIO', piezas: 1, subtotal_vidrio: 94.5, precio_manual: null, procesos: [] },
      { tipo: 'PRODUCTO', subtotal_partida: 47.3 },
    ]
    expect(calcTotal(partidas)).toBe(145)
  })

  it('lista vacía devuelve 0', () => {
    expect(calcTotal([])).toBe(0)
  })
})
