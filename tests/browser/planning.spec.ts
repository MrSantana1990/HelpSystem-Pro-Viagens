import { test, expect } from '@playwright/test';
test('identity, planning, reload, comparison, edit, duplicate and logout persist on desktop/mobile', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email =
    'browser-' + testInfo.project.name + '-' + Date.now() + '@example.invalid';
  const password = 'Synthetic-browser-password-2026';
  const title = 'Recife · ' + testInfo.project.name;
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Entre para planejar' }),
  ).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Minhas viagens' }),
  ).toBeVisible();
  await expect(page.getByText('Modo demonstração')).toBeVisible();
  await page.getByLabel('Nome da viagem', { exact: true }).fill(title);
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
  await page.getByRole('button', { name: 'Salvar viagem e cenário' }).click();
  await expect(
    page.locator('.journey-card').filter({ hasText: title }),
  ).toBeVisible();
  await expect(page.locator('.scenario-card')).toHaveCount(1);
  await page.reload();
  await page.locator('.journey-card').filter({ hasText: title }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Editar cenário', exact: true })
    .click();
  await page.getByLabel('Nome do cenário', { exact: true }).fill('Econômico');
  await page
    .getByRole('button', { name: 'Atualizar cenário', exact: true })
    .click();
  await expect(
    page
      .locator('.scenario-card')
      .getByRole('heading', { name: 'Econômico', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explorar melhores datas' }).click();
  await page.getByLabel('Nome do cenário', { exact: true }).fill('Alternativa');
  await page.getByRole('button', { name: 'Salvar viagem e cenário' }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(2);
  await page.getByLabel('Comparar Econômico', { exact: true }).check();
  await page.getByLabel('Comparar Alternativa', { exact: true }).check();
  await page
    .getByRole('button', { name: 'Comparar selecionados (2/3)', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Comparação de cenários' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.runtime/identity-' + testInfo.project.name + '.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Duplicar viagem', exact: true })
    .click();
  await expect(page.locator('.journey-card')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Excluir viagem', exact: true })
    .click();
  await expect(page.locator('.journey-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Entre para planejar' }),
  ).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.locator('.journey-card').filter({ hasText: title }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});
