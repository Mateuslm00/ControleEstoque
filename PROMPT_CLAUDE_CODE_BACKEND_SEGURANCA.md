# Prompt para Claude Code - Backend, Banco e Seguranca do Sistema de Controle de Estoque

Voce e o Claude Code trabalhando no projeto `estoque-app-organizado`, um sistema React/Vite/Tailwind de controle de estoque, cotacao de precos, saida de materiais/vendas e romaneio. Leia o codigo existente antes de alterar qualquer arquivo, principalmente `src/App.jsx`, `src/data/constants.js`, `src/features/cotacao/CotacaoTab.jsx`, `src/features/saida/SaidaTab.jsx`, `src/features/saida/romaneioHtml.js` e demais componentes usados por entrada, saida, materiais, fornecedores, unidades/clientes e dashboard.

O objetivo e implementar um backend organizado, seguro e pronto para hospedagem gratuita inicialmente, com caminho claro para producao em VM futuramente. O sistema hoje esta muito concentrado no frontend e usa estado local; a regra agora e mover persistencia, autenticacao, autorizacao, auditoria, emails e regras criticas de estoque para o servidor.

## Decisao tecnica recomendada

Use PostgreSQL como banco principal.

Justificativa: este sistema precisa de historico confiavel, auditoria, relatorios, integridade transacional, controle de concorrencia em estoque FEFO, permissao por perfil, consultas filtradas por periodo/material/cliente/fornecedor e crescimento de usuarios. PostgreSQL e melhor que SQLite para esse cenario. SQLite so deve ser considerado para prototipo local, porque nao e ideal para fluxo diario de estoque com varios usuarios, auditoria e backend hospedado. PostgreSQL tambem e superior para evolucao de relatorios, indices, constraints, transacoes e recursos futuros de seguranca.

Se o projeto precisar manter compatibilidade futura com MySQL, isole a camada de dados usando ORM ou query builder tipado. Mesmo assim, a implementacao inicial recomendada e PostgreSQL.

Stack sugerida:

- Node.js com TypeScript.
- Fastify ou Express, preferindo Fastify pela organizacao, performance e schemas.
- Prisma ou Drizzle para migrations e queries parametrizadas.
- Zod para validacao de entrada e DTOs.
- PostgreSQL gerenciado em Neon ou Supabase no plano gratuito.
- Frontend em Vercel, Netlify ou Render Static.
- Backend em Render, Koyeb, Railway trial/free credit, Fly.io ou VM gratuita OCI Always Free.

Importante sobre hospedagem gratuita: PM2 e Nginx fazem sentido em VM. Em plataformas gratuitas gerenciadas como Render/Koyeb/Vercel, normalmente nao se usa PM2; a plataforma gerencia o processo. Se for exigido PM2 desde o inicio, a opcao gratuita mais parecida com VM e OCI Always Free, com Node.js, PM2, Nginx e PostgreSQL instalados ou banco externo gerenciado.

## Fontes e referencias para validar decisoes

Consulte e aplique as recomendacoes oficiais abaixo durante a implementacao:

- OWASP API Security Top 10 2023: https://owasp.org/API-Security/
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Node.js Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Render Free limitations: https://render.com/docs/free
- Vercel Hobby limits: https://vercel.com/docs/plans/hobby
- Neon pricing/free plan: https://neon.com/pricing
- Supabase pricing/free plan: https://supabase.com/pricing
- Oracle Cloud Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Escopo funcional que precisa existir

Preserve e evolua os modulos atuais:

- Dashboard.
- Materiais/produtos.
- Fornecedores.
- Entrada de estoque.
- Estoque atual.
- Cotacao de precos.
- Saida/venda de materiais.
- Romaneio.
- Unidades/clientes.
- Usuarios, login e perfis.
- Relatorios.
- Historico/auditoria.
- Disparo de emails.

O frontend pode continuar em React, mas nao deve ser a fonte de verdade para estoque, usuario, auditoria, venda, cotacao ou email. O backend deve validar e recalcular o que for critico.

## Usuarios e perfis

O sistema comeca com 4 usuarios: 1 admin e 3 usuarios normais. Modele para ate 10 usuarios agora e deixe facil aumentar depois.

