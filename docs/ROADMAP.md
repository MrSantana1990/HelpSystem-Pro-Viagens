# Roadmap técnico

## Fase 0 — Fundação aprovada

Auditoria, arquitetura/ADRs, app demo responsivo, providers desacoplados, Travel Engine testado, API e CI/CD preparado. Commit base 4008e96; preservado nesta evolução.

## Fase 1 — Runtime Persistence & Identity

Identidade/sessões próprias no PostgreSQL; runtime não privilegiado; RLS ligado à identidade; CRUD/duplicação de planos e cenários; comparação de até três; backup/restore descartável; testes de autorização, segurança e navegador. Escopo exclusivamente local. Evidências em VALIDATION.md.

Não inclui staging, providers comerciais, e-mail, alertas, PWA offline, organizações ou billing.

## Próxima fase — Staging Provisioning & CD

1. Resolver destino offsite autenticado e retenção; ensaiar restauração representativa com roles separadas.
2. Provisionar staging isolado, credencial de deploy restrita e secrets/environment próprios.
3. Adaptar deploy por SHA para backup verificado e migration separada do runtime; rollback compatível.
4. Revalidar capacidade/portas, origem HTTPS, cookie Secure, política de proxy confiável, health e ausência de impacto nos produtos existentes.
5. Somente após evidência, habilitar DEPLOY_ENABLED e PERSISTENCE_DEPLOY_READY. Mudanças DNS/publicação têm escopo específico.

## Depois do staging — Inventário real

Validar elegibilidade/contrato/quota de um parceiro de voos e um de hotéis. Implementar adapters, sandbox, expiração/proveniência, ausências e revalidação. Manter diferença visível entre DEMO, INDICATIVE e LIVE. Não reescrever Cost/Score por causa de um fornecedor.

## Evoluções posteriores

Planejamento avançado/compartilhamento solicitado; e-mail idempotente; alertas com opt-in, retries e heartbeat; PWA com proteção de dados; Score multidimensional explicado e calibrado. B2B somente após utilidade comprovada, com membership, roles e isolamento testado. Nenhuma dessas etapas é requisito para encerrar a Fase 1 local.
