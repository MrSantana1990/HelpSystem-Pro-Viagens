# Roadmap técnico

## Entregue

Fase 0: arquitetura, engine demo, experiência responsiva e fundação de CI.

Fase 1: identidade e sessão PostgreSQL, trips/scenarios persistentes, autorização API mais RLS, comparação, backup/restore e testes. Fases integradas em main pelos PRs #1 e #2.

Fase 2 operacional — Staging Provisioning & CD: ambiente privado isolado, identidade restrita, imagens por SHA, Quality obrigatório, backup diário/pré-migration, restore descartável e rollback. Evidências em VALIDATION. Produção permanece desabilitada.

## Próxima fase — Provider Commercial Readiness / inventário real

Inventariar elegibilidade, contratos, quotas, sandbox e credenciais próprias para um fornecedor de voos e um de hotéis. Definir expiração/proveniência, ausência de disponibilidade, normalização, timeout, cancelamento e revalidação. DEMO não pode ser apresentado como LIVE. Preservar Cost/Score em centavos e fronteiras existentes.

Antes de produção, resolver offsite autenticado, ensaio representativo de recuperação, agenda/monitoramento, proxy confiável, TLS/DNS autorizado e revisão do Environment. RPO 24 h/RTO 4 h continuam objetivos.

Depois: e-mail, alertas, preferências avançadas, PWA e B2B somente em fases próprias; nenhuma dessas integrações foi ativada agora.
