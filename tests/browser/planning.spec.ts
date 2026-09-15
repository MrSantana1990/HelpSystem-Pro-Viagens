import { test, expect } from '@playwright/test';
test('guest planning survives account entry; saved plans remain private on desktop/mobile', async ({
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
  await expect(
    page.getByText('Explore sem cadastro', { exact: true }),
  ).toBeVisible();
  expect((await page.request.get('/v1/trips')).status()).toBe(401);
  await page.getByLabel('Nome da viagem', { exact: true }).fill(title);
  await page.getByLabel('Mês para explorar').fill('2028-02');
  await page.getByRole('button', { name: 'Explorar melhores datas' }).click();
  await expect(page.locator('.ranking li')).toHaveCount(5);
  await expect(page.locator('.calendar button')).toHaveCount(29);
  await page.locator('.calendar button').last().click();
  await expect(page.getByText('Custo total estimado')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.runtime/guest-' + testInfo.project.name + '.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Salvar meu planejamento', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Continuar sem conta', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.calendar button').last()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('button', { name: 'Salvar meu planejamento', exact: true })
    .click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('wrong-password');
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'E-mail ou senha inválidos.',
  );
  await dialog
    .getByRole('button', { name: 'Criar conta', exact: true })
    .click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Entre para salvar seus planos' }),
  ).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Minhas viagens' }),
  ).toBeVisible();
  await expect(page.getByText('Modo demonstração')).toBeVisible();
  await expect(page.getByLabel('Nome da viagem', { exact: true })).toHaveValue(
    title,
  );
  await expect(page.getByLabel('Mês para explorar')).toHaveValue('2028-02');
  await expect(page.locator('.ranking li')).toHaveCount(5);
  await expect(page.locator('.calendar button')).toHaveCount(29);
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
    page.getByText('Explore sem cadastro', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.journey-card')).toHaveCount(0);
  await expect(page.locator('.calendar button')).toHaveCount(0);
  await expect(page.getByLabel('Nome da viagem', { exact: true })).toHaveValue(
    'Minha próxima viagem',
  );
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Entre para salvar seus planos' }),
  ).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.locator('.journey-card').filter({ hasText: title }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});
