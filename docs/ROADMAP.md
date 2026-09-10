# Roadmap técnico

## Fase 0 — Auditoria e bootstrap (esta entrega)

Inventário/ADRs/docs, app demo responsivo, providers desacoplados, engine testado, API validada, schema inicial e CI/CD preparado. Aceite: instalar pelo lockfile, check verde, demo utilizável, valores simulados explícitos e nenhuma alteração na produção existente.

## Fase 1 — Persistência e staging privado

Autenticação própria, usuário/membership, role PostgreSQL de runtime sem bypass RLS, CRUD de planos e comparação de até três cenários persistidos. Testar CSRF, logout, sessão expirada e autorização cruzada. Revalidar capacidade VPS; provisionar staging isolado com backup/restore ensaiado e secrets mínimos. Aceite: usuário A não lê nem grava plano de B; edição mantém semântica dos custos; staging/rollback rastreáveis.

## Fase 2 — Primeiro inventário real

Escolher parceiro após elegibilidade comercial, quota, orçamento e termos de cache/afiliado. Integrar um FlightProvider e um HotelProvider reais, sandbox/contrato, resultados ausentes/parciais, timeout, retry limitado e cache com proveniência/expiração. Separar simulação de preço real no contrato/UI. Aceite: um itinerário revalidado na fonte, custos completos rastreáveis e nenhuma promessa de reserva. Mapas só se manual não for suficiente.

## Fase 3 — Planejamento e compartilhamento

Itinerário, comparação lado a lado, salvar versões, exportação e e-mail após comando explícito. Remetente verificado e opt-in; fila idempotente, retries, timeout, DLQ e heartbeat. Aceite: entrega rastreável sem duplicação, falha recuperável e exclusão do plano.

## Fase 4 — Alertas, PWA e inteligência

PWA instalável, app shell offline com proteção de dados, alertas autorizados, disponibilidade/flexibilidade, preferências e Score multidimensional calibrado. Aceite: stale prices visíveis, logout limpa armazenamento, alertas respeitam opt-out e critérios, score explica pesos e ausência de dados.

## Fase 5 — B2B e operação comercial

Organizações, convites, papéis, auditoria, quotas, cobrança se aprovada, isolamento verificado e métricas de valor: precisão de custo total, tempo até decisão, plano executado e feedback. Só expandir após demonstrar utilidade da experiência principal.

## Próximo estágio concreto

Finalizar revisão do bootstrap e provisionar staging privado. Em paralelo, validar elegibilidade dos fornecedores; esse acesso é bloqueio real para preços ao vivo, não para a engenharia da aplicação.
