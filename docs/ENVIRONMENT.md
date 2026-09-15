# Ambientes e credenciais

## Staging

Diretório exclusivo /opt/projetos/helpsystempro-viagens/staging. Compose viagens-staging; porta HTTPS 127.0.0.1:18094; API/PostgreSQL sem portas no host. Redes viagens-staging_private (internal) e viagens-staging_edge; volumes postgres_data/backup_data próprios. Redis não iniciado.

runtime.env root:root 600 possui POSTGRES_PASSWORD, MIGRATION_PASSWORD e RUNTIME_PASSWORD aleatórias independentes. O provisionador preserva valores existentes; alterar arquivo não rotaciona roles automaticamente. A API recebe somente a credencial runtime. TLS/CA e conta sintética de smoke ficam em arquivos próprios, fora do Git. Chave TLS do web 400 para UID 101; chave da CA 600 root; certificados públicos 444.

GitHub Environment staging contém somente DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY e DEPLOY_KNOWN_HOSTS. STAGING_DEPLOY_ENABLED=true é variável do repositório; a chamada passa por Quality. Production tem DEPLOY_ENABLED=false, revisão obrigatória e nenhuma chave de deploy configurada. Branches autorizadas em staging: main e a branch temporária agent/staging-provisioning-cd.

Fingerprint SSH ED25519 conferido pelo canal administrativo já confiável e pelo known_hosts local: SHA256:M3Gy4Ud27K2uNeeZUhpaUrYXff+nLZEDTv80PIKDDRk. Não usar ssh-keyscan como aprovação automática de chave nova; não desabilitar StrictHostKeyChecking.

Usuários:

- viagens-deploy: somente grupo próprio, authorized_keys root-owned, forced command; única regra sudo para helper fixo. Sem grupo docker, shell remoto, PTY ou forwarding.
- viagens-access: somente grupo próprio, sem sudo/Docker; chave exclusiva para encaminhar a porta privada. Não recebe secrets de deploy.

Chaves locais em ~/.ssh/viagens_staging_deploy e ~/.ssh/viagens_staging_access, com ACL do usuário atual. Nunca publicar arquivos privados, runtime.env, smoke-config.js, dumps ou manual global.

## Local e testes

npm run local:setup gera .env protegido apenas se ausente; npm run local:up mantém http://localhost:8094. DATABASE_URL é runtime, MIGRATION_DATABASE_URL é DDL. APP_ENV local permite HTTP; staging/production exigem APP_ORIGINS HTTPS e cookies Secure. PROVIDER_MODE continua demo.

npm run test:system usa projeto viagens-phase1-test-PID e bancos/volumes descartáveis, com loopback 15495/18095. Não reutiliza staging nem o banco local principal. RUN_DATABASE_TESTS é obrigatório para a suíte isolada.

Nenhum provider comercial, e-mail ou credencial de outro produto foi integrado. Offsite depende de destino e autenticação próprios antes de produção.
