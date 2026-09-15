// Run only through the private SSH tunnel with the pinned staging certificate.
import { chromium } from '@playwright/test';
import { X509Certificate, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const certificate = new X509Certificate(readFileSync(process.argv[2]));
const pin = createHash('sha256')
  .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
  .digest('base64');
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'chrome',
  args: ['--ignore-certificate-errors-spki-list=' + pin],
});
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const account = {
      email:
        'staging-browser-' +
        randomBytes(8).toString('hex') +
        '@example.invalid',
      password: randomBytes(32).toString('hex'),
    };
    await page.goto('https://localhost:18094');
    await page
      .getByRole('button', { name: 'Criar conta', exact: true })
      .click();
    await page.getByLabel('E-mail', { exact: true }).fill(account.email);
    await page.getByLabel('Senha', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Entre para salvar seus planos' })
      .waitFor();
    await page.getByLabel('Senha', { exact: true }).fill(account.password);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Entrar', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Minhas viagens' }).waitFor();
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === '__Host-viagens_session');
    assert.ok(
      session?.httpOnly && session.secure && session.sameSite === 'Lax',
    );
    const title = 'Staging ' + name;
    await page.getByLabel('Nome da viagem', { exact: true }).fill(title);
    await page.getByLabel('Mês para explorar').fill('2028-02');
    await page.getByRole('button', { name: 'Explorar melhores datas' }).click();
    await page.locator('.calendar button').first().waitFor();
    assert.equal(await page.locator('.calendar button').count(), 29);
    await page.locator('.calendar button').first().click();
    await page.getByRole('button', { name: 'Salvar viagem e cenário' }).click();
    await page.locator('.scenario-card').waitFor();
    await page.reload();
    await page.locator('.journey-card').filter({ hasText: title }).click();
    await page.locator('.scenario-card').waitFor();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Entre para salvar seus planos' })
      .waitFor();
    await page.getByLabel('E-mail', { exact: true }).fill(account.email);
    await page.getByLabel('Senha', { exact: true }).fill(account.password);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Entrar', exact: true })
      .click();
    await page.locator('.journey-card').filter({ hasText: title }).click();
    await page.locator('.scenario-card').waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: '.runtime/staging-' + name + '.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await context.close();
    console.log(
      JSON.stringify({
        browser: name,
        status: 'passed',
        tls: 'specific-SPKI-pin',
        secureCookie: true,
        persistence: true,
        errors: 0,
        overflow: false,
      }),
    );
  }
} finally {
  await browser.close();
}
