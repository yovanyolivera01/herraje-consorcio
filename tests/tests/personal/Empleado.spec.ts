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
  // Ruta real registrada en App.jsx es en minúsculas ("personal/empleados").
  await page.goto(`${BASE_URL}/personal/empleados`)
})

test('should open the new empleado modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo empleado' })).toBeVisible()
})

test('should show validation errors when submitting empty form', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es obligatorio')).toBeVisible()
  await expect(page.getByText('El apellido paterno es obligatorio')).toBeVisible()
  await expect(page.getByText('El teléfono es obligatorio')).toBeVisible()
  await expect(page.getByText('El puesto es obligatorio')).toBeVisible()
})

test('should close modal when clicking cancel', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo empleado' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo empleado' })).not.toBeVisible()
})

test('should create and then dar de baja a new empleado', async ({ page }) => {
  // Teléfono único por corrida — empleados.telefono tiene un unique index
  // (uq_empleados_telefono), así que reusar un valor fijo falla en la
  // segunda corrida con "Ya existe un empleado con ese teléfono."
  // (nombre NO puede llevar un sufijo numérico para hacerlo único: el
  // input de Nombre le quita cualquier dígito mientras se escribe — ver
  // setTexto() en formEmpleado.jsx — así que se identifica la fila por
  // teléfono en vez de por nombre.)
  const telefono = `55${Date.now().toString().slice(-8)}`

  await page.getByRole('button', { name: '+ Nuevo empleado' }).click()

  const modal = page.locator('.modal').filter({ hasText: 'Nuevo empleado' })
  await modal.getByPlaceholder('Nombre').fill('PlaywrightTest')
  await modal.getByPlaceholder('Apellido paterno').fill('Prueba')
  await modal.getByPlaceholder('Teléfono').fill(telefono)
  // El primer <option> es el placeholder "Selecciona un puesto" — se elige
  // el segundo (el primer puesto real) sin depender de qué puestos de
  // prueba existan ya en la base.
  await modal.locator('select').selectOption({ index: 1 })
  await modal.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Empleado registrado correctamente ✅')).toBeVisible()
  const fila = page.getByRole('row', { name: new RegExp(telefono) })
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('PlaywrightTest')

  // Limpieza: a diferencia de turnos (sin delete), empleados sí tiene baja
  // (soft delete vía id_estado=0) — se usa para no dejar acumulando
  // empleados de prueba en cada corrida.
  await fila.getByRole('button', { name: '🗑️' }).click()
  await page.getByRole('button', { name: 'Sí, dar de baja' }).click()
  await expect(page.getByText('Empleado dado de baja')).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(telefono) })).not.toBeVisible()
})


test('only create empleado', async ({ page }) => {
  // Teléfono único por corrida (uq_empleados_telefono).
  const telefono = `55${Date.now().toString().slice(-8)}`

  await page.getByRole('button', { name: '+ Nuevo empleado' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo empleado' })).toBeVisible()

  const modal = page.locator('.modal').filter({ hasText: 'Nuevo empleado' })
  await modal.getByPlaceholder('Nombre').fill('PlaywrightCreate')
  await modal.getByPlaceholder('Apellido paterno').fill('Prueba')
  await modal.getByPlaceholder('Apellido materno').fill('Completo')
  await modal.getByPlaceholder('Teléfono').fill(telefono)
  await modal.locator('select').selectOption({ index: 1 })
  await modal.getByPlaceholder('Calle y número').fill('Av. Reforma 123')
  await modal.getByPlaceholder('Colonia').fill('Centro')
  await modal.getByPlaceholder('Ciudad').fill('Monterrey')
  await modal.getByPlaceholder('Código postal').fill('64000')
  await modal.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Empleado registrado correctamente ✅')).toBeVisible()
  const fila = page.getByRole('row', { name: new RegExp(telefono) })
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('PlaywrightCreate')
})