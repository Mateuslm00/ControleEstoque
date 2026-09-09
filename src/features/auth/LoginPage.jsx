import { useState } from "react";
import {
  ShieldCheck,
  LockKeyhole,
  FileClock,
  ScanFace,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  TriangleAlert,
} from "lucide-react";
import "./LoginPage.css";

/**
 * LoginPage
 * -----------------------------------------------------------------------
 * Tela pública de login — porta de entrada do sistema para usuários ainda
 * não autenticados (ver PROMPT_CLAUDE_CODE_BACKEND_SEGURANCA.md, seção
 * "Reforço: tela de login, criação de usuários e permissões").
 *
 * Layout e classes CSS replicam 1:1 o protótipo estático de referência em
 * `pimentel-login-compact-original/` (mesma estrutura, mesmo styles.css
 * adaptado para módulo React). A diferença é que aqui os campos são
 * controlados de verdade e o formulário chama o backend.
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
 *  - onSubmit(email, password): Promise
 *      Função fornecida pelo componente pai (App.jsx) que efetivamente
 *      chama POST /auth/login. Deve rejeitar a Promise em caso de falha
 *      para esta tela poder exibir o aviso de erro.
 * -----------------------------------------------------------------------
 */
export default function LoginPage({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSession, setKeepSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit?.(email.trim(), password, keepSession);
    } catch {
      // Mensagem sempre genérica: o backend já retorna erro genérico de
      // propósito (não revela se o e-mail existe), então aqui repetimos
      // a mesma cautela em vez de tentar detalhar a causa.
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="pimentel-login-compact">
      <section className="shell" aria-label="Tela de login">
        {/* ===== Coluna esquerda: painel de marca (fundo verde) ===== */}
        <aside className="brand">
          {/* Nome do sistema e subtítulo */}
          <div className="brand-top">
            <div>
              <p className="brand-title">Pimentel Estoque</p>
              <p className="brand-subtitle">Controle interno</p>
            </div>
          </div>

          {/* Frase de efeito + descrição */}
          <div>
            <h2>Login seguro para estoque, cotação e romaneio.</h2>
            <p>Acesso por perfil, sessão protegida e auditoria das operações críticas.</p>
          </div>

          {/* Lista de benefícios/garantias de segurança */}
          <ul className="badges">
            <li>
              <ShieldCheck aria-hidden="true" /> Cookie seguro no servidor
            </li>
            <li>
              <LockKeyhole aria-hidden="true" /> Admin separado de usuários comuns
            </li>
            <li>
              <FileClock aria-hidden="true" /> Rastreabilidade completa
            </li>
          </ul>
        </aside>

        {/* ===== Coluna direita: formulário de login ===== */}
        <main className="form-side">
          {/* Selo "Acesso restrito" */}
          <div className="access">
            <ScanFace aria-hidden="true" /> Acesso restrito
          </div>

          <h1>Entrar no sistema</h1>
          <p className="copy">Use seu e-mail corporativo. O menu será liberado conforme seu perfil.</p>

          <form aria-label="Formulário de login" onSubmit={handleSubmit} noValidate>
            {/* Campo de e-mail */}
            <div className="field">
              <label htmlFor="login-email">E-mail</label>
              <div className={`input${error ? " has-error" : ""}`}>
                <Mail aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu.nome@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

          {/* Aviso padrão de acesso restrito */}
          <div className="notice">
            <TriangleAlert aria-hidden="true" />
            <span>Acesso restrito ao sistema de Estoque Pimentel.</span>
          </div>
        </main>
      </section>
    </div>
  );
}
