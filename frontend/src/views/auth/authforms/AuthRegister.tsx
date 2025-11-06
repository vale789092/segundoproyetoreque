import { Button, Label, Select, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { register, Rol } from "@/services";

const AuthRegister = () => {
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "", correo: "", password: "",
    codigo: "", rol: "estudiante" as Rol, carrera: "", telefono: ""
  });
  const on = (k: keyof typeof form) => (e: any) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await register(form);
      alert("Cuenta creada. Inicie sesión");
      nav("/auth/login");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <Label htmlFor="nombre" value="Nombre" />
        <TextInput id="nombre" value={form.nombre} onChange={on("nombre")} required />
      </div>
      <div className="mb-3">
        <Label htmlFor="correo" value="Correo institucional" />
        <TextInput id="correo" type="email" placeholder="tu@estudiantec.cr"
          value={form.correo} onChange={on("correo")} required />
      </div>
      <div className="mb-3">
        <Label htmlFor="password" value="Contraseña" />
        <TextInput id="password" type="password"
          value={form.password} onChange={on("password")} required />
      </div>
      <div className="mb-3">
        <Label htmlFor="codigo" value="Código" />
        <TextInput id="codigo" placeholder="(Estudiante: 10 dígitos)"
          value={form.codigo} onChange={on("codigo")} required />
      </div>
      <div className="mb-3">
        <Label htmlFor="rol" value="Rol" />
        <Select id="rol" value={form.rol} onChange={on("rol")}>
          <option value="estudiante">Estudiante (@estudiantec.cr)</option>
          <option value="profesor">Profesor (@itcr.ac.cr)</option>
          <option value="tecnico">Técnico (@itcr.ac.cr)</option>
          <option value="admin">Admin (@tec.ac.cr)</option>
        </Select>
      </div>
      <div className="mb-3">
        <Label htmlFor="carrera" value="Carrera" />
        <TextInput id="carrera" value={form.carrera} onChange={on("carrera")} required />
      </div>
      <div className="mb-4">
        <Label htmlFor="telefono" value="Teléfono (8 dígitos)" />
        <TextInput id="telefono" value={form.telefono} onChange={on("telefono")}
          placeholder="88881234" required />
      </div>
      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}
      <Button type="submit" className="w-full bg-primary text-white">
        Crear cuenta
      </Button>
    </form>
  );
};
export default AuthRegister;
