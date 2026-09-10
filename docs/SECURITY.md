# Segurança

- Repositório público. .env, logs, dumps, chaves e contextos privados ignorados; nunca copiar manual de continuidade.
- API demo sem persistência ou painel administrativo. Não recebe e-mail, documento ou credencial do usuário.
- Validar DTO strict, tamanho de body, números inteiros e limites de entradas. IDs de correlação gerados no servidor.
- Logs estruturados sem body; cookies/autorização e campos sensíveis redigidos. Erros não retornam stack ou detalhes internos.
- Rate limit por conexão/IP sem confiar em cabeçalhos de proxy arbitrários. Atrás de Nginx, limite atual é agregado; revisar trustProxy/IP do Tunnel de forma restrita antes de tráfego público.
- API/dados em rede interna; host publica somente web em loopback. Runtime não-root, no-new-privileges e recursos limitados.
- Autenticação futura própria com hash forte, sessão expirada/revogável, cookie HttpOnly/Secure/SameSite e proteção CSRF. Não depender de Cloudflare Access conforme padrão existente.
- tenant_id e owner_id obrigatórios; RLS com FORCE em trip_plans. Superusuários PostgreSQL ignoram RLS: runtime deverá usar role não-superusuária separada da migration. API não conecta ao banco nesta fase.
- Nenhum envio de e-mail, compra, reserva ou scraping automático. Adapters reais devem conferir domínios de fornecedores e não aceitar URLs arbitrárias.
- PWA futura não poderá cachear responses autenticadas, tokens ou dados pessoais; logout deve limpar dados offline.
- Dependências travadas no package-lock e audit em CI. Revisar pinning de actions/imagens por SHA/digest antes da ativação pública.
- Antes de coleta real: políticas de retenção/exclusão, consentimento, controle por usuário e revisão dos termos dos fornecedores. A fundação não equivale a certificação jurídica ou produto pronto para dados pessoais.
