# Implantação — Fase 1 exclusivamente local

## Desenvolvimento

```sh
npm ci
npm run local:setup
npm run local:up
```

Abre http://localhost:8094. O script cria configuração privada somente se ausente, constrói web/API/migrate, inicia PostgreSQL, gera pg_dump pré-migration, aplica migrations com viagens_migrator e inicia API/web com health checks. Migration não roda dentro do processo runtime.

A API exige banco e recusa role privilegiada, schema incompleto ou RLS inválido. Não usar docker compose up em um banco novo sem aplicar migrations. O banco principal não publica porta no host.

Parar sem excluir dados: docker compose --env-file .env -f infra/compose.yml stop. Nunca usar down -v no projeto principal por rotina.

## Testes

npm run test:system usa projeto/volumes descartáveis com nome viagens-phase1-test-PID. Executa migração idempotente, runtime/ownership, navegador e restore em novo banco temporário; remove apenas esses recursos no finally. Scripts rejeitam alvo de restore que não pertença ao projeto de teste. A porta loopback adicional do PostgreSQL só existe em infra/compose.test.yml.

## CI e revisão

Quality roda npm ci, check, npm audit, Docker build, PostgreSQL real, navegador e backup/restore. Evidência sanitizada e build web são artefatos; .env e dumps não são enviados.

O PR de Fase 0 ainda não estava mesclado ao começar. A Fase 1 é uma branch descendente de 4008e96 e seu PR deve ter a branch da Fase 0 como base enquanto o PR #1 estiver aberto. Depois da revisão/merge da base, atualizar a base do PR para main. Nenhum merge automático.

## CD compartilhado permanece bloqueado

Fluxo por SHA/worktree preservado. Além de DEPLOY_ENABLED, a chamada exige PERSISTENCE_DEPLOY_READY=true. Nenhuma dessas flags foi habilitada; staging não foi provisionado, nem VPS/DNS/Cloudflare alterados.

A próxima fase deve preparar o deploy persistente: backup pré-migration verificado, execução DDL separada, health de dependências, rollback compatível com schema e teste de restore. O script de deploy herdado da Fase 0 não aplica essas migrations; não habilitar o gate para contorná-lo.

Antes de ativar staging: destino offsite autenticado, usuário de deploy restrito, secrets próprios, revisão de capacidades/portas, ambiente GitHub com controle de publicação, trustProxy e HTTPS validados. Alvos de RPO 24h/RTO 4h não estão comprovados por um teste pequeno local.
