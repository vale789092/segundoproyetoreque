Estudiante:
{
  "nombre": "Ana Romero",
  "correo": "ana.romero@estudiantec.cr",
  "password": "Test1234*",
  "codigo": "2024182540",
  "rol": "estudiante",
  "carrera": "Ingeniería en Computación",
  "telefono": "88881234"
}

Profesor
{
  "nombre": "Carlos Mora",
  "correo": "carlos.mora@itcr.ac.cr",
  "password": "Test1234*",
  "codigo": "55555",
  "rol": "profesor",
  "carrera": "Ciencias Naturales",
  "telefono": "88884567"
}


Técnico
{
  "nombre": "Luisa Solano",
  "correo": "luisa.solano@itcr.ac.cr",
  "password": "Test1234*",
  "codigo": "77777",
  "rol": "tecnico",
  "carrera": "Soporte de Laboratorios",
  "telefono": "88885678"
}

Admin
{
  "nombre": "Admin Labs",
  "correo": "admin.labs@tec.ac.cr",
  "password": "Test1234*",
  "codigo": "99999",
  "rol": "admin",
  "carrera": "Dirección de Laboratorios",
  "telefono": "88886789"
}

Admin: C/E/D

Técnico: E solo en sus labs (?mine=1)

Profesor/Estudiante: solo lectura

# Matriz de funcionalidades por rol

## 1. Administrador

### 1.1 Laboratorios y Departamentos

* Crear/editar/eliminar laboratorios
  **Endpoints:** `POST /labs`, `PATCH /labs/:labId`, `DELETE /labs/:labId`, `GET /labs`, `GET /labs/:labId`
  **Estado:** Implementado

* Gestionar responsables (técnicos) por laboratorio
  **Endpoints:** `POST /labs/:labId/technicians`, `GET /labs/:labId/technicians`, `PATCH /labs/:labId/technicians/:tecLabId`, `DELETE /labs/:labId/technicians/:tecLabId`
  **Estado:** **Backend implementado**; **Frontend**: listado en `LabDetail.tsx` (solo lectura vía `getLab`), **CRUD pendiente** (no existen todavía funciones `add/update/remove` en `services/labs.ts` ni UI de formulario/tabla).

* Definir políticas internas (seguridad, horarios, capacidad)
  **Endpoints:** `POST /labs/:labId/policies`, `GET /labs/:labId/policies`, `PATCH /labs/:labId/policies/:id`, `DELETE /labs/:labId/policies/:id`
  **Estado:** Implementado

* Publicar disponibilidad (horarios y bloqueos)
  **Endpoints:** `POST /labs/:labId/horarios`, `GET /labs/:labId/horarios`, `PATCH /labs/:labId/horarios/:id`, `DELETE /labs/:labId/horarios/:id`
  **Estado:** Implementado

* Gestionar recursos fijos (equipos)
  **Endpoints:** `POST /labs/:labId/equipos`, `GET /labs/:labId/equipos`, `GET /labs/:labId/equipos/:equipoId`, `PATCH /labs/:labId/equipos/:equipoId`, `DELETE /labs/:labId/equipos/:equipoId`
  **Estado:** Implementado

* Bitácora de laboratorio
  **Endpoints:** `GET /labs/:labId/history`
  **Estado:** Implementado

### 1.2 Solicitudes y Control de Recursos

* Ver/aprobar/rechazar solicitudes
  **Endpoint:** `PATCH /requests/:id/status` (admin|tecnico)
  **Estado:** Implementado parcialmente (faltan efectos sobre inventario/calendario)

### 1.3 Administración del sistema

* Gestión de usuarios/roles
  **Endpoints:** `/auth/register`, `/auth/me (GET/PATCH)`
  **Estado:** Implementado

* Reportes institucionales (inventario, uso global)
  **Endpoints actuales:** `/history/my-usage(.xlsx/.pdf)` (solo usuario)
  **Pendiente:** generar reportes globales (todos los labs)

