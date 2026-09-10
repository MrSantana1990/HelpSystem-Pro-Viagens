# Validação — 09/09/2026

| Verificação               | Resultado                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| npm run check             | Passou: formatação, ESLint, TypeScript strict, testes e build                                                                             |
| Domínio/API               | 11 testes passaram; ano bissexto, custo do grupo, score, ranking, validação, correlação e rate limit                                      |
| PostgreSQL 16 descartável | Migration executada duas vezes; isolamento de tenant e usuário verificado com role sem bypass RLS                                         |
| Navegador Chrome local    | 2 testes passaram: desktop e celular, calendário com 29 partidas, top cinco, seleção e detalhamento, sem pageerror ou overflow horizontal |
| Docker                    | Imagens web/API construídas e serviços healthy, web apenas em 127.0.0.1:8094                                                              |
| npm audit                 | Zero vulnerabilidades conhecidas após atualização de ferramentas                                                                          |
| Revisão de diff           | Sem erros de whitespace; sem chaves, tokens ou cópia do manual privado                                                                    |
| GitHub Actions            | Workflow preparado; execução remota será registrada no PR                                                                                 |

Preview local: http://localhost:8094. Capturas desktop/mobile em .runtime (não versionadas). PostgreSQL de teste foi encerrado e descartado; web/API de demonstração permanecem locais.

Durante a validação, o teste de limite foi corrigido para exercitar a rota real de busca; health checks são isentos de rate limit. O orçamento de tempo do runner foi ampliado para 30 s devido à inicialização de módulos no Windows, sem alterar o timeout de requisição da aplicação. Houve um bloqueio transitório de arquivo de metadados do Docker Desktop depois de construir as imagens; iniciar as imagens concluídas confirmou os dois serviços saudáveis.

Não validados: fornecedor real, autenticação/persistência pela API, e-mail, PWA offline, provisionamento de staging/production, DNS/TLS do produto e restore offsite. O pipeline CD existe, mas está desabilitado e não foi executado contra VPS.
