# Operações — staging privado

## Health e logs

/health/live: processo; /health/ready: PostgreSQL, role, migrations, RLS; /health/web: Nginx. Falha de PostgreSQL deve produzir ready 503 mesmo com live 200. Release identificada em x-release-sha e logs JSON; sem body/cookies/secrets. Logs Docker com rotação 10 MiB × 3 por serviço, logs operacionais próprios em staging/logs, restritos a root e com rotação diária por 14 dias.

## Backup

```sh
sudo /usr/local/sbin/viagens-staging-backup manual
sudo systemctl start viagens-staging-backup.service
systemctl status viagens-staging-backup.timer
journalctl -u viagens-staging-backup.service
```

Timer diário 03:00 UTC, com atraso aleatório de até cinco minutos e Persistent=true. Ativado após primeiro deploy. Backup pré-migration em todo deploy. pg_dump -Fc → catálogo válido → promoção do .partial → SHA-256, diretório 700, arquivos 600. Volume viagens-staging_backup_data, caminho interno /backups. Execução registra sucesso/falha e duração; last-backup-success deve ter menos de 24 h mais a tolerância de agenda. Verificar falhas/idade no journal; não há serviço externo de alertas nesta fase.

Retenção local: diários por 14 dias, cópia semanal aos domingos por quatro semanas. Só nomes próprios dentro do volume são elegíveis; checksum validado antes da remoção. Pré-migration e provas de restore preservados até revisão explícita. Monitorar espaço e janela de rollback.

Offsite não configurado: nenhuma ferramenta/destino autenticado apropriado foi encontrado no inventário verificado. Backups locais não protegem contra perda da VPS. Antes de produção: destino/credencial específicos, criptografia, upload verificável, retenção externa e ensaio a partir da cópia externa. RPO 24 h/RTO 4 h permanecem objetivos não comprovados.

## Restore

```sh
sudo /usr/local/sbin/viagens-staging-restore
```

Bloqueia deploy concorrente, cria fixtures sintéticas com runtime real, faz backup do staging e restaura em NOVO viagens_restore_HEX. Valida contagens e fingerprints de tenants/users/sessions/trips/scenarios/migrations, role e RLS A × B. O único DROP DATABASE aponta ao nome aleatório criado nessa execução, removido no finally. Nunca restaura sobre staging, produção ou banco alheio. Evidência sanitizada em logs/restore-evidence.json, com tempos separados.

Recuperação em cluster novo também exige provisionar roles (pg_dump não inclui roles), TLS e credenciais; o ensaio dentro do cluster não comprova recuperação de perda total da VPS.

## Rollback

Release ativa em staging/current; anterior em staging/previous-sha. Imagens com tags SHA preservadas. O helper retorna à anterior se startup/readiness/smoke falharem e registra ambos os SHAs. Não reverte banco; migrations devem manter compatibilidade.

Ensaio autorizado: administrador cria staging/fail-next-health antes do deploy B. O helper consome esse marcador root-only após startup e reprova o gate; reativa A e executa health/smoke reais. CI dessa tentativa deve falhar; uma execução final sem marcador deve passar. Não criar marker via usuário de deploy.

## Retenção de releases

Preservar current, previous-sha e ao menos as cinco últimas releases saudáveis. Revisar worktrees antes da limpeza. Remover uma release antiga somente por git worktree remove apontando ao caminho absoluto staging/releases/SHA previamente validado, depois remover exclusivamente suas duas tags viagens-staging-api:SHA e viagens-staging-web:SHA se não usadas. Sem prune global nem limpeza automática de volumes. Artefatos CI expiram em sete dias; as imagens de rollback ficam na VPS.

## Incidentes

Revalidar health dos demais produtos antes/depois de operações relevantes. Se houver degradação atribuível ao Viagens, interromper e reverter somente seus recursos. Nunca reiniciar host, Docker ou produtos alheios. Recursos de staging somam limites máximos de 1.152 MiB persistentes e 256 MiB temporários de migration; builds ficam no CI.

Backup/restore locais da Fase 1 continuam reproduzíveis por npm run backup e npm run test:system.