Perfis minimos:

- Admin: gerencia usuarios, permissoes, cadastros, relatorios completos, configuracoes e auditoria.
- Operacional: entrada, saida, cotacoes e consultas permitidas.
- Leitura: consulta dashboards, estoque, relatorios permitidos e historicos, sem alterar dados.

Toda autorizacao deve ocorrer no backend. Nao confie em esconder botao no frontend.

## Autenticacao e sessao

Implemente autenticacao server-side.

Requisitos:

- Hash de senha com Argon2id ou bcrypt com custo forte.
- Nunca salvar senha pura.
- Sessao em cookie `HttpOnly`, `Secure`, `SameSite=Strict` quando possivel (usar `Lax` apenas se `Strict` quebrar um fluxo legitimo). `SameSite` sozinho nao substitui protecao CSRF: mesmo com `Strict`/`Lax`, implemente token CSRF (double-submit cookie ou header customizado) em toda rota de mutacao.
- Sessao com timeout absoluto (ex.: 8h) e timeout por inatividade (ex.: 30min). Definir os dois valores explicitamente na config, nao deixar indefinido.
- Rotacao/renovacao de sessao quando necessario.
- Revogar TODAS as sessoes ativas do usuario ao: trocar senha, admin redefinir acesso, desativar usuario ou alterar seu perfil/role.
- Logout invalida sessao no servidor.
- Rate limit com numeros explicitos, nao apenas "forte": login (ex.: 5 tentativas/15min por IP+usuario, com backoff), recuperacao de senha (ex.: 3/hora por email), envio de email (ex.: por usuario/hora) e exportacao/relatorios pesados.
- Bot protection em login e recuperacao se houver endpoint publico.
- Nao usar `localStorage` para token de autenticacao.
- Mensagens de erro de login genericas.
- Logar/auditar tentativas de acesso negado (401/403), especialmente tentativa de usuario nao-admin acessar rota administrativa, como evento de seguranca.

## Modelo de dados sugerido

Crie migrations e constraints. Use nomes consistentes, chaves UUID quando fizer sentido e indices para buscas por data/status/material/cliente/fornecedor.

Tabelas minimas:

- `users`: id, name, email, password_hash, role, status, created_at, updated_at, last_login_at.
- `sessions`: id, user_id, token_hash, ip, user_agent, expires_at, revoked_at, created_at.
- `materials`: id, name, sku/code, unit, min_stock, active, created_at, updated_at.
- `suppliers`: id, name, cnpj, email, phone, active, created_at, updated_at.
- `clients` ou `units`: id, name, cnpj, email, address fields, active, created_at, updated_at.
- `stock_entries`: id, supplier_id, invoice_number, entry_date, total_value, created_by, created_at.
- `stock_entry_items`: id, entry_id, material_id, lot_number, expires_at, quantity, unit_cost, created_at.
- `stock_lots`: id, material_id, supplier_id, lot_number, expires_at, initial_quantity, current_quantity, unit_cost, source_entry_item_id, status.
- `sales`: id, doc_number, client_id/unit_id, sale_date, total, created_by, recipient_email, email_status, created_at.
- `sale_items`: id, sale_id, material_id, quantity, unit_price, subtotal.
- `sale_item_lot_consumptions`: id, sale_item_id, stock_lot_id, quantity, unit_cost_snapshot.
- `quotes`: id, material_id, period_start, period_end, quote_date, created_by, created_at.
- `quote_items`: id, quote_id, supplier_id, price, notes.
- `email_jobs`: id, type, entity_type, entity_id, recipient, subject, status, attempts, last_error_safe, sent_at, created_by, created_at.
- `audit_logs`: id, actor_user_id, action, entity_type, entity_id, ip, user_agent, before_json, after_json, metadata_json, created_at.

Nunca exponha `password_hash`, `token_hash`, segredos, custo interno ou markup em respostas publicas.

## Regras de estoque e FEFO

A saida de materiais deve consumir lotes por FEFO: o lote que vence primeiro sai primeiro.

Requisitos:

