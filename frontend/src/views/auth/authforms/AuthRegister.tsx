import { Button, Label, Select, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { register, Rol } from "@/services";

const dominioPorRol: Record<Rol, RegExp> = {
  estudiante: /^[^@\s]+@estudiantec\.cr$/i,
  profesor: /^[^@\s]+@itcr\.ac\.cr$/i,
  tecnico: /^[^@\s]+@itcr\.ac\.cr$/i,
  admin: /^[^@\s]+@tec\.ac\.cr$/i,
};

const AuthRegister = () => {
  const nav = useNavigate();

  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    password: "",
    codigo: "",
    rol: "estudiante" as Rol,
    carrera: "",
    telefono: "",
  });

  const [errors, setErrors] = useState<
    Partial<
      typeof form & {
        global: string;
      }
    >
  >({});

  const on =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm({ ...form, [k]: e.target.value });
      setErrors((prev) => ({ ...prev, [k]: undefined, global: undefined }));
    };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); // limpiamos

    const newErrors: Partial<typeof form & { global: string }> = {};

    // ===== Validaciones frontend =====
    if (!form.nombre.trim()) {
      newErrors.nombre = "El nombre es obligatorio.";
    }

    if (!form.correo.trim()) {
      newErrors.correo = "El correo es obligatorio.";
    } else {
      const regex = dominioPorRol[form.rol];
      if (!regex.test(form.correo.trim())) {
        newErrors.correo = `El correo debe ser del dominio institucional para el rol seleccionado (${form.rol}).`;
      }
    }

    if (!form.password.trim()) {
      newErrors.password = "La contraseña es obligatoria.";
    } else if (form.password.length < 8) {
      newErrors.password = "La contraseña debe tener al menos 8 caracteres.";
    }

    if (!form.codigo.trim()) {
      newErrors.codigo = "El código es obligatorio.";
    } else if (
      form.rol === "estudiante" &&
      String(form.codigo).length !== 10
    ) {
      newErrors.codigo = "Para estudiantes, el código debe tener 10 dígitos.";
    }

    if (!form.carrera.trim()) {
      newErrors.carrera = "La carrera / unidad es obligatoria.";
    }

    if (!form.telefono.trim()) {
      newErrors.telefono = "El teléfono es obligatorio.";
    } else if (
      !/^[0-9]+$/.test(form.telefono) ||
      form.telefono.length !== 8
    ) {
      newErrors.telefono =
        "El teléfono debe tener exactamente 8 dígitos (ej: 88881234).";
    }

    // Si hay errores, no llamamos al backend
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // ===== Llamada al backend =====
    try {
      await register(form);
      alert("Cuenta creada. Inicie sesión");
      nav("/auth/login");
    } catch (e: any) {
      // Error global del backend
      setErrors({
        global: e?.message ?? "No se pudo crear la cuenta.",
      });
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <Label htmlFor="nombre" value="Nombre" />
        <TextInput
          id="nombre"
          value={form.nombre}
          onChange={on("nombre")}
          required
        />
        {errors.nombre && (
          <p className="text-red-500 text-xs mt-1">{errors.nombre}</p>
        )}
      </div>

      <div className="mb-3">
        <Label htmlFor="correo" value="Correo institucional" />
        <TextInput
          id="correo"
          type="email"
          placeholder="tu@estudiantec.cr"
          value={form.correo}
          onChange={on("correo")}
          required
        />
        {errors.correo && (
          <p className="text-red-500 text-xs mt-1">{errors.correo}</p>
        )}
      </div>

      <div className="mb-3">
        <Label htmlFor="password" value="Contraseña" />
        <TextInput
          id="password"
          type="password"
          value={form.password}
          onChange={on("password")}
          required
        />
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{errors.password}</p>
        )}
      </div>

      <div className="mb-3">
        <Label htmlFor="codigo" value="Código" />
        <TextInput
          id="codigo"
          placeholder="(Estudiante: 10 dígitos)"
          value={form.codigo}
          onChange={on("codigo")}
          required
        />
        {errors.codigo && (
          <p className="text-red-500 text-xs mt-1">{errors.codigo}</p>
        )}
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
        <TextInput
          id="carrera"
          value={form.carrera}
          onChange={on("carrera")}
          required
        />
        {errors.carrera && (
          <p className="text-red-500 text-xs mt-1">{errors.carrera}</p>
        )}
      </div>

      <div className="mb-4">
        <Label htmlFor="telefono" value="Teléfono (8 dígitos)" />
        <TextInput
          id="telefono"
          value={form.telefono}
          onChange={on("telefono")}
          placeholder="88881234"
          required
        />
        {errors.telefono && (
          <p className="text-red-500 text-xs mt-1">{errors.telefono}</p>
        )}
      </div>

      {errors.global && (
        <p className="text-red-500 text-sm mb-3">{errors.global}</p>
      )}

      <Button type="submit" className="w-full bg-primary text-white">
        Crear cuenta
      </Button>
    </form>
  );
};

export default AuthRegister;
