# 📦 Controlador de Estoque — Grupo Multiunidades

Sistema interno de controle de estoque com gestão de vendas, desenvolvido em React.
Permite registrar entradas de materiais, controlar lotes por validade (FEFO), cotar preços
com fornecedores bimestralmente e gerar romaneios de venda para as unidades do grupo.

---

## 🗂️ O que o sistema faz

| Módulo | O que faz |
|---|---|
| **Painel (Dashboard)** | Visão geral: valor em estoque, lucro acumulado, lotes vencendo, estoque baixo e últimas vendas |
| **Materiais** | Cadastro de materiais com tipo, grupo, unidade de medida e markup padrão de venda |
| **Fornecedores** | Cadastro de fornecedores com CNPJ, contato e e-mail |
| **Entrada de Estoque** | Registro de lotes recebidos (quantidade, validade, preço de compra, NFe) — sempre no depósito central |
| **Estoque Atual** | Saldo por lote (entradas − saídas), com valores e relatório HTML para download/impressão |
| **Cotação de Preços** | Cotação bimestral por material com mínimo de 3 fornecedores; calcula economia entre melhor e pior preço |
| **Saída / Venda** | Monta um "romaneio" de venda por unidade/cliente, consumindo lotes pelo critério FEFO (vence primeiro, sai primeiro) |
| **Unidades / Clientes** | Cadastro das unidades do grupo, que funcionam como clientes nas vendas internas |
| **Usuários** | Cadastro informativo de usuários e perfis (sem autenticação implementada) |

---

## 🏗️ Estrutura do projeto

```
estoque-app/
├── index.html                          # HTML raiz do Vite (ponto de entrada)
├── vite.config.js                      # Configuração do Vite (porta 5173)
├── tailwind.config.js                  # Configuração do Tailwind CSS
├── postcss.config.js                   # PostCSS (necessário para o Tailwind funcionar)
├── package.json                        # Dependências e scripts npm
├── .gitignore
│
└── src/
    ├── main.jsx                        # Monta o <App /> no DOM (ponto de entrada React)
    ├── App.jsx                         # Estado global + roteamento entre abas
    ├── index.css                       # Tailwind + CSS customizado (tokens, cards, botões)
    │
    ├── lib/                            # Funções utilitárias puras (sem React, sem estado)
    │   ├── format.js                   # uid(), todayISO(), brDate(), brl(), daysUntil()
    │   └── bimester.js                 # Cálculo de bimestres para a tela de Cotação
    │
    ├── data/                           # Dados e constantes do sistema
    │   ├── constants.js                # NAV, DISTRIMEDICAL_UNIT, MIN_QUOTES, DEFAULT_MARKUP, EMITENTE
    │   └── seedData.js                 # Dados de exemplo usados ao inicializar o app
    │
    ├── components/
    │   ├── common/                     # Componentes de UI reutilizáveis em todo o sistema
    │   │   ├── PageHeader.jsx          # Cabeçalho de cada tela (título + subtítulo + botão de ação)
    │   │   ├── StatCard.jsx            # Cartão de indicador numérico (KPI)
    │   │   ├── EmptyState.jsx          # Mensagem quando uma lista está vazia
    │   │   ├── Modal.jsx               # Janela modal genérica (formulários e visualizações)
    │   │   └── Field.jsx               # Wrapper de campo de formulário (label + input)
    │   └── layout/
    │       └── Sidebar.jsx             # Menu lateral com navegação entre abas
    │
    └── features/                       # Um módulo por funcionalidade de negócio
        ├── dashboard/
        │   └── Dashboard.jsx
        ├── materiais/
        │   └── MateriaisTab.jsx
        ├── fornecedores/
        │   └── FornecedoresTab.jsx
        ├── entrada/
        │   └── EntradaTab.jsx
        ├── estoque/
        │   ├── EstoqueAtualTab.jsx
        │   ├── RelatorioEstoqueModal.jsx
        │   └── relatorioEstoqueHtml.js  # Gera o HTML do relatório para download
        ├── cotacao/
        │   ├── CotacaoTab.jsx
        │   ├── NovaCotacaoModal.jsx
        │   └── HistoricoCotacaoModal.jsx
        ├── saida/
        │   ├── SaidaTab.jsx             # Lógica FEFO de consumo de lotes
        │   ├── RomaneioView.jsx
        │   └── romaneioHtml.js          # Gera o HTML do romaneio para download
        ├── unidades/
        │   └── UnidadesTab.jsx
        └── usuarios/
            └── UsuariosTab.jsx
```

---

## 🚀 Como rodar em localhost (passo a passo)

### Pré-requisitos

- **Node.js** versão 18 ou superior instalado
  - Verifique: `node -v`
  - Instale em: https://nodejs.org (use a versão LTS)
- **npm** versão 9 ou superior (já vem com o Node)
  - Verifique: `npm -v`
- Um terminal (Prompt de Comando, PowerShell, Terminal do Mac/Linux ou VS Code)

---

### Passo 1 — Baixar ou clonar o projeto

Se você baixou o `.zip`, extraia ele em uma pasta de sua preferência.

Se for usar Git:
```bash
git clone <url-do-repositorio>
cd estoque-app
```

---

### Passo 2 — Instalar as dependências

Dentro da pasta do projeto (`estoque-app/`), execute:

```bash
npm install
```

Isso vai baixar todas as bibliotecas listadas no `package.json` para a pasta `node_modules/`.
Só precisa rodar uma vez (ou quando o `package.json` mudar).

---

### Passo 3 — Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

O terminal vai exibir algo assim:

```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Abra o navegador e acesse **http://localhost:5173**. O sistema vai aparecer com os dados de exemplo já carregados.

> **Hot reload ativo:** qualquer alteração nos arquivos `.jsx` ou `.css` é refletida automaticamente no navegador, sem precisar recarregar a página manualmente.

---

### Passo 4 — Parar o servidor

Pressione `Ctrl + C` no terminal onde o `npm run dev` está rodando.

---

### Outros comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento com hot reload |
| `npm run build` | Gera os arquivos de produção na pasta `dist/` |
| `npm run preview` | Serve localmente os arquivos gerados pelo `build` (para testar antes de publicar) |

---

## ⚠️ Problemas conhecidos (mantidos do sistema original)

Os itens abaixo são **comportamentos já existentes**, documentados aqui para que futuras correções sejam planejadas. Nenhum foi introduzido na refatoração.

| # | Problema | Onde ocorre | Impacto |
|---|---|---|---|
| 1 | **Sem persistência** — todo o estado está em memória (`useState`). Ao recarregar a página, tudo volta aos dados de exemplo | App inteiro | 🔴 Crítico para uso em produção |
| 2 | **Excluir lote com vendas vinculadas** não emite aviso — o saldo some do estoque, mas a venda continua registrada | `EntradaTab` | 🔴 Integridade de dados |
| 3 | **Nenhum botão de excluir tem confirmação** — um clique errado apaga imediatamente | 5 telas | 🟠 Usabilidade |
| 4 | **Perfis de usuário são informativos** — não há autenticação nem controle de acesso por perfil | `UsuariosTab` | 🟠 Segurança |
| 5 | **Sem validação de nomes duplicados** ao cadastrar materiais, fornecedores ou unidades | Todos os cadastros | 🟠 Qualidade de dados |
| 6 | **`todayISO()` usa UTC** (`toISOString()`), podendo gravar a data de ontem/amanhã perto da meia-noite | `lib/format.js` | 🟡 Baixo |
| 7 | **`formatCNPJInput` é uma função identidade** (não formata nada) | `lib/format.js` | 🟢 Cosmético |
| 8 | **`supplierById` definida mas nunca usada** em `App.jsx` | `App.jsx` | 🟢 Código morto |
| 9 | **6 ícones importados e não usados** no sistema original (`Calendar`, `ChevronRight`, etc.) | `App.jsx` original | 🟢 Cosmético |
| 10 | **`DISTRIMEDICAL_UNIT` é uma constante fixa no código** — não é editável pela interface | `data/constants.js` | 🟡 Decisão de design |

---

## 🗄️ Banco de dados — qual usar?

### Por que o sistema ainda não tem banco de dados?

O sistema atual guarda todo o estado em `useState` do React — memória do navegador.
Ao recarregar a página, tudo se perde. Para uso em produção por múltiplas pessoas
ou em múltiplos dispositivos, é preciso um banco de dados real.

---

### Recomendação: **PostgreSQL + Supabase**

Para um sistema deste porte (uma organização, ~10 unidades, dados de estoque médico),
o stack recomendado é:

```
PostgreSQL (banco)  →  Supabase (hospedagem + API pronta)  →  React (front-end atual)
```

#### Por que PostgreSQL?

- Suporte nativo a transações (garante que uma venda e o consumo de lotes sejam gravados juntos ou nenhum dos dois — elimina o bug #2 da tabela acima)
- Tipos de dado precisos para números financeiros (`NUMERIC`, evita erros de ponto flutuante do JavaScript)
- Suporte a datas com fuso horário (`TIMESTAMPTZ`), eliminando o bug #6
- Queries complexas para relatórios (joins entre materiais, lotes, vendas)
- Gratuito e open source

#### Por que Supabase?

- Fornece um PostgreSQL hospedado com API REST e SDK JavaScript prontos
- Autenticação de usuários já embutida (resolve o bug #4 — perfis sem controle de acesso)
- Plano gratuito suficiente para este volume de dados
- Interface visual para ver e editar os dados diretamente, sem precisar de SQL no dia a dia
- Compatível com o front-end React atual sem mudar a estrutura do projeto

---

### Modelo de tabelas sugerido

```sql
-- Tabelas principais (correspondentes ao estado em App.jsx)

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  contact_person TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  "group" TEXT NOT NULL,
  measure_unit TEXT NOT NULL DEFAULT 'un',
  markup NUMERIC(5,2) NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  unit TEXT NOT NULL DEFAULT 'DISTRIMEDICAL INTERNO',
  quantity NUMERIC(10,3) NOT NULL,
  validity DATE,
  purchase_price NUMERIC(12,4) NOT NULL,
  nfe_number TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number TEXT NOT NULL UNIQUE,
  unit_name TEXT NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost_total NUMERIC(12,4) NOT NULL,
  total NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(10,3) NOT NULL,
  markup NUMERIC(5,2) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  subtotal NUMERIC(12,4) NOT NULL
);

-- Rastreia quais lotes (entries) foram consumidos em cada item de venda
-- (essencial para recalcular o saldo restante de cada lote)
CREATE TABLE sale_item_consumed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id),
  qty NUMERIC(10,3) NOT NULL
);

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id),
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE quotation_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  price NUMERIC(12,4) NOT NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Todas',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Alternativas mais simples (se não quiser API)

| Opção | Quando usar | Limitação |
|---|---|---|
| `localStorage` | Uso por uma só pessoa no mesmo navegador | Não compartilha entre dispositivos/pessoas |
| **Supabase** ✅ | Uso por equipe, múltiplos dispositivos | Requer criar conta e configurar |
| Firebase (Firestore) | Familiaridade com Google | Banco NoSQL, sem transações tão simples |
| PocketBase | Rodar tudo local num único executável | Requer servidor Node/Linux rodando |

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Versão | Função |
|---|---|---|
| React | 18 | Interface e estado da aplicação |
| Vite | 5 | Bundler e servidor de desenvolvimento |
| Tailwind CSS | 3 | Utilitários de estilo |
| lucide-react | 0.383 | Ícones |
| IBM Plex Mono | — | Fonte monoespaçada para números |
| Manrope | — | Fonte principal da interface |

---

## 👤 Autoria

Sistema desenvolvido para controle interno do **Grupo Multiunidades** (ISV, Multicordis, Admed, Venna, Sauvtech e demais unidades associadas).