- A venda/saida deve ser criada em transacao.
- O backend deve travar/garantir concorrencia nos lotes consumidos para evitar estoque negativo.
- O frontend nao decide o estoque final sozinho.
- Validar quantidade positiva, material ativo, cliente ativo e disponibilidade antes de confirmar.
- Salvar o consumo por lote para rastreabilidade.
- Auditoria obrigatoria da venda e dos lotes alterados.

## Cotacao de precos

Mantenha a regra atual:

- Cada material deve ser recotado a cada 2 meses.
- Minimo de `MIN_QUOTES`, hoje 3 fornecedores diferentes.
- Status:
  - Sem cotacao: Nunca cotado.
  - Vencida: data de vencimento menor que hoje.
  - Vence em breve: 10 dias ou menos para vencer.
  - Em dia: demais casos.

Backend deve fornecer endpoints para:

- Criar cotacao com material, fornecedores e precos.
- Listar ultimas 15 cotacoes.
- Listar historico de cotacao por material.
- Calcular estatisticas: em dia, vencendo em breve, vencidas, economia media.
- Filtrar por status.

Validacoes:

- Nao permitir fornecedores duplicados na mesma cotacao.
- Exigir minimo de fornecedores.
- Precos positivos.
- Material e fornecedores ativos.
- Auditoria obrigatoria.

## Relatorios e historico

Criar endpoints e tela integrada para buscar dados historicos.

Relatorio de entrada:

- Produto/material.
- Fornecedor.
- Periodo.
- Quantidade.
- Lote.
- Validade.
- Nota fiscal.
- Valor unitario e total quando permitido pelo perfil.
- Usuario responsavel.

Relatorio de saida:

- Produto/material.
- Periodo.
- Cliente/unidade.
- Quantidade.
- Numero do romaneio.
- Usuario responsavel.
- Total de venda quando permitido pelo perfil.

Historico geral:

- Todos os processos importantes devem ser auditados.
- Deve ser possivel buscar por periodo, usuario, entidade, acao, material, fornecedor, cliente/unidade e numero de documento.
- Auditoria nao deve vazar senha, token, cookies, API keys nem conteudo sensivel desnecessario.

## Romaneio

O romaneio e documento para cliente/unidade. Ele nao pode mostrar:

- Custo unitario.
- Markup.

Ele deve mostrar:

- Numero do romaneio.
- Emitente.
- Data de emissao.
- Cliente/unidade e CNPJ.
- Material.
- Quantidade.
- Preco unitario de venda.
- Subtotal.
- Total geral.
- Assinaturas: responsavel pela entrega e recebido por unidade/cliente.

Atualize tanto a visualizacao em React quanto o HTML/PDF/email gerado pelo backend. Escape todo valor dinamico para evitar injecao de HTML/XSS. Nomes de materiais, clientes, fornecedores e observacoes nunca devem ser interpolados diretamente em string HTML sem escaping.

## Emails

Implementar envio de email pelo backend, nunca pelo frontend.

Fluxos:

- Entrada de estoque: ao confirmar entrada, disparar email automatico para o financeiro da empresa.
- Saida/romaneio: colaborador informa o email do destinatario e o backend envia o romaneio.

Requisitos de seguranca para email:

- API key/SMTP password apenas em variavel de ambiente do servidor.
- Validar email de destino.
- Bloquear header injection: nao aceitar quebras de linha, `bcc:`, `cc:`, `to:` ou manipulacao de cabecalho em campos de usuario.
- Permitir apenas destinatarios esperados por regra de negocio.
- Rate limit por usuario e IP.
- Auditoria de envio, reenvio, falha e destinatario.
- Fila/tabela de `email_jobs` com tentativas controladas.
- Nao expor erro bruto do provedor no frontend.
- Templates com escaping HTML.
- Configurar SPF, DKIM e DMARC no dominio antes de producao.
- Anexos/HTML do romaneio devem conter apenas dados permitidos ao destinatario.
- Email do financeiro (entrada de estoque) deve ser configuracao fixa no servidor (env var ou tabela de config), nunca aceito como input do usuario.

