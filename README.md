# HelpSystem Pro Viagens

Planejamento de viagens sem cadastro: explore datas, calendário, Top 5 e custos completos. Para salvar, retomar e gerenciar viagens ou comparar até três cenários salvos, entre ou crie sua conta. O plano em andamento permanece na página durante cadastro/login; sem conta, ele não é salvo após fechar ou recarregar a página.

React/Vite, Fastify/Node 22 e PostgreSQL 16, sessões revogáveis e isolamento por usuário com RLS.

Preços atuais são **DEMO/SIMULADOS**, em centavos de BRL. Não representam reserva, disponibilidade ou tarifa real. Travel Score v0 é uma heurística de orçamento.

## Desenvolvimento local

```sh
npm ci
npm run local:setup
npm run local:up
```

Acesse http://localhost:8094 e comece a explorar. A conta é opcional para explorar e obrigatória para gestão persistente. Configuração e senhas próprias são geradas em .env protegido; não existe conta padrão. PostgreSQL não publica porta. Redis continua previsto, mas não é iniciado sem necessidade.

## Qualidade

```sh
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test:system
python -m unittest discover -s tests/deploy -p 'test_*.py'
```

Testes de banco/browser/restore usam recursos descartáveis separados. No Windows, PW_CHANNEL=chrome usa o Chrome instalado. Evidências em [VALIDATION](docs/VALIDATION.md).

## Staging privado

Deploy por SHA após Quality, identidade SSH restrita, PostgreSQL exclusivo, backup diário/pré-migration e rollback. Acesso por túnel em https://localhost:18094 com CA privada verificada. Ambiente local e staging são independentes. Produção e providers comerciais continuam desabilitados.

Consulte [DEPLOYMENT](docs/DEPLOYMENT.md), [ENVIRONMENT](docs/ENVIRONMENT.md), [OPERATIONS](docs/OPERATIONS.md), [SECURITY](docs/SECURITY.md) e [decisões](docs/DECISIONS.md). Offsite autenticado e ensaio representativo de RPO/RTO permanecem gates de produção.
