-- ============================================================================
-- ESQUEMA DE BASE DE DATOS PARA DASHBOARD DE GESTIÓN DE FAUNA (SUPABASE)
-- ============================================================================
-- Este script define las tablas de métricas pre-calculadas y configura
-- Row Level Security (RLS) para permitir solo lectura (SELECT) desde el
-- frontend (clave anónima/pública) y restringir escritura al rol de servicio.
-- ============================================================================

-- 1. Tabla de Catálogo de Clases Taxonómicas (Filtro con Imágenes)
CREATE TABLE IF NOT EXISTS public.secciones_clase (
    id SERIAL PRIMARY KEY,
    clase VARCHAR(50) NOT NULL UNIQUE,
    nombre_seccion VARCHAR(50) NOT NULL,
    imagen TEXT NOT NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de KPIs Resumen (Tarjetas Principales + Indicador ANLA)
CREATE TABLE IF NOT EXISTS public.kpi_resumen (
    id SERIAL PRIMARY KEY,
    clase VARCHAR(50) NOT NULL DEFAULT 'TODAS',
    mes VARCHAR(20) NOT NULL DEFAULT 'TODOS',
    total_ahuyentados INT NOT NULL DEFAULT 0,
    total_rescatados INT NOT NULL DEFAULT 0,
    total_individuos INT NOT NULL DEFAULT 0,
    tasa_reubicacion NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tasa_mortalidad NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    indicador_anla NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    estado_anla VARCHAR(30) NOT NULL DEFAULT 'Cumple (<20%)',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_kpi_resumen UNIQUE(clase, mes)
);

-- 3. Tabla de Evolución Mensual por Manejo (Gráfico de Líneas)
CREATE TABLE IF NOT EXISTS public.kpi_tendencia_mensual (
    id SERIAL PRIMARY KEY,
    clase VARCHAR(50) NOT NULL DEFAULT 'TODAS',
    mes_num INT NOT NULL,
    mes_nombre VARCHAR(20) NOT NULL,
    manejo VARCHAR(30) NOT NULL,
    total_individuos INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_kpi_tendencia UNIQUE(clase, mes_nombre, manejo)
);

-- 4. Tabla de Mortalidad por Actividad (Gráfico de Barras Horizontales)
CREATE TABLE IF NOT EXISTS public.kpi_mortalidad_actividad (
    id SERIAL PRIMARY KEY,
    clase VARCHAR(50) NOT NULL DEFAULT 'TODAS',
    mes VARCHAR(20) NOT NULL DEFAULT 'TODOS',
    actividad VARCHAR(100) NOT NULL,
    muertes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_kpi_mortalidad UNIQUE(clase, mes, actividad)
);

-- 5. Tabla de Top 5 Especies (Tablas de Rescate y Ahuyentamiento)
CREATE TABLE IF NOT EXISTS public.kpi_top_especies (
    id SERIAL PRIMARY KEY,
    clase VARCHAR(50) NOT NULL DEFAULT 'TODAS',
    mes VARCHAR(20) NOT NULL DEFAULT 'TODOS',
    manejo VARCHAR(30) NOT NULL,
    ranking INT NOT NULL,
    especie VARCHAR(100) NOT NULL,
    total_individuos INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_kpi_top_especies UNIQUE(clase, mes, manejo, ranking)
);

-- ============================================================================
-- CONFIGURACIÓN DE SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- La clave pública 'anon' del frontend solo puede ejecutar SELECT.
-- No se otorgan políticas de INSERT, UPDATE o DELETE al rol anon/authenticated.
-- Las inserciones y actualizaciones son exclusivas del backend usando 'service_role'.

-- Habilitar RLS en cada tabla
ALTER TABLE public.secciones_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_resumen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_tendencia_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_mortalidad_actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_top_especies ENABLE ROW LEVEL SECURITY;

-- Políticas de SOLO LECTURA para clientes públicos / anon
DROP POLICY IF EXISTS "Permitir lectura publica secciones_clase" ON public.secciones_clase;
CREATE POLICY "Permitir lectura publica secciones_clase"
    ON public.secciones_clase
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica kpi_resumen" ON public.kpi_resumen;
CREATE POLICY "Permitir lectura publica kpi_resumen"
    ON public.kpi_resumen
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica kpi_tendencia_mensual" ON public.kpi_tendencia_mensual;
CREATE POLICY "Permitir lectura publica kpi_tendencia_mensual"
    ON public.kpi_tendencia_mensual
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica kpi_mortalidad_actividad" ON public.kpi_mortalidad_actividad;
CREATE POLICY "Permitir lectura publica kpi_mortalidad_actividad"
    ON public.kpi_mortalidad_actividad
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica kpi_top_especies" ON public.kpi_top_especies;
CREATE POLICY "Permitir lectura publica kpi_top_especies"
    ON public.kpi_top_especies
    FOR SELECT
    TO anon, authenticated
    USING (true);
