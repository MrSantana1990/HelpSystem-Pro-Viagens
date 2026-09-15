# Lacunas de contexto — staging

| Lacuna                                                         | Impacto                                                                             | Continuidade                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Offsite sem destino/autenticação próprios identificados        | Sem proteção contra perda da VPS; bloqueia produção                                 | Solicitar destino e credencial específicos quando definidos; não usar contas improvisadas. |
| RPO 24 h/RTO 4 h sem ensaio representativo                     | Não há SLA comprovado                                                               | Medir recuperação de volume realista e cópia offsite, incluindo reprovisionamento.         |
| CA privada/certificado localhost                               | Exige confiança explícita para navegador e renovação antes do vencimento de 90 dias | Distribuir CA por SSH validado; futuro hostname/TLS somente mediante autorização.          |
| Exceção temporária de branch de bootstrap                      | Staging aceita main e agent/staging-provisioning-cd                                 | Remover exceção do workflow, Environment e verificador remoto após integração desta fase.  |
| Proxy confiável e rate limit público não validados             | Limite agregado suficiente apenas ao staging privado                                | Reavaliar antes de tráfego público, sem confiar em headers arbitrários.                    |
| Providers comerciais sem elegibilidade/credenciais confirmadas | Dados continuam DEMO                                                                | Próxima fase de readiness comercial, sem ativação prematura.                               |
| E-mail, recuperação de conta, B2B e monetização fora do escopo | Produto ainda não pronto para operação comercial                                    | Tratar em fases próprias.                                                                  |

Histórico Git foi regularizado mediante autorização: PRs #1/#2 integrados, Fases 0/1 presentes em main e CI revalidado. Nenhuma lacuna de branch impede este staging. Estado remoto foi reconsultado nesta fase; o manual privado não foi publicado.
