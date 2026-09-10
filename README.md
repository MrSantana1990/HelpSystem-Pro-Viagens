# HelpSystem Pro Viagens

Plataforma para escolher quando e como viajar a partir do orçamento total. Primeira entrega: auditoria do ecossistema e bootstrap funcional, com simulação transparente de um mês completo.

## Executar

Requer Node.js 22.13+ (linha 22) e npm. O ambiente auditado usa Node 22.20.

```sh
npm ci
npm run dev
```

Abra http://localhost:5173. API em http://127.0.0.1:3001. A demonstração não exige credenciais, PostgreSQL ou Redis. O servidor de desenvolvimento escuta somente em loopback.

```sh
npm run check
docker compose -f infra/compose.yml up -d --build --wait
```

Com Docker, abra http://localhost:8094. Para parar: `docker compose -f infra/compose.yml down` (preserva volumes).

## Funcionalidades entregues

- Formulário responsivo com orçamento, mês, noites, viajantes, quartos e estimativas ajustáveis.
- Passagens e hotéis **simulados**, em reais, sem disponibilidade real.
- Custo de voos, hospedagem, alimentação, transporte, passeios e porta a porta.
- Calendário com todas as partidas do mês, top cinco e detalhamento por data.
- Travel Score v0 explicável, baseado exclusivamente no orçamento.
- API validada, IDs de correlação, logs JSON, limites de requisição e health checks.
- CI com lint, formatação, tipos strict, testes, migrations PostgreSQL, isolamento por tenant e build/smoke de contêineres.
- CD preparado para staging/production; desabilitado até provisionamento explícito.

Salvamento autenticado, e-mail, alertas, fornecedores reais, PWA offline e operação B2B estão no roadmap. A migração inicial existe; o frontend não grava dados.

## Documentação

- [Auditoria e inventário](docs/AUDIT.md)
- [Arquitetura](docs/ARCHITECTURE.md) · [Decisões e ADRs](docs/DECISIONS.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)
- [Ambientes e credenciais](docs/ENVIRONMENT.md)
- [Deploy](docs/DEPLOYMENT.md) · [Operações](docs/OPERATIONS.md)
- [Segurança](docs/SECURITY.md) · [Lacunas de contexto](docs/CONTEXT_GAPS.md)
- [Validação desta entrega](docs/VALIDATION.md)

Repositório público: não adicionar manuais privados, inventários de acesso, credenciais ou dados de outros produtos.
