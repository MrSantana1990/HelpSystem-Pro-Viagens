# Validação — 10/09/2026

A Fase 1 foi exercitada localmente com PostgreSQL 16 real e credenciais distintas para administração, migrations e runtime.

| Verificação           | Evidência                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`       | Formatação, ESLint, TypeScript strict, 14 testes sem dependência de banco e build. Os 19 testes de runtime são executados separadamente, com banco obrigatório.                                                      |
| `npm run test:system` | Ambiente Docker descartável; migrations executadas duas vezes; 19 testes de autenticação, sessão, autorização, Trip, Scenario, contratos e RLS passaram.                                                             |
| Isolamento A × B      | GET/PATCH/DELETE/duplicação/cenários negados nos dois sentidos; respostas 404 uniformes; listagem restrita; consultas diretas sob runtime real e transações concorrentes sem vazamento de contexto.                  |
| Desktop e mobile      | 2 fluxos completos passaram: cadastro/login, salvar, reload, editar cenário, comparar, duplicar, excluir, logout e novo login. Calendário, Top 5 e detalhamento preservados, sem page errors ou overflow horizontal. |
| Docker                | Imagens API/web construídas; PostgreSQL e aplicação saudáveis no ambiente de teste.                                                                                                                                  |
| Dependências          | `npm audit --audit-level=high`; nenhuma vulnerabilidade conhecida nas instalações verificadas.                                                                                                                       |
| CI                    | Workflow executa check, audit, Docker, banco, browser e restore; execução remota e SHA final registrados no PR. CD permanece condicionado e não foi executado.                                                       |

## Backup e restore real

Execução concluída em **2026-09-10T06:00:25.051Z**, por `npm run test:system` → `npm run test:restore`. O script produziu `pg_dump -Fc`, verificou checksum SHA-256, catálogo do dump, diretório 700 e arquivos 600; restaurou em um novo banco descartável e comparou fingerprints de todas as linhas.

| Tabela            | Linhas restauradas |
| ----------------- | -----------------: |
| tenants           |                  7 |
| identity.users    |                  7 |
| identity.sessions |                 24 |
| trip_plans        |                 17 |
| trip_scenarios    |                 15 |
| schema_migrations |                  2 |

Validados schema, migrations, runtime sem privilégios de bypass, RLS/FORCE RLS, isolamento após restore e negação de acesso direto à identidade. Etapa de prova: 1.043 ms; esse ensaio pequeno **não comprova RTO operacional**. O banco restaurado e o projeto de teste foram removidos. Nenhum restore foi feito sobre o banco principal.

Evidências locais ignoradas pelo Git: `.runtime/restore-evidence.json`, `.runtime/identity-desktop.png` e `.runtime/identity-mobile.png`. O CI publica somente essas evidências sanitizadas e o build web, sem dumps, arquivos de ambiente ou credenciais. Contagens podem variar em novas execuções; o JSON identifica a execução correspondente.

## Reprodução

```sh
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test:system
npm run local:setup
npm run local:up
npm run backup
```

No Windows, `PW_CHANNEL=chrome` permite usar o Chrome instalado. O PostgreSQL de teste publica somente loopback, em override próprio; a rede adicional desse override permite conexão do runner no Docker Desktop. O banco principal não publica porta. A aplicação local fica em http://localhost:8094, com cadastro próprio e sem conta padrão.

## Limites

Backup offsite autenticado e agendamento diário ainda não provisionados. RPO 24 h e RTO 4 h são alvos não comprovados. Staging, DNS/TLS, produção, providers comerciais e e-mail permanecem fora desta fase. A Fase 0 está incorporada na ancestralidade da branch; enquanto o PR #1 não for integrado, o PR desta fase usa sua branch como base.
