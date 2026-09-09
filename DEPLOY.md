# Hospedagem — Controle de Estoque

Registro de como e onde o sistema está hospedado, para não depender de
memória de quem configurou. Atualizado em 2026-09-09.

## Visão geral

| Peça | Serviço | Plano | URL |
|---|---|---|---|
| Frontend (React/Vite) | Vercel | Grátis (Hobby) | https://controle-estoque-weld.vercel.app |
| Backend (Node/Fastify) | Render | Grátis (Free Web Service) | https://controle-estoque-api-sttl.onrender.com |
| Banco (PostgreSQL) | Neon | Grátis | projeto `ControleEstoque`, banco `Estoquedb` |
| Repositório | GitHub | Público | https://github.com/Mateuslm00/ControleEstoque |

O repositório é **público** — isso é necessário porque o plano gratuito do
Vercel não permite auto-deploy a partir de push em repositório privado
quando o commit não é do dono exato da conta conectada. Não há segredo
nenhum commitado (`.env` real nunca entra no git — ver `.gitignore`); só o
`.env.example` com valores fictícios está versionado.

## Variáveis de ambiente do backend (Render)

Configuradas em Render → serviço → *Environment*:

```
NODE_ENV=production
DATABASE_URL=<connection string do Neon>
SESSION_SECRET=<64+ caracteres aleatórios, gerado uma vez, nunca reaproveitar o de dev>
SESSION_ABSOLUTE_TTL_HOURS=8
SESSION_IDLE_TTL_MINUTES=30
COOKIE_DOMAIN=localhost   # valor especial: significa "sem Domain custom" — ver src/config/env.ts
COOKIE_SECURE=true
COOKIE_SAMESITE=none      # front e back estão em domínios diferentes (vercel.app / onrender.com)
CORS_ORIGINS=https://controle-estoque-weld.vercel.app
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
EMAIL_MODE=dev
EMAIL_FROM=Controle de Estoque <no-reply@localhost>
```

**Build Command**: `npm ci --include=dev && npx prisma generate && npm run build`
(precisa do `--include=dev` porque `NODE_ENV=production` faz o `npm install`
pular devDependencies como `typescript`/`@types/node`, quebrando o build.)

**Start Command**: `npm start` (roda `node dist/src/server.js` — sem
`--env-file`, já que o Render injeta as variáveis direto no processo).

Se o CORS_ORIGINS mudar (domínio próprio, novo ambiente de preview etc.),
atualizar essa variável e o Render redesenha sozinho.

## Frontend (Vercel)

Única variável necessária, definida **antes** do build (Vite embute em
tempo de build, não dá pra trocar depois sem rebuildar):

```
VITE_API_URL=https://controle-estoque-api-sttl.onrender.com
```

## Banco (Neon)

Projeto `ControleEstoque`, região `AWS us-east-2 (Ohio)` — mesma região do
Render, para reduzir latência entre API e banco.

Migrations aplicadas com `npx prisma migrate deploy` (nunca `migrate dev`
contra produção). Sempre que uma migration nova for criada localmente,
aplicar também no Neon:

```bash
DATABASE_URL="<connection string do Neon>" npx prisma migrate deploy
```

## ⚠️ Gambiarra documentada: keep-alive do Render (cron-job.org)

**Problema**: o plano gratuito do Render "dorme" o backend depois de 15
minutos sem receber nenhuma requisição. A primeira requisição depois disso
demora ~30-50s pra responder (cold start) — ruim para quem for abrir o
sistema depois de um tempo sem uso.

**Solução aplicada**: um cronjob gratuito no **cron-job.org**
(conta pessoal, fora deste repositório) faz um `GET /health` no backend a
cada 10 minutos, para sempre — como nunca passa os 15 minutos de
inatividade, o Render nunca chega a dormir de verdade.

- Configurado em: https://cron-job.org (painel da conta que criou o job)
- Alvo: `https://controle-estoque-api-sttl.onrender.com/health`
- Frequência: `*/10 * * * *` (a cada 10 minutos, sem expiração)
- Notificações por e-mail ativadas para: falha de execução (após 1
  falha), recuperação após falha, e desativação por excesso de falhas.

**Como verificar se está funcionando:**
1. Aba "History" do cronjob em cron-job.org — mostra cada execução com
   status HTTP e tempo de resposta.
2. Logs do Render (aba "Logs" do serviço) — deve aparecer uma linha
   `GET /health` a cada ~10 minutos.

**Como desativar** (se um dia migrar para plano pago do Render, que não
dorme): pausar/excluir o cronjob em cron-job.org. Nada no código depende
disso — é puramente uma chamada HTTP externa e periódica.

**Alternativa mais robusta** (sem depender de um serviço de terceiro):
upgrade do Render para o plano pago (~US$7/mês), que remove o sleep por
completo.

## Contas de acesso (não commitar credenciais reais em lugar nenhum)

- GitHub: conta `Mateuslm00` é a dona do repositório e a que tem
  autorização instalada no Vercel/Render. Commits feitos localmente
  precisam ter o e-mail do git config batendo com um e-mail verificado
  dessa conta, senão o Vercel bloqueia o deploy automático (trava do
  plano gratuito para "colaboração").
- Neon, Render, Vercel, cron-job.org: contas próprias, sem integração
  automatizada — configuração feita manualmente pelos respectivos
  painéis web.