---

## 2. Técnico / Encargado

* Ver laboratorios asignados e inventario
  **Endpoints:** `GET /labs` (filtro por técnico), `GET /labs/:labId/equipos`
  **Estado:** Parcial (falta filtro por técnico)

* Procesar solicitudes (entregas/devoluciones)
  **Endpoint:** `PATCH /requests/:id/status`
  **Estado:** Implementado parcialmente

* Actualizar estado de equipos
  **Endpoint:** `PATCH /labs/:labId/equipos/:equipoId`
  **Estado:** Solo admin actualmente (se puede ampliar a técnico)

* Registrar mantenimientos
  **Estado:** Pendiente (faltan tablas y rutas de mantenimiento)

* Reportes operativos (uso e inventario)
  **Estado:** Pendiente (falta agregación y export)

---

## 3. Usuario (Estudiante / Docente)

* Registro/Login/Perfil
  **Endpoints:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`
  **Estado:** Implementado

* Ver laboratorios, recursos y disponibilidad
  **Endpoints:** `GET /labs`, `GET /labs/:labId`, `GET /labs/:labId/equipos`, `GET /labs/:labId/horarios`
  **Estado:** Implementado (falta vista calendario avanzada)

* Crear y gestionar solicitudes
  **Endpoints:** `POST /requests`, `GET /requests`, `GET /requests/:id`, `PATCH /requests/:id`, `DELETE /requests/:id`
  **Estado:** Implementado parcialmente (validaciones de traslape pendientes)

* Ver historial y exportar
  **Endpoints:** `GET /history/my-usage`, `/history/my-usage.xlsx`, `/history/my-usage.pdf`, `/history/me`
  **Estado:** Implementado

* Notificaciones/mensajería
  **Estado:** Pendiente (frontend tiene stub de servicio)

---

## 4. Común (Todos los roles autenticados)

* Consultar laboratorios y equipos
  **Endpoints:** `GET /labs`, `GET /labs/:labId`, `GET /labs/:labId/equipos`, `GET /labs/:labId/horarios`

* Ver/editar perfil
  **Endpoints:** `GET /auth/me`, `PATCH /auth/me`

* Buscar usuarios
  **Endpoint:** `GET /users/search`

* Consultar historial propio
  **Endpoint:** `/history/*`

---

## Gaps y próximos pasos

1. Cerrar integración de solicitudes → inventario → calendario
2. Agregar filtro de laboratorios por técnico asignado
3. **Frontend:** implementar CRUD de responsables (técnicos) por laboratorio

   * Servicios a crear en `services/labs.ts`:

     * `addLabTechnician(labId, payload)` → `POST /labs/:labId/technicians`
     * `updateLabTechnician(labId, tecLabId, patch)` → `PATCH /labs/:labId/technicians/:tecLabId`
     * `removeLabTechnician(labId, tecLabId)` → `DELETE /labs/:labId/technicians/:tecLabId`
   * UI: en `views/labs/LabDetail.tsx` reemplazar `<pre>` por tabla editable (crear/editar/baja) y validaciones de correo por rol.
4. Generar reportes globales (inventario, uso, desempeño)
5. Crear módulo de mantenimientos
6. Implementar notificaciones y suscripciones

---

## Resumen rápido

| Rol                     | Funciones principales                                                           | Estado general |
| ----------------------- | ------------------------------------------------------------------------------- | -------------- |
| **Administrador**       | CRUD labs, técnicos, políticas, equipos, aprobar solicitudes, reportes globales | 80% completo   |
| **Técnico**             | Ver labs asignados, procesar solicitudes, registrar mantenimiento               | 60% completo   |
| **Usuario (Est./Doc.)** | Crear solicitudes, ver disponibilidad, descargar historial                      | 90% completo   |
| **Común (todos)**       | Perfil, consulta de labs y equipos                                              | 100% completo  |
