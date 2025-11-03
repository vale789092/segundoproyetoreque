-- Requiere extensión para UUID aleatoria
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nombre         TEXT        NOT NULL,
  correo         TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,

  codigo         TEXT        NOT NULL UNIQUE,   -- carné o código de profesor
  rol            TEXT        NOT NULL CHECK (rol IN ('estudiante','profesor','tecnico','admin')),
  carrera        TEXT        NOT NULL,          -- carrera (cursa o imparte)

  telefono       TEXT,                          -- opcional; evita redundancia en tecnicos_labs
  activo         BOOLEAN     NOT NULL DEFAULT TRUE,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Asegurar correo institucional
  CONSTRAINT correo_institucional_chk CHECK (
    correo ~* '@(estudiantec\.cr|itcr\.ac\.cr|tec\.ac\.cr)$'
  )
);

CREATE INDEX IF NOT EXISTS idx_users_correo ON users (correo);
CREATE INDEX IF NOT EXISTS idx_users_codigo ON users (codigo);




-- ============================================================
-- 1.1 Perfiles de Laboratorio
-- ============================================================
CREATE TABLE IF NOT EXISTS laboratorios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  codigo_interno TEXT        NOT NULL,
  ubicacion      TEXT        NOT NULL,
  descripcion    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_labs_codigo UNIQUE (codigo_interno)
);
CREATE INDEX IF NOT EXISTS idx_labs_nombre ON laboratorios (nombre);

-- Responsables / contactos (sin redundar datos personales: vienen de users)
CREATE TABLE IF NOT EXISTS tecnicos_labs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  cargo          TEXT NOT NULL CHECK (cargo IN ('tecnico','encargado','asistente','otro')),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  asignado_desde TIMESTAMPTZ  NOT NULL DEFAULT now(),
  asignado_hasta TIMESTAMPTZ
);
-- Evitar duplicados activos del mismo usuario/cargo en el mismo lab
CREATE UNIQUE INDEX IF NOT EXISTS uniq_teclab_activo
  ON tecnicos_labs (laboratorio_id, usuario_id, cargo) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_teclab_lab ON tecnicos_labs (laboratorio_id);
CREATE INDEX IF NOT EXISTS idx_teclab_usr ON tecnicos_labs (usuario_id);

-- Recursos fijos (integrada con publicación/estados del 1.2)
CREATE TABLE IF NOT EXISTS equipos_fijos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id     UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,

  codigo_inventario  TEXT NOT NULL,                                    -- inventario visible
  nombre             TEXT NOT NULL,
  estado_operativo   TEXT NOT NULL CHECK (estado_operativo IN ('operativo','fuera_servicio','baja')),
  fecha_ultimo_mant  TIMESTAMPTZ,

  -- Publicación / catálogo / disponibilidad (1.2)
  tipo               TEXT NOT NULL CHECK (tipo IN ('equipo','material','software')),
  estado_disp        TEXT NOT NULL CHECK (estado_disp IN ('disponible','reservado','en_mantenimiento','inactivo')),
  cantidad_total     INT  NOT NULL DEFAULT 1 CHECK (cantidad_total >= 0),
  cantidad_disponible INT NOT NULL DEFAULT 1 CHECK (cantidad_disponible >= 0 AND cantidad_disponible <= cantidad_total),
  ficha_tecnica      JSONB,                                             -- specs libres
  fotos              TEXT[],                                            -- URLs
  reservable         BOOLEAN NOT NULL DEFAULT TRUE,                     -- para “enlace a solicitud”

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uniq_equipo_por_lab UNIQUE (laboratorio_id, codigo_inventario)
);
CREATE INDEX IF NOT EXISTS idx_equipo_lab    ON equipos_fijos (laboratorio_id);
CREATE INDEX IF NOT EXISTS idx_equipo_tipo   ON equipos_fijos (tipo);
CREATE INDEX IF NOT EXISTS idx_equipo_estado ON equipos_fijos (estado_disp);

-- Políticas internas / requisitos por laboratorio
CREATE TABLE IF NOT EXISTS requisitos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,        -- p.ej., "Curso XYZ", "Inducción"
  descripcion    TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('academico','seguridad','otro')),
  obligatorio    BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde  TIMESTAMPTZ,
  vigente_hasta  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_req_lab ON requisitos (laboratorio_id);

