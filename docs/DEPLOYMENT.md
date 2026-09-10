# Deploy

## Estado da entrega

CI executa verificações e smoke de contêineres. CD está implementado, mas condicionado a DEPLOY_ENABLED=true, environments/secrets e provisionamento. Nenhum deploy público, DNS ou reinício de serviço existente integra esta entrega.

## Local

```sh
npm ci
npm run check
docker compose -f infra/compose.yml up -d --build --wait
curl http://127.0.0.1:8094/health/ready
```

Perfil data é opt-in: configurar senhas próprias em .env e executar `docker compose --env-file .env -f infra/compose.yml --profile data up -d`. Não habilitar em produção sem backup, papel de banco não-superusuário para runtime e controles de acesso.

## Fluxo GitHub

Feature/agent → Quality (testes/build). PR → Quality. develop → Quality → staging. main → Quality → production. Job de deploy reutilizável só é chamado após sucesso, em push de develop/main, com variável habilitada. Não existe workflow_dispatch que contorne testes. O environment production deve exigir revisão.

Quality constrói web e API e testa via Nginx; migra PostgreSQL descartável duas vezes e comprova RLS com role não privilegiada. O artefato web guarda o SHA. Imagens são reconstruídas a partir de lockfile no destino; fixação de imagens por digest e publicação em registry ficam antes de produção comercial.

## Primeiro provisionamento (pendente)

1. Revalidar RAM/disco/portas e estado dos serviços existentes.
2. Criar usuário/credenciais exclusivos, diretórios por ambiente em /opt/projetos/helpsystempro-viagens, repository e runtime.env protegido; clone deste repositório.
3. Usar templates de ambiente com porta exclusiva e projeto Compose fixo.
4. Configurar secrets e fingerprint SSH validado; testar staging por túnel SSH.
5. Após aprovação da publicação, fazer backup da configuração Cloudflare, adicionar hostname específico e validar ingress; somente então ativar DNS/TLS. Proposta: viagens.helpsystempro.site. Não usar .com.br sem verificar titularidade.
6. Habilitar CD. Primeira implantação deve demonstrar rollback e ausência de impacto nos outros produtos.

## Rollback

infra/deploy.sh trava deploy concorrente com flock, faz fetch do SHA verificado e worktree por release. Symlink current muda após todos os health checks. Falha reativa Compose da release anterior, se existente. No primeiro deploy não há release anterior: diagnosticar o ambiente novo sem mexer em outros projetos. Não remove worktrees antigas automaticamente.

Migration de dados não roda implicitamente em deploy demo. Quando persistência for ativada: pg_dump antes, migration expand/contract e teste de restore isolado. Rollback de código não é rollback de dados.
