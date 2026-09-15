-- =====================================
-- KPI 1: Abundancia por manejo
-- =====================================
SELECT manejo, SUM(abundancia) AS total_individuos
FROM registros
GROUP BY manejo;


-- =====================================
-- KPI 2: Tendencia mensual
-- =====================================
SELECT 
    manejo,
    strftime('%Y-%m', fecha) AS mes,
    SUM(abundancia) AS total
FROM registros
GROUP BY manejo, mes
ORDER BY mes;


-- =====================================
-- KPI 3: Porcentaje de reubicación
-- =====================================
SELECT 
    SUM(CASE WHEN reubicado = 'si' THEN abundancia ELSE 0 END) * 1.0 /
    SUM(CASE WHEN manejo = 'rescate' THEN abundancia ELSE 0 END)
    AS tasa_reubicacion
FROM registros;


-- =====================================
-- KPI 4: Porcentaje de mortalidad
-- =====================================
SELECT 
    SUM(CASE WHEN estado = 'muerto' THEN abundancia ELSE 0 END) * 1.0 /
    SUM(CASE WHEN manejo = 'rescate' THEN abundancia ELSE 0 END) 
    AS tasa_mortalidad
FROM registros;


-- =====================================
-- KPI 5: Mortalidad por actividad
-- =====================================
SELECT actividad,
       SUM(CASE WHEN estado = 'muerto' THEN abundancia ELSE 0 END) AS muertes
FROM registros
GROUP BY actividad
ORDER BY muertes DESC;


-- =====================================
-- KPI 6: Top 5 especies rescatadas
-- =====================================
SELECT especie, SUM(abundancia) AS total
FROM registros
WHERE manejo = 'rescate'
GROUP BY especie
ORDER BY total DESC
LIMIT 5;


-- =====================================
-- KPI 7: Top 5 especies ahuyentadas
-- =====================================
SELECT especie, SUM(abundancia) AS total
FROM registros
WHERE manejo = 'ahuyentamiento'
GROUP BY especie
ORDER BY total DESC
LIMIT 5;


-- =====================================
-- KPI 8: Indicador ANLA
-- =====================================
SELECT 
    ROUND(indicador, 3) AS indicador_rescate_ahuyentamiento,
    CASE 
        WHEN indicador < 0.2 THEN 'Cumple (<20%)'
        ELSE 'No cumple (>20%)'
    END AS estado_indicador
FROM (
    SELECT 
        SUM(CASE WHEN manejo = 'rescate' THEN abundancia ELSE 0 END) * 1.0 /
        SUM(CASE WHEN manejo = 'ahuyentamiento' THEN abundancia ELSE 0 END)
        AS indicador
    FROM registros
);