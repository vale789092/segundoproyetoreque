import { useState, FormEvent } from "react";
import { http } from "@/services/http";

type Rol = "estudiante" | "profesor" | "tecnico" | "admin";

export default function Register() {
  const [form, setForm] = useState({
    nombre: "", correo: "", password: "",
    codigo: "", rol: "" as Rol | "",
    carrera: "", telefono: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const dominios: Record<Rol, RegExp> = {
    estudiante: /^[^@\s]+@estudiantec\.cr$/i,
    profesor: /^[^@\s]+@itcr\.ac\.cr$/i,
    tecnico: /^[^@\s]+@itcr\.ac\.cr$/i,
    admin: /^[^@\s]+@tec\.ac\.cr$/i
  };

  function onChange<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function validarCliente(): string | null {
    const { nombre, correo, password, codigo, rol, carrera, telefono } = form;
    if (!nombre || !correo || !password || !codigo || !rol || !carrera || !telefono) {
      return "Completa todos los campos.";
    }
    if (!/^[0-9]+$/.test(codigo)) return "El código debe ser numérico.";
    if (!/^[0-9]+$/.test(telefono)) return "El teléfono debe ser numérico.";
    if (telefono.length !== 8) return "El teléfono debe tener 8 dígitos.";
    if (rol === "estudiante" && codigo.length !== 10) return "Para estudiante el código debe tener 10 dígitos.";
    if (!dominios[rol as Rol]?.test(correo)) return "Correo no coincide con el dominio del rol.";
    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setOk(null);
    const err = validarCliente();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      await http("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          correo: form.correo.toLowerCase().trim(),
          password: form.password,
          codigo: form.codigo.trim(),
          rol: form.rol,
          carrera: form.carrera.trim(),
          telefono: form.telefono.trim()
        })
      });
      setOk("Usuario creado. Ahora puedes iniciar sesión.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <h1 style={styles.title}>Registrarse</h1>
        {error && <p style={styles.error}>{error}</p>}
        {ok && <p style={styles.ok}>{ok}</p>}
        <form onSubmit={onSubmit} style={styles.form}>
          <input style={styles.input} placeholder="Nombre"
            value={form.nombre} onChange={(e)=>onChange("nombre", e.target.value)} />
          <input style={styles.input} placeholder="Correo institucional" type="email"
            value={form.correo} onChange={(e)=>onChange("correo", e.target.value)} />
          <input style={styles.input} placeholder="Contraseña" type="password"
            value={form.password} onChange={(e)=>onChange("password", e.target.value)} />
          <input style={styles.input} placeholder="Código"
            value={form.codigo} onChange={(e)=>onChange("codigo", e.target.value)} />
          <select style={styles.input} value={form.rol}
            onChange={(e)=>onChange("rol", e.target.value)}>
            <option value="">Selecciona rol</option>
            <option value="estudiante">@estudiantec.cr</option>
            <option value="profesor">@itcr.ac.cr</option>
            <option value="tecnico">@itcr.ac.cr</option>
            <option value="admin">@tec.ac.cr</option>
          </select>
          <input style={styles.input} placeholder="Carrera"
            value={form.carrera} onChange={(e)=>onChange("carrera", e.target.value)} />
          <input style={styles.input} placeholder="Teléfono (8 dígitos)"
            value={form.telefono} onChange={(e)=>onChange("telefono", e.target.value)} />
          <button style={styles.button} disabled={loading}>
            {loading ? "Enviando..." : "Crear cuenta"}
          </button>
        </form>
        <p style={styles.hint}>¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell:{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f6f7fb",padding:16},
  card:{width:"100%",maxWidth:420,background:"#fff",borderRadius:16,boxShadow:"0 10px 30px rgba(0,0,0,.08)",padding:24},
  title:{margin:0,marginBottom:16,fontSize:22,fontWeight:700},
  form:{display:"grid",gap:12},
  input:{height:40,border:"1px solid #e5e7eb",borderRadius:10,padding:"0 12px",fontSize:14},
  button:{height:40,background:"#111827",color:"#fff",border:0,borderRadius:10,fontWeight:600,cursor:"pointer"},
  hint:{fontSize:13,color:"#6b7280",marginTop:10},
  error:{background:"#fee2e2",color:"#991b1b",border:"1px solid #fecaca",borderRadius:10,padding:"8px 10px",fontSize:13,marginBottom:8},
  ok:{background:"#ecfdf5",color:"#065f46",border:"1px solid #a7f3d0",borderRadius:10,padding:"8px 10px",fontSize:13,marginBottom:8}
};
