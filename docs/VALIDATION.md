# Validação — staging real, 10/09/2026

## Git e Quality

PR #1 integrado em main em 11:15 UTC; PR #2 retargetado, sincronizado sem alterações funcionais e integrado em 11:21 UTC após [CI revalidado](https://github.com/MrSantana1990/HelpSystem-Pro-Viagens/actions/runs/34470560632). Main contém integralmente Fases 0/1.

Quality desta fase executa format, ESLint, TypeScript strict, 14 testes sem banco, 19 testes com PostgreSQL real, dois fluxos browser locais, oito testes Python da fronteira de deploy, build, Docker, audit e restore. Os 19 testes não são dispensados: rodam em test:system com runtime real. Audit observado: zero vulnerabilidades conhecidas. Resultado remoto do head final registrado no [PR #3](https://github.com/MrSantana1990/HelpSystem-Pro-Viagens/pull/3).

## Deploy e rollback reais

| Etapa              | Evidência                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Release A          | 768d098e97274d7f19dd95be1ba8d53d446ea8e3, [Actions](https://github.com/MrSantana1990/HelpSystem-Pro-Viagens/actions/runs/34471842495), promovida após health e smoke; 66 s na tentativa bem-sucedida.  |
| Correção observada | Smoke inicialmente enviava Content-Type JSON sem corpo no logout, recebendo 400. Cliente corrigido; o gate não promoveu a tentativa falha.                                                             |
| Release B          | 583dee788bdfef2b8b192ea77e4b166f0cb60377, [ensaio](https://github.com/MrSantana1990/HelpSystem-Pro-Viagens/actions/runs/34474048715). Quality passou; marcador root-only reprovou o gate após startup. |
| Retorno para A     | Helper reativou A e aprovou readiness e smoke autenticado; procedimento completo 126 s. current permaneceu em A. Tentativa de B falhou intencionalmente no CI.                                         |
| Dados              | Nenhum DROP/restore sobre staging, nenhuma remoção de volume; backup antes de cada migration. Rollback de código não desfaz schema.                                                                    |
| Release final      | Promovida pelo mesmo fluxo sem marcador; SHA e CI finais no PR, no symlink current e no header x-release-sha.                                                                                          |

## Restore de backup do staging

Executado /usr/local/sbin/viagens-staging-restore às **2026-09-10T11:57:14.171124Z**. Backup pg_dump -Fc do banco staging restaurado em um NOVO banco viagens_restore_HEX, removido após o ensaio. Nenhum banco existente foi sobrescrito.

| Tabela            | Linhas validadas |
| ----------------- | ---------------: |
| tenants           |                5 |
| identity.users    |                5 |
| identity.sessions |                4 |
| trip_plans        |                5 |
| trip_scenarios    |                4 |
| schema_migrations |                2 |

Checksum SHA-256, permissões 600/700, fingerprints de todas as linhas, schema/migrations, runtime sem superusuário/BYPASSRLS e isolamento A × B após restore passaram. Tempos: backup/verificação 839 ms; restore 517 ms; validação 1.188 ms. Cópia offsite indisponível; sem tempo de upload a declarar. RPO 24 h/RTO 4 h continuam objetivos não comprovados por este ensaio pequeno.

Backup diário executado pelo service (1 s), timer ativo para 03:00 UTC com até cinco minutos de aleatoriedade. Pré-migrations observados com 2 s. Artefato no volume viagens-staging_backup_data, /backups, com checksum correspondente. Retenção em OPERATIONS.

## Health e navegador

Com PostgreSQL exclusivamente de staging parado: live 200, web 200, ready 503. Reiniciado o próprio banco: ready 200. Tratamento automático de saída garantia restart mesmo se o ensaio falhasse.

Desktop 1440×1000 e mobile 390×844 reais, através do túnel SSH e pin específico do certificado obtido por canal autenticado: cadastro/login, cookies __Host-/Secure/HttpOnly/SameSite=Lax, salvar viagem/cenário, calendário com 29 dias, reload, logout/novo login e persistência passaram; zero page errors e nenhum overflow horizontal. Contas sintéticas com senhas aleatórias, sem credencial hardcoded. Reproduzir com `node scripts/staging-browser.mjs .runtime/staging-server.crt` após abrir o túnel e obter o certificado por SSH confiável.

## Isolamento e recursos

Somente web em 127.0.0.1:18094. API/PostgreSQL sem bind no host. Compose viagens-staging, volumes e duas redes próprios; private é internal. Redis desligado. Limites: API 512 MiB/1 CPU, web 128 MiB/0,5 CPU, PostgreSQL 512 MiB/0,75 CPU; migration temporária 256 MiB/0,5 CPU. Builds ficam no CI.

83 amostras durante a janela de deploy/rollback: máximos observados API 43,63 MiB, web 7,85 MiB e PostgreSQL 39,64 MiB; RAM disponível do host nunca abaixo de 3.914 MiB nessas amostras. Amostragem não comprova pico absoluto entre leituras nem substitui teste de carga.

Portal/Crédito/CareerOS/Bot mantiveram respostas 200/200/308/200 nas respectivas origens. Containers existentes continuam com datas de startup anteriores à fase, saudáveis quando possuem health check; AEG/Alerta e workers sem health check permanecem running. Nenhum controle/restart executado nesses produtos.

## Segurança operacional

Comando arbitrário pela chave de deploy rejeitado; chave de acesso rejeitou shell e encaminhamento para 8091. Usuários pertencem somente aos grupos próprios, sem Docker. Sudo limitado ao helper de SHA fixo. Secrets e smoke-config 600; chave TLS 400. Fingerprint SSH validado, StrictHostKeyChecking ativo. Varredura de logs operacionais e logs dos três containers não encontrou as credenciais do staging.

Revisão final vincula também o SHA-256 do pacote ao nome do artefato emitido pelo job Quality no GitHub; somente labels de imagem não seriam prova suficiente da origem do pacote. Testes rejeitam adulteração, outro produto, outro SHA, caminhos de escape, symlinks e nomes OCI alheios.

Evidências locais ignoradas pelo Git: .runtime/staging-restore-evidence.json, staging-readiness-evidence.json, staging-resource-samples.jsonl e staging-desktop/mobile.png. Não publicar dumps, runtime.env, chaves, smoke-config ou logs privados. Evidências completas de operação ficam no diretório protegido de staging.

## Limites reais

Offsite autenticado ausente; recuperação de perda total do host e RPO/RTO não comprovados. CA privada exige distribuição confiável e renovação de certificado em até 90 dias. A exceção de bootstrap da branch deve ser removida após integrar o PR. Produção, DNS/Cloudflare e providers comerciais não foram ativados.
