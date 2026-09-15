"""
Script de pre-cálculo y migración de métricas de fauna a Supabase.
Procesa registros.csv y secciones.xlsx, calcula exactamente los 8 KPIs
para todas las dimensiones de filtro (clase y mes) y los exporta a Supabase
(o a data/precalculated_data.json como respaldo local).
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List

MESES_ESPANOL = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"
}

def load_data(base_dir: str = "."):
    csv_path = os.path.join(base_dir, "data", "registros.csv")
    xlsx_path = os.path.join(base_dir, "data", "secciones.xlsx")

    df_reg = pd.read_csv(csv_path)
    # Normalizar nombres de columnas a minúsculas
    df_reg.columns = [c.lower() for c in df_reg.columns]
    
    # Manejo de fechas y nombres de meses
    df_reg['fecha'] = pd.to_datetime(df_reg['fecha'])
    df_reg['mes_num'] = df_reg['fecha'].dt.month
    df_reg['mes_nombre'] = df_reg['mes_num'].map(MESES_ESPANOL)

    # Limpieza de textos en campos clave
    df_reg['manejo'] = df_reg['manejo'].str.strip().str.lower()
    df_reg['estado'] = df_reg['estado'].str.strip().str.lower()
    df_reg['reubicado'] = df_reg['reubicado'].astype(str).str.strip().str.lower()
    df_reg['actividad'] = df_reg['actividad'].str.strip().str.title()
    
    # Cargar secciones (filtro de clases con imágenes)
    df_sec = pd.read_excel(xlsx_path)
    df_sec.columns = [c.lower() for c in df_sec.columns]
    
    # Mapeo y orden explícito según el dashboard (Anfibios, Aves, Mamíferos, Reptiles)
    orden_map = {'Amphibia': 1, 'Aves': 2, 'Mammalia': 3, 'Reptilia': 4}
    df_sec['orden'] = df_sec['clase'].map(orden_map)
    df_sec = df_sec.sort_values(by='orden').reset_index(drop=True)
    
    # Corrección de nombres y URLs
    for idx, row in df_sec.iterrows():
        if row['clase'] == 'Mammalia':
            df_sec.at[idx, 'nombre_seccion'] = 'Mamíferos'
        elif row['clase'] == 'Aves':
            df_sec.at[idx, 'nombre_seccion'] = 'Aves'
            df_sec.at[idx, 'imagen'] = 'https://i.ibb.co/gFWj9cb9/selective-focus-shot-hummingbird-flight.jpg'
        elif row['clase'] == 'Amphibia':
            df_sec.at[idx, 'nombre_seccion'] = 'Anfibios'
        elif row['clase'] == 'Reptilia':
            df_sec.at[idx, 'nombre_seccion'] = 'Reptiles'

    return df_reg, df_sec


def compute_kpis_for_slice(df_slice: pd.DataFrame) -> Dict[str, Any]:
    """Calcula los KPIs para un subconjunto de datos."""
    
    # KPI 1: Abundancia por manejo
    total_ahuyentados = int(df_slice[df_slice['manejo'] == 'ahuyentamiento']['abundancia'].sum())
    total_rescatados = int(df_slice[df_slice['manejo'] == 'rescate']['abundancia'].sum())
    total_individuos = int(df_slice['abundancia'].sum())
    
    # KPI 3: Porcentaje de reubicación (sobre total de rescates)
    rescates_reubicados = df_slice[(df_slice['manejo'] == 'rescate') & (df_slice['reubicado'] == 'si')]['abundancia'].sum()
    tasa_reubicacion = (rescates_reubicados / total_rescatados * 100.0) if total_rescatados > 0 else 0.0
    
    # KPI 4: Porcentaje de mortalidad (sobre total de rescates)
    rescates_muertos = df_slice[(df_slice['manejo'] == 'rescate') & (df_slice['estado'] == 'muerto')]['abundancia'].sum()
    tasa_mortalidad = (rescates_muertos / total_rescatados * 100.0) if total_rescatados > 0 else 0.0
    
    # KPI 8: Indicador ANLA (Rescate / Ahuyentamiento)
    if total_ahuyentados > 0:
        indicador_anla = (total_rescatados / total_ahuyentados) * 100.0
    else:
        indicador_anla = 0.0
        
    estado_anla = "Cumple (<20%)" if indicador_anla < 20.0 else "No cumple (>20%)"
    
    # KPI 5: Mortalidad por actividad
    df_muertes = df_slice[df_slice['estado'] == 'muerto']
    mortalidad_actividad = (
        df_muertes.groupby('actividad')['abundancia']
        .sum()
        .reset_index()
        .rename(columns={'abundancia': 'muertes'})
        .sort_values(by='muertes', ascending=False)
        .to_dict(orient='records')
    )
    
    # KPI 6: Top 5 especies rescatadas
    df_rescate = df_slice[df_slice['manejo'] == 'rescate']
    top_rescatadas = (
        df_rescate.groupby('especie')['abundancia']
        .sum()
        .reset_index()
        .rename(columns={'abundancia': 'total'})
        .sort_values(by='total', ascending=False)
        .head(5)
        .to_dict(orient='records')
    )
    
    # KPI 7: Top 5 especies ahuyentadas
    df_ahuyentamiento = df_slice[df_slice['manejo'] == 'ahuyentamiento']
    top_ahuyentadas = (
        df_ahuyentamiento.groupby('especie')['abundancia']
        .sum()
        .reset_index()
        .rename(columns={'abundancia': 'total'})
        .sort_values(by='total', ascending=False)
        .head(5)
        .to_dict(orient='records')
    )
    
    return {
        "resumen": {
            "total_ahuyentados": total_ahuyentados,
            "total_rescatados": total_rescatados,
            "total_individuos": total_individuos,
            "tasa_reubicacion": round(tasa_reubicacion, 1),
            "tasa_mortalidad": round(tasa_mortalidad, 1),
            "indicador_anla": round(indicador_anla, 1),
            "estado_anla": estado_anla
        },
        "mortalidad_actividad": mortalidad_actividad,
        "top_rescatadas": top_rescatadas,
        "top_ahuyentadas": top_ahuyentadas
    }


def compute_all_precalculated_data(df_reg: pd.DataFrame, df_sec: pd.DataFrame) -> Dict[str, Any]:
    """Genera todas las métricas pre-calculadas para todas las combinaciones de filtros."""
    
    clases = ['TODAS'] + sorted(df_reg['clase'].unique().tolist())
    meses = ['TODOS'] + [MESES_ESPANOL[i] for i in range(1, 13)]
    
    kpi_resumen_rows = []
    kpi_mortalidad_rows = []
    kpi_top_especies_rows = []
    kpi_tendencia_rows = []
    
    # Pre-cálculo para combinaciones de (clase, mes)
    for clase in clases:
        df_clase = df_reg if clase == 'TODAS' else df_reg[df_reg['clase'] == clase]
        
        # KPI 2: Tendencia mensual por manejo para esta clase
        for mes_num in range(1, 13):
            mes_nombre = MESES_ESPANOL[mes_num]
            df_mes_t = df_clase[df_clase['mes_num'] == mes_num]
            for m in ['ahuyentamiento', 'rescate']:
                tot = int(df_mes_t[df_mes_t['manejo'] == m]['abundancia'].sum())
                kpi_tendencia_rows.append({
                    "clase": clase,
                    "mes_num": mes_num,
                    "mes_nombre": mes_nombre,
                    "manejo": m,
                    "total_individuos": tot
                })
        
        for mes in meses:
            if mes == 'TODOS':
                df_slice = df_clase
            else:
                df_slice = df_clase[df_clase['mes_nombre'] == mes]
                
            metrics = compute_kpis_for_slice(df_slice)
            
            # Resumen
            res = metrics['resumen']
            kpi_resumen_rows.append({
                "clase": clase,
                "mes": mes,
                **res
            })
            
            # Mortalidad por actividad
            for item in metrics['mortalidad_actividad']:
                kpi_mortalidad_rows.append({
                    "clase": clase,
                    "mes": mes,
                    "actividad": item['actividad'],
                    "muertes": int(item['muertes'])
                })
                
            # Top Rescatadas
            for idx, item in enumerate(metrics['top_rescatadas'], start=1):
                kpi_top_especies_rows.append({
                    "clase": clase,
                    "mes": mes,
                    "manejo": "rescate",
                    "ranking": idx,
                    "especie": item['especie'],
                    "total_individuos": int(item['total'])
                })
                
            # Top Ahuyentadas
            for idx, item in enumerate(metrics['top_ahuyentadas'], start=1):
                kpi_top_especies_rows.append({
                    "clase": clase,
                    "mes": mes,
                    "manejo": "ahuyentamiento",
                    "ranking": idx,
                    "especie": item['especie'],
                    "total_individuos": int(item['total'])
                })

    # Catálogo de secciones
    secciones_rows = []
    for idx, row in df_sec.iterrows():
        secciones_rows.append({
            "clase": row['clase'],
            "nombre_seccion": row['nombre_seccion'],
            "imagen": row['imagen'],
            "orden": idx + 1
        })
        
    return {
        "secciones_clase": secciones_rows,
        "kpi_resumen": kpi_resumen_rows,
        "kpi_tendencia_mensual": kpi_tendencia_rows,
        "kpi_mortalidad_actividad": kpi_mortalidad_rows,
        "kpi_top_especies": kpi_top_especies_rows
    }


def main():
    print("Iniciando procesamiento de métricas pre-calculadas...")
    df_reg, df_sec = load_data(".")
    
    data = compute_all_precalculated_data(df_reg, df_sec)
    
    # Guardar archivo JSON precalculado para soporte web
    out_json = os.path.join("data", "precalculated_data.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Dataset pre-calculado guardado con exito en {out_json}")
    
    # Imprimir resumen de métricas globales recalculadas
    global_kpi = [r for r in data['kpi_resumen'] if r['clase'] == 'TODAS' and r['mes'] == 'TODOS'][0]
    print("\n==========================================")
    print("MÉTRICAS GLOBALES ACTUALIZADAS:")
    print(f" Total Ahuyentados: {global_kpi['total_ahuyentados']}")
    print(f" Total Rescatados:   {global_kpi['total_rescatados']}")
    print(f" % Reubicados:       {global_kpi['tasa_reubicacion']}%")
    print(f" % Mortalidad:       {global_kpi['tasa_mortalidad']}%")
    print(f" Indicador ANLA:     {global_kpi['indicador_anla']}%")
    print(f" Estado ANLA:        {global_kpi['estado_anla']}")
    print("==========================================\n")
    
    # Sincronización con Supabase mediante variables de entorno
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if supabase_url and supabase_service_key:
        try:
            from supabase import create_client, Client
            print("Conectando a Supabase con service_role...")
            supabase: Client = create_client(supabase_url, supabase_service_key)
            
            # Cargar cada tabla
            for table_name, rows in data.items():
                print(f"Insertando {len(rows)} registros en tabla '{table_name}'...")
                # Eliminar contenido previo con service_role y reinsertar
                supabase.table(table_name).delete().neq("id", 0).execute()
                
                batch_size = 500
                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i + batch_size]
                    supabase.table(table_name).insert(batch).execute()
                    
            print("Sincronización con Supabase completada con éxito.")
        except ImportError:
            print("Nota: paquete 'supabase' no instalado. Para sincronizar en la nube ejecuta: pip install supabase")
        except Exception as e:
            print(f"Error al sincronizar con Supabase: {e}")
    else:
        print("Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no detectadas.")
        print("Los datos locales precalculados (data/precalculated_data.json) están listos para alimentar el frontend.")


if __name__ == "__main__":
    main()