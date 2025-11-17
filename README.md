# Segundoproyectodereque – Backend + Docker + Postgres

API en **Node.js + Express** con **PostgreSQL** en Docker. Incluye healthcheck y estructura modular para crecer.

## Requisitos
- Docker Desktop (o Docker + Docker Compose).

### Base

Base URL: http://localhost:3000/api

Auth: usar Bearer JWT en el header Authorization: Bearer <token>

Content-Type: application/json en POST/PATCH

### Auth – Register

POST /api/auth/register
Auth: No
Body:

{
  "nombre": "Admin Labs",
  "correo": "admin.labs@tec.ac.cr",
  "password": "Secreta123",
  "codigo": "2024182540",
  "rol": "admin",
  "carrera": "Dirección de Laboratorios",
  "telefono": "88881234"
}



Respuestas: 201 Created con { user, message } / errores 400|409|422

### Auth – Login (retorna token)

POST /api/auth/login
Auth: No
Body:

{ "correo": "admin.labs@tec.ac.cr", "password": "Secreta123!" }


Respuestas: 200 OK con { token, token_type: "Bearer", expires_in, user } / 401|403

### Auth – Me

GET /api/auth/me
Auth: Sí (cualquier rol)

### Auth – Logout

POST /api/auth/logout
Auth: Sí

### Auth – Ping Admin

GET /api/auth/admin/ping
Auth: Sí (solo admin)

### Labs – Crear laboratorio

POST /api/labs
Auth: Sí (solo admin)
Body:

{
  "nombre": "Laboratorio A",
  "codigo_interno": "LAB-A-001",
  "ubicacion": "Edificio A, piso 1",
  "descripcion": "Perfil base"
}


Respuestas: 201 Created con { id, created_at, updated_at } / 400|409

### Labs – Listar laboratorios

GET /api/labs
Auth: Sí (cualquier rol)

### Labs – Detalle de laboratorio

GET /api/labs/:labId
Auth: Sí (cualquier rol)
Respuesta: { lab, technicians: [...], policies: [...] }

### Labs – Actualizar laboratorio

PATCH /api/labs/:labId
Auth: Sí (admin o tecnico)
Body (ejemplos, enviar solo lo que cambie):

{ "nombre": "Laboratorio A - Actualizado" }

{ "ubicacion": "Edificio A, piso 3" }

{ "descripcion": "Con kits nuevos" }

{ "codigo_interno": "LAB-A-001-2025" }


Respuestas: 200 OK con detalle del lab / 400|404

### Labs – Eliminar laboratorio

DELETE /api/labs/:labId
Auth: Sí (solo admin)
Respuestas: 200 OK con { ok: true } / 404

### Técnicos del Lab – Asignar técnico

POST /api/labs/:labId/technicians
Auth: Sí (admin o tecnico)
Body (mínimo):

{
  "usuario_id": "<uuid-del-usuario>",
  "activo": true
}


Respuestas: 201 Created con { id: "<tecLabId>" } / 400|409

### Técnicos del Lab – Listar

GET /api/labs/:labId/technicians
Auth: Sí (cualquier rol)

### Técnicos del Lab – Actualizar asignación

PATCH /api/labs/:labId/technicians/:tecLabId
Auth: Sí (admin o tecnico)
Body (enviar solo lo que cambie):

{ "activo": false }

{ "asignado_hasta": "2025-12-31T23:59:00Z" }


Respuestas: 200 OK con { id } / 404

### Técnicos del Lab – Remover asignación

DELETE /api/labs/:labId/technicians/:tecLabId
Auth: Sí (solo admin)
Respuestas: 200 OK con { ok: true } / 404

### Políticas – Crear

POST /api/labs/:labId/policies
Auth: Sí (admin o tecnico)
Body:

{
  "nombre": "Inducción de seguridad",
  "descripcion": "Charla obligatoria",
  "tipo": "seguridad",   // academico | seguridad | otro
  "obligatorio": true,
  "vigente_desde": "2025-10-01T00:00:00Z",
  "vigente_hasta": null
}


Respuestas: 201 Created con { id } / 400

### Políticas – Listar

GET /api/labs/:labId/policies
Auth: Sí (cualquier rol)

### Políticas – Actualizar

PATCH /api/labs/:labId/policies/:policyId
Auth: Sí (admin o tecnico)
Body (ejemplos) CADA UNO ES PARADO O UNEN TODOS EN UNO:

{ "descripcion": "Inducción obligatoria con examen" }

{ "tipo": "academico" }

{ "obligatorio": false }

{ "vigente_hasta": "2026-12-31T23:59:59Z" }


Respuestas: 200 OK con { id } / 404

### Políticas – Eliminar

DELETE /api/labs/:labId/policies/:policyId
Auth: Sí (admin o tecnico)
Respuestas: 200 OK con { ok: true } / 404

### Historial del laboratorio

GET /api/labs/:labId/history?limit=50&offset=0
Auth: Sí (cualquier rol)
Respuesta: arreglo de eventos { id, usuario_id, accion, detalle, creado_en }



### `.env` en la raíz (lo usa docker-compose)
```env
API_PORT=3000
PG_PORT=5432
PGADMIN_PORT=5050

POSTGRES_USER=appuser
POSTGRES_PASSWORD=apppass
POSTGRES_DB=appdb

PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin123

CORS_ORIGIN=http://localhost:5173



### `backend/.env` 
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://appuser:apppass@db:5432/appdb
CORS_ORIGIN=http://localhost:5173

```

=======================================

Levantar todo
docker compose up -d   

docker compose logs -f api           # ver logs en vivo del API esto sirve para porqué algo se jodió o así


=====================
Bajar el docker

docker compose down                  # bajar contenedores y red (mantiene volúmenes)
docker compose down -v               # bajar y ELIMINAR volúmenes (borra la BD)

docker compose down --rmi all -v --remove-orphans 

docker system prune -af --volumes 




======================================
Orden de las carpetas



backend/
├─ Dockerfile                 # imagen del API para dev
├─ .env                       # variables del backend (PORT, DATABASE_URL, etc.)
├─ .dockerignore
├─ package.json
├─ src/
│  ├─ server.js              # arranque del servidor (listen, shutdown)
│  ├─ app.js                 # configuración de Express (CORS, JSON, rutas, errores)
│  ├─ config/
│  │  └─ env.js              # lectura de variables de entorno
│  ├─ db/
│  │  ├─ index.js            # Pool de Postgres (pg) y test de conexión
│  │  └─ init/               # *.sql auto-init de la BD (solo 1ª vez)
│  │     └─ 001_schema.sql
│  ├─ middleware/
│  │  └─ error.js            # manejador central de errores
│  ├─ routes/
│  │  └─ index.js            # /api/v1/health y montaje de subrutas
│  └─ modules/
│     └─ auth/
│        ├─ auth.controller.js
│        ├─ auth.model.js
│        └─ auth.routes.js
docker-compose.yml            # orquesta db, api (y pgadmin opcional)
.env                          # variables globales para docker-compose
README.md


