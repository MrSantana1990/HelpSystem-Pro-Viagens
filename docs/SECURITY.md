# Segurança — identidade, persistência e staging privado

## Senhas e enumeração

Scrypt assíncrono N=131072/r=8/p=1, salts aleatórios de 16 bytes, chave derivada de 64 bytes e formato versionado. Cadastro aceita 12–128 caracteres; sem senha padrão. Duas derivações simultâneas no máximo, com rejeição 503 sob saturação para proteger memória. Login desconhecido executa o mesmo KDF e retorna a mesma resposta de senha errada. Cadastro novo e duplicado retornam o mesmo 202, sem cookie automático.

Cadastro limitado a cinco tentativas/15 min/IP; login a dez/15 min/IP; buscas a 30/min. Não confiar em X-Forwarded-For arbitrário. Limites em memória por processo e agregados atrás de Nginx; proxy confiável e defesa distribuída precisam revisão antes de uso público.

## Sessões e CSRF

Token opaco aleatório de 256 bits no cookie; banco guarda apenas SHA-256. Validade absoluta de oito horas pelo relógio do PostgreSQL. Login rotaciona token e revoga sessão anterior apresentada; logout revoga no banco, limpa cookie e estado privado da UI. Cookies HttpOnly, SameSite=Lax, Path=/; não-local exige HTTPS, Secure e prefixo __Host-. Sem Domain.

Mutação privada exige token CSRF derivado por HMAC do segredo da sessão mais Origin exato permitido. Token fica apenas em memória no navegador. Login/cadastro exigem Origin válido e contrato JSON. Sem CORS permissivo, localStorage de tokens, Cloudflare Access ou login social. Sessão revogada/expirada responde 401 e não executa operação privada.

## Banco e autorização

API recebe exclusivamente viagens_runtime. Essa role não possui SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE, DDL, ownership das tabelas nem membership da role migrator. Startup/readiness verificam role, schema e RLS/FORCE RLS.

Schema identity não é acessível diretamente ao runtime. Funções SECURITY DEFINER possuem search_path fixo, objetos qualificados e EXECUTE restrito. Autenticação verifica senha antes de emitir sessão. O serviço runtime é a fronteira confiável para resolver identidade; RLS não pretende proteger contra comprometimento completo dessa identidade técnica.

Planos/cenários usam transação com set_config(...,true) para tenant_id/user_id obtidos da sessão. API confere ownership e banco aplica RLS. Nenhuma decisão usa tenant/owner enviado pelo cliente. FK composta preserva trip/tenant/owner. Respostas de recurso alheio e inexistente são 404 idênticos em código/mensagem; correlation ID aleatório não identifica proprietário.

## HTTP, conteúdo e logs

Zod strict, UUIDs, datas reais, quantidades e centavos inteiros. Resultados financeiros/proveniência são recalculados, não aceitos do cliente. Body máximo 16 KiB. Queries parametrizadas; nomes dinâmicos em scripts operacionais vêm de allowlists.

React escapa títulos/conteúdo; sem HTML arbitrário. Nginx mantém CSP, nosniff, Referrer-Policy e bloqueio de frames. API usa no-store e correlation ID. Logs JSON e duração de requisição mantidos; não registrar senha, hashes, sessão, CSRF, autorização, body, URL de conexão ou dados privados desnecessários. Erros públicos genéricos sem SQL/stack.

## Operação e gates

PostgreSQL/Redis sem porta pública, API em rede interna; somente web em loopback. Aplicação não-root; limites de memória e logs. Redis/worker não são iniciados sem necessidade.

Backups contêm dados sensíveis: diretório 700, dumps/checksums 600, volume isolado. Restore permitido somente em banco descartável recém-criado: projeto de teste local ou cluster exclusivo do staging pelo helper administrativo. Offsite autenticado e ensaio operacional com volume representativo são gates de produção; o Prompt 3 autoriza staging privado sem offsite. pg_dump não inclui roles: recriá-las pelo provisionamento antes de restaurar em cluster novo.

Sem verificação de e-mail, recuperação de conta, troca de senha ou gestão B2B nesta fase. Nenhuma integração comercial, compra, e-mail, PWA offline, DNS ou produção. Branch e PR sujeitos à revisão.

A matriz de testes e os resultados reais estão em [VALIDATION](VALIDATION.md); critérios e fontes da decisão em [ADR 004](adr/004-runtime-identity-and-backup.md).

## Staging privado — Fase 2 operacional

Identidade SSH de deploy exclusiva e limitada a helper root-owned; não pertence ao grupo docker. Pacote de imagens limita tamanho, plataforma, nomes e SHA, incluindo índice OCI; nenhuma extração no filesystem do host. O servidor exige Quality do workflow conhecido, para push em branch autorizada e commit exato. Templates privilegiados ficam fora de releases. Alterações administrativas exigem revisão; código da aplicação implantado pode acessar os dados do próprio produto.

runtime.env/smoke-config.js 600 root, chave CA 600 root, chave TLS 400 UID do web; secrets mínimos somente no Environment staging. Known_hosts validado, StrictHostKeyChecking=yes. Chave de acesso privada separada com forwarding limitado à porta 18094; sem alteração DNS/Tunnel. TLS termina no Nginx exclusivo com CA própria; não desabilitar validação TLS globalmente. Cookies __Host-/Secure permanecem ativos.

main exige PR e quality, impede force push/deleção. A contagem de aprovações de PR é zero para o mantenedor único, sem dispensar PR/check; production exige revisão no Environment e permanece sem deploy habilitado. A autorização temporária de bootstrap deve ser removida após integração.

Rate limit continua agregado atrás do Nginx, trustProxy permanece desabilitado: adequado ao staging privado pequeno, sem confiar em cabeçalhos arbitrários. Antes de tráfego público, revisar proxy confiável e limites distribuídos. Offsite agora é gate de produção; o Prompt 3 autoriza staging técnico privado sem esse destino. Logs e artefatos não contêm credenciais/dumps. Detalhes e alternativas no ADR 005.

O pacote é vinculado criptograficamente ao SHA-256 registrado no nome do artefato do job Quality no GitHub, consultado pelo servidor via HTTPS. A validação não depende apenas de tags/labels fornecidas pelo cliente de deploy.

## Visitantes

Exploração de datas/custos sem cadastro não concede acesso a viagens salvas. Auth/CSRF/RLS de endpoints privados permanecem inalterados. A consulta inicial de sessão sem identidade não emite um evento falso de expiração nem apaga o rascunho público. Logout/expiração reais removem estado privado e reiniciam o Planner; entrar a partir de um rascunho público o preserva na memória da mesma página. Diálogo nativo mantém foco e permite voltar à exploração. Nenhum novo cookie/token ou armazenamento local é criado para visitantes.
