import { test, expect } from '@playwright/test'

const BASE = 'http://192.168.0.240:5174'

// ── Navegación general ────────────────────────────────────────────────────────
test('redirige a /proveedores al abrir la app', async ({ page }) => {
  await page.goto(BASE)
  await expect(page).toHaveURL(/\/proveedores/)
  await expect(page).toHaveTitle(/herraje-consorcio/)
})

// ── Productos ─────────────────────────────────────────────────────────────────
test('muestra la página de productos', async ({ page }) => {
  await page.goto(`${BASE}/productos`)
  await expect(page.getByRole('heading', { name: /producto/i })).toBeVisible()
})

test('abre el modal para agregar un producto', async ({ page }) => {
  await page.goto(`${BASE}/productos`)
  await page.getByRole('button', { name: /nuevo|agregar/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('valida campos obligatorios al guardar producto vacío', async ({ page }) => {
  await page.goto(`${BASE}/productos`)
  await page.getByRole('button', { name: /nuevo|agregar/i }).first().click()
  await page.getByRole('button', { name: /guardar/i }).click()
  await expect(page.getByText(/obligatorio|requerido/i).first()).toBeVisible()
})

// ── Nueva Venta ───────────────────────────────────────────────────────────────
test('muestra la página de nueva venta', async ({ page }) => {
  await page.goto(`${BASE}/ventas/nueva`)
  await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible()
})

test('busca un producto en nueva venta', async ({ page }) => {
  await page.goto(`${BASE}/ventas/nueva`)
  await page.getByPlaceholder(/buscar producto/i).fill('a')
  // espera resultados o estado vacío
  await page.waitForTimeout(500)
})

test('muestra el historial de ventas', async ({ page }) => {
  await page.goto(`${BASE}/ventas/historial`)
  await expect(page.getByRole('heading', { name: /historial/i })).toBeVisible()
})

// ── Nueva Cotización ──────────────────────────────────────────────────────────
test('muestra la página de nueva cotización', async ({ page }) => {
  await page.goto(`${BASE}/cot/nueva`)
  await expect(page.getByRole('heading', { name: /cotiz/i })).toBeVisible()
})

test('muestra el historial de cotizaciones', async ({ page }) => {
  await page.goto(`${BASE}/cot/historial`)
  await expect(page.getByRole('heading', { name: /historial/i })).toBeVisible()
})

test('muestra la página de clientes', async ({ page }) => {
  await page.goto(`${BASE}/cot/clientes`)
  await expect(page.getByRole('heading', { name: /cliente/i })).toBeVisible()
})
