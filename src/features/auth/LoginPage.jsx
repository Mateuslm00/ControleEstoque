import { useState } from "react";
import { User, KeyRound, Eye, EyeOff, ArrowRight, TriangleAlert } from "lucide-react";
import "./LoginPage.css";

/**
 * LoginPage
 * -----------------------------------------------------------------------
 * Tela pública de login — porta de entrada do sistema para usuários ainda
 * não autenticados (ver PROMPT_CLAUDE_CODE_BACKEND_SEGURANCA.md, seção
 * "Reforço: tela de login, criação de usuários e permissões").
 *
 * Layout e classes CSS replicam 1:1 o protótipo estático de referência
 * usado no desenho da tela (já incorporado aqui, não existe mais como
 * arquivo separado). A diferença é que aqui os campos são controlados de
 * verdade e o formulário chama o backend.
 *
 * O QUE ESTE COMPONENTE NÃO FAZ (de propósito):
 *  - Não guarda token/sessão em localStorage — a sessão vive só no cookie
 *    HttpOnly setado pelo backend em /auth/login.
 *  - Não decide autorização nenhuma — só envia email/senha e repassa pro
 *    backend decidir. Quem manda no que o usuário pode ver é o backend.
 *  - Não mostra detalhe de erro do servidor: sempre mensagem genérica,
 *    para não revelar se o e-mail existe ou não.
 *
 * Props:
 *  - onSubmit(identifier, password): Promise
 *      Função fornecida pelo componente pai (App.jsx) que efetivamente
 *      chama POST /auth/login. `identifier` pode ser o e-mail OU o nome
 *      de exibição do usuário — o backend aceita os dois (ambos são
 *      únicos no banco, ver User.name em schema.prisma). Deve rejeitar a
 *      Promise em caso de falha para esta tela poder exibir o aviso de erro.
 * -----------------------------------------------------------------------
 */
export default function LoginPage({ onSubmit }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keepSession, setKeepSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Informe e-mail/nome e senha para continuar.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit?.(identifier.trim(), password, keepSession);
    } catch {
      // Mensagem sempre genérica: o backend já retorna erro genérico de
      // propósito (não revela se o e-mail/nome existe), então aqui
      // repetimos a mesma cautela em vez de tentar detalhar a causa.
      setError("Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="controle-estoque-login">
      <section className="shell" aria-label="Tela de login">
        {/* ===== Coluna esquerda: painel de marca (fundo verde) ===== */}
        <aside className="brand">
          {/* Nome do sistema e subtítulo */}
          <div className="brand-top">
            <div>
              <p className="brand-title">Controle de Estoque</p>
              <p className="brand-subtitle">Controle interno</p>
            </div>
          </div>

          {/* Frase de efeito + descrição */}
          <div>
            <h2>Estoque, cotação e romaneio em um só lugar.</h2>
            <p>Acesso por perfil: cada usuário vê só o que precisa do sistema.</p>
          </div>
        </aside>

        {/* ===== Coluna direita: formulário de login ===== */}
        <main className="form-side">
          <h1>Entrar no sistema</h1>
          <p className="copy">Use seu e-mail ou nome de usuário. O menu será liberado conforme seu perfil.</p>

          <form aria-label="Formulário de login" onSubmit={handleSubmit} noValidate>
            {/* Campo de identificação: aceita e-mail OU nome */}
            <div className="field">
              <label htmlFor="login-identifier">E-mail ou nome</label>
              <div className={`input${error ? " has-error" : ""}`}>
                <User aria-hidden="true" />
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="seu.nome@empresa.com.br ou seu nome"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Campo de senha (com botão de mostrar/ocultar) */}
            <div className="field">
              <label htmlFor="login-password">Senha</label>
              <div className={`input${error ? " has-error" : ""}`}>
                <KeyRound aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Linha "Manter sessão" + link "Esqueci minha senha" */}
            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={keepSession}
                  onChange={(e) => setKeepSession(e.target.checked)}
                  disabled={loading}
                />
                Manter sessão
              </label>
              <a href="#esqueci-senha">Esqueci minha senha</a>
            </div>

            {/* Botão de envio */}
            <button className="submit" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar com segurança"}
              <ArrowRight aria-hidden="true" />
            </button>
          </form>

          {/* Aviso de erro de autenticação (mensagem sempre genérica) */}
          {error && (
            <div className="notice error" role="alert">
              <TriangleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
