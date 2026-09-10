# Operações — persistência local

## Health e observabilidade

/health/live confirma processo vivo, sem consultar PostgreSQL. /health/ready consulta o banco, role, versões de migrations e RLS/FORCE RLS; falha retorna 503. Redis continua not-used. /health/web confirma Nginx. Health é isento de rate limit.

Logs estruturados, correlation ID, status e duração; sem body, senha, sessão ou URL de conexão. Processo saudável não garante sucesso de uma operação; verificar resultado da requisição e gravação esperada. Falhas de dependência não podem ser apresentadas como sucesso.

## Backup executável

```sh
npm run backup
npm run backup -- daily
```

Executa infra/backup.sh no PostgreSQL do projeto viagens-local. O arquivo pg_dump -Fc é escrito como .partial e promovido somente após pg_restore --list bem-sucedido. Gera SHA-256; diretório /backups em modo 700 e dump/checksum 600. Volume backup_data separado do banco. local:up executa esse mesmo caminho com label pre-migration antes de aplicar DDL.

A rotina diária está disponível pelo comando daily; **não foi agendado nenhum job no computador/VPS**. Próxima fase deverá instalar uma única tarefa diária (cron/systemd ou Agendador de Tarefas com diretório de trabalho correto), registrar sucesso/idade do último backup e alertar se >24h. Não contar execução manual como comprovação de RPO.

Retenção proposta: 14 backups diários, quatro semanais e todos os pré-migration da janela de rollback. Sem exclusão automática nesta fase; revisar capacidade e remover somente backups específicos de Viagens após verificar cópias offsite e restore. Nunca executar prune global.

## Restore real e reproduzível

```sh
npm run test:system
```

O teste cria seu próprio PostgreSQL, cadastra identidades sintéticas e dados, faz backup, valida checksum/permissões/listagem, cria viagens_restore_HEX dentro do projeto descartável e executa pg_restore --exit-on-error. Compara contagem e fingerprint de todas as linhas de tenants/users/sessions/trips/scenarios/migrations. Conecta usando a role runtime real ao banco restaurado, valida readiness, RLS A×B, ausência de contexto e bloqueio de acesso ao schema identity/SET ROLE. Somente o banco criado por esse processo é removido; o banco principal nunca é alvo.

Evidência em .runtime/restore-evidence.json, sem secrets, e no artefato CI. pg_dump não leva usuários/roles do cluster: infra/postgres-init.sh é parte do provisionamento de recuperação. Não existe restore livre apontando para produção/staging; esta fase fornece a prova descartável controlada.

## Offsite e objetivos

Backups no mesmo Docker/host não protegem contra perda do host. Offsite deve usar destino autenticado, criptografia, retenção e ensaio de recuperação com roles próprias. Nenhum destino foi inventado/configurado. É bloqueio para staging/persistência pública.

RPO 24h/RTO 4h continuam objetivos: o tempo do teste sintético demonstra o funcionamento do procedimento, não o SLA operacional.

## Incidente

Confirmar projeto e ambiente; checar /health/live versus /health/ready; identificar correlation ID e erro; verificar banco/roles/migrations e espaço. Recuperar somente Viagens. Registrar causa, impacto, correção e prevenção. Não parar produtos alheios, remover volumes principais ou restaurar sobre banco existente como teste. Sem deploy remoto nesta fase, não há atualização operacional do manual privado global.
