# HelpSystem Pro Viagens

Planejamento de viagens com identidade, sessão e persistência local reais. Voos e hotéis continuam **DEMO / SIMULADOS**; o Travel Score v0 mede apenas adequação ao orçamento.

## Executar localmente

Requer Node.js 22.13+ (linha 22), npm e Docker Desktop/Compose em execução.

```sh
npm ci
npm run local:setup
npm run local:up
```

Abra http://localhost:8094, cadastre seu e-mail com senha de pelo menos 12 caracteres e entre. Não existe conta/senha padrão. A configuração gera três credenciais PostgreSQL independentes em .env protegido, sem imprimi-las.

local:up constrói imagens, inicia o PostgreSQL próprio, gera backup pré-migration, aplica migrations com a role migrator e inicia web/API. Não provisiona staging e não acessa VPS. PostgreSQL e Redis não publicam portas no ambiente principal.

Para parar preservando planos e backups:

```sh
docker compose --env-file .env -f infra/compose.yml stop
```

## Experiência disponível

Cadastro, login/logout, sessão persistente e revogável; minhas viagens; criar, abrir, editar, excluir e duplicar planos; salvar/editar/excluir cenários; comparar de um a três cenários. Calendário, top cinco e detalhamento financeiro da Fase 0 preservados.

Um plano pode começar sem cenário e guardar até 20 snapshots. Alterar parâmetros do plano não reescreve os cenários antigos. Para mudar um cenário, use Editar cenário e recalcule as datas quando alterar os parâmetros. Valores e proveniência são calculados no servidor, em centavos inteiros de BRL.

## Verificar

```sh
npm run check
npm run test:system
npm audit --audit-level=high
npm run backup
```

check executa formatação, lint, TypeScript, testes sem banco e build. test:system cria um projeto Docker descartável próprio, executa as migrations duas vezes, testes com runtime real/RLS, navegador desktop/mobile e backup/restore; depois remove somente seus contêineres e volumes de teste. Não usa o banco local principal. Chromium: `npx playwright install chromium`; opcionalmente PW_CHANNEL=chrome para Chrome instalado.

Os testes descartáveis usam loopback 15495 (PostgreSQL) e 18095 (web). O ambiente principal usa 8094. Evidências locais ficam em .runtime, ignorado no Git.

## Documentação

[Auditoria](docs/AUDIT.md) · [Arquitetura](docs/ARCHITECTURE.md) · [Decisões](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md) · [Ambientes](docs/ENVIRONMENT.md) · [Deploy](docs/DEPLOYMENT.md) · [Operações e restore](docs/OPERATIONS.md) · [Segurança](docs/SECURITY.md) · [Validação](docs/VALIDATION.md) · [Lacunas](docs/CONTEXT_GAPS.md).

Fora desta fase: staging/produção, DNS, providers comerciais, e-mail, pagamento, alertas, PWA offline e B2B. Repositório público: não versionar .env, dumps, logs privados ou manuais de outros produtos.
