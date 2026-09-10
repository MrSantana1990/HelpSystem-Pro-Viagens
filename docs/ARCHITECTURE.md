# Arquitetura

## Decisão após auditoria

Monorepo npm workspaces, TypeScript strict, React/Vite/Tailwind, API Fastify em Node 22. PostgreSQL 16 e Redis 7.4 alinhados à infraestrutura existente, provisionados separadamente e opcionais enquanto a aplicação não persiste dados. shadcn/ui entra quando os componentes exigirem, sem infraestrutura vazia.

```text
Navegador → Nginx web → API /v1
                         ↓
                    Travel Engine
                         ↓
               contratos de providers
                  ↙             ↘
           FlightProvider   HotelProvider
               demo              demo

Futuro: API → PostgreSQL isolado
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
