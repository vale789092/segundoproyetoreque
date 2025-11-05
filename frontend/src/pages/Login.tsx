import { FormEvent, useState } from "react";
import "./Login.css";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // { token, user }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      {/* Panel decorativo */}
      <aside className="auth__hero">
        <div className="auth__heroContent">
          <div className="auth__badge">Proyecto Admin</div>
          <h1>Bienvenido 👋</h1>
          <p>Inicia sesión con tu correo institucional para continuar.</p>
        </div>
      </aside>

      {/* Card */}
      <section className="auth__card">
        <div className="auth__brand">
          <div className="auth__logo" aria-hidden />
          <span>Panel de acceso</span>
        </div>

        {error && <p className="auth__alert">{error}</p>}

        <form className="auth__form" onSubmit={onSubmit}>
          <label className="auth__label">
            Correo institucional
            <input
              className="auth__input"
              type="email"
              placeholder="usuario@estudiantec.cr"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </label>

          <label className="auth__label">
            Contraseña
            <div className="auth__pwWrap">
              <input
                className="auth__input"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth__pwToggle"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          <button className="auth__btn" disabled={loading} aria-busy={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="auth__hint">
          ¿No tienes cuenta? <a href="/register">Regístrate</a>
        </p>

        <footer className="auth__footer">
          <small>© {new Date().getFullYear()} Proyecto Admin</small>
        </footer>
      </section>
    </main>
  );
}
