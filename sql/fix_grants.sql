-- ============================================================================
-- FIX: Otorgar permisos completos al rol service_role en todas las tablas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================================

-- Permisos completos para service_role (bypass RLS + CRUD)
GRANT ALL ON public.secciones_clase TO service_role;
GRANT ALL ON public.kpi_resumen TO service_role;
GRANT ALL ON public.kpi_tendencia_mensual TO service_role;
GRANT ALL ON public.kpi_mortalidad_actividad TO service_role;
GRANT ALL ON public.kpi_top_especies TO service_role;

-- Permisos sobre las secuencias (auto-incremento de IDs)
GRANT USAGE, SELECT ON SEQUENCE public.secciones_clase_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_resumen_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_tendencia_mensual_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_mortalidad_actividad_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_top_especies_id_seq TO service_role;

-- También asegurar SELECT para anon (lectura pública del dashboard)
GRANT SELECT ON public.secciones_clase TO anon;
GRANT SELECT ON public.kpi_resumen TO anon;
GRANT SELECT ON public.kpi_tendencia_mensual TO anon;
GRANT SELECT ON public.kpi_mortalidad_actividad TO anon;
GRANT SELECT ON public.kpi_top_especies TO anon;
