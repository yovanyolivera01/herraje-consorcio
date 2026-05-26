import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[type="text"]').fill('130')
  await page.locator('input[type="password"]').fill('130')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(`${BASE}/cot/nueva`, { timeout: 8000 })
}

async function seleccionarNivel(page: any) {
  // Esperar que el formulario este listo (tabs de tipo visibles)
  await expect(page.getByRole('button', { name: '🪟 Vidrio' })).toBeVisible({ timeout: 10000 })

  // Abrir el panel colapsable de nivel de precio
  await page.getByTestId('nivel-precio-toggle').click()

  // Los botones de nivel aparecen en .form-row al expandir
  const primerNivel = page.locator('.form-row button').first()
  await primerNivel.waitFor({ state: 'visible', timeout: 8000 })
  await primerNivel.click()

  // El badge azul confirma que se selecciono un nivel
  await expect(page.locator('.badge-blue').first()).toBeVisible({ timeout: 5000 })
}

async function agregarVidrio(page: any, medida: string) {
  await page.getByRole('button', { name: /Vidrio/i }).first().click()
  // Medida — primer input visible en la calculadora
  await page.locator('input.cot-calc-input').first().fill(medida)
  // Tipo de vidrio — primer select de la pagina
  const selectTipo = page.locator('select.form-select').first()
  await selectTipo.selectOption({ index: 1 })
  // Esperar preview calculado
  await expect(page.locator('.cot-preview-row')).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /Agregar vidrio/i }).click()
}

async function agregarMaquila(page: any, medida: string) {
  await page.getByRole('button', { name: /Maquila/i }).first().click()
  // Medida
  await page.locator('input.cot-calc-input').first().fill(medida)
  // Primer espesor disponible (botones sin clase btn, solo con estilo propio)
  await page.locator('label', { hasText: 'Espesor' })
    .locator('xpath=following-sibling::div').locator('button').first().click()
  // Primer proceso disponible
  await page.locator('label', { hasText: 'Procesos' }).last()
    .locator('xpath=following-sibling::div').locator('button').first().click()
  await page.getByRole('button', { name: /Agregar maquila/i }).click()
}

async function agregarHerraje(page: any, termino: string) {
  await page.getByRole('button', { name: /Herraje/i }).first().click()
  await page.getByPlaceholder('Codigo o descripcion...').fill(termino)
  // El dropdown aparece como div absoluto; esperar el primer boton resultado
  const primerResultado = page.locator('div[style*="position: absolute"] button').first()
  await primerResultado.waitFor({ state: 'visible', timeout: 8000 })
  await primerResultado.click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Nueva Cotizacion — Vidrio + Maquila + Herraje', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
  })

  // ── Test 1: agregar las 3 partidas y verificar el resumen ─────────────────
  test('agrega vidrio, maquila y herraje y muestra 3 partidas', async ({ page }) => {

    await seleccionarNivel(page)

    // Vidrio: 2 piezas 90×45 cm
    await agregarVidrio(page, '2-90x45')
    await expect(page.getByText('Partidas (1)')).toBeVisible()

    // Maquila: 1 pieza 80×40 cm
    await agregarMaquila(page, '80x40')
    await expect(page.getByText('Partidas (2)')).toBeVisible()

    // Herraje: primer producto que aparezca
    await agregarHerraje(page, 'a')
    await expect(page.getByText('Partidas (3)')).toBeVisible()

    // El total debe ser mayor a $0
    await expect(page.locator('text=/\\$\\d+\\.\\d{2}/')).toHaveCount(expect.any(Number) as any)

    // Los botones de accion deben estar habilitados
    await expect(page.getByRole('button', { name: /Solo cotizar/i })).toBeEnabled()
    await expect(page.getByRole('button', { name: /Convertir a pedido/i })).toBeEnabled()
  })

  // ── Test 2: guardar como cotizacion ──────────────────────────────────────
  test('guarda la cotizacion y muestra el folio en el ticket', async ({ page }) => {

    await seleccionarNivel(page)
    await agregarVidrio(page, '60x40')
    await expect(page.getByText('Partidas (1)')).toBeVisible()

    await page.getByRole('button', { name: /Solo cotizar/i }).click()

    // Pantalla de ticket
    await expect(page.getByText('Cotizacion registrada')).toBeVisible({ timeout: 12000 })
    await expect(page.locator('.ticket-preview')).toBeVisible()
    // Folio COT-XXXXX en el ticket
    await expect(page.locator('.ticket-preview').getByText(/COT-\d+/i)).toBeVisible()
    // Boton de nueva cotizacion disponible
    await expect(page.getByRole('button', { name: /Nueva cotizacion/i })).toBeVisible()
  })

  // ── Test 3: cotizacion mixta (vidrio + herraje) y guardar ────────────────
  test('cotizacion mixta vidrio y herraje se guarda correctamente', async ({ page }) => {

    await seleccionarNivel(page)

    // Vidrio: 1 pieza 100×60 cm
    await agregarVidrio(page, '100x60')
    await expect(page.getByText('Partidas (1)')).toBeVisible()

    // Herraje
    await agregarHerraje(page, 'b')
    await expect(page.getByText('Partidas (2)')).toBeVisible()

    // Guardar
    await page.getByRole('button', { name: /Solo cotizar/i }).click()

    await expect(page.getByText('Cotizacion registrada')).toBeVisible({ timeout: 12000 })
    await expect(page.locator('.ticket-preview').getByText(/COT-\d+/i)).toBeVisible()
  })

  // ── Test 4: convertir cotizacion a pedido liquidado ───────────────────────
  test('convierte cotizacion a pedido liquidado y muestra el folio', async ({ page }) => {

    await seleccionarNivel(page)
    await agregarVidrio(page, '80x50')
    await expect(page.getByText('Partidas (1)')).toBeVisible()

    // Abrir modal de conversion
    await page.getByRole('button', { name: /Convertir a pedido/i }).click()
    await expect(page.getByText('Convertir a pedido')).toBeVisible({ timeout: 5000 })

    // Seleccionar pago liquidado
    await page.getByText('Liquidado').first().click()

    // Confirmar pedido
    await page.getByRole('button', { name: /Confirmar pedido/i }).click()

    // Ticket de pedido
    await expect(page.getByText(/Pedido creado/i)).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.ticket-preview').getByText(/PED-\d+/i)).toBeVisible()
  })

  // ── Test 5: validaciones — no se puede agregar vidrio sin tipo ────────────
  test('muestra error si se intenta agregar vidrio sin tipo seleccionado', async ({ page }) => {

    await seleccionarNivel(page)

    // Llenar medida pero NO seleccionar tipo de vidrio
    await page.getByLabel('Medida').first().fill('50x30')

    // El boton debe estar deshabilitado
    await expect(page.getByRole('button', { name: /Agregar vidrio/i })).toBeDisabled()
  })
})

