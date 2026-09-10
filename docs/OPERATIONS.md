# Operações

## Health e logs

GET /health/live verifica processo API. GET /health/ready descreve prontidão demo e informa explicitamente que banco/Redis não são usados. GET /health/web valida Nginx. Não chamar esse readiness de verificação de banco. Todos os retornos API incluem x-correlation-id; falhas usam error.code/message/correlationId.

Logs JSON no stdout; rotação Docker 10 MB × 3 por serviço. Não logar corpos, cookies, tokens ou strings de conexão. Medir futuramente latência por provider, erros, idade do cache, custo de chamadas e tempo real de jobs. Não implantar nova stack de observabilidade só para demo.

## Procedimento de incidente

1. Identificar ambiente/projeto e verificar health, status, RAM/disco e horário.
2. Buscar correlation ID e códigos de erro, sem publicar logs privados.
3. Distinguir health do processo e progresso da tarefa.
4. Reverter somente release do Viagens afetado se regressão confirmada.
5. Registrar causa, impacto, correção, teste e prevenção em relatório próprio.

Sem prune global, remoção de volumes ou restart de produtos alheios.

## Backup e restore antes da persistência

Demo não armazena dados. Fundação PostgreSQL ainda não recebe dados reais. Antes de ativá-la, estabelecer pg_dump -Fc diário e antes de migration, arquivo modo 600, criptografia offsite, retenção documentada e verificação de integridade. Alvos iniciais propostos: RPO 24h e RTO 4h, ainda não comprovados.

Restore em banco descartável com role/app equivalentes; validar contagens, migrations e isolamento por usuário/tenant. Nunca restaurar sobre produção como teste. Backup local na mesma VPS não protege contra perda do host.

## Continuidade

Registrar SHA, PR, testes, destino, data, health e pendências após cada implantação. O manual privado global é atualizado quando houver deploy real; não anexá-lo ao Git. Nesta entrega só leitura ocorreu na VPS.
