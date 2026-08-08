import { test, expect } from '@playwright/test';

const base = "http://192.168.0.240:5173/"

test('Cotizacion con vidrio, maquila y proceso extra', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Vidriero', exact: true }).click()

    // pieza 1: 2-87x90 LUNA-6MM + maquila de esmerila + bisel + Barreno 10mm
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-87x90')
    await page.getByRole('combobox').selectOption('LUNA-6MM')
    await page.locator('div').filter({ hasText: /^maquila de esmerila$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^Barreno 10mm$/ }).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()

    // pieza 2: 24x89 mismos procesos
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('24x89')
    await page.locator('div').filter({ hasText: /^maquila de esmerila$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^Barreno 10mm$/ }).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()

    // pieza 3: 6-87x89 mismos procesos
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('6-87x89')
    await page.locator('div').filter({ hasText: /^maquila de esmerila$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^Barreno 10mm$/ }).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()

    // tab maquila
    await page.getByRole('button', { name: '🔧 Maquila' }).click()

    // maquila 1: 2-77x77 9MM + C/P/B + bisel
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-77x77')
    await page.getByRole('button', { name: '9MM' }).click()
    await page.locator('div').filter({ hasText: /^C\/P\/B$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '🔧 Agregar maquila' }).click()

    // maquila 2: 6-100x100 mismo espesor y procesos
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('6-100x100')
    await page.getByRole('button', { name: '9MM' }).click()
    await page.locator('div').filter({ hasText: /^C\/P\/B$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '🔧 Agregar maquila' }).click()

    // maquila 3: 8-88x23 espesor 4MM, mismos procesos
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('8-88x23')
    await page.getByRole('button', { name: '4MM' }).click()
    await page.locator('div').filter({ hasText: /^C\/P\/B$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '🔧 Agregar maquila' }).click()

    // proceso extra: flete largo x2
    await page.locator('div').filter({ hasText: /^flete largo$/ }).nth(1).click()
    await page.getByRole('spinbutton').fill('2')
    await page.getByRole('button', { name: '➕', exact: true }).click()

    await expect(page.getByText('Partidas (7)')).toBeVisible()

    await page.getByRole('button', { name: '✓ Solo cotizar' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '🖨️ Imprimir' }).click()
});
