# ADR 005 — Staging privado, identidade restrita e recuperação

Data: 2026-09-10. Status: implementação e validação da Fase 2 operacional (Prompt 3).

## Contexto

Fases 0 e 1 integradas em main pelos PRs #1/#2 mediante autorização explícita. VPS compartilhada com aproximadamente 4,6 GiB disponíveis e 86 GB livres na revalidação. A porta 18094 estava livre. PostgreSQL é obrigatório; Redis ainda não é utilizado. Não há destino offsite autenticado identificado nas ferramentas/configurações operacionais verificadas.

## Decisão

Staging exclusivo em /opt/projetos/helpsystempro-viagens/staging, Compose viagens-staging, HTTPS publicado somente em 127.0.0.1:18094. Acesso por chave SSH distinta com encaminhamento limitado a essa porta. CA privada própria e certificado localhost/web; cookie Secure e origem HTTPS preservados. Nenhuma mudança DNS/Tunnel. A proteção operacional não substitui a conta da aplicação.

Imagens construídas no GitHub Actions, identificadas pelo SHA e transportadas por SSH depois de Quality. Evita build concorrente na VPS compartilhada. O servidor verifica o job Quality do workflow conhecido para o SHA exato, valida o arquivo Docker sem extraí-lo no host, rejeita tags de outro produto e confere labels. Release por worktree/SHA e symlink current promovido somente depois de health e smoke.

O usuário viagens-deploy não integra docker/sudo. Uma regra sudo permite somente o helper root-owned de deploy, com SHA validado e diretório fixo. Chave com forced command/restrict, sem shell, PTY ou forwarding. Compose, scripts operacionais e credenciais ficam fora dos worktrees, sob root; uma release não pode substituir scripts privilegiados ou adicionar mounts arbitrários. Atualizar esses arquivos exige revisão/provisionamento administrativo explícito. A identidade ainda pode implantar código da aplicação e, portanto, é confiável para os dados deste produto.

Main recebe PRs e Quality; nesta fase main entrega somente staging. A branch agent/staging-provisioning-cd é uma autorização explícita de bootstrap no workflow, Environment e verificador remoto. Após integrar esta fase, retirar essa exceção nos três locais. Não criar develop sem uso real. Production continua desabilitado e seu Environment exige revisão.

Backup pré-migration obrigatório. Manifesto de SHA-256 do SQL revisado impede migrations novas/alteradas sem atualização administrativa. Migration falha interrompe release. Estratégia expand/contract; rollback troca somente código, nunca desfaz schema nem restaura por cima do banco.

## Recuperação e limites

Backup diário systemd, pg_dump -Fc, checksum e permissões 600/700. Retenção: 14 dias de diários, quatro semanas de cópias semanais, pré-migration preservado até revisão da janela de rollback. Restore em banco novo descartável dentro do cluster exclusivo, com comparação completa de linhas e revalidação de runtime/RLS. Offsite é gate de produção, não bloqueia o staging técnico privado conforme Prompt 3. Essa autorização atualiza o gate mais estrito documentado na Fase 1.

Ensaio de rollback usa marcador root-only para reprovar o gate de health após subir uma segunda release; não altera schema ou volumes. Health/smoke reais são executados novamente na release anterior.

## Alternativas e fontes

Adicionar o usuário ao grupo docker daria privilégios equivalentes a root; rejeitado pela fronteira necessária em host compartilhado ([Docker](https://docs.docker.com/engine/install/linux-postinstall/)). Rootless Docker acrescentaria daemon/rede/operação próprios; o helper fixo limita esta fase sem modificar o daemon existente. Chave administrativa no CI foi rejeitada. [OpenSSH](https://man.openbsd.org/sshd.8) fornece forced command/restrict/permitopen; [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) controla branches e secrets de staging.

O pacote é vinculado criptograficamente ao SHA-256 registrado no nome do artefato do job Quality no GitHub, consultado pelo servidor via HTTPS. A validação não depende apenas de tags/labels fornecidas pelo cliente de deploy.
