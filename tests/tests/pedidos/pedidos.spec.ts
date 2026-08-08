import { test, expect } from '@playwright/test';

const base = "http://192.168.0.240:5173/"

test('Pedido only extras', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Publico' }).click()
    // agregar extra suelto (sin vidrio)
    await page.locator('div').filter({ hasText: /^Kit$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕', exact: true }).click()
    await page.getByRole('button', { name: '📦 Convertir a pedido' }).click()
    await page.getByRole('radio', { name: 'Liquidado' }).click()
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '🖨️ Ticket' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});


test('Pedido only extras - 3 different quantities', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Publico' }).click()

    // extra 1: Cargada x3
    await page.locator('div').filter({ hasText: /^Cargada$/ }).nth(1).click()
    await page.getByRole('spinbutton').nth(0).fill('3')
    await page.getByRole('button', { name: '➕', exact: true }).nth(0).click()

    // extra 2: flete largo x2
    await page.locator('div').filter({ hasText: /^flete largo$/ }).nth(1).click()
    await page.getByRole('spinbutton').nth(1).fill('2')
    await page.getByRole('button', { name: '➕', exact: true }).nth(1).click()

    // extra 3: Kit x5
    await page.locator('div').filter({ hasText: /^Kit$/ }).nth(1).click()
    await page.getByRole('spinbutton').nth(2).fill('5')
    await page.getByRole('button', { name: '➕', exact: true }).nth(2).click()

    await expect(page.getByText('Partidas (3)')).toBeVisible()

    await page.getByRole('button', { name: '📦 Convertir a pedido' }).click()
    await page.getByRole('radio', { name: 'Liquidado' }).click()
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '🖨️ Ticket' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});


test('Pedido only maquila con mas de 3 procesos por partida', async ({ page }) => {
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
    await page.getByRole('button', { name: '🔧 Maquila' }).click()

    // pieza maquila: 3-90x90 6MM + 4 procesos (C/P/B, maquila de esmerila, Pulido, bisel)
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-90x90')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^C\/P\/B$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^maquila de esmerila$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^Pulido$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '🔧 Agregar maquila' }).click()

    await expect(page.getByText('Partidas (1)')).toBeVisible()

    await page.getByRole('button', { name: '📦 Convertir a pedido' }).click()
    await page.getByRole('radio', { name: 'Liquidado' }).click()
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '🖨️ Ticket' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});
