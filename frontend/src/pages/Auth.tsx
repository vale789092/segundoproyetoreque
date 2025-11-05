import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Eye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94"/>
    <path d="M1 1l22 22"/>
    <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42"/>
    <path d="M22.94 11.06A21.77 21.77 0 0 0 17 5.08"/>
  </svg>
);


type Rol = "estudiante" | "profesor" | "tecnico" | "admin";
type Tab = "login" | "register";

type RegisterForm = {
  nombre: string;
  codigo: string;
  rol: "" | Rol;
  correo: string;
  telefono: string;
  carrera: string;
  password: string;
};

export default function Auth({ initialTab }: { initialTab?: Tab }) {
  const location = useLocation();
  const navigate = useNavigate();

  // pestaña: por prop o por URL
  const [tab, setTab] = useState<Tab>(initialTab ?? "login");
  useEffect(() => {
    if (!initialTab) {
      setTab(location.pathname.includes("register") ? "register" : "login");
    }
  }, [location.pathname, initialTab]);

  // ------- LOGIN -------
  const [correoL, setCorreoL] = useState("");
  const [passL, setPassL] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwL, setShowPwL] = useState(false);
  const [loadingL, setLoadingL] = useState(false);
  const [errorL, setErrorL] = useState<string | null>(null);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setErrorL(null);
    setLoadingL(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoL.trim().toLowerCase(), password: passL }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { token, user } = await res.json();
      if (remember) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(user));
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      setErrorL(err?.message ?? "No se pudo iniciar sesión.");
    } finally {
      setLoadingL(false);
    }
  }

  // ------- REGISTER -------
  const [formR, setFormR] = useState<RegisterForm>({
    nombre: "",
    codigo: "",
    rol: "",
    correo: "",
    telefono: "",
    carrera: "",
    password: "",
  });
  const [showPwR, setShowPwR] = useState(false);
  const [loadingR, setLoadingR] = useState(false);
  const [errorR, setErrorR] = useState<string | null>(null);
  const [okR, setOkR] = useState<string | null>(null);

  const dominios: Record<Rol, RegExp> = useMemo(
    () => ({
      estudiante: /^[^@\s]+@estudiantec\.cr$/i,
      profesor: /^[^@\s]+@itcr\.ac\.cr$/i,
      tecnico: /^[^@\s]+@itcr\.ac\.cr$/i,
      admin: /^[^@\s]+@tec\.ac\.cr$/i,
    }),
    []
  );

  function onChangeR<K extends keyof RegisterForm>(k: K, v: string) {
    setFormR((s) => ({ ...s, [k]: v }));
  }

  function validarR(): string | null {
    const { nombre, codigo, rol, correo, telefono, carrera, password } = formR;
    if (!nombre || !codigo || !rol || !correo || !telefono || !carrera || !password) {
      return "Completa todos los campos.";
    }
    if (!/^[0-9]+$/.test(codigo)) return "El código debe ser numérico.";
    if (rol === "estudiante" && codigo.length !== 10) return "El código del estudiante debe tener 10 dígitos.";
    if (!/^[0-9]+$/.test(telefono) || telefono.length !== 8) return "El teléfono debe tener 8 dígitos.";
    if (!dominios[rol as Rol].test(correo)) return "El correo no coincide con el dominio del rol.";
    // ejemplo simple: 4 letras + 4 números
    if (!/(?=(?:.*[A-Za-z]){4,})(?=(?:.*\d){4,}).{8,}/.test(password))
      return "La contraseña debe contener mínimo 4 letras y 4 números (8+ caracteres).";
    return null;
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setErrorR(null);
    setOkR(null);

    const err = validarR();
    if (err) return setErrorR(err);

    setLoadingR(true);
    try {
      const payload = {
        ...formR,
        correo: formR.correo.trim().toLowerCase(),
        nombre: formR.nombre.trim(),
        codigo: formR.codigo.trim(),
        telefono: formR.telefono.trim(),
      };
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setOkR("Usuario creado. Ya puedes iniciar sesión.");
      setTab("login");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setErrorR(err?.message ?? "No se pudo registrar.");
    } finally {
      setLoadingR(false);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    navigate(next === "login" ? "/login" : "/register", { replace: true });
  }

  return (
    <main className="authFull">
      <header className="authHeader">
        <h1 className="brand">LabTEC</h1>
        <p className="subtitle">Gestión de laboratorios TEC</p>
      </header>

      <section className="authCard">
        <div className="authBox">
          {/* Tabs */}
          <div className="tabs" role="tablist" aria-label="Autenticación">
            <button
              className={`tab ${tab === "login" ? "is-active" : ""}`}
              role="tab"
              aria-selected={tab === "login"}
              onClick={() => switchTab("login")}
            >
              Iniciar Sesión
            </button>
            <button
              className={`tab ${tab === "register" ? "is-active" : ""}`}
              role="tab"
              aria-selected={tab === "register"}
              onClick={() => switchTab("register")}
            >
              Registrarse
            </button>
          </div>

          {/* Panel */}
          <div className="panel">
            {tab === "login" ? (
              <form className="form" onSubmit={onLogin} noValidate>
                {errorL && <p className="alert">{errorL}</p>}

                <label className="label" htmlFor="login-email">Correo electrónico</label>
                <input
                  id="login-email"
                  className="input"
                  type="email"
                  placeholder="usuario@estudiantec.cr"
                  value={correoL}
                  onChange={(e) => setCorreoL(e.target.value)}
                  required
                />

                <label className="label" htmlFor="login-pass">Contraseña</label>
                <div className="pwWrap">
                  <input
                    id="login-pass"
                    className="input"
                    type={showPwL ? "text" : "password"}
                    placeholder="••••••••"
                    value={passL}
                    onChange={(e) => setPassL(e.target.value)}
                    required
                  />
                 <button
  type="button"
  className="pwToggle"
  onClick={() => setShowPwL(v => !v)}
  aria-label={showPwL ? "Ocultar contraseña" : "Mostrar contraseña"}
  title={showPwL ? "Ocultar contraseña" : "Mostrar contraseña"}
>
  {showPwL ? <EyeOff/> : <Eye/>}
</button>

                </div>

                <div className="row">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>Recordarme</span>
                  </label>
                  <a className="link" href="#" onClick={(e) => e.preventDefault()}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>

                <button className="btn" disabled={loadingL} aria-busy={loadingL}>
                  {loadingL ? "Entrando…" : "Iniciar Sesión"}
                </button>

                <p className="hint">
                  ¿No tienes cuenta?{" "}
                  <button type="button" className="link" onClick={() => switchTab("register")}>
                    Regístrate
                  </button>
                </p>
              </form>
            ) : (
              <form className="form" onSubmit={onRegister} noValidate>
                {errorR && <p className="alert">{errorR}</p>}
                {okR && <p className="ok">{okR}</p>}

                <label className="label" htmlFor="r-nombre">Nombre completo</label>
                <input
                  id="r-nombre"
                  className="input"
                  placeholder="Nombre y apellidos"
                  value={formR.nombre}
                  onChange={(e) => onChangeR("nombre", e.target.value)}
                  required
                />

                <label className="label" htmlFor="r-codigo">Identificación / Código</label>
                <input
                  id="r-codigo"
                  className="input"
                  placeholder="Código (estudiante: 10 dígitos)"
                  value={formR.codigo}
                  onChange={(e) => onChangeR("codigo", e.target.value)}
                  required
                />

                <div className="grid-2">
                  <div>
                    <label className="label" htmlFor="r-rol">Tipo de usuario</label>
                    <select
                      id="r-rol"
                      className="input"
                      value={formR.rol}
                      onChange={(e) => onChangeR("rol", e.target.value)}
                      required
                    >
                      <option value="">Seleccione…</option>
                      <option value="estudiante">Estudiante</option>
                      <option value="profesor">Profesor</option>
                      <option value="tecnico">Técnico</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="r-carrera">Carrera</label>
                    <input
                      id="r-carrera"
                      className="input"
                      placeholder="Ej. Ingeniería en Computación"
                      value={formR.carrera}
                      onChange={(e) => onChangeR("carrera", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <label className="label" htmlFor="r-correo">Correo institucional</label>
                <input
                  id="r-correo"
                  className="input"
                  type="email"
                  placeholder="usuario@estudiantec.cr / @itcr.ac.cr / @tec.ac.cr"
                  value={formR.correo}
                  onChange={(e) => onChangeR("correo", e.target.value)}
                  required
                />

                <label className="label" htmlFor="r-telefono">Número telefónico (8 dígitos)</label>
                <input
                  id="r-telefono"
                  className="input"
                  placeholder="88881234"
                  value={formR.telefono}
                  onChange={(e) => onChangeR("telefono", e.target.value)}
                  required
                />

                <label className="label" htmlFor="r-pass">Contraseña</label>
                <div className="pwWrap">
                  <input
                    id="r-pass"
                    className="input"
                    type={showPwR ? "text" : "password"}
                    placeholder="Mínimo 4 letras + 4 números"
                    value={formR.password}
                    onChange={(e) => onChangeR("password", e.target.value)}
                    required
                  />
                  <button
  type="button"
  className="pwToggle"
  onClick={() => setShowPwR(v => !v)}
  aria-label={showPwR ? "Ocultar contraseña" : "Mostrar contraseña"}
  title={showPwR ? "Ocultar contraseña" : "Mostrar contraseña"}
>
  {showPwR ? <EyeOff/> : <Eye/>}
</button>

                </div>
                <small className="note">La contraseña debe contener al menos 4 letras y 4 números.</small>

                <button className="btn" disabled={loadingR} aria-busy={loadingR}>
                  {loadingR ? "Registrando…" : "Registrarse"}
                </button>

                <p className="hint">
                  ¿Ya tienes cuenta?{" "}
                  <button type="button" className="link" onClick={() => switchTab("login")}>
                    Iniciar sesión
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
