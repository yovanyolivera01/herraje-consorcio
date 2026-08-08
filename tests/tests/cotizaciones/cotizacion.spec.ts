
import { test, expect } from '@playwright/test';

const base = "http://localhost:5173/"

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
    await page.getByRole('button', { name: 'Solo cotizar' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '📦 Confirmar pedido' }).click()
    await page.waitForTimeout(2000)

    await page.pause()
});