-- Historial del laboratorio (reutilizable también para 1.2.5 bitácora)
-- Nota: 'cambio_estado_equipo' incluido como pediste.
CREATE TABLE IF NOT EXISTS historial_laboratorio (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  usuario_id     UUID REFERENCES users(id),

  accion         TEXT NOT NULL CHECK (accion IN (
    'creacion_lab',
    'actualizacion_lab',
    'alta_equipo',
    'actualizacion_equipo',
    'cambio_estado_equipo',   -- <- requerido para 1.2-5 (bitácora de cambios)
    'mantenimiento_registrado',
    'politica_creada',
    'politica_actualizada',
    'reserva_creada',
    'reserva_aprobada',
    'reserva_rechazada',
    'otro'
  )),
  detalle        JSONB,                               -- diffs, campos afectados, etc.
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_lab     ON historial_laboratorio (laboratorio_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_hist_accion  ON historial_laboratorio (accion);

-- ============================================================
-- 1.2 Publicación de Disponibilidad y Recursos
-- (calendario base + excepciones/bloqueos)
-- ============================================================
-- Horario base semanal por laboratorio (0=domingo..6=sábado)
CREATE TABLE IF NOT EXISTS laboratorio_horarios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  dow            SMALLINT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  hora_inicio    TIME     NOT NULL,
  hora_fin       TIME     NOT NULL,
  capacidad_maxima INT    NOT NULL CHECK (capacidad_maxima > 0),
  CONSTRAINT chk_horario_order CHECK (hora_inicio < hora_fin)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lab_dow_slot
  ON laboratorio_horarios (laboratorio_id, dow, hora_inicio, hora_fin);

-- Excepciones/bloqueos por evento/mantenimiento/uso exclusivo
CREATE TABLE IF NOT EXISTS laboratorio_bloqueos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  titulo         TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('evento','mantenimiento','uso_exclusivo','bloqueo')),
  ts_inicio      TIMESTAMPTZ NOT NULL,
  ts_fin         TIMESTAMPTZ NOT NULL,
  descripcion    TEXT,
  creado_por     UUID REFERENCES users(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bloqueo_rango CHECK (ts_inicio < ts_fin)
);
CREATE INDEX IF NOT EXISTS idx_bloq_lab_rango
  ON laboratorio_bloqueos (laboratorio_id, ts_inicio, ts_fin);


-- ============================================================
-- Soporte UUID (si no está cargado)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- MÓDULO 2.3 — Gestión de Mantenimientos
-- ============================================================

-- Cabecera de mantenimiento (programación + registro técnico)
CREATE TABLE IF NOT EXISTS mantenimientos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Programación
  programado_para  TIMESTAMPTZ NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('preventivo','correctivo','calibracion','inspeccion','otro')),

  -- Técnico responsable (FK a users; el rol se valida a nivel app)
  tecnico_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Registro de mantenimiento (lo pediste "en la misma tabla")
  procedimientos   TEXT,      -- detalle de pasos/procedimientos
  repuestos_usados JSONB,     -- { "pieza":"X", "cantidad":N, ... } (libre)
  observaciones    TEXT,

  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mant_programado_para ON mantenimientos(programado_para);
CREATE INDEX IF NOT EXISTS idx_mant_tecnico         ON mantenimientos(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_mant_tipo            ON mantenimientos(tipo);

-- Relación N:M mantenimiento ↔ recursos involucrados
CREATE TABLE IF NOT EXISTS mantenimiento_recursos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mantenimiento_id UUID NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
  equipo_id        UUID NOT NULL REFERENCES equipos_fijos(id)  ON DELETE RESTRICT
);
-- evitar duplicar el mismo recurso en el mismo mantenimiento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mant_recurso
  ON mantenimiento_recursos(mantenimiento_id, equipo_id);
CREATE INDEX IF NOT EXISTS idx_mantrec_equipo ON mantenimiento_recursos(equipo_id);

-- Historial de mantenimiento (consulta por equipo, laboratorio o periodo)
CREATE TABLE IF NOT EXISTS historial_mantenimientos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  mantenimiento_id UUID REFERENCES mantenimientos(id) ON DELETE CASCADE,
  equipo_id        UUID REFERENCES equipos_fijos(id)  ON DELETE SET NULL,
  laboratorio_id   UUID REFERENCES laboratorios(id)   ON DELETE SET NULL,

  usuario_id       UUID REFERENCES users(id),
  accion           TEXT NOT NULL CHECK (accion IN (
    'creado','programado','actualizado','iniciado','completado','cancelado'
  )),
  detalle          JSONB,                            -- diffs, notas, etc.
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hm_por_equipo       ON historial_mantenimientos(equipo_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_hm_por_laboratorio  ON historial_mantenimientos(laboratorio_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_hm_por_fecha        ON historial_mantenimientos(creado_en);



-- ============================================================
-- MÓDULO 3.3 — Solicitud de Uso y Reservas
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  usuario_id         UUID NOT NULL REFERENCES users(id)          ON DELETE RESTRICT,
  laboratorio_id     UUID NOT NULL REFERENCES laboratorios(id)   ON DELETE RESTRICT,
  recurso_id         UUID NOT NULL REFERENCES equipos_fijos(id)  ON DELETE RESTRICT,

  fecha_uso_inicio   TIMESTAMPTZ NOT NULL,
  fecha_uso_fin      TIMESTAMPTZ NOT NULL,
  motivo             TEXT,
  adjuntos           JSONB,

  estado             TEXT NOT NULL CHECK (estado IN ('pendiente','aprobada','rechazada','en_revision'))
                     DEFAULT 'pendiente',

  creada_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprobada_en        TIMESTAMPTZ,  -- se setea al aprobar
  fecha_devolucion   TIMESTAMPTZ,  -- la llenaremos vía trigger

  CONSTRAINT chk_rango_uso CHECK (fecha_uso_inicio < fecha_uso_fin)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sol_por_usuario     ON solicitudes(usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_sol_por_lab         ON solicitudes(laboratorio_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_sol_por_recurso     ON solicitudes(recurso_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS idx_sol_por_estado      ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_sol_aprobadas_fecha ON solicitudes(aprobada_en);

-- Función y trigger para fecha_devolucion = aprobada_en + 20 días
CREATE OR REPLACE FUNCTION set_fecha_devolucion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.aprobada_en IS NULL THEN
    NEW.fecha_devolucion := NULL;
  ELSE
    NEW.fecha_devolucion := NEW.aprobada_en + INTERVAL '20 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_set_fecha_devolucion ON solicitudes;

CREATE TRIGGER tg_set_fecha_devolucion
BEFORE INSERT OR UPDATE OF aprobada_en ON solicitudes
FOR EACH ROW EXECUTE FUNCTION set_fecha_devolucion();


