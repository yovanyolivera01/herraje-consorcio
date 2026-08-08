import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE     = 'http://localhost:5173'
const USERNAME = 'user'
const PASSWORD = '129'



async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForLoadState('networkidle')
}


test.crearPedido('Pedidos', () => {
  await page.goto(`${BASE}/login`)
  await page.locator('input[autocomplete="username"]').fill(USERNAME)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForLoadState('networkidle')

})