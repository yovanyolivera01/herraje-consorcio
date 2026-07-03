import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE     = 'http://localhost:5173'
const USERNAME = 'user'
const PASSWORD = '129'
const CLIENT   = 'yovany Abizael'

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForLoadState('networkidle')
}

async function crearPedidoCredito(page: Page, opts: {
  vidrio:    string
  medida:    string
  procesos?: string[]
}) {
  // 1. Seleccionar cliente — obligatorio para que aparezca CRÉDITO
  // Al seleccionar cliente, la sección se colapsa y el select de cliente desaparece del DOM
  await page.getByRole('combobox').first().selectOption({ label: CLIENT })

  // 2. Seleccionar tipo de vidrio — ahora es el único combobox visible (first)
  await page.getByRole('combobox').first().selectOption({ label: opts.vidrio })

  // 3. Llenar medida
  await page.getByPlaceholder('98x45  o  3-98x45').first().fill(opts.medida)

  // 4. Seleccionar procesos (opcional)
  for (const proceso of opts.procesos ?? []) {
    await page.getByText(proceso, { exact: false }).first().click()
  }

  // 5. Agregar vidrio
  await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()

  // 6. Convertir a pedido
  await page.getByRole('button', { name: '📦 Convertir a pedido' }).click()

  // 7. Esperar el modal
  await page.waitForSelector('.modal')

  // 8. Seleccionar CRÉDITO en el modal
  await page.getByText('Credito', { exact: true }).click()

  // 9. Confirmar pedido
  await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()

  // Verificar que se creó el pedido
  await expect(page.getByText(/PED-/i)).toBeVisible()
}

test.describe('Pedidos con crédito', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/cot/nueva`)
    await page.waitForLoadState('networkidle')
  })

  test('Crédito — vidrio con Filo muerto', async ({ page }) => {
    await crearPedidoCredito(page, {
      vidrio:   'CLARO-6MM',
      medida:   '88x89',
      procesos: ['Filo muerto'],
    })
  })

  test('Crédito — vidrio con Barreno', async ({ page }) => {
    await crearPedidoCredito(page, {
      vidrio:   'CLARO-6MM',
      medida:   '100x100',
      procesos: ['Barreno'],
    })
  })

  test('Crédito — vidrio con Bisel y Barreno', async ({ page }) => {
    await crearPedidoCredito(page, {
      vidrio:   'CLARO-6MM',
      medida:   '2-60x90',
      procesos: ['Bisel', 'Barreno'],
    })
  })

  test('Crédito — LUNA-3MM sin procesos', async ({ page }) => {
    await crearPedidoCredito(page, {
      vidrio: 'LUNA-3MM',
      medida: '50x80',
    })
  })

})
