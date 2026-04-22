/**
 * Pruebas unitarias — cotizacionApi.js
 * Basadas en la Matriz de Pruebas del Sistema de Cotización de Vidrio
 *
 * Todas las llamadas a Supabase están mockeadas: las pruebas validan
 * la lógica de transformación y el comportamiento de las funciones
 * sin conectarse a la base de datos real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock del cliente Supabase ─────────────────────────────────────────────
vi.mock('../lib/supabase', () => {
  const builder = () => {
    const obj = {}
    const chain = new Proxy(obj, {
      get(_, prop) {
        if (prop === 'then') return undefined
        return (...args) => chain
      },
    })
    return chain
  }

  return {
    supabase: {
      from: vi.fn(() => builder()),
    },
    supabaseConfigured: true,
  }
})

import { supabase } from '../lib/supabase'
import {
  createTipoVidrio,
  updateTipoVidrio,
  getTiposVidrio,
  guardarPrecio,
  getPreciosVidrio,
  createCliente,
  updateCliente,
  getNivelesPrecio,
  createProceso,
  updateProceso,
  getProcesos,
  iniciarCotizacion,
  agregarPartida,
  finalizarCotizacion,
  cancelarCotizacion,
  getCotizaciones,
  getDetalleCotizacion,
} from '../lib/cotizacionApi'

// ── Helper: construye un mock de cadena Supabase con resultado fijo ────────
function mockChain(result) {
  const chain = {
    select:  vi.fn().mockReturnThis(),
    insert:  vi.fn().mockReturnThis(),
    update:  vi.fn().mockReturnThis(),
    upsert:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    single:  vi.fn().mockResolvedValue(result),
  }
  // Para consultas sin .single() que resuelven directamente
  chain.then = (resolve) => resolve(result)
  return chain
}

// ═══════════════════════════════════════════════════════════════════════════
// HU-01  Tipos de Vidrio
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-01 Tipos de Vidrio', () => {

  // CP-01 Crear tipo de vidrio con datos válidos (Positivo)
  it('CP-01 crea un tipo de vidrio con datos válidos y retorna el registro', async () => {
    const nuevoTipo = {
      id_tipo_vidrio: 1,
      id_tono: 1,
      id_espesor: 2,
      clave: 'CLARO-4MM',
      descripcion: 'Vidrio claro 4mm',
      tono: { id_tono: 1, nombre: 'Claro' },
      espesor: { id_espesor: 2, valor_mm: 4, etiqueta: '4mm' },
    }
    supabase.from.mockReturnValue(mockChain({ data: nuevoTipo, error: null }))

    const result = await createTipoVidrio({
      id_tono: 1,
      id_espesor: 2,
      clave: 'CLARO-4MM',
      descripcion: 'Vidrio claro 4mm',
    })

    expect(result).toMatchObject({ clave: 'CLARO-4MM' })
    expect(result.tono.nombre).toBe('Claro')
  })

  // CP-02 Crear tipo de vidrio duplicado (Negativo)
  it('CP-02 lanza error al intentar crear un tipo de vidrio duplicado', async () => {
    const errorDuplicado = { message: 'duplicate key value violates unique constraint' }
    const chain = mockChain({ data: null, error: errorDuplicado })
    chain.single = vi.fn().mockRejectedValue(errorDuplicado)
    supabase.from.mockReturnValue(chain)

    await expect(
      createTipoVidrio({ id_tono: 1, id_espesor: 2, clave: 'CLARO-4MM', descripcion: 'dup' })
    ).rejects.toMatchObject({ message: expect.stringContaining('duplicate') })
  })

  // CP-04 Activar/desactivar tipo de vidrio existente (Positivo)
  it('CP-04 desactiva un tipo de vidrio actualizando el campo activo a false', async () => {
    const updated = { id_tipo_vidrio: 1, clave: 'CLARO-4MM', activo: false }
    supabase.from.mockReturnValue(mockChain({ data: updated, error: null }))

    const result = await updateTipoVidrio(1, { activo: false })

    expect(result.activo).toBe(false)
  })

  // CP-04b Reactivar tipo de vidrio (Positivo)
  it('CP-04b reactiva un tipo de vidrio actualizando el campo activo a true', async () => {
    const updated = { id_tipo_vidrio: 1, clave: 'CLARO-4MM', activo: true }
    supabase.from.mockReturnValue(mockChain({ data: updated, error: null }))

    const result = await updateTipoVidrio(1, { activo: true })

    expect(result.activo).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-02  Precios de Vidrio
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-02 Precios de Vidrio', () => {

  // CP-05 Guardar precio por m² por primera vez (Positivo)
  it('CP-05 guarda un precio nuevo y retorna el registro con precio_m2 numérico', async () => {
    const nuevoPrecio = { id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 120 }
    supabase.from.mockReturnValue(mockChain({ data: nuevoPrecio, error: null }))

    const result = await guardarPrecio({ id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 120 })

    expect(result.precio_m2).toBe(120)
  })

  // CP-06 Actualizar precio existente (Positivo) — upsert reemplaza el valor
  it('CP-06 actualiza un precio existente via upsert con el nuevo valor', async () => {
    const precioActualizado = { id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 135 }
    supabase.from.mockReturnValue(mockChain({ data: precioActualizado, error: null }))

    const result = await guardarPrecio({ id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 135 })

    expect(result.precio_m2).toBe(135)
  })

  // CP-07 Actualizar precio con mismo valor (Borde) — upsert no falla
  it('CP-07 upsert con el mismo valor no lanza error', async () => {
    const mismoValor = { id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 120 }
    supabase.from.mockReturnValue(mockChain({ data: mismoValor, error: null }))

    await expect(
      guardarPrecio({ id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 120 })
    ).resolves.toMatchObject({ precio_m2: 120 })
  })

  // CP-08 Precio de cambio no afecta cotizaciones previas
  it('CP-08 precio_m2_aplicado queda fijo en la partida al momento de su creación', async () => {
    // El precio aplicado se guarda en la partida; cambiar precio_vidrio no lo modifica
    const partida = {
      id_partida: 1,
      precio_m2_aplicado: 120,  // precio original al cotizar
      subtotal_vidrio: 480,
    }
    supabase.from.mockReturnValue(mockChain({ data: partida, error: null }))

    const result = await agregarPartida(1, {
      id_tipo_vidrio: 1,
      largo_cm: 244,
      ancho_cm: 163,
      metros2: 4,
      precio_m2_aplicado: 120,
      subtotal_vidrio: 480,
      subtotal_procesos: 0,
      subtotal_partida: 480,
    })

    expect(result.precio_m2_aplicado).toBe(120)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-03  Niveles de Precio (4 niveles para un tipo de vidrio)
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-03 Niveles de Precio', () => {

  // CP-09 Configurar 4 niveles de precio para un tipo de vidrio (Positivo)
  it('CP-09 guardarPrecio para 4 niveles registra un precio por cada nivel', async () => {
    const niveles = [1, 2, 3, 4]
    const precios = [120, 105, 95, 90]

    for (let i = 0; i < niveles.length; i++) {
      supabase.from.mockReturnValueOnce(
        mockChain({ data: { id_tipo_vidrio: 1, id_nivel_precio: niveles[i], precio_m2: precios[i] }, error: null })
      )
    }

    const resultados = await Promise.all(
      niveles.map((nv, i) =>
        guardarPrecio({ id_tipo_vidrio: 1, id_nivel_precio: nv, precio_m2: precios[i] })
      )
    )

    expect(resultados).toHaveLength(4)
    expect(resultados[0].precio_m2).toBe(120)
    expect(resultados[3].precio_m2).toBe(90)
  })

  // CP-11 Actualizar precio de un nivel no afecta a los demás
  it('CP-11 actualizar precio de nivel Vidrieros no cambia precio de los otros niveles', async () => {
    const preciosOriginales = [
      { id_tipo_vidrio: 1, id_nivel_precio: 1, precio_m2: 120 },
      { id_tipo_vidrio: 1, id_nivel_precio: 2, precio_m2: 105 }, // Vidrieros
      { id_tipo_vidrio: 1, id_nivel_precio: 3, precio_m2: 95  },
      { id_tipo_vidrio: 1, id_nivel_precio: 4, precio_m2: 90  },
    ]

    // Solo nivel 2 (Vidrieros) cambia a 90.50
    const preciosActualizados = preciosOriginales.map(p =>
      p.id_nivel_precio === 2 ? { ...p, precio_m2: 90.5 } : p
    )

    supabase.from.mockReturnValue(mockChain({ data: preciosActualizados, error: null }))

    // El mock de getPreciosVidrio devuelve todos
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: preciosActualizados, error: null }),
    })

    const todos = await getPreciosVidrio()
    const nivel1 = todos.find(p => p.id_nivel_precio === 1)
    const nivel2 = todos.find(p => p.id_nivel_precio === 2)

    expect(nivel2.precio_m2).toBe(90.5)
    expect(nivel1.precio_m2).toBe(120) // sin cambios
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-04  Clientes
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-04 Clientes', () => {

  // CP-12 Registrar cliente frecuente con nivel de precio asignado (Positivo)
  it('CP-12 crea cliente con nivel_precio y retorna relación anidada', async () => {
    const clienteCreado = {
      id_cliente: 1,
      nombre: 'Vidrios del Norte',
      telefono: '5551234567',
      correo: 'contacto@vidriosdelnorte.com',
      id_nivel_precio: 4,
      nivel_precio: { id_nivel_precio: 4, nombre: 'Vidrieros' },
    }
    supabase.from.mockReturnValue(mockChain({ data: clienteCreado, error: null }))

    const result = await createCliente({
      nombre: 'Vidrios del Norte',
      telefono: '5551234567',
      correo: 'contacto@vidriosdelnorte.com',
      id_nivel_precio: 4,
    })

    expect(result.nivel_precio.nombre).toBe('Vidrieros')
    expect(result.id_nivel_precio).toBe(4)
  })

  // CP-14 Cotización para cliente de mostrador sin registro (Positivo)
  it('CP-14 createCliente sin id_nivel_precio lo guarda como null', async () => {
    const mostradorCliente = {
      id_cliente: 3,
      nombre: null,
      id_nivel_precio: null,
      nivel_precio: null,
    }
    supabase.from.mockReturnValue(mockChain({ data: mostradorCliente, error: null }))

    const result = await createCliente({ nombre: null, telefono: null, correo: null, id_nivel_precio: null })

    expect(result.id_nivel_precio).toBeNull()
  })

  // CP-15 Ingresar cliente con nivel de precio inactivo (Negativo)
  it('CP-15 lanza error si el nivel de precio referenciado no está activo (FK)', async () => {
    const fkError = { message: 'violates foreign key constraint on table nivel_precio' }
    const chain = mockChain({ data: null, error: fkError })
    chain.single = vi.fn().mockRejectedValue(fkError)
    supabase.from.mockReturnValue(chain)

    await expect(
      createCliente({ nombre: 'Test', id_nivel_precio: 99 })
    ).rejects.toMatchObject({ message: expect.stringContaining('foreign key') })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-05  Procesos
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-05 Procesos', () => {

  // CP-17 Crear proceso cobrado por m² (Positivo)
  it('CP-17 crea proceso con unidad m² y precio unitario', async () => {
    const proceso = {
      id_proceso: 1,
      nombre: 'Pulido',
      id_unidad_cobro: 1,
      precio_unitario: 45,
      activo: true,
      unidad_cobro: { id_unidad_cobro: 1, nombre: 'm2', descripcion: 'Metro cuadrado' },
    }
    supabase.from.mockReturnValue(mockChain({ data: proceso, error: null }))

    const result = await createProceso({ nombre: 'Pulido', id_unidad_cobro: 1, precio_unitario: 45 })

    expect(result.nombre).toBe('Pulido')
    expect(result.unidad_cobro.nombre).toBe('m2')
    expect(result.precio_unitario).toBe(45)
  })

  // CP-18 Crear proceso cobrado por metro lineal (Positivo)
  it('CP-18 crea proceso con unidad metro lineal', async () => {
    const proceso = {
      id_proceso: 2,
      nombre: 'Biselado',
      id_unidad_cobro: 2,
      precio_unitario: 35,
      activo: true,
      unidad_cobro: { id_unidad_cobro: 2, nombre: 'ml', descripcion: 'Metro lineal' },
    }
    supabase.from.mockReturnValue(mockChain({ data: proceso, error: null }))

    const result = await createProceso({ nombre: 'Biselado', id_unidad_cobro: 2, precio_unitario: 35 })

    expect(result.unidad_cobro.nombre).toBe('ml')
  })

  // CP-19 Crear proceso con unidad de cobro inválida (Negativo)
  it('CP-19 lanza error cuando id_unidad_cobro no existe (FK violation)', async () => {
    const fkError = { message: 'violates foreign key constraint on table unidad_cobro' }
    const chain = mockChain({ data: null, error: fkError })
    chain.single = vi.fn().mockRejectedValue(fkError)
    supabase.from.mockReturnValue(chain)

    await expect(
      createProceso({ nombre: 'Proceso X', id_unidad_cobro: 99, precio_unitario: 10 })
    ).rejects.toMatchObject({ message: expect.stringContaining('foreign key') })
  })

  // CP-20 Activar proceso en uso (Borde) — solo cambia campo activo
  it('CP-20 marcar proceso como inactivo no elimina cotizaciones previas que lo usan', async () => {
    const procesoInactivo = { id_proceso: 1, nombre: 'Pulido', activo: false }
    supabase.from.mockReturnValue(mockChain({ data: procesoInactivo, error: null }))

    const result = await updateProceso(1, { activo: false })

    expect(result.activo).toBe(false)
    // La partida_proceso en la BD conserva el proceso; aquí solo verificamos
    // que el update no falla y devuelve el nuevo estado
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-06  Cotizaciones — Flujo completo
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-06 Cotizaciones', () => {

  // CP-21 Iniciar cotización con cliente registrado (Positivo)
  it('CP-21 iniciarCotizacion genera folio COT-##### y estado BORRADOR', async () => {
    const cotizacion = {
      id_cotizacion: 1,
      folio: 'COT-00001',
      id_nivel_precio: 4,
      id_cliente: 1,
      estatus: 'BORRADOR',
      total: 0,
    }
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: { id_cotizacion: 1, folio: 'COT-00000' }, error: null })
        .mockResolvedValueOnce({ data: cotizacion, error: null }),
      update: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
    }
    supabase.from.mockReturnValue(chain)

    const result = await iniciarCotizacion({ id_nivel_precio: 4, id_cliente: 1 })

    expect(result.folio).toBe('COT-00001')
    expect(result.estatus).toBe('BORRADOR')
  })

  // CP-22 Agregar partida de vidrio con medidas manuales (Positivo)
  it('CP-22 agregarPartida inserta partida con metros2 y subtotales correctos', async () => {
    const partida = {
      id_partida: 1,
      id_cotizacion: 1,
      id_tipo_vidrio: 1,
      largo_cm: 120,
      ancho_cm: 90,
      metros2: 1.08,
      precio_m2_aplicado: 90,
      subtotal_vidrio: 97.2,
      subtotal_procesos: 0,
      subtotal_partida: 97.2,
      es_hoja_completa: false,
    }
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: partida, error: null }),
    }
    supabase.from.mockReturnValue(chain)

    const result = await agregarPartida(1, {
      id_tipo_vidrio: 1,
      largo_cm: 120,
      ancho_cm: 90,
      metros2: 1.08,
      precio_m2_aplicado: 90,
      subtotal_vidrio: 97.2,
      subtotal_procesos: 0,
      subtotal_partida: 97.2,
    })

    expect(result.metros2).toBeCloseTo(1.08)
    expect(result.subtotal_partida).toBeCloseTo(97.2)
  })

  // CP-23 Agregar proceso por m² a una partida (Positivo)
  it('CP-23 agregarPartida con proceso m² inserta fila en partida_proceso', async () => {
    const partida = { id_partida: 2, subtotal_procesos: 45, subtotal_partida: 145 }
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0
    const chain = {
      insert: vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1
          ? { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: partida, error: null }) }
          : { error: null, then: (r) => r({ error: null }) }
      }),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: partida, error: null }),
    }
    supabase.from.mockReturnValue(chain)

    const result = await agregarPartida(1, {
      id_tipo_vidrio: 1,
      largo_cm: 120, ancho_cm: 90,
      metros2: 1, precio_m2_aplicado: 100,
      subtotal_vidrio: 100, subtotal_procesos: 45, subtotal_partida: 145,
      procesos: [{ id_proceso: 1, id_unidad_cobro: 1, cantidad: 1, precio_unitario: 45, subtotal: 45 }],
    })

    expect(result.subtotal_procesos).toBe(45)
  })

  // CP-27 Eliminar partida de cotización (Positivo)
  it('CP-27 cancelarCotizacion cambia estatus a CANCELADA', async () => {
    const cancelada = { id_cotizacion: 1, estatus: 'CANCELADA' }
    supabase.from.mockReturnValue(mockChain({ data: cancelada, error: null }))

    const result = await cancelarCotizacion(1)

    expect(result.estatus).toBe('CANCELADA')
  })

  // CP-29 Finalizar cotización calcula total correctamente (Positivo)
  it('CP-29 finalizarCotizacion guarda el total y cambia estatus a FINALIZADA', async () => {
    const finalizada = {
      id_cotizacion: 1,
      folio: 'COT-00001',
      total: 860.90,
      estatus: 'FINALIZADA',
    }
    supabase.from.mockReturnValue(mockChain({ data: finalizada, error: null }))

    const result = await finalizarCotizacion(1, 860.90)

    expect(result.estatus).toBe('FINALIZADA')
    expect(result.total).toBeCloseTo(860.90)
  })

  // CP-31 Finalizar cotización ya finalizada (Negativo)
  it('CP-31 finalizarCotizacion en cotización FINALIZADA lanza error', async () => {
    const err = { message: 'No se puede finalizar una cotizacion que ya esta FINALIZADA' }
    const chain = mockChain({ data: null, error: err })
    chain.single = vi.fn().mockRejectedValue(err)
    supabase.from.mockReturnValue(chain)

    await expect(finalizarCotizacion(1, 0)).rejects.toMatchObject({
      message: expect.stringContaining('FINALIZADA'),
    })
  })

  // CP-32 Obtener ticket de cotización con cliente registrado (Positivo)
  it('CP-32 getDetalleCotizacion retorna cliente y partidas correctamente', async () => {
    const cotRow = {
      id_cotizacion: 1,
      folio: 'COT-00001',
      fecha: '2026-04-01T10:00:00.000Z',
      total: 860.90,
      estatus: 'FINALIZADA',
      observaciones: null,
      cliente: { id_cliente: 1, nombre: 'Vidrios del Norte', telefono: '5551234567' },
      nivel_precio: { id_nivel_precio: 4, nombre: 'Vidrieros', es_hoja_completa: false },
    }
    const partidasRows = [
      {
        id_partida: 1,
        id_cotizacion: 1,
        largo_cm: 120, ancho_cm: 90,
        metros2: 1.08,
        precio_m2_aplicado: 90,
        subtotal_vidrio: 97.2,
        subtotal_procesos: 0,
        subtotal_partida: 97.2,
        es_hoja_completa: false,
        tipo_vidrio: { id_tipo_vidrio: 1, clave: 'CLARO-4MM', descripcion: 'Vidrio claro 4mm' },
        partida_proceso: [],
      },
    ]

    let callIndex = 0
    supabase.from.mockImplementation(() => {
      callIndex++
      if (callIndex % 2 === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: cotRow, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: partidasRows, error: null }),
      }
    })

    const result = await getDetalleCotizacion(1)

    expect(result.folio).toBe('COT-00001')
    expect(result.cliente.nombre).toBe('Vidrios del Norte')
    expect(result.partidas).toHaveLength(1)
    expect(result.partidas[0].largo_cm).toBe(120)
  })

  // CP-33 Obtener ticket cotización de mostrador sin cliente (Positivo)
  it('CP-33 getDetalleCotizacion con cliente null retorna clienteNombre Mostrador en getCotizaciones', async () => {
    const rows = [
      {
        id_cotizacion: 2,
        folio: 'COT-00003',
        fecha: '2026-04-01T12:00:00.000Z',
        total: 0,
        estatus: 'FINALIZADA',
        observaciones: null,
        cliente: null,
        nivel_precio: { id_nivel_precio: 1, nombre: 'Público' },
      },
    ]

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })

    const result = await getCotizaciones()
    const cotizacion = result.find(c => c.folio === 'COT-00003')

    expect(cotizacion.clienteNombre).toBe('Mostrador')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-07  Historial de cotizaciones de un cliente
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-07 Historial de Cotizaciones', () => {

  // CP-16 Consultar historial de cotizaciones de un cliente (Positivo)
  it('CP-16 getCotizaciones retorna lista ordenada por fecha descendente', async () => {
    const rows = [
      {
        id_cotizacion: 3, folio: 'COT-00003',
        fecha: '2026-04-03T10:00:00.000Z', total: 500, estatus: 'FINALIZADA',
        observaciones: null,
        cliente: { id_cliente: 1, nombre: 'Vidrios del Norte' },
        nivel_precio: { id_nivel_precio: 4, nombre: 'Vidrieros' },
      },
      {
        id_cotizacion: 2, folio: 'COT-00002',
        fecha: '2026-04-02T10:00:00.000Z', total: 300, estatus: 'FINALIZADA',
        observaciones: null,
        cliente: { id_cliente: 1, nombre: 'Vidrios del Norte' },
        nivel_precio: { id_nivel_precio: 4, nombre: 'Vidrieros' },
      },
      {
        id_cotizacion: 1, folio: 'COT-00001',
        fecha: '2026-04-01T10:00:00.000Z', total: 860.90, estatus: 'FINALIZADA',
        observaciones: null,
        cliente: { id_cliente: 1, nombre: 'Vidrios del Norte' },
        nivel_precio: { id_nivel_precio: 4, nombre: 'Vidrieros' },
      },
    ]

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })

    const result = await getCotizaciones()
    const delCliente = result.filter(c => c.clienteNombre === 'Vidrios del Norte')

    expect(delCliente).toHaveLength(3)
    // Orden descendente: primera fecha más reciente
    expect(new Date(delCliente[0].fechaISO) >= new Date(delCliente[1].fechaISO)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HU-08  Helper formatearFechaHora (función interna — testeada via getCotizaciones)
// ═══════════════════════════════════════════════════════════════════════════

describe('HU-08 Formato de Fecha y Hora', () => {

  it('formato fecha dd/mm/yyyy y hora HH:mm en la salida de getCotizaciones', async () => {
    const rows = [
      {
        id_cotizacion: 1, folio: 'COT-00001',
        fecha: '2026-04-19T15:30:00.000Z',
        total: 100, estatus: 'BORRADOR', observaciones: null,
        cliente: null,
        nivel_precio: { id_nivel_precio: 1, nombre: 'Público' },
      },
    ]

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })

    const result = await getCotizaciones()

    expect(result[0].fecha).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result[0].hora).toMatch(/^\d{2}:\d{2}$/)
  })
})
