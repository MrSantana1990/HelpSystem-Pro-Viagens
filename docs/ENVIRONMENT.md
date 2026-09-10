# Ambientes e credenciais

## Configuração

| Variável             | Uso                            | Valor/padrão                        |
| -------------------- | ------------------------------ | ----------------------------------- |
| APP_ENV              | Ambiente                       | local, staging ou production        |
| HOST / PORT          | Escuta API fora de Docker      | 127.0.0.1 / 3001                    |
| PROVIDER_MODE        | Inventário                     | somente demo é aceito               |
| COMPOSE_PROJECT_NAME | Isolamento de serviços/volumes | viagens-local                       |
| WEB_PORT             | Porta loopback do frontend     | 8094                                |
| POSTGRES_PASSWORD    | Perfil data opcional           | aleatória, exclusiva; não vazia     |
| REDIS_PASSWORD       | Perfil data opcional           | aleatória, distinta; não vazia      |
| DATABASE_URL         | Migration/teste PostgreSQL     | URL privada com valores URI encoded |

`npm run dev` não carrega .env automaticamente; padrões bastam no demo. Para API compilada, exporte variáveis no processo ou use `node --env-file=.env dist/apps/api/src/server.js`. Compose: `docker compose --env-file .env -f infra/compose.yml ...`. Nunca use `config` sem `--quiet` com secrets reais.

Templates em infra/environments. Staging sugerido 18094; production 8094. Portas ainda precisam de revalidação no provisionamento. PostgreSQL e Redis não publicam portas no Compose.

## Acessos realmente necessários

| Serviço                              | Estado auditado                           | Quando exigir ação                                                       |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| GitHub                               | CLI autenticado com repo/workflow         | Nenhuma credencial para desenvolvimento                                  |
| VPS/SSH                              | Acesso por chave existente validado       | Nenhuma credencial para auditoria; criar identidade de deploy restrita   |
| Cloudflare                           | Tunnel ativo no host                      | Sessão/API scoped apenas ao configurar novo DNS/Tunnel                   |
| Skyscanner ou alternativa contratada | Acesso de API do produto não comprovado   | Antes de cotações reais; validar parceria, quota e termos                |
| Booking ou alternativa contratada    | Credenciais de Demand API não comprovadas | Antes de hotéis reais; parceiro gerenciado + API key/affiliate ID        |
| Mapas                                | Não necessário para estimativa manual     | Quando habilitar distância/custo automático                              |
| E-mail                               | Não necessário no bootstrap               | Antes de envio solicitado pelo usuário, com remetente/domínio verificado |
| Banco externo                        | Desnecessário                             | PostgreSQL isolado pode operar na VPS existente                          |

Nenhum token deve ser colado em chat ou commit. Configurar em secret manager/arquivo restrito/GitHub Environment.

## CD ainda não provisionado

Criar environments staging/production, com revisão para production. Secrets por ambiente: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS (host key validada fora da sessão de deploy). Não copiar automaticamente a chave administrativa existente. Provisionar diretório e runtime.env modo 600, usuário mínimo com acesso controlado ao Docker. Definir DEPLOY_ENABLED=true somente após esses controles e teste privado.

Bootstrapping local não exige nenhuma autenticação adicional. Não há justificativa para solicitar todos os serviços comerciais de uma vez agora.
