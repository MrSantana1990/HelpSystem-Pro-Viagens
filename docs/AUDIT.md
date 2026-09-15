# Auditoria inicial — 09/09/2026

## Método e evidências

Leitura do briefing fornecido, manual local de continuidade (privado), manifests/Compose/workflows de Portal, Crédito e CareerOS e estado recente de melhoria contínua do CareerOS. Consultas somente de leitura ao GitHub, VPS via SSH e DNS público. Nenhum arquivo de segredo foi lido. Não reproduzir o manual privado neste repositório público.

| Componente                      | Observado                                                                            | Consequência para Viagens                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Repositório indicado            | Público e vazio; GitHub CLI autenticado                                              | Criar bootstrap próprio e revisão por branch                                         |
| Portal                          | React existente, Nginx em Compose; VPS ativa                                         | Reutilizar publicação por origem local                                               |
| Crédito                         | React/Vite/TypeScript e backend Node; testes Vitest                                  | Confirma compatibilidade da preferência TypeScript                                   |
| CareerOS                        | Next.js, FastAPI, PostgreSQL 16, Redis 7.4, workers e métricas                       | Reutilizar separação apps/packages, isolamento e operação, sem portar domínio Python |
| GitHub Actions                  | Execuções recentes bem-sucedidas de CareerOS e Crédito                               | Manter CI no GitHub desde o início                                                   |
| VPS                             | Docker/Compose disponíveis; Tunnel ativo                                             | Aproveitar capacidade existente após provisionamento isolado                         |
| Recursos no momento da consulta | Aproximadamente 4,6 GiB disponíveis, 86 GB livres e 4 GiB de swap                    | Estabelecer limites; fotografia não garante capacidade futura                        |
| Serviços existentes             | Portal, Crédito, Carreira e Bot saudáveis; AEG e Alerta compartilham host            | Não alterar projetos, volumes ou proxy compartilhados                                |
| Publicação                      | Serviços HelpSystem em loopback, portas 8091–8093 e 8501                             | 8094 é candidata para Viagens, livre na consulta; revalidar antes do deploy          |
| Cloudflare                      | Tunnel ativo; ingressos atuais só para produtos existentes                           | Novo hostname depende de mudança específica e validada                               |
| Domínio                         | helpsystempro.site, NS dion/melody Cloudflare confirmados                            | Proposta: viagens.helpsystempro.site                                                 |
| TLS                             | Publicação atual por Cloudflare Tunnel e origens HTTP locais                         | Reutilizar terminação de borda; certificado de Viagens ainda não existe/foi validado |
| Nginx global                    | Outros sistemas ocupam 80/443                                                        | Usar Nginx do próprio contêiner, sem disputar essas portas                           |
| Netlify                         | Documentado como contingência do portal                                              | Não criar segundo fluxo principal de produção                                        |
| Backups                         | Scripts e backups locais existentes em produtos anteriores                           | Reutilizar padrão pg_dump/pre-deploy; backup externo e restore precisam evidência    |
| Autenticação                    | Aplicação própria, cookies protegidos; orientação explícita contra Cloudflare Access | Autenticação futura será da aplicação, sem painel administrativo anônimo             |
| Secrets de Viagens no GitHub    | Nenhum secret/variable/environment listado                                           | Pipeline de deploy fica desabilitado                                                 |
| Máquina local                   | Node 22.20, npm 10.9, Git, GitHub CLI e Docker CLI                                   | npm workspaces reduz ferramentas extras; Docker Desktop iniciado para testes         |

## Reutilização e exclusões

Reutilizar VPS, Docker Compose, Cloudflare Tunnel, GitHub Actions, PostgreSQL 16 e Redis 7.4 como padrões. Cada ambiente de Viagens terá projeto Compose, rede, volumes e credenciais próprios; nenhum banco ou login de outro produto será compartilhado.

Não reutilizar scraping com perfis de navegador: os incidentes anteriores mostram consumo de RAM, sessões incompatíveis entre sistemas, bloqueios externos e falhas difíceis de observar. Voos/hotéis dependem de APIs comerciais aprovadas. Não copiar Next.js/FastAPI sem necessidade: o produto inicial não exige SSR ou ecossistema Python. Não adicionar pgvector/IA, Prometheus/Grafana próprios ou worker ocioso ao bootstrap.

## Incidentes relevantes e contramedidas

- OOM de navegador: evitar navegador no backend; limitar memória de contêineres.
- Tarefas aceitas porém travadas: health de processo não prova progresso. Worker futuro exige timeout, heartbeat, lock com lease e captura de erros.
- Flags operacionais ativadas indevidamente: somente provider demo é aceito no bootstrap; CD requer variável explícita.
- Métricas intermediárias sem resultado real: quantidade de cenários não prova economia. Medir orçamento previsto versus revalidado e resultado do planejamento.
- Deploy com reset destrutivo no fluxo anterior: usar release por SHA em worktree e rollback de aplicação sem apagar árvore de desenvolvimento.

## Riscos

Aprovação comercial e quotas dos fornecedores podem impedir cotações reais. Estimativas não incluem toda despesa individual. Score v0 não mede qualidade global da viagem. VPS compartilhada tem capacidade variável. TLS/DNS de Viagens e restauração de backups ainda não validados. Autenticação, consentimento, retenção e autorização por usuário são pré-requisitos de persistência pública.

Fontes externas consultadas: [Node Release](https://github.com/nodejs/Release), [Vite](https://vite.dev/guide/), [Skyscanner Travel API](https://www.partners.skyscanner.net/product/travel-api), [Booking prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites). Node 22 ainda está em manutenção LTS; Vite aceita Node 22.12+. As duas integrações de viagem exigem onboarding próprio, não apenas a presença de um conector nesta sessão.

## Revalidação da VPS — 10/09/2026, 11:17 UTC

Nova consulta SSH antes de provisionar Viagens: RAM total 7.941 MiB, disponível 4.730 MiB, swap 4.095 MiB (1 MiB usado), disco 86 GB livres, load average 1,74/1,03/0,92. Docker 29.1.3 e Compose 2.40.3 disponíveis. Porta 18094 livre, sem projeto/volume/rede Viagens remoto preexistente.

Portal, Crédito, CareerOS e Bot: origens loopback 8092/8091/8093/8501 responderam 200/200/308/200. Containers com health declarado estavam saudáveis; workers/scheduler e componentes AEG/Alerta sem health declarado estavam em execução. Docker e cloudflared ativos; Nginx global via systemd inativo, bordas existentes operam em containers. Portas 80/443/8443 pertencem a outros produtos. Chromium, MySQL, Redis e workers externos ao escopo foram somente observados.

Tunnel auditado por entradas hostname/service: somente Portal, Crédito, CareerOS e fallback 404; nenhum hostname Viagens criado. Um novo hostname exigiria adicionar ingresso e DNS após backup/revisão, podendo afetar o Tunnel compartilhado; a fase usa SSH e não fez essa mudança. Offsite não identificado nos executáveis rclone/restic/borg/aws, timers e caminhos de configuração verificados. Inventário não prova inexistência de contas externas fora desses locais.

A provisão utiliza somente /opt/projetos/helpsystempro-viagens, usuários/chaves próprios e arquivos de serviço Viagens. Não executou prune global, restart do Docker/SSH/cloudflared, alteração de DNS ou comandos de controle em outros produtos. Evidência final de health/recuperação em VALIDATION.
