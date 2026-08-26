import { test, expect } from '@playwright/test';

const base = "http://192.168.0.240:5173/"

test('Cotizacion registrada muestra botones de compartir (WhatsApp / Correo)', async ({ page }) => {
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
    await expect(page.url()).toBe(`${base}cot/nueva`)

    // pieza de vidrio con un proceso
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-60x60')
    await page.getByRole('combobox').selectOption('CLARO-6MM')
    await page.locator('div').filter({ hasText: /^Templado$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()

    // proceso extra suelto
    await page.locator('div').filter({ hasText: /^Kit de luz$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕', exact: true }).click()

    await expect(page.getByText('Partidas (2)')).toBeVisible()

    await page.getByRole('button', { name: '✓ Solo cotizar' }).click()
    await page.waitForTimeout(2000)

    // botones de compartir generados por el componente CompartirBotones
    await expect(page.getByRole('button', { name: '📱 WhatsApp' })).toBeVisible()
    await expect(page.getByRole('button', { name: '✉️ Correo' })).toBeVisible()

    const [waPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('button', { name: '📱 WhatsApp' }).click(),
    ])
    await waPage.waitForLoadState()
    expect(waPage.url()).toContain('whatsapp.com')

    await page.pause()
});
