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
  await page.goto(`${BASE_URL}/personal/turnos`)
})

test('should open the new turno modal with Lun-Sáb selected by default', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await expect(page.getByText('Nuevo turno')).toBeVisible()
  for (const dia of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']) {
    await expect(page.getByRole('button', { name: dia })).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByRole('button', { name: 'Dom' })).toHaveAttribute('aria-pressed', 'false')
})

test('should show validation errors when submitting empty form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('La hora de inicio es obligatoria')).toBeVisible()
  await expect(page.getByText('La hora de fin es obligatoria')).toBeVisible()
})

test('should reject a tolerancia greater than 30 minutes', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()

  const modal = page.locator('.modal').filter({ hasText: 'Nuevo turno' })
  await modal.getByRole('textbox').nth(0).fill('08:00')
  await modal.getByRole('textbox').nth(1).fill('17:00')
  await modal.getByRole('spinbutton').fill('31')
  await modal.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('La tolerancia no puede ser mayor a 30 minutos')).toBeVisible()
  await expect(page.getByText('Nuevo turno')).toBeVisible() // el modal no se cierra: no se guardó
})

test('should close modal when clicking cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await expect(page.getByText('Nuevo turno')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Nuevo turno')).not.toBeVisible()
})

// La app no expone sp_update_turno/sp_delete_turno todavía, así que cada
// corrida de estos tests deja filas nuevas en turno y la tolerancia está
// acotada a 0-30 (solo 31 valores posibles) — con corridas repetidas es
// cuestión de tiempo que se repita un mismo valor. La prueba real de éxito
// es que el modal se cierre (createTurno() solo hace eso si no lanzó error);
// el chequeo de la fila usa .first() para no exigir que sea la única con
// esos datos.
test('should create a turno with the default Lun-Sáb days', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()

  // Ojo: hay que acotar los locators al modal — la barra lateral también
  // tiene un textbox ("Buscar módulo...") que hace que getByRole('textbox')
  // sin acotar recoja ese campo primero y desfase los índices.
  const modal = page.locator('.modal').filter({ hasText: 'Nuevo turno' })
  await modal.getByRole('textbox').nth(0).fill('08:00') // Hora inicio
  await modal.getByRole('textbox').nth(1).fill('17:00') // Hora fin
  await modal.getByRole('spinbutton').fill('20')
  await modal.getByRole('button', { name: 'Guardar' }).click()

  // el modal solo se cierra cuando createTurno() resuelve sin lanzar error
  await expect(page.getByText('Nuevo turno')).not.toBeVisible()

  const row = page.getByRole('row', { name: /08:00:00.*17:00:00/ }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('Lun, Mar, Mié, Jue, Vie, Sáb')
})

test('should create a turno with a custom day selection', async ({ page }) => {
  await page.getByRole('button', { name: '+ Agregar' }).click()

  const modal = page.locator('.modal').filter({ hasText: 'Nuevo turno' })
  await modal.getByRole('textbox').nth(0).fill('16:00') // Hora inicio
  await modal.getByRole('textbox').nth(1).fill('23:00') // Hora fin
  await modal.getByRole('spinbutton').fill('25')
  await modal.getByRole('button', { name: 'Sáb' }).click() // quita el sábado
  await modal.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Nuevo turno')).not.toBeVisible()

  const row = page.getByRole('row', { name: /16:00:00.*23:00:00/ }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('Lun, Mar, Mié, Jue, Vie')
})
