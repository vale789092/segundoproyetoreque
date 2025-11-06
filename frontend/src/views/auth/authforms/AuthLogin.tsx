import { Button, Label, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { login } from "@/services";

const AuthLogin = () => {
  const nav = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    try {
      await login({ correo, password });
      nav('/');                     // o a donde quieras entrar
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        <Label htmlFor="correo" value="Correo institucional" />
        <TextInput id="correo" type="email" value={correo}
          onChange={(e) => setCorreo(e.target.value)} required />
      </div>
      <div className="mb-6">
        <Label htmlFor="pass" value="Contraseña" />
        <TextInput id="pass" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}
      <Button type="submit" className="w-full bg-primary text-white rounded-xl">
        Iniciar sesión
      </Button>
    </form>
  );
};
export default AuthLogin;
