/**
 * Configuración de Conexión a Supabase (Frontend con clave pública ANON)
 * 
 * NOTA DE SEGURIDAD (RLS):
 * Las tablas en Supabase tienen habilitado Row Level Security (RLS)
 * con una política de solo lectura pública (SELECT). No es posible
 * realizar operaciones de INSERT, UPDATE o DELETE con esta clave anónima.
 */

const SUPABASE_CONFIG = {
    supabaseUrl: "https://zxftsvoicvwjtchoqkqz.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZnRzdm9pY3Z3anRjaG9xa3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTI0MjksImV4cCI6MjEwNDk4ODQyOX0.Y7natNdtLsPnAV8KOmG8EunYAwaNMOaRZDWdfLBdeM0",
    
    // Archivo de respaldo local con las métricas ya precalculadas por el script de Python
    localFallbackUrl: "data/precalculated_data.json"
};

class FaunaDataService {
    constructor() {
        this.client = null;
        this.isSupabaseConfigured = false;
        this.localData = null;
        this.init();
    }

    init() {
        if (
            window.supabase &&
            SUPABASE_CONFIG.supabaseUrl &&
            !SUPABASE_CONFIG.supabaseUrl.includes("your-project") &&
            SUPABASE_CONFIG.supabaseAnonKey &&
            !SUPABASE_CONFIG.supabaseAnonKey.includes("your-anon-key")
        ) {
            try {
                this.client = window.supabase.createClient(
                    SUPABASE_CONFIG.supabaseUrl,
                    SUPABASE_CONFIG.supabaseAnonKey
                );
                this.isSupabaseConfigured = true;
                console.log("Conectado a Supabase con RLS (SELECT público)");
            } catch (e) {
                console.warn("Error al inicializar cliente Supabase, usando respaldo local:", e);
            }
        }
    }

    async ensureDataLoaded() {
        if (!this.localData) {
            try {
                const res = await fetch(SUPABASE_CONFIG.localFallbackUrl);
                this.localData = await res.json();
            } catch (err) {
                console.error("No se pudo cargar el dataset pre-calculado:", err);
            }
        }
    }

    /**
     * Obtiene el catálogo de secciones / clases con imágenes
     */
    async getSecciones() {
        if (this.isSupabaseConfigured) {
            const { data, error } = await this.client
                .from("secciones_clase")
                .select("*")
                .order("orden", { ascending: true });
            if (!error && data && data.length > 0) return data;
        }
        await this.ensureDataLoaded();
        return this.localData ? this.localData.secciones_clase : [];
    }

    /**
     * Obtiene las métricas resumen para una combinación de clase y mes
     */
    async getKpiResumen(clase = "TODAS", mes = "TODOS") {
        if (this.isSupabaseConfigured) {
            const { data, error } = await this.client
                .from("kpi_resumen")
                .select("*")
                .eq("clase", clase)
                .eq("mes", mes)
                .maybeSingle();
            if (!error && data) return data;
        }
        await this.ensureDataLoaded();
        if (!this.localData) return null;
        return this.localData.kpi_resumen.find(r => r.clase === clase && r.mes === mes) || null;
    }

    /**
     * Obtiene la tendencia mensual de individuos para la clase seleccionada
     */
    async getTendenciaMensual(clase = "TODAS") {
        if (this.isSupabaseConfigured) {
            const { data, error } = await this.client
                .from("kpi_tendencia_mensual")
                .select("*")
                .eq("clase", clase)
                .order("mes_num", { ascending: true });
            if (!error && data && data.length > 0) return data;
        }
        await this.ensureDataLoaded();
        if (!this.localData) return [];
        return this.localData.kpi_tendencia_mensual.filter(r => r.clase === clase);
    }

    /**
     * Obtiene la mortalidad por actividad según clase y mes
     */
    async getMortalidadActividad(clase = "TODAS", mes = "TODOS") {
        if (this.isSupabaseConfigured) {
            const { data, error } = await this.client
                .from("kpi_mortalidad_actividad")
                .select("*")
                .eq("clase", clase)
                .eq("mes", mes)
                .order("muertes", { ascending: false });
            if (!error && data && data.length > 0) return data;
        }
        await this.ensureDataLoaded();
        if (!this.localData) return [];
        return this.localData.kpi_mortalidad_actividad
            .filter(r => r.clase === clase && r.mes === mes)
            .sort((a, b) => b.muertes - a.muertes);
    }

    /**
     * Obtiene el Top 5 de especies por manejo (rescate / ahuyentamiento)
     */
    async getTopEspecies(clase = "TODAS", mes = "TODOS", manejo = "ahuyentamiento") {
        if (this.isSupabaseConfigured) {
            const { data, error } = await this.client
                .from("kpi_top_especies")
                .select("*")
                .eq("clase", clase)
                .eq("mes", mes)
                .eq("manejo", manejo)
                .order("ranking", { ascending: true })
                .limit(5);
            if (!error && data && data.length > 0) return data;
        }
        await this.ensureDataLoaded();
        if (!this.localData) return [];
        return this.localData.kpi_top_especies
            .filter(r => r.clase === clase && r.mes === mes && r.manejo === manejo)
            .sort((a, b) => a.ranking - b.ranking)
            .slice(0, 5);
    }
}

window.dataService = new FaunaDataService();
