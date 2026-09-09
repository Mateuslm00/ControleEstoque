import { useState, useEffect } from "react";
import Header from "./components/layout/Header.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import Dashboard from "./features/dashboard/Dashboard.jsx";
import MateriaisTab from "./features/materiais/MateriaisTab.jsx";
import FornecedoresTab from "./features/fornecedores/FornecedoresTab.jsx";
import EntradaTab from "./features/entrada/EntradaTab.jsx";
import EstoqueAtualTab from "./features/estoque/EstoqueAtualTab.jsx";
import CotacaoTab from "./features/cotacao/CotacaoTab.jsx";
import SaidaTab from "./features/saida/SaidaTab.jsx";
import UnidadesTab from "./features/unidades/UnidadesTab.jsx";
import UsuariosTab from "./features/usuarios/UsuariosTab.jsx";
import ChangePasswordModal from "./features/auth/ChangePasswordModal.jsx";
import { authApi } from "./lib/api.js";
import { NAV } from "./data/constants.js";

/**
 * App
 * -----------------------------------------------------------------------
 * Componente raiz do sistema.
 *
 * MUDANÇA CENTRAL em relação à versão anterior: este componente não
 * guarda mais NENHUM dado de negócio (materiais, fornecedores, estoque,
 * vendas, cotações...) em useState. Antes, App.jsx era a única fonte de
 * verdade em memória do navegador — agora essa fonte de verdade é o
 * backend (server/), e cada tela busca e grava seus próprios dados via
 * src/lib/api.js. App.jsx ficou responsável só por:
 *
 *   1. Autenticação: verificar sessão existente (GET /auth/me) ao
 *      carregar a página, mostrar a tela de login quando não há sessão,
 *      e expor login/logout.
 *   2. Navegação entre abas (sem roteamento por URL, como antes).
 *   3. Gate de autorização visual: some com abas que o perfil do usuário
 *      logado não deveria ver, e — como defesa em profundidade, já que
 *      a proteção real está no backend (403 em qualquer rota) — barra a
 *      renderização de uma aba administrativa mesmo que alguém force o
 *      estado local para uma chave de aba escondida.
 * -----------------------------------------------------------------------
 */
export default function App() {
  const [tab, setTab] = useState("dashboard");

  // ---------- Autenticação (sessão real no backend, cookie HttpOnly) ----------
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((data) => setCurrentUser(data.user))
      .catch(() => setCurrentUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = async (identifier, password) => {
    const data = await authApi.login(identifier, password);
    setCurrentUser(data.user);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentUser(null);
    }
  };

  // Enquanto confirma a sessão com o backend, não mostra nem login nem app.
  if (checkingSession) {
    return (
      <div className="w-full min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text)]">
        Carregando...
      </div>
    );
  }

  // Sem sessão válida: tela de login é a única coisa visível (rota pública).
  if (!currentUser) {
    return <LoginPage onSubmit={handleLogin} />;
  }

  // Senha de bootstrap (admin recém-criado) ou reset feito por outro admin:
  // o backend já bloqueia qualquer outra rota nesse estado (ver app.ts),
  // então aqui só forçamos a mesma coisa visualmente, sem dar acesso ao
  // resto do sistema por trás do modal.
  if (currentUser.mustChangePassword) {
    return (
      <div className="w-full min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <ChangePasswordModal
          forced
          onDone={() => setCurrentUser({ ...currentUser, mustChangePassword: false })}
        />
      </div>
    );
  }

  // Defesa em profundidade: se a aba ativa não é permitida para o perfil
  // logado (ex: alguém forçou tab="usuarios" fora do clique do menu), cai
  // de volta pro dashboard em vez de renderizar a tela.
  const navItem = NAV.find((n) => n.key === tab);
  const allowedTab = !navItem?.roles || navItem.roles.includes(currentUser.role);
  const activeTab = allowedTab ? tab : "dashboard";

  return (
    <div className="w-full min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Header
        tab={activeTab}
        onChangeTab={setTab}
        role={currentUser.role}
        userName={currentUser.name}
        onLogout={handleLogout}
      />

      <main className="flex-1 md:ml-64 pt-16">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "materiais" && <MateriaisTab />}
        {activeTab === "fornecedores" && <FornecedoresTab />}
        {activeTab === "entrada" && <EntradaTab />}
        {activeTab === "estoqueatual" && <EstoqueAtualTab />}
        {activeTab === "cotacao" && <CotacaoTab />}
        {activeTab === "saida" && <SaidaTab />}
        {activeTab === "unidades" && <UnidadesTab />}
        {activeTab === "usuarios" && <UsuariosTab />}
      </main>
    </div>
  );
}
