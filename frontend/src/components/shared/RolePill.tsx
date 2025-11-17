type Props = { role?: string };

const colorByRole: Record<string, string> = {
  admin:     "bg-red-100 text-red-700",
  tecnico:   "bg-amber-100 text-amber-700",
  profesor:  "bg-emerald-100 text-emerald-700",
  estudiante:"bg-sky-100 text-sky-700",
};

export default function RolePill({ role }: Props) {
  if (!role) return null;
  const r = String(role).toLowerCase();
  const cls = colorByRole[r] ?? "bg-gray-100 text-gray-700";
  const pretty = r.charAt(0).toUpperCase() + r.slice(1);
  return (
    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {pretty}
    </span>
  );
}
