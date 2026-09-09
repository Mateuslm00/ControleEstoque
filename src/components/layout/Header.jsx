import { useState } from "react";
import { LogOut, User, Users, KeyRound } from "lucide-react";
import { NAV } from "../../data/constants.js";
import ChangePasswordModal from "../../features/auth/ChangePasswordModal.jsx";

/**
 * Header
 * -----------------------------------------------------------------------
 * Barra de topo (título + usuário logado/sair, como no layout original)
 * mais o menu lateral fixo (sempre visível, sem gaveta/hamburguer) logo
 * abaixo dela.
 *
 * Mesmo esquema de filtragem por `role` que a Sidebar original tinha:
 * quem não é ADMIN nunca vê "Usuários", por exemplo. Isso é só a parte
 * visual — a checagem de permissão de verdade acontece no backend.
 *
 * Props:
 *  - tab: string — chave da aba atualmente ativa
 *  - onChangeTab: (key: string) => void — chamado ao clicar em um item
 *  - role: string — perfil do usuário logado (ADMIN | OPERACIONAL | LEITURA)
 *  - userName: string — nome exibido no cabeçalho
 *  - onLogout: () => void — chamado ao clicar em "Sair"
 * -----------------------------------------------------------------------
 */
export default function Header({ tab, onChangeTab, role, userName, onLogout }) {
  const visibleItems = NAV.filter((n) => n.key !== "usuarios" && (!n.roles || n.roles.includes(role)));
  const isAdmin = role === "ADMIN";
  const [profileOpen, setProfileOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 no-print"
        style={{ background: "linear-gradient(to bottom, var(--primary-deep), var(--primary-neon))" }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="leading-tight">
            <div className="text-white font-extrabold text-sm sm:text-base">Controlador de Estoque</div>
            <div className="text-[11px]" style={{ color: "#9FC3BD" }}>Grupo Multiunidades</div>
          </div>

          {userName && (
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Perfil"
                aria-expanded={profileOpen}
                className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors"
                style={{ background: "rgba(255,255,255,0.14)", color: "white" }}
              >
                <User size={18} />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 w-56 rounded-lg z-50 py-2 px-3"
                    style={{ background: "var(--primary-deep)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
                  >
                    <div className="text-xs pb-2 mb-2 border-b truncate" style={{ color: "#BFD8D3", borderColor: "rgba(255,255,255,0.15)" }} title={userName}>
                      {userName}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          onChangeTab("usuarios");
                        }}
                        className="w-full flex items-center gap-2 text-sm py-1.5 hover:text-white transition-colors"
                        style={{ color: "#BFD8D3" }}
                      >
                        <Users size={14} />
                        Usuários
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setChangingPassword(true);
                      }}
                      className="w-full flex items-center gap-2 text-sm py-1.5 hover:text-white transition-colors"
                      style={{ color: "#BFD8D3" }}
                    >
                      <KeyRound size={14} />
                      Trocar senha
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 text-sm py-1.5 hover:text-white transition-colors"
                      style={{ color: "#BFD8D3" }}
                    >
                      <LogOut size={14} />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {changingPassword && (
        <ChangePasswordModal onClose={() => setChangingPassword(false)} onDone={() => setChangingPassword(false)} />
      )}

      <nav
        className="fixed top-16 left-0 w-64 z-30 flex flex-col px-3 py-4 no-print"
        style={{ height: "calc(100vh - 4rem)", background: "linear-gradient(to top, var(--primary-deep), var(--primary-neon))" }}
      >
        {visibleItems.map((n) => {
          const Icon = n.icon;
          const active = tab === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onChangeTab(n.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-sm text-left transition-colors"
              style={{
                background: active ? "rgba(255,255,255,0.14)" : "transparent",
                color: active ? "white" : "#BFD8D3",
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon size={17} />
              {n.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
