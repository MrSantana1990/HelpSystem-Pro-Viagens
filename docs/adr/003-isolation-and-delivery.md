# ADR 003 — Isolamento e implantação

Data: 2026-09-09. Status: aceito.

Contexto: VPS compartilhada, bancos de outros produtos e portas 80/443 ocupadas. Repositório novo é público.

Decisão: nomes Compose separados, portas de host apenas em 127.0.0.1, rede interna para API/dados, credenciais próprias, volumes próprios, logs limitados e memória limitada. Imagens rodam sem root na aplicação. Persistência não exposta antes de auth e autorização. CD só após Quality e configuração DEPLOY_ENABLED; feature/agent passam CI, develop direciona staging, main production. Releases por SHA sem reset forçado.

Consequências: não copiar inventário privado para Git; mudanças DNS/proxy e primeiro provisionamento permanecem fora do bootstrap. Schema atual é aditivo e migrado explicitamente. Rollback de imagem não desfaz migration; restore ensaiado é necessário antes de ativar persistência.
