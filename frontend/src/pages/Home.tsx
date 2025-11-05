export default function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      {user ? <pre>{JSON.stringify(user, null, 2)}</pre> : <p>No hay usuario</p>}
    </div>
  );
}
