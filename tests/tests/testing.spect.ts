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
    // touch buttin 
    await expect(page.url()).toBe(`${base}cot/nueva`)
    await page.getByRole('button', { name: 'Publico' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
});






test('pedido with anticipo', async ({ page }) => {
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
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.getByRole('radio', { name: 'Anticipo' }).click()
    await page.getByPlaceholder('0.00').fill('300')
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    //await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    
});





test('pedido for cobrar', async ({ page }) => {
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
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.getByRole('radio', { name: 'Por cobrar' }).click()
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    //await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    
});





test('cotizacion with a lot of pieces of glass', async ({ page }) => {
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
    // another piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('24x87')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    ///another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-98x89')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('4-12x78')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-99x12')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another 

    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('22-12x45')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })

    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)

    await page.pause()
});




test('Pedido only maquila', async ({ page }) => {
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
    await page.getByRole('button', { name: '🔧 Maquila' }).click()
    await page.pause()
    await page.getByRole('button', { name: 'Publico' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.getByText('Filo muerto').click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    // await page.getByRole('radio', { name: 'Por cobrar' }).click()
    // await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    // await page.waitForTimeout(2000)
    // await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    
});




test('Pedido with a lot of maquila', async ({ page }) => {
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
    await page.getByRole('button', { name: '🔧 Maquila' }).click()
    await page.pause()
    await page.getByRole('button', { name: 'Publico' }).click()
    /// piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99x99')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('25x78')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('12-98x12')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page 
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('14-23x56')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('7-67x67')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-98x89')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
});



test('Pedido with a lot of pieces of glass and maquila', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Carpintero' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99.5x99.3')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    // another piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('24.2x87.5')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    ///another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-98.2x89.7')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('4-12.7x78.2')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-99.5x12.8')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another 

    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('22-12.7x45.2')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })

    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    await page.getByRole('button', { name: '🔧 Maquila' }).click()
    await page.waitForTimeout(2000)
    /// piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99.5x99.3')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('25.5x78.7')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('12-98.4x12.5')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page 
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('14-23.8x56.2')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('7-67.2x67.4')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-98.6x89.9')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
})





test('Pedido with a lot of pieces with two or more process, glass and maquila', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Carpintero' }).click()
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99.5x99.3')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^miki$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    // another piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('24.2x87.5')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^miki$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    ///another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-98.2x89.7')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^miki$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('4-12.7x78.2')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another
    await expect(page.url()).toBe(`${base}cot/nueva`)
    
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('3-99.5x12.8')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    //another 

    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('22-12.7x45.2')
    await page.getByRole('combobox').selectOption({ label: "GRIS-6MM" })
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: '➕ Agregar vidrio' }).click()
    await page.getByRole('button', { name: '🔧 Maquila' }).click()
    await page.waitForTimeout(2000)
    /// piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('99.5x99.3')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('25.5x78.7')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('12-98.4x12.5')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page 
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('14-23.8x56.2')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //page
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('7-67.2x67.4')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    //piece
    await page.getByRole('textbox', { name: '98x45 o 3-98x45' }).fill('2-98.6x89.9')
    await page.getByRole('button', { name: '6MM' }).click()
    await page.locator('div').filter({ hasText: /^Filo muerto$/ }).nth(1).click()
    await page.locator('div').filter({ hasText: /^bisel$/ }).nth(1).click()
    await page.getByRole('button', { name: ' Agregar maquila' }).click()
    // page
    await page.getByRole('button', { name: '📦 Pedido' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)
    await page.pause()
})



test('Cotizacion', async ({ page }) => {
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
    await page.getByRole('button', { name: '✓ Solo cotizar' }).click()
    await page.waitForTimeout(2000)
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