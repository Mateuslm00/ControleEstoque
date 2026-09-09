/**
 * constants.js
 * -----------------------------------------------------------------------
 * Constantes de configuração usadas em várias telas do sistema.
 *
 * IMPORTANTE (ponto de atenção já existente no sistema original):
 * DISTRIMEDICAL_UNIT é uma string fixa no código — todo o estoque entra
 * e sai sempre desse "depósito central" só por convenção do código,
 * e não é editável na tela de Unidades/Clientes. Se um dia o nome do
 * depósito mudar, é preciso alterar aqui manualmente.
 * -----------------------------------------------------------------------
 */
import {
  LayoutDashboard, Package, Truck, ArrowDownToLine, Warehouse,
  BarChart3, ArrowUpFromLine, Building2, Users,
} from "lucide-react";

/** Markup (%) padrão aplicado a um material quando nenhum markup específico é definido. */
export const DEFAULT_MARKUP = 30;

/** Dados usados no cabeçalho dos relatórios e romaneios gerados em HTML/impressão. */
export const EMITENTE = { name: "Grupo Multiunidades — Controle de Estoque" };

/** Depósito central único que recebe toda entrada de estoque (ver aviso acima). */
export const DISTRIMEDICAL_UNIT = "DISTRIMEDICAL INTERNO";

/** Número mínimo de fornecedores exigido em cada cotação de preço (ver CotacaoTab). */
export const MIN_QUOTES = 3;

/**
 * Itens do menu lateral (Sidebar) — chave da aba, rótulo, ícone e quais
 * perfis (roles do backend) podem ver o item. Sem `roles` = todo mundo
 * autenticado ve. Isso e so a parte visual; a autorizacao de verdade
 * acontece no backend (ver PROMPT_CLAUDE_CODE_BACKEND_SEGURANCA.md).
 */
export const NAV = [
  { key: "dashboard", label: "Painel", icon: LayoutDashboard },
  { key: "materiais", label: "Materiais", icon: Package },
  { key: "fornecedores", label: "Fornecedores", icon: Truck },
  { key: "entrada", label: "Entrada de Estoque", icon: ArrowDownToLine, roles: ["ADMIN", "OPERACIONAL"] },
  { key: "estoqueatual", label: "Estoque Atual", icon: Warehouse },
  { key: "cotacao", label: "Cotação", icon: BarChart3 },
  { key: "saida", label: "Saída / Venda", icon: ArrowUpFromLine, roles: ["ADMIN", "OPERACIONAL"] },
  { key: "unidades", label: "Unidades / Clientes", icon: Building2, roles: ["ADMIN", "OPERACIONAL"] },
  { key: "usuarios", label: "Usuários", icon: Users, roles: ["ADMIN"] },
];
