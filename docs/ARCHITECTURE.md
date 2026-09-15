# Arquitetura

## Decisão após auditoria

Monorepo npm workspaces, TypeScript strict, React/Vite/Tailwind, API Fastify em Node 22. Na Fase 1, PostgreSQL 16 é dependência obrigatória de identidade e persistência. Redis 7.4 continua previsto, mas não é iniciado: sessões residem no PostgreSQL. shadcn/ui entra quando os componentes exigirem, sem infraestrutura vazia.

```text
Navegador → Nginx web → API /v1
                         ↓
                    Travel Engine
                         ↓
               contratos de providers
                  ↙             ↘
           FlightProvider   HotelProvider
               demo              demo

Atual: API → PostgreSQL isolado (sessões, usuários, planos, cenários)
Futuro:
        API → Redis/filas → worker → EmailProvider
        MapsProvider → estimativas de deslocamento
Borda alvo: Cloudflare Tunnel → 127.0.0.1:porta-web
```

## Fronteiras

| Pasta                  | Responsabilidade                                                              |
| ---------------------- | ----------------------------------------------------------------------------- |
| apps/web               | Formulários, calendário, ranking, estados de carregamento/erro e detalhamento |
| apps/api               | HTTP, validação, limites, composição de dependências e erros                  |
| apps/worker            | Contrato operacional documentado; processo ainda não ativado                  |
| packages/contracts     | DTOs e validação compartilhada com Zod                                        |
| packages/providers     | Interfaces de voos/hotéis/mapas e adapters demo determinísticos               |
| packages/travel-engine | Cost, Score, Calendar e Ranking; sem HTTP, banco ou SDK de fornecedor         |
| packages/database      | Migration transacional, tenants, planos e política RLS                        |
| packages/config        | Validação de configuração e restrição ao modo demo                            |
| packages/observability | Configuração de logging e redação                                             |
| packages/ui            | Reserva documentada para componentes realmente compartilhados                 |
| infra                  | Imagens, Compose, Nginx, ambientes e deploy por SHA                           |

## Semântica de cálculo

Dinheiro em centavos inteiros de BRL. Passagem cotada para todos os viajantes, ida e volta; hotel para todos os quartos/noites. Alimentação = valor por pessoa × viajantes × (noites + 1). Transporte = valor do grupo por dia × (noites + 1). Passeios = valor por pessoa × viajantes. Porta a porta = valor total do grupo para ida/volta. Total soma as seis parcelas.

Calendar Engine inclui todos os dias do mês de partida e permite volta no mês/ano seguinte; cálculo UTC evita diferenças de horário de verão. Demonstração aceita meses históricos; provider real deverá rejeitar passado e aplicar janela de venda do fornecedor.

Score v0 = round(clamp(100 − 50 × total/orçamento, 0, 100)). Dentro do orçamento precede fora; depois score descendente, total ascendente e data ascendente. Retorna cinco ou menos candidatos sem alterar o calendário. Não chama essa heurística de qualidade geral.

Providers demo não fazem rede. Interface recebe AbortSignal; adapters reais deverão respeitar timeout, quotas, disponibilidade, moedas, expiração, proveniência e cancelamento. O engine atual só aceita quotes simuladas BRL. Uma futura mudança para real exige resultado próprio e testes; não basta trocar uma variável.

## Evolução

Separar cache de inventário de snapshots salvos; TTL por contrato comercial. Chave de cache deve incluir moeda, rota, datas, passageiros e ocupação. Fila com tentativas limitadas, idempotência, DLQ e métricas de progresso. Providers reais podem retornar sem disponibilidade: nunca converter ausência de resultado em custo zero. Viagens B2B requer organização, membership/roles e testes completos; tenant_id/RLS inicial não constitui produto B2B pronto.

## Identidade e persistência — Fase 1

Cadastro/login/logout/session em /v1/auth. Cadastro cria partição pessoal interna (tenant_id=user.id), sem organização ou RBAC. Cookie de sessão opaco, hash no PostgreSQL e CSRF vinculado ao segredo; detalhes no ADR 004.

Planos em /v1/trips: POST, GET paginado em lotes de 50, GET/PATCH/DELETE por UUID e POST /:tripId/duplicate. Cenários em /:tripId/scenarios: POST e GET/PATCH/DELETE por UUID. POST /:tripId/compare aceita entre um e três IDs distintos, todos do mesmo plano autenticado. Até 20 snapshots por plano; plano vazio pode ser salvo antes da primeira análise.

Fluxo obrigatório: cookie → sessão válida no PostgreSQL → Identity do servidor → autorização API → transação → set_config local de tenant/user → RLS/FORCE RLS. Parâmetros de usuário não definem contexto. Pool não conserva identidade após commit/rollback; conexão com rollback falho é descartada.

Roles: admin apenas bootstrap/backup, migrator owner/DDL, runtime sem privilégios administrativos ou bypass. Startup/readiness recusam role errada, membership migrator, schema incompleto e políticas desabilitadas. Schema identity fechado ao runtime; funções definer estreitas resolvem autenticação sem conceder leitura ampla das tabelas de usuários/sessões.

trip_scenarios possui FK composta para trip_id/tenant_id/owner_id. Guarda input e snapshot imutável até edição explícita, com sourceType, provider, observedAt, expiresAt e currency. A API só grava DEMO/BRL, usando o engine existente. Duplicação cria novos UUIDs em transação e preserva valores/proveniência das cópias. Alterar o input do plano não muda snapshots antigos.

Frontend mantém a experiência de planejamento e acrescenta conta/minhas viagens. Tokens ficam somente em cookie HttpOnly/memória, nunca localStorage; troca/expiração de sessão limpa conteúdo privado. Detalhes de backup/restore estão em OPERATIONS; staging não faz parte desta fase.

## Staging — entrega por SHA

GitHub Actions constrói/testa imagens; transporta pacote por identidade SSH restrita. Helper administrativo fixo valida Quality, SHA e imagens, mantém release/worktree e ativa current após backup, migration, health e smoke. Compose/root scripts ficam fora dos worktrees para que a credencial de aplicação não possa ampliar privilégios de host. Nenhum build ocorre na VPS.

Acesso: navegador → túnel SSH limitado → HTTPS localhost:18094 → Nginx staging → API → PostgreSQL staging. Redes, volumes, roles e secrets próprios. Redis continua desnecessário. Main entrega staging nesta fase; produção desabilitada. ADR 005 registra essa evolução do fluxo planejado no ADR 003.

## Exploração sem cadastro

A página inicial abre o Planner para visitantes. POST /v1/search/month já é anônimo e continua limitado/validado, sem criar identidade ou sessão. Calendário, ranking e detalhamento ficam disponíveis; /v1/trips e cenários persistentes continuam protegidos por sessão, CSRF e RLS.

Login/cadastro aparecem em diálogo nativo ao solicitar a conta ou tentar salvar. O mesmo Planner permanece montado, preservando input, títulos, ranking e data selecionada durante fechamento/reabertura, erro de login e cadastro/login bem-sucedidos. Não há gravação automática: após entrar, a pessoa confirma salvar. Rascunho de visitante existe somente na memória da página, sem localStorage; reload/fechamento o descartam. Logout/expiração reiniciam o Planner e removem dados privados da interface.
