/**
 * LÓGICA DEL DASHBOARD DE GESTIÓN DE FAUNA
 * Integración con Supabase (RLS SELECT) / Fallback de Métricas Pre-calculadas
 * Visualizaciones con Chart.js
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Estado global de filtros
    const state = {
        clase: "TODAS",
        mes: "TODOS"
    };

    // Referencias a instancias de gráficos de Chart.js
    let trendChart = null;
    let mortalityChart = null;
    let anlaGaugeChart = null;

    // Elementos DOM
    const elAhuyentados = document.getElementById("kpi-ahuyentados");
    const elRescatados = document.getElementById("kpi-rescatados");
    const elReubicados = document.getElementById("kpi-reubicados");
    const elMortalidad = document.getElementById("kpi-mortalidad");
    const elAnlaValue = document.getElementById("gauge-anla-value");
    const elAnlaTarget = document.getElementById("gauge-anla-target");
    const elSelectMes = document.getElementById("select-mes");
    const elClaseContainer = document.getElementById("clase-cards-container");
    const elBtnResetClase = document.getElementById("btn-reset-clase");
    const elTableAhuyentadas = document.getElementById("tbody-top-ahuyentadas");
    const elTableRescatadas = document.getElementById("tbody-top-rescatadas");
    const elBackendStatus = document.getElementById("backend-status-text");

    // =========================================================================
    // PLUGINS PERSONALIZADOS DE CHART.JS
    // =========================================================================

    // 1. Plugin de Aguja e Indicador para el Tacómetro ANLA
    const gaugeNeedlePlugin = {
        id: 'gaugeNeedle',
        afterDatasetDraw(chart, args, options) {
            if (chart.config.type !== 'doughnut') return;
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || meta.data.length === 0) return;
            
            const value = chart.config._gaugeValue || 0;
            // El semicírculo va de 0% (PI) a 100% (2*PI)
            const clampedVal = Math.max(0, Math.min(100, value));
            const angle = Math.PI + (clampedVal / 100) * Math.PI;

            const xCenter = meta.data[0].x;
            const yCenter = meta.data[0].y;
            const outerRadius = meta.data[0].outerRadius;
            const innerRadius = meta.data[0].innerRadius;

            ctx.save();
            
            // Dibujar línea roja de límite objetivo (20%)
            const targetAngle = Math.PI + (20 / 100) * Math.PI;
            const txOuter = xCenter + (outerRadius + 8) * Math.cos(targetAngle);
            const tyOuter = yCenter + (outerRadius + 8) * Math.sin(targetAngle);
            const txInner = xCenter + (innerRadius - 4) * Math.cos(targetAngle);
            const tyInner = yCenter + (innerRadius - 4) * Math.sin(targetAngle);

            ctx.beginPath();
            ctx.moveTo(txInner, tyInner);
            ctx.lineTo(txOuter, tyOuter);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#e53935'; // Línea roja vertical para meta 20%
            ctx.stroke();

            // Dibujar aguja actual (indicador negro apuntando al valor)
            const needleLen = outerRadius + 2;
            const nx = xCenter + needleLen * Math.cos(angle);
            const ny = yCenter + needleLen * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(xCenter, yCenter);
            ctx.lineTo(nx, ny);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#111111';
            ctx.stroke();

            // Perno central de la aguja
            ctx.beginPath();
            ctx.arc(xCenter, yCenter, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#111111';
            ctx.fill();

            ctx.restore();
        }
    };

    // 2. Plugin para Etiquetas de Datos fuera de las Barras Horizontales
    const barDataLabelsPlugin = {
        id: 'barDataLabels',
        afterDatasetDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;

            ctx.save();
            ctx.font = 'bold 12px Segoe UI, -apple-system, sans-serif';
            ctx.fillStyle = '#1f2937';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            meta.data.forEach((bar, index) => {
                const val = chart.data.datasets[0].data[index];
                if (val !== undefined && val !== null) {
                    const xPos = bar.x + 6;
                    const yPos = bar.y;
                    ctx.fillText(val, xPos, yPos);
                }
            });
            ctx.restore();
        }
    };

    Chart.register(gaugeNeedlePlugin, barDataLabelsPlugin);

    /**
     * Inicializar Segmentador de Clases con Imágenes
     */
    async function initClaseCards() {
        const secciones = await window.dataService.getSecciones();
        if (!secciones || secciones.length === 0) return;

        elClaseContainer.innerHTML = "";
        secciones.forEach(sec => {
            const card = document.createElement("div");
            card.className = `clase-card ${state.clase === sec.clase ? 'active' : ''}`;
            card.dataset.clase = sec.clase;
            card.innerHTML = `
                <img src="${sec.imagen}" alt="${sec.nombre_seccion}" loading="lazy" referrerpolicy="no-referrer" />
                <div class="clase-card-overlay">
                    <div class="clase-radio-indicator"></div>
                    <div class="clase-card-name">${sec.nombre_seccion}</div>
                </div>
            `;
            card.addEventListener("click", () => {
                if (state.clase === sec.clase) {
                    state.clase = "TODAS"; // Deseleccionar al hacer clic de nuevo
                } else {
                    state.clase = sec.clase;
                }
                updateClaseCardSelection();
                updateDashboard();
            });
            elClaseContainer.appendChild(card);
        });
    }

    function updateClaseCardSelection() {
        const cards = elClaseContainer.querySelectorAll(".clase-card");
        cards.forEach(card => {
            if (card.dataset.clase === state.clase) {
                card.classList.add("active");
            } else {
                card.classList.remove("active");
            }
        });
    }

    /**
     * Actualizar Tarjetas KPI y Gauge ANLA
     */
    async function updateKPIs() {
        const kpi = await window.dataService.getKpiResumen(state.clase, state.mes);
        if (!kpi) return;

        // Formato con separadores de miles y coma decimal estilo latino
        elAhuyentados.textContent = kpi.total_ahuyentados.toLocaleString("es-ES");
        elRescatados.textContent = kpi.total_rescatados.toLocaleString("es-ES");
        elReubicados.textContent = `${kpi.tasa_reubicacion.toFixed(1).replace(".", ",")} %`;
        elMortalidad.textContent = `${kpi.tasa_mortalidad.toFixed(1).replace(".", ",")} %`;

        // Indicador ANLA
        const anlaVal = kpi.indicador_anla;
        elAnlaValue.textContent = `${anlaVal.toFixed(1).replace(".", ",")} %`;
        elAnlaTarget.textContent = `Objetivo: < 20%`;

        updateAnlaGauge(anlaVal);
    }

    /**
     * Gráfico Gauge Semicircular ANLA (Dinámico con aguja y arco relleno hasta el valor)
     */
    function updateAnlaGauge(value) {
        const ctx = document.getElementById("chart-anla-gauge").getContext("2d");

        // Relleno verde dinámico desde 0% hasta el valor actual (ej. 17.4% o 41.0%)
        const clampedVal = Math.max(0, Math.min(100, value));
        const remainingPart = Math.max(0, 100 - clampedVal);

        if (anlaGaugeChart) {
            anlaGaugeChart.data.datasets[0].data = [clampedVal, remainingPart];
            anlaGaugeChart.config._gaugeValue = value;
            anlaGaugeChart.update();
            return;
        }

        anlaGaugeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Valor Actual', 'Restante'],
                datasets: [{
                    data: [clampedVal, remainingPart],
                    backgroundColor: ['#279e43', '#e9ecef'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                    cutout: '72%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
        anlaGaugeChart.config._gaugeValue = value;
        anlaGaugeChart.update();
    }

    /**
     * Gráfico de Evolución Mensual por Manejo (Líneas)
     */
    async function updateTrendChart() {
        const data = await window.dataService.getTendenciaMensual(state.clase);
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        
        const ahuyentamientoMap = {};
        const rescateMap = {};
        meses.forEach(m => {
            ahuyentamientoMap[m] = 0;
            rescateMap[m] = 0;
        });

        data.forEach(item => {
            if (item.manejo === 'ahuyentamiento') {
                ahuyentamientoMap[item.mes_nombre] = item.total_individuos;
            } else if (item.manejo === 'rescate') {
                rescateMap[item.mes_nombre] = item.total_individuos;
            }
        });

        const seriesAhuyentamiento = meses.map(m => ahuyentamientoMap[m]);
        const seriesRescate = meses.map(m => rescateMap[m]);

        const ctx = document.getElementById("chart-tendencia-mensual").getContext("2d");

        if (trendChart) {
            trendChart.data.datasets[0].data = seriesAhuyentamiento;
            trendChart.data.datasets[1].data = seriesRescate;
            trendChart.update();
            return;
        }

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Ahuyentamiento',
                        data: seriesAhuyentamiento,
                        borderColor: '#1c75bc',
                        backgroundColor: '#1c75bc',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Rescate',
                        data: seriesRescate,
                        borderColor: '#279e43',
                        backgroundColor: '#279e43',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 15,
                            font: { size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#666',
                            font: { size: 11 },
                            maxRotation: 35,
                            minRotation: 0
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Abundancia',
                            color: '#555',
                            font: { size: 11, weight: '600' }
                        },
                        grid: { color: '#f0f0f0' },
                        ticks: {
                            color: '#666',
                            font: { size: 11 },
                            precision: 0
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Gráfico de Actividades con Mayor Mortalidad (Barras Horizontales con Etiquetas Externas o Mensaje Vacío)
     */
    async function updateMortalityChart() {
        const data = await window.dataService.getMortalidadActividad(state.clase, state.mes);
        const canvas = document.getElementById("chart-mortalidad-actividad");
        const emptyMsg = document.getElementById("msg-sin-mortalidad");

        const filteredData = (data || []).filter(d => d.muertes > 0);

        if (!filteredData || filteredData.length === 0) {
            if (canvas) canvas.style.display = "none";
            if (emptyMsg) emptyMsg.style.display = "flex";
            if (mortalityChart) {
                mortalityChart.data.labels = [];
                mortalityChart.data.datasets[0].data = [];
                mortalityChart.update();
            }
            return;
        }

        if (canvas) canvas.style.display = "block";
        if (emptyMsg) emptyMsg.style.display = "none";

        const labels = filteredData.map(d => d.actividad);
        const values = filteredData.map(d => d.muertes);

        const ctx = canvas.getContext("2d");

        if (mortalityChart) {
            mortalityChart.data.labels = labels;
            mortalityChart.data.datasets[0].data = values;
            mortalityChart.update();
            return;
        }

        mortalityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Muertes',
                    data: values,
                    backgroundColor: '#e24a2c',
                    borderRadius: 2,
                    maxBarThickness: 18
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: 25 // Espacio suficiente para las etiquetas fuera de las barras
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` Nº Individuos: ${ctx.raw}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Nº Individuos',
                            color: '#555',
                            font: { size: 11, weight: '600' }
                        },
                        grid: { color: '#f0f0f0' },
                        ticks: {
                            precision: 0,
                            color: '#666'
                        },
                        beginAtZero: true,
                        grace: 1
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: '#333',
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    }


    /**
     * Actualizar Tablas Top 5 Especies
     */
    async function updateSpeciesTables() {
        const [topAhuyentadas, topRescatadas] = await Promise.all([
            window.dataService.getTopEspecies(state.clase, state.mes, 'ahuyentamiento'),
            window.dataService.getTopEspecies(state.clase, state.mes, 'rescate')
        ]);

        // Render Top Ahuyentadas
        if (topAhuyentadas && topAhuyentadas.length > 0) {
            elTableAhuyentadas.innerHTML = topAhuyentadas.map(sp => `
                <tr>
                    <td class="species-name">${sp.especie}</td>
                    <td class="species-count">${sp.total_individuos.toLocaleString("es-ES")}</td>
                </tr>
            `).join("");
        } else {
            elTableAhuyentadas.innerHTML = `<tr><td colspan="2" class="empty-msg">Sin registros</td></tr>`;
        }

        // Render Top Rescatadas
        if (topRescatadas && topRescatadas.length > 0) {
            elTableRescatadas.innerHTML = topRescatadas.map(sp => `
                <tr>
                    <td class="species-name">${sp.especie}</td>
                    <td class="species-count">${sp.total_individuos.toLocaleString("es-ES")}</td>
                </tr>
            `).join("");
        } else {
            elTableRescatadas.innerHTML = `<tr><td colspan="2" class="empty-msg">Sin registros</td></tr>`;
        }
    }

    /**
     * Actualizar todo el Dashboard según filtros activos
     */
    async function updateDashboard() {
        await Promise.all([
            updateKPIs(),
            updateTrendChart(),
            updateMortalityChart(),
            updateSpeciesTables()
        ]);
    }

    // Eventos
    elSelectMes.addEventListener("change", (e) => {
        state.mes = e.target.value;
        updateDashboard();
    });

    elBtnResetClase.addEventListener("click", () => {
        state.clase = "TODAS";
        updateClaseCardSelection();
        updateDashboard();
    });

    // Actualizar indicador de backend
    if (window.dataService.isSupabaseConfigured) {
        elBackendStatus.innerHTML = `🟢 Conectado a <strong>Supabase (RLS Activo)</strong>`;
    } else {
        elBackendStatus.innerHTML = `⚡ Modo Local: <strong>Métricas Pre-calculadas (JSON)</strong>`;
    }

    // Inicialización inicial
    await initClaseCards();
    await updateDashboard();
});
