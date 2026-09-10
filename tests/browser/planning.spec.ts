import { test, expect } from '@playwright/test';
test('explores a month and selects a detailed scenario without horizontal overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Modo demonstração')).toBeVisible();
  await page.getByLabel('Mês para explorar').fill('2028-02');
  await page.getByRole('button', { name: 'Explorar melhores datas' }).click();
  await expect(page.locator('.ranking li')).toHaveCount(5);
  await expect(page.locator('.calendar button')).toHaveCount(29);
  await page.locator('.calendar button').last().click();
  await expect(page.locator('.calendar button').last()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Custo total estimado')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: '.runtime/preview-' + testInfo.project.name + '.png',
    fullPage: true,
  });
});
