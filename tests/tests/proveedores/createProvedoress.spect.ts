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
  await page.goto(`${BASE_URL}/proveedores`)
})

test('should open the new proveedor modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await expect(page.getByText('Nuevo proveedor')).toBeVisible()
})

test('should show validation errors when submitting empty form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await page.getByRole('button', { name: 'Registrar proveedor' }).click()
  await expect(page.getByText('El nombre es obligatorio')).toBeVisible()
})

test('should create a new proveedor successfully', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await page.getByPlaceholder('Nombre del proveedor').fill('Proveedor Test Playwright')
  await page.getByPlaceholder('Ej. 55 1234-5678').fill('5512345678')
  await page.getByRole('button', { name: 'Registrar proveedor' }).click()
  await expect(page.getByText('Proveedor registrado correctamente')).toBeVisible()
  await expect(page.getByText('Proveedor Test Playwright')).toBeVisible()
})

test('should close modal when clicking cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await expect(page.getByText('Nuevo proveedor')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Nuevo proveedor')).not.toBeVisible()
})

test('should reject letters in telefono field', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await page.getByPlaceholder('Ej. 55 1234-5678').fill('abcdefg')
  await expect(page.getByPlaceholder('Ej. 55 1234-5678')).toHaveValue('')
})


test('Create proveedor', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click()
  await page.getByPlaceholder('Nombre del proveedor').fill('Arturo Valdez ')
  await page.getByPlaceholder('Ej. 55 1234-5678').fill('5541739271')
  await page.getByRole('button', { name: 'Registrar proveedor' }).click()
  await expect(page.getByText('Proveedor registrado correctamente')).toBeVisible()
  await page.pause()
})

test('eliminate proveedor', async ({ page }) => {
  const row = page.getByRole('row', { name: /Arturo Valdez/i })
  await row.getByRole('button', { name: '🗑️' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByText('Proveedor eliminado')).toBeVisible()
})

test('eliminar proveedor',async({page}) => {
  const deleteButtons = page.getByRole('button', { name: '🗑️' })
    const count = await deleteButtons.count()

    for(let i=0; i<5; i++){
      await deleteButtons.first().click()
      await page.getByRole('button',{ name: 'Sí, eliminar' }).click()
    }

})

test('cotizacion vidrio y maquila', async ({ page }) => {
    await page.goto(base)
    await page.waitForTimeout(4000)
    //login 
    await page.locator('input[type="text"]').fill('user')
    await page.locator('input[type="password"]').fill('129')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Ventas' }).click()
    // Abrir la ruta desde el menú lateral
    await page.getByRole('link', { name: /Nueva cotizacion/i }).click()
    await page.waitForTimeout(1000)
    // touch buttin 
    await expect(page.url()).toBe(`${base}cot/nueva`)
    await page.getByRole('button', { name: 'Publico' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    await page.getByRole('button', { name: '🔧 Maquila' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.getByRole('button', { name: 'esmerilado', exact: true }).click()
    await page.getByRole('button', { name: '🔧 Agregar maquila' }).click()
    await page.getByRole('button', { name: '🧰 Herraje' }).click()
    await page.getByRole('textbox', { name: 'Codigo o descripcion...' }).fill('silicon')
    await page.getByRole('button', { name: '🧰 Silicon tubo · $90.00 ' }).click()
    await page.getByRole('textbox', { name: 'Codigo o descripcion...' }).fill('jaladera')
    await page.getByRole('button', { name: '📦 Jaladera toallero 30 cm' }).click()
    await page.getByRole('button', { name: '📦 Convertir a pedido' }).click()
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(4000)
    await page.pause()
});