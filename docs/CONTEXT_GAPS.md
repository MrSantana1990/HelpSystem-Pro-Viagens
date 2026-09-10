# Lacunas de contexto — 09/09/2026

| Lacuna                                                                 | Impacto                                                  | Como continuar                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chats completos não disponíveis como fonte de conversa nesta sessão    | Decisões podem faltar                                    | Manual local e docs recentes fornecem continuidade; não solicitar cópia integral de chats |
| Manual global contém datas e estados históricos                        | Não representa sozinho produção atual                    | Usados SSH/GitHub read-only e CURRENT_STATE recente; registrar divergências               |
| Propriedade/uso de helpsystempro.com.br não comprovado                 | Não assumir sugestão inicial como domínio válido         | Priorizar proposta .site já operacional; verificar antes de DNS                           |
| Zona completa Cloudflare/conta Netlify não consultadas por API         | Não há inventário total de DNS, certificados ou previews | Tunnel e NS auditados; consultar configuração específica antes de publicar                |
| Certificado/TLS do hostname Viagens inexistente/não validado           | Sem URL pública de produto                               | Provisionar somente no estágio de publicação                                              |
| Backup offsite e restore de outros produtos sem evidência atual        | RPO/RTO não garantidos                                   | Criar e ensaiar estratégia própria antes de armazenar dados                               |
| Skyscanner/Booking/Mapas/e-mail sem credenciais do produto comprovadas | Dados reais e envio indisponíveis                        | Demo explícito; contratos desacoplados; solicitar acessos só na etapa correspondente      |
| Nenhum environment/secret de deploy no repo novo                       | CD não pode implantar                                    | Workflow condicionado; criar identidade e ambientes próprios                              |
| Regras detalhadas de preferências, clima e bagagem não definidas       | Score multidimensional seria arbitrário                  | V0 só orçamento; validar dimensões na próxima fase                                        |
| Papéis B2B, autenticação de consumidores e monetização ainda abertos   | Não expor persistência comercial                         | Schema inicial isolado e roadmap com critérios de aceite                                  |
