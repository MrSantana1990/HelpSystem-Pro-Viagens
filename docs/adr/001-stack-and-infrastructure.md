# ADR 001 — Stack e infraestrutura

Data: 2026-09-09. Status: aceito para bootstrap.

Contexto: Crédito valida React/Vite/Node; CareerOS valida apps/packages, PostgreSQL, Redis e Compose. Portal opera por Tunnel; Netlify é contingência.

Decisão: npm workspaces, Node 22, TypeScript strict, React/Vite/Tailwind, Fastify, PostgreSQL 16 e Redis 7.4. Reutilizar VPS/Tunnel como destino proposto, com ambientes isolados. Lockfile versionado. Não adotar Kubernetes, Next.js, Python ou vector database sem requisito.

Consequências: regra de domínio compartilhável; poucas ferramentas adicionais. Node 22 exige upgrade planejado antes do fim de suporte. Npm workspaces ainda não impõe sozinho direção de imports; revisar fronteiras e adicionar regra automatizada quando surgirem mais consumidores. Atualização de dependências via PR e testes.
