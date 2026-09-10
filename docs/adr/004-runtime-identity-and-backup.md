# ADR 004 — Identidade, sessões PostgreSQL e recuperação local

Data: 2026-09-10. Status: aceito para a Fase 1 local.

## Contexto e evidência

A Fase 0 tem engine demo, trip_plans e RLS isolado, mas não liga usuário autenticado ao banco em runtime. O Prompt 2 exige identidade/persistência reais, sem staging, Redis artificial ou mudanças na arquitetura existente. O PR #1 ainda está aberto: a nova branch parte do commit aprovado 4008e96, mantendo a Fase 0 como ancestral sem merge automático.

## Decisões

- Preservar Node/Fastify, React/Vite, workspaces, PostgreSQL 16, contracts, providers demo, Cost/Score/Calendar/Ranking, BRL em centavos e RLS.
- Hash scrypt nativo Node: N=131072, r=8, p=1, salt aleatório 16 bytes, derivação 64 bytes, máximo de dois trabalhos simultâneos. Moderno e portável no Windows/Alpine sem dependência nativa extra. Argon2id seria alternativa válida; a escolha usa o scrypt disponível nativamente com parâmetros recomendados. API tem limite de memória 512 MiB.
- Cookie opaco de 256 bits; só SHA-256 do token no banco. Sessão absoluta de oito horas, revogada no logout; login gera novo token e revoga cookie anterior apresentado. Sem JWT, social login ou Redis obrigatório.
- CSRF derivado por HMAC do segredo da sessão, devolvido só por resposta same-origin e comparado em tempo constante. Mutação privada exige token e Origin exato; cadastro/login exigem Origin exato e DTO JSON. Cookies HttpOnly/SameSite=Lax; fora de local, Secure e prefixo __Host-, com origem HTTPS obrigatória.
- Partição pessoal interna: tenant_id = user.id. Reaproveita tenants sem expor organização, billing ou RBAC.
- Roles fixas viagens_admin (bootstrap/backup local), viagens_migrator (DDL/owner, não-superusuária), viagens_runtime (DML/RLS, sem BYPASSRLS e sem membership migrator). Só a credencial runtime entra na API.
- Usuários/sessões no schema identity fechado. Cinco funções SECURITY DEFINER com search_path fixo e EXECUTE revogado de PUBLIC expõem somente as operações de identidade necessárias.
- Cada operação de plano usa transação e set_config local com IDs oriundos da sessão, mais autorização API e RLS/FORCE RLS. Chaves compostas impedem anexar cenário a outro plano/usuário.
- Snapshots guardam input, resultado e proveniência. API aceita apenas DEMO e recalcula o resultado; campos futuros INDICATIVE/LIVE no schema não ativam providers reais.
- Backup custom pg_dump, SHA-256, permissões restritas e prova de restore num banco descartável. Nenhum offsite inventado; offsite autenticado bloqueia persistência compartilhada.

## Alternativas e consequências

JWT exigiria mecanismo adicional de revogação; Redis criaria dependência operacional sem necessidade. RLS não substitui autenticação: o runtime é parte da fronteira confiável de identidade e não deve aceitar SQL arbitrário ou IDs de contexto vindos do cliente. Banco impede acesso direto às tabelas de identidade, DDL e RLS bypass pelo runtime.

Cadastro novo/duplicado retorna a mesma resposta 202 e não autentica automaticamente, reduzindo enumeração. Sem verificação de e-mail/recuperação nesta fase local. Limites por IP atrás de Nginx são agregados; resolver proxy confiável antes de tráfego público.

## Migração

002 acrescenta identity.users, identity.sessions, trip_scenarios, updated_at e FK composta de plano/usuário. selected_scenario legado permanece nullable e é preservado na duplicação. FK de owner é NOT VALID para não destruir/bloquear silenciosamente possíveis linhas legadas da fundação; inserções novas são verificadas. Se uma instalação antiga possuir linhas sem identidade, reconciliar explicitamente antes de validar essa constraint; não apagar nem atribuir a usuários novos por suposição.

Backups precedem migrations. API recusa iniciar com role errada/schema incompleto. CD ganha gate PERSISTENCE_DEPLOY_READY; preparar migration/backup/restore do deploy compartilhado é tarefa da próxima fase.

Referências: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [PostgreSQL 16 CREATE POLICY](https://www.postgresql.org/docs/16/sql-createpolicy.html).