Se usar Render free, atencao: ele nao permite trafego SMTP comum nas portas 25, 465 e 587 no plano gratuito. Prefira provedor com API HTTPS para envio ou hospede o backend em VM gratuita/OCI se precisar SMTP direto.

## Seguranca obrigatoria por rota

Implemente middleware em todas as rotas:

- Autenticacao.
- Autorizacao por perfil.
- Validacao de schema.
- Rate limit conforme criticidade.
- CSRF em mutacoes com cookie.
- CORS restrito aos dominios oficiais.
- Logs seguros com redacao.
- Respostas padronizadas e sem stack trace em producao.

Contra SQL Injection:

- Usar ORM/query builder com queries parametrizadas.
- Nunca concatenar input do usuario em SQL.
- Para `orderBy`, `sort`, nome de coluna ou direcao, usar allowlist explicita.
- Principio do menor privilegio no usuario do banco.
- Constraints no banco alem da validacao da API.

Contra mass assignment:

- Criar DTOs explicitos por caso de uso.
- Nao fazer spread direto de `req.body` para ORM.
- Rejeitar ou ignorar campos extras.
- Campos como `role`, `isAdmin`, `created_by`, `unit_cost`, `password_hash`, `email_status`, `stock_quantity`, `stock_lots.current_quantity`, `stock_lots.status` e `sales.total` nao podem ser alterados por payload externo sem regra especifica: sao sempre recalculados/derivados no servidor, nunca aceitos direto do cliente.

Contra vazamento de dados:

- Serializers/DTOs de resposta.
- Paginacao em listas.
- Limite maximo de registros.
- Nunca retornar hashes, tokens, segredos, cookies, custo interno ou markup para usuarios sem permissao.
- Erros genericos em producao.
- Logs sem dados sensiveis.

Contra XSS:

- React ja escapa texto renderizado normalmente, mas nao usar `dangerouslySetInnerHTML` com dados nao confiaveis.
- Escapar HTML em romaneio, relatorios e emails.
- Sanitizar/validar campos textuais.
- Configurar Content Security Policy.

Contra ataques de upload:

- Se houver upload, restringir extensao, MIME e assinatura real do arquivo.
- Definir tamanho maximo.
- Renomear arquivo no servidor.
- Guardar fora de pasta publica quando possivel.
- Bloquear executaveis.
- Validar permissao antes de download.

Headers e transporte:

- Forcar HTTPS.
- `Strict-Transport-Security`.
- `Content-Security-Policy` restritiva: evitar `unsafe-inline` e `unsafe-eval` em `script-src`; se precisar de estilo inline do Tailwind/build, preferir nonce/hash a `unsafe-inline` em `style-src`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy`.
- `X-Frame-Options` ou `frame-ancestors`.
- `Permissions-Policy`.
- Cookies seguros.

Segredos e Git:

- `.env` fora do Git.
- Criar `.env.example` sem valores reais.
- Rodar varredura de segredos antes de commit/deploy.
- Se algum segredo ja foi commitado, remover do historico e rotacionar o segredo.

Dependencias:

- Usar lockfile.
- Rodar `npm audit` e corrigir vulnerabilidades possiveis.
- Evitar bibliotecas abandonadas.
- Validar licencas se necessario.

## Estrutura de codigo desejada

Crie uma estrutura organizada, por exemplo:

```text
server/
  src/
    app.ts
    server.ts
    config/
      env.ts
      security.ts
    db/
      prisma.ts
      migrations/
    modules/
      auth/
      users/
      materials/
      suppliers/
      clients/
      stock/
      quotes/
      sales/
      romaneio/
      reports/
      email/
      audit/
    shared/
      errors/
      http/
      validation/
      security/
      utils/
  prisma/
    schema.prisma
  tests/
  package.json
  tsconfig.json
  .env.example
  README.md
```

Mantenha controllers finos, services com regra de negocio, repositories/acesso a dados isolado quando fizer sentido, schemas de validacao perto das rotas e testes nas regras criticas.

## Endpoints minimos

Autenticacao:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Usuarios:

- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/status`

Materiais, fornecedores e clientes/unidades:

- CRUD com validacao, paginacao, filtros e auditoria.

