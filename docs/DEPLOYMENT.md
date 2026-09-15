# Implantação — staging privado

## Estado Git e fluxo

PR #1 integrado em main, PR #2 retargetado para main, atualizado sem mudança funcional e integrado após CI verde. Branch desta fase descende de main com ambas as fases completas.

Push em main → Quality → imagens por SHA → Environment staging → SSH restrito → deploy → smoke. Durante o bootstrap, agent/staging-provisioning-cd possui a mesma autorização explícita. PRs executam Quality sem receber secrets/deploy. Nenhum fluxo de produção habilitado. Após integrar a fase, retirar a exceção de bootstrap do workflow, Environment e verificador remoto.

Quality inclui format/lint/TypeScript, testes de domínio/API, PostgreSQL real, autorização, browser desktop/mobile, restore, audit, build Docker e testes da fronteira de deploy. Imagens são artefatos por SHA, retenção sete dias, sem secrets. O servidor também consulta o job Quality do workflow ci.yml para o commit.

## Provisionamento administrativo

Revalidar recursos, porta 18094 e ausência de colisões. Revisar infra/staging e executar como administrador:

```sh
bash infra/staging/provision.sh /caminho/do/checkout-revisado /caminho/deploy.pub /caminho/access.pub
```

Script idempotente preserva runtime.env, CA, conta de smoke e repositório existentes. Atualiza somente arquivos operacionais próprios sob root. Não adiciona deploy user ao grupo Docker, não modifica daemon Docker/SSH, Nginx global ou Cloudflare.

O manifesto de migrations aprovado deve corresponder ao SQL revisado. Novas migrations exigem revisão expand/contract e atualização administrativa deliberada. Não rodar provisionamento novo apenas para contornar rejeição do manifesto.

## Deploy

O CI constrói API/web; empacota duas imagens rotuladas; envia a infra/deploy.sh. O helper /usr/local/sbin/viagens-staging-deploy valida SHA, Quality e pacote, cria worktree e inicia somente viagens-staging com o Compose root-owned.

Sequência: validar → carregar imagens → PostgreSQL saudável → backup pré-migration → migration separada → API/web → readiness HTTPS → smoke autenticado → current. Um erro de migration interrompe antes da troca da aplicação. Falha de health/smoke tenta código anterior e revalida health/smoke; dados e volumes permanecem.

Arquivos operacionais não são atualizados automaticamente a partir de release. Mudança de Compose/helper requer revisão administrativa; alteração apenas de código da aplicação segue CD normal.

## Acesso privado

```sh
ssh -N -L 127.0.0.1:18094:127.0.0.1:18094 viagens-staging
```

Alias local configurado com a chave exclusiva viagens_staging_access. Acessar https://localhost:18094 e confiar somente na CA privada obtida pelo canal SSH autenticado. Não usar exceção global de TLS. API exige HTTPS e cookies Secure; a conta da aplicação é obrigatória para salvar/gerenciar viagens, enquanto a exploração funciona sem cadastro. Acesso anônimo ao produto não torna o staging público: o túnel privado continua necessário.

A chave de acesso não executa comandos. Encaminhamento permitido somente para a porta exclusiva; autorização de reverse bind também limitada à mesma porta já ocupada pelo staging. Chave de deploy não permite forwarding.

## Desenvolvimento local

npm run local:setup e npm run local:up continuam disponíveis em http://localhost:8094, sem modificar o banco local existente. Testes usam projetos descartáveis próprios. Staging usa infra/staging/compose.yml, não o Compose local.

O pacote é vinculado criptograficamente ao SHA-256 registrado no nome do artefato do job Quality no GitHub, consultado pelo servidor via HTTPS. A validação não depende apenas de tags/labels fornecidas pelo cliente de deploy.
