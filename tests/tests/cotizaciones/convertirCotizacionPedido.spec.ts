import { test, expect } from '@playwright/test';

const base = "http://192.168.0.240:5173/"

test('Convertir la primera cotizacion del historial a pedido', async ({ page }) => {
    await page.goto(base)
    await page.waitForTimeout(4000)
    //login
    await page.locator('input[type="text"]').fill('user')
    await page.locator('input[type="password"]').fill('129')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Reportes' }).click()
    await page.getByRole('link', { name: 'Cotizaciones' }).click()
    await expect(page).toHaveURL(`${base}cot/historial`)
    await page.waitForTimeout(2000)

    // primera fila de la tabla
    await page.getByRole('button', { name: 'Convertir a pedido' }).first().click()
    await page.getByRole('button', { name: 'Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '🖨️ Ticket' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});