Estoque:

- `POST /stock/entries`
- `GET /stock/current`
- `GET /stock/lots`
- `GET /reports/stock-entries`

Cotacoes:

- `POST /quotes`
- `GET /quotes/latest`
- `GET /quotes/materials/status`
- `GET /quotes/materials/:materialId/history`

Saidas/vendas:

- `POST /sales`
- `GET /sales`
- `GET /sales/:id`
- `GET /sales/:id/romaneio`
- `POST /sales/:id/send-romaneio-email`
- `GET /reports/sales`

Auditoria:

- `GET /audit-logs`

Emails:

- `GET /email-jobs`
- `POST /email-jobs/:id/retry` somente admin ou perfil permitido.

## Responsividade do frontend

Ajuste a UI para telas menores:

- Sidebar responsiva.
- Tabelas com scroll horizontal ou layout adaptado em cards.
- Modais que funcionem bem em mobile.
- Formularios com campos empilhados em celular.
- Cards e grids sem texto espremido.
- Botao e navegacao usaveis em tablet/celular.

## Criterios de aceite

Entregue com:

- Backend rodando localmente.
- Banco PostgreSQL com migrations.
- `.env.example` documentado.
- Autenticacao e cookies seguros implementados.
- Rotas protegidas por perfil.
- Validacao de input em todas as rotas mutaveis.
- Queries parametrizadas/ORM.
- Auditoria funcionando.
- Entrada e saida de estoque persistidas no banco.
- FEFO transacional no backend.
- Cotacao persistida e com status bimestral.
- Relatorios basicos por entrada e saida.
- Email jobs implementados com mock/dev mode e provider real configuravel.
- Romaneio sem custo unitario e sem markup.
- Templates de email/romaneio com HTML escaping.
- Security headers, CORS, rate limit e CSRF.
- Testes para autenticacao, autorizacao, FEFO, cotacao e romaneio.
- Documentacao de deploy gratuito e caminho para VM com PM2/Nginx.

Antes de finalizar, rode:

```bash
npm install
npm run lint
npm run test
npm run build
```

Se criar `server/` com package separado, rode tambem os comandos equivalentes dentro de `server/`.

## Resultado esperado

Ao final, o projeto deve estar preparado para sair de um frontend com estado local para uma aplicacao com backend real, banco PostgreSQL, seguranca por rota, historico auditavel, emails controlados e documentacao suficiente para hospedar primeiro em ambiente gratuito e depois migrar para VM DigitalOcean/PM2/Nginx sem reescrever a arquitetura.

## Reforco: tela de login, criacao de usuarios e permissoes

- Deve existir uma tela de login como porta de entrada publica para usuarios nao autenticados.
- Depois que o usuario entra no sistema, nao deve existir uma aba chamada Login dentro da navegacao principal.
- Deve existir uma area administrativa para criar, editar, ativar, desativar e redefinir acesso de usuarios.
- Somente o usuario Admin pode ver e acessar Usuarios, Permissoes e Auditoria.
- Usuarios Operacionais e de Leitura nao podem ver menu, rota, tela ou endpoint administrativo de criacao de usuario.
- Mesmo que um usuario normal tente chamar a rota administrativa direto pela API, o backend deve retornar 403 Forbidden.
- O primeiro usuario Admin deve ser criado por seed seguro, comando de setup local, migration controlada ou variavel temporaria de bootstrap. Nao deixar usuario e senha padrao em producao. Se usar variavel de bootstrap (ex.: `ADMIN_BOOTSTRAP_TOKEN`), ela deve ser de uso unico (invalidada apos criar o primeiro admin) e removida do `.env` de producao logo em seguida — nao pode virar uma porta de entrada permanente esquecida.
- Senhas nunca podem aparecer em tela, resposta de API, log ou auditoria.
- Alteracao de perfil, status, senha e permissao deve gerar registro em audit_logs.
- A navegacao pos-login deve ser montada conforme perfil: Admin ve Usuarios/Permissoes/Auditoria; Operacional ve Estoque, Entrada, Saida, Cotacao e consultas permitidas; Leitura ve somente consultas e relatorios liberados.
