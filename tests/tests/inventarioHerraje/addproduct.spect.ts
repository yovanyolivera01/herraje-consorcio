import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const USERNAME = 'user'
const PASSWORD = '129'

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/proveedores|\/cot\/nueva/)
  await page.goto(`${BASE_URL}/productos`)
})

test('should open the add product modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar producto' }).click()
  await expect(page.getByText('Agregar producto')).toBeVisible()
})

test('should show validation errors when submitting empty form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar producto' }).click()
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await expect(page.getByText('El código es obligatorio')).toBeVisible()
  await expect(page.getByText('Selecciona un proveedor')).toBeVisible()
  await expect(page.getByText('La marca es obligatoria')).toBeVisible()
  await expect(page.getByText('La descripción es obligatoria')).toBeVisible()
  await expect(page.getByText('El tono es obligatorio')).toBeVisible()
})

test('should close modal when clicking cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar producto' }).click()
  await expect(page.getByText('Agregar producto')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Agregar producto')).not.toBeVisible()
})

test('should create a new product successfully', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar producto' }).click()
  await page.getByPlaceholder('Ej. PRD-001').fill('TEST-001')
  await page.getByRole('combobox').first().selectOption({ index: 1 })
  await page.getByPlaceholder('Marca del producto').fill('Marca Test')
  await page.getByPlaceholder('Descripción del producto').fill('Producto de prueba Playwright')
  await page.getByPlaceholder('Ej. Natural, Café...').fill('Natural')
  await page.getByPlaceholder('Ej. 6').fill('6')
  await page.getByPlaceholder('0.00').fill('100')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await expect(page.getByText('Producto agregado ✅')).toBeVisible()
  await expect(page.getByText('TEST-001')).toBeVisible()
})

test('should delete a product', async ({ page }) => {
  const row = page.getByRole('row', { name: /TEST-001/i })
  await row.getByRole('button', { name: '🗑️' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByText('Producto eliminado')).toBeVisible()
})
