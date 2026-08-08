import { test, expect } from '@playwright/test';

const base = "http://192.168.0.240:5173/"

test('Facturar el primer pedido del historial de ventas', async ({ page }) => {
    await page.goto(base)
    await page.waitForTimeout(4000)
    //login
    await page.locator('input[type="text"]').fill('user')
    await page.locator('input[type="password"]').fill('129')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Reportes' }).click()
    await page.getByRole('link', { name: /Ventas netas/i }).click()
    await expect(page).toHaveURL(`${base}cot/ventas`)
    await page.waitForTimeout(2000)

    // primera fila de la tabla
    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    await page.getByRole('button', { name: '🧾 Facturar' }).click()

    await page.getByRole('textbox', { name: '00000' }).fill('07550')
    await page.getByRole('textbox', { name: 'NOMBRE COMPLETO O RAZÓN SOCIAL' }).fill('publico general')
    await page.getByRole('button', { name: '🧾 Generar CFDI' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});
