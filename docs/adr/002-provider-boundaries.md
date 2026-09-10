# ADR 002 — Fronteiras e demonstração

Data: 2026-09-09. Status: aceito.

Contexto: acesso ao inventário real depende de aprovação comercial; automação por navegador trouxe incidentes no ecossistema.

Decisão: contratos FlightProvider, HotelProvider e MapsProvider; domínio não importa SDKs de fornecedores. Somente adapters demo disponíveis e resultados sempre identificados. Não implementar Skyscanner/Booking fictícios nem estimativas apresentadas como tarifas reais. Score v0 explicável apenas pelo orçamento.

Consequências: desenvolvimento sem credenciais; nenhum valor representa reserva ou disponibilidade. Integrações reais exigem normalização, cancelamento, tratamento de ausência, quotas, custos e testes de contrato/sandbox. Dados de mapas e e-mail ficam para etapas posteriores.
