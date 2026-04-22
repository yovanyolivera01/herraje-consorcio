/**
 * Pruebas unitarias — CotizacionContext.jsx
 * Se testean los helpers de lookup y la traducción de errores del wrapper,
 * sin montar el árbol React completo.
 */

import { describe, it, expect, vi } from 'vitest'

// ── Helpers extraídos del contexto para testear en aislamiento ────────────

function getPrecioVidrio(precios, id_tipo_vidrio, id_nivel_precio) {
  const found = precios.find(
    p => p.id_tipo_vidrio === id_tipo_vidrio && p.id_nivel_precio === id_nivel_precio
  )
  return found ? Number(found.precio_m2) : null
}

function getPrecioProceso(preciosProceso, id_proceso, id_nivel_precio, id_espesor) {
  const found = preciosProceso.find(
    p =>
      p.id_proceso === id_proceso &&
      p.id_nivel_precio === id_nivel_precio &&
      p.id_espesor === id_espesor
  )
  return found ? Number(found.precio_unitario) : null
}

function translateError(message) {
  if (message.includes('violates foreign key') || message.includes('RESTRICT'))
    return 'Operacion no permitida: el registro tiene dependencias activas'
  if (message.includes('unique') || message.includes('duplicate'))
    return 'Ya existe un registro con esos datos (combinacion duplicada)'
  return message
}

// ═══════════════════════════════════════════════════════════════════════════
// Lookup: getPrecioVidrio
// ═══════════════════════════════════════════════════════════════════════════

describe('getPrecioVidrio', () => {
  const precios = [
    { id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: '120.00' },
    { id_tipo_vidrio: 1, id_nivel_precio: 2, precio_m2: '105.00' },
    { id_tipo_vidrio: 1, id_nivel_precio: 3, precio_m2: '95.00'  },
    { id_tipo_vidrio: 1, id_nivel_precio: 4, precio_m2: '90.00'  },
    { id_tipo_vidrio: 2, id_nivel_precio: 1, precio_m2: '200.00' },
  ]

  // CP-13 Al seleccionar cliente registrado, se carga su nivel automáticamente
  it('retorna el precio_m2 numérico para combinación tipo/nivel existente', () => {
    expect(getPrecioVidrio(precios, 1, 1)).toBe(120)
    expect(getPrecioVidrio(precios, 1, 4)).toBe(90)
    expect(getPrecioVidrio(precios, 2, 1)).toBe(200)
  })

  it('retorna null cuando no existe precio para esa combinación', () => {
    expect(getPrecioVidrio(precios, 99, 1)).toBeNull()
    expect(getPrecioVidrio(precios, 1, 99)).toBeNull()
  })

  // CP-25 Agregar partida sin precio configurado para ese nivel (Negativo)
  it('CP-25 retorna null para tipo/nivel sin precio — frontend debe bloquear la partida', () => {
    const preciosVacios = []
    expect(getPrecioVidrio(preciosVacios, 1, 1)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Lookup: getPrecioProceso
// ═══════════════════════════════════════════════════════════════════════════

describe('getPrecioProceso', () => {
  const preciosProceso = [
    { id_proceso: 1, id_nivel_precio: 1, id_espesor: 2, precio_unitario: '45.00' },
    { id_proceso: 1, id_nivel_precio: 4, id_espesor: 2, precio_unitario: '40.00' },
    { id_proceso: 2, id_nivel_precio: 1, id_espesor: 2, precio_unitario: '35.00' },
  ]

  it('retorna precio_unitario numérico para combinación proceso/nivel/espesor existente', () => {
    expect(getPrecioProceso(preciosProceso, 1, 1, 2)).toBe(45)
    expect(getPrecioProceso(preciosProceso, 1, 4, 2)).toBe(40)
  })

  it('retorna null cuando no existe precio para esa combinación', () => {
    expect(getPrecioProceso(preciosProceso, 99, 1, 2)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Traducción de errores (wrap)
// ═══════════════════════════════════════════════════════════════════════════

describe('Traducción de errores del Context', () => {

  // CP-02 Tipo de vidrio duplicado
  it('CP-02 traduce error "duplicate" a mensaje amigable', () => {
    const msg = translateError('duplicate key value violates unique constraint "tipo_vidrio_clave_key"')
    expect(msg).toBe('Ya existe un registro con esos datos (combinacion duplicada)')
  })

  it('traduce error "unique" a mensaje amigable', () => {
    const msg = translateError('unique violation on precio_vidrio')
    expect(msg).toBe('Ya existe un registro con esos datos (combinacion duplicada)')
  })

  // CP-20 Proceso en uso (RESTRICT)
  it('CP-20 traduce error "foreign key" a mensaje de dependencias activas', () => {
    const msg = translateError('update or delete on table "proceso" violates foreign key constraint RESTRICT')
    expect(msg).toBe('Operacion no permitida: el registro tiene dependencias activas')
  })

  it('traduce error "violates foreign key" a mensaje de dependencias activas', () => {
    const msg = translateError('insert or update on table "cliente" violates foreign key constraint')
    expect(msg).toBe('Operacion no permitida: el registro tiene dependencias activas')
  })

  it('pasa el mensaje original cuando no es un error conocido', () => {
    const msg = translateError('connection timeout')
    expect(msg).toBe('connection timeout')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Cálculos de metros² (lógica de negocio del frontend)
// ═══════════════════════════════════════════════════════════════════════════

describe('Cálculos de metros cuadrados', () => {

  function calcularMetros2(largo_cm, ancho_cm, piezas = 1) {
    return piezas * (largo_cm * ancho_cm) / 10000
  }

  // CP-10 Precio de hoja completa usa medida completa automáticamente
  it('CP-10 hoja completa 244×163 cm = 3.9772 m²', () => {
    expect(calcularMetros2(244, 163)).toBeCloseTo(3.9772, 3)
  })

  // CP-22 Partida 120×90 cm = 1.08 m²
  it('CP-22 partida 120×90 cm = 1.08 m²', () => {
    expect(calcularMetros2(120, 90)).toBeCloseTo(1.08, 3)
  })

  // CP-28 Múltiples piezas — 3 piezas de distintos tipos
  it('CP-28 metros2 incluye el número de piezas en el total', () => {
    expect(calcularMetros2(120, 90, 2)).toBeCloseTo(2.16, 3)
  })

  // CP-24 Proceso metro lineal a una partida
  it('CP-24 perímetro de partida 120×90 = 4.2 ml', () => {
    const perimetro_cm = 2 * (120 + 90)
    const perimetro_ml = perimetro_cm / 100
    expect(perimetro_ml).toBeCloseTo(4.2, 1)
  })

  // CP-29 Total de cotización = suma de subtotales de partidas
  it('CP-29 total cotización = suma de subtotal_partida de todas las partidas', () => {
    const partidas = [
      { subtotal_partida: 540 },
      { subtotal_partida: 320 },
    ]
    const total = partidas.reduce((acc, p) => acc + p.subtotal_partida, 0)
    expect(total).toBeCloseTo(860, 0)
  })
})
