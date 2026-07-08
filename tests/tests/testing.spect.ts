import { test,expect } from '@playwright/test';

const base = "http://192.168.253.1:5173/"


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
    await expect(page.url()).toBe(`${base}cot/nueva`)
    await page.getByRole('button', { name: 'Público' }).click()
    await page.pause()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('combobox').selectOption({ label: "CLARO-3MM" })
    await page.getByRole('button', { name: 'canto', exact: true }).click()
    await page.pause()
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

test('Ir a reportes',async ({page}) =>{
    await page.goto(base)
    await page.locator('input[type="text"]').fill('129')
    await page.locator('input[type="password"]').fill('129')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Reportes' }).click()
    await page.getByRole('link', { name: /Ventas netas/i }).click()
    await expect(page).toHaveURL(`${base}cot/ventas`)
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    await page.waitForTimeout(4000)
    await page.pause()
});

test('ir a reporte herraje',async ({page}) =>{
    await page.goto(base)
    await page.waitForTimeout(4000)
    //login 
    await page.locator('input[type="text"]').fill('129')
    await page.locator('input[type="password"]').fill('129')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForTimeout(4000)
    await page.getByRole('button', { name: 'Reportes' }).click()
    // Abrir la ruta desde el menú lateral
    await page.getByRole('link', { name: 'Historial de maquila' }).click()
    await expect(page.url()).toBe(`${base}cot/historial-maquila`)
    await page.waitForTimeout(4000)
    await page.pause()
    
});

test('Pedido con anticipo',async ({page}) =>{

  await page.goto(base)
  await page.locator('input[type="text"]').fill('129')
  await page.locator('input[type="password"]').fill('129')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'Ventas' }).click()
  // Abrir la ruta desde el menú lateral
  await page.getByRole('link', { name: /Nueva cotizacion/i }).click()
  await page.waitForTimeout(1000)
  await expect(page.url()).toBe(`${base}cot/nueva`)
  await page.getByRole('button', { name: 'Público' }).click()
  await page.pause()
  await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-120x99')
  await page.getByRole('combobox').selectOption({ label: "CLARO-6MM" })
  await page.getByRole('button', { name: 'canto', exact: true }).click()
  await page.getByRole('button', { name: 'Templado' }).click()
  await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
  await page.getByRole('button', { name: '🔧 Maquila' }).click()
  await page.getByRole('button', { name: '📦 Convertir a pedido' }).click ()
  await page.getByRole('radio', { name: 'Anticipo Pago parcial · queda' }).click()
  await page.getByPlaceholder('0.00').fill('1000')
  await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('link', { name: 'Pendientes' }).click()
  await expect(page).toHaveURL(`${base}cot/pedidos-pendientes`)
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click()
  await page.waitForTimeout(5000)
  await page.getByRole('button', { name: '📦 Marcar como entregado' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: '✅ Confirmar — cobrar $' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'Reportes' }).click()
  await page.getByRole('link', { name: /Ventas netas/i }).click()
  await expect(page).toHaveURL(`${base}cot/ventas`)
  await page.getByRole('button', { name: 'Ver detalle' }).first().click()
  await page.waitForTimeout(4000)
  await page.pause()
})

test('crear nuevo proceso',async ({page}) =>{
  await page.goto(base)
  await page.locator('input[type="text"]').fill('129')
  await page.locator('input[type="password"]').fill('129')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'catalogos' }).click()
  await page.getByRole('link', { name: 'Procesos' }).click()
  await expect(page).toHaveURL(`${base}cot/procesos`)
  await page.getByRole('button', { name: '+ Nuevo proceso' }).click()
  await page.getByRole('textbox', { name: 'Ej. Pulido de canto, Biselado' }).fill("Chaflan")
  await page.getByRole('combobox').selectOption("m2 — Metro cuadrado")
  await page.getByPlaceholder('0.00').nth(3).fill("200")
  await page.getByPlaceholder('0.00').nth(4).fill("150")
  await page.getByPlaceholder('0.00').nth(5).fill("100")
  await page.getByRole('button', { name: 'Crear proceso' }).click()
  await page.waitForTimeout(7000)
  await expect(page.getByText('Proceso creado ✅')).toBeVisible({ timeout: 7000 })

  /*
  await page.getByRole('combobox').select
  */

});


test('crear nuevo proceso barreno',async ({page}) =>{
  await page.goto(base)
  await page.locator('input[type="text"]').fill('129')
  await page.locator('input[type="password"]').fill('129')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'catalogos' }).click()
  await page.getByRole('link', { name: 'Procesos' }).click()
  await expect(page).toHaveURL(`${base}cot/procesos`)
  await page.getByRole('button', { name: /Barrenos/ }).click()
  await page.getByRole('button', { name: '+ Nuevo barreno' }).click()
  await page.waitForTimeout(1000)
  await page.getByPlaceholder('Ej. 6, 8, 10,').fill("10")
  await page.getByRole('row', { name: 'Público' }).getByPlaceholder('0.00').fill("50")
  await page.getByRole('row', { name: 'Carpintero' }).getByPlaceholder('0.00').fill("40")
  await page.getByRole('row', { name: 'Vidriero' }).getByPlaceholder('0.00').fill("30")
  await page.getByRole('button', { name: 'Crear barreno' }).click()
  await expect(page.getByRole('button', { name: '+ Nuevo barreno' })).toBeVisible({timeout:1000})
  /*
  await page.getByRole('combobox').select
  */

});