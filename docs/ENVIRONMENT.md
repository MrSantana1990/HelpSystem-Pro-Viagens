# Ambientes e credenciais — Fase 1 local

## Configuração real

npm run local:setup gera .env apenas se ausente, com três senhas criptograficamente aleatórias independentes. Não sobrescreve configuração existente. Linux: modo 600; Windows: ACL somente para o usuário atual. Nunca imprimir .env, strings de conexão ou Compose expandido com secrets.

| Variável               | Responsabilidade                                              |
| ---------------------- | ------------------------------------------------------------- |
| POSTGRES_PASSWORD      | Bootstrap/admin local e backup; nunca na API                  |
| MIGRATION_PASSWORD     | Role viagens_migrator; apenas migration                       |
| RUNTIME_PASSWORD       | Role viagens_runtime; somente DML/autenticação/RLS            |
| DATABASE_URL           | Conexão runtime; injetada por Compose no serviço API          |
| MIGRATION_DATABASE_URL | Conexão DDL; injetada somente no serviço migrate              |
| APP_ENV                | local, staging, production; esta fase executa somente local   |
| APP_ORIGINS            | Lista explícita de origens completas; sem wildcard            |
| HOST/PORT              | API nativa; padrão loopback:3001, Docker 0.0.0.0:3001 interno |
| WEB_PORT               | Host loopback, 8094 no desenvolvimento                        |
| PROVIDER_MODE          | Somente demo                                                  |
| REDIS_PASSWORD         | Apenas perfil futuro; Redis não usado por sessões             |

Senhas geradas são hexadecimais, seguras para interpolação em URL. Credenciais fornecidas manualmente precisam de URL encoding; preferir o gerador local. Uma mudança no .env não rotaciona automaticamente usuários de um volume PostgreSQL já inicializado: fazer rotação explícita e coordenada das roles antes de alterar a configuração de runtime.

## Ambientes de execução

Principal: viagens-local, volumes PostgreSQL/backup próprios, nenhuma porta do banco no host. npm run local:up exige Docker e realiza backup antes da migration. Use volumes novos ou migração deliberada ao incorporar esta fase em uma instalação manual anterior; não reusar bancos de outros produtos.

Testes: viagens-phase1-test-PID com .runtime/arquivo.env protegido, bancos/volumes descartáveis e portas apenas loopback 15495/18095. test:system gera e injeta DATABASE_URL, MIGRATION_DATABASE_URL, TEST_ADMIN_URL e TEST_DATABASE_CONTAINER para a suíte; não copiar esses valores para configuração principal. RUN_DATABASE_TESTS é obrigatório; o comando isolado recusa executar sem ambiente preparado.

Desenvolvimento frontend: npm run dev:web, com proxy API para localhost:3001. API nativa requer PostgreSQL próprio acessível localmente, migrations aplicadas e DATABASE_URL runtime exportada; o modo Docker completo é o caminho documentado para esta fase. npm run dev não substitui a configuração do banco e não carrega .env automaticamente.

## Credenciais externas

Nenhuma necessária para concluir a Fase 1. GitHub já autenticado. Não acessar VPS, Cloudflare, fornecedores, e-mail ou outros produtos.

Próxima fase: credencial de deploy restrita, fingerprint SSH validado, environments GitHub e destino offsite autenticado. DEPLOY_ENABLED e PERSISTENCE_DEPLOY_READY devem continuar desabilitados até resolver esses gates. Não reaproveitar automaticamente chave administrativa ou contas de banco existentes.

Os templates staging/production são planejamento herdado, não ambientes provisionados. Em APP_ENV não-local, todas as origens devem ser HTTPS e os cookies serão Secure.
