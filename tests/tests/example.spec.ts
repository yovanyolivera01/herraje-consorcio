import { test, expect } from '@playwright/test';

const BASE = 'http://192.168.0.237:3000';

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="username"]', '129');
  await page.fill('input[autocomplete="current-password"]', '129');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/proveedores`);
});

/*
test('agregar proveedor', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nuevo proveedor' }).click();
  await page.getByRole('textbox', { name: 'Nombre del proveedor' }).fill('7yrueheu');
  await page.getByRole('textbox', { name: 'Ej. 55 1234-' }).fill('55 1234 5678');
  await page.getByRole('button', { name: 'Registrar proveedor' }).click();
});

test('agregar producto', async ({ page }) => {
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(`${BASE}/productos`);
  await page.getByRole('button', { name: '+ Agregar producto' }).click();
  await page.getByRole('textbox', { name: 'Ej. PRD-001 o el código que' }).fill('HBOQ-102');
  const combobox = page.locator('form').getByRole('combobox').first();
  await expect(combobox.locator('option').nth(1)).toBeAttached();
  await combobox.selectOption({ index: 1 });
  await page.getByRole('textbox', { name: 'Marca del producto' }).fill('HBOQ');
  await page.getByRole('textbox', { name: 'Descripción del producto' }).fill('jaladera muro de acero inoxidable');
  await page.getByRole('textbox', { name: 'Ej. Natural, Café' }).fill('Natural');
  await page.getByPlaceholder('Ej. 6').fill('6');
  await page.getByPlaceholder('0.00').fill('150.00');
  await page.getByRole('button', { name: 'Agregar producto', exact: true }).click();
});

test('cambiar stock de producto', async ({ page }) => {
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(`${BASE}/productos`);
  await page.getByRole('button', { name: 'Stock' }).click();
  await page.locator('form').getByRole('combobox').selectOption({ label: 'Entrada de mercancía' });
  await page.getByRole('spinbutton').fill('10');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  await expect(page.getByRole('cell', { name: '10' })).toBeVisible();
  
});

test.only('make a product', async ({ page }) => {
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(`${BASE}/productos`);

  await page.getByRole('button', { name: '+ Agregar producto' }).click();

  await page.getByRole('textbox', { name: 'Ej. PRD-001 o el código que' }).fill('TEST-003');
  const combobox = page.locator('form').getByRole('combobox').first();
  await expect(combobox.locator('option').nth(1)).toBeAttached();
  await combobox.selectOption({ value: 'PRV-073' });
  await page.getByRole('textbox', { name: 'Marca del producto' }).fill('marca');
  await page.getByRole('textbox', { name: 'Descripción del producto' }).fill('Producto de prueba automatizada');
  await page.getByRole('textbox', { name: 'Ej. Natural, Café' }).fill('claro');
  await page.getByPlaceholder('Ej. 6').fill('6');
  await page.getByPlaceholder('0.00').fill('150.00');
  await page.getByRole('button', { name: 'Agregar producto', exact: true }).click();
  await expect(page.getByText('TEST-003')).toBeVisible();
});


*/


// test('agregar stock a todos los productos', async ({ page }) => {
// await page.getByRole('link', { name: 'Inventario' }).click();
// await expect(page).toHaveURL(`${BASE}/productos`);

// const botonesStock = page.getByRole('button', { name: 'Stock' });
// const total = await botonesStock.count();

// for (let i = 0; i < total; i++) {
// await botonesStock.nth(i).click();
// await page.locator('form').getByRole('combobox').selectOption({ label: 'Entrada de mercancía' });
// await page.getByRole('spinbutton').fill('10');
// await page.getByRole('button', { name: 'Registrar movimiento' }).click();
// }
// });

// test('quitar stock a todos los productos',async  ({page}) =>{

//   await page.getByRole('link', { name: 'Inventario' }).click();
//   await expect(page).toHaveURL(`${BASE}/productos`);
//   const botonesStock = page.getByRole('button', { name: 'Stock' });
//   const total = await botonesStock.count();

//   for (let i=0; i<total; i++){
//     await botonesStock.nth(i).click();
//     await page.locator('form').getByRole('combobox').selectOption({ label: 'Ajuste de inventario' });
//     await page.getByRole('spinbutton').fill('10');
//     await page.getByRole('button', { name: 'Registrar movimiento' }).click();
//   }


// });

test('ventas de productos', async ({ page }) => {
  await page.getByRole('link', { name: 'Nueva venta' }).click();
  await expect(page).toHaveURL(`${BASE}/ventas/nueva`);

  // Buscar producto por código o descripción
  await page.getByPlaceholder('Buscar producto por código o descripción...').fill('producto');
  await page.getByRole('button', { name: 'Producto de prueba automatizada TEST-001 · Natural · $150.00 5 pzas' }).click();
  
  // Confirmar venta
  await page.getByRole('button', { name: '✓ Confirmar venta', exact: true }).click();
  
  await page.pause();
  await page.getByRole('button', { name: 'Imprimir' }).click();
  await expect(page.getByText('TEST-001')).toBeVisible();
});