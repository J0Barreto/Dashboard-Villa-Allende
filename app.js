// URL de la caja negra (Web App de SIGIPSA)
const API_URL = "https://script.google.com/macros/s/AKfycbzjpHvMWbNC78brjExGx-f82497hUwNvHwUyHhp1HMCbo-Gc8T_ALDoIP3kZMNMSGKP2w/exec";

// Estado global de los datos
let baseDeDatos = [];
let datosFiltrados = [];
let graficoInteranual = null;
let graficoPrestacion = null;

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await descargarDatos();
        inicializarFiltros();
        renderizarTableros();
        ocultarPantallaCarga();
    } catch (error) {
        console.error("Error al iniciar el dashboard:", error);
        document.getElementById("loading-details").innerText = "Error crítico de conexión.";
    }
});

// 1. Descarga e ingestión segura
async function descargarDatos() {
    const statusText = document.getElementById("connection-status");
    const progress = document.getElementById("load-progress");
    const details = document.getElementById("loading-details");

    try {
        statusText.innerText = "DESCARGANDO...";
        progress.style.width = "50%";
        details.innerText = "Recuperando registros nominales...";

        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) throw new Error("Respuesta de red no satisfactoria");
        
        baseDeDatos = await respuesta.json();
        datosFiltrados = [...baseDeDatos];

        progress.style.width = "100%";
        statusText.innerText = "CONECTADO";
        document.querySelector(".status-indicator").style.backgroundColor = "#065f46"; // Verde éxito
    } catch (err) {
        statusText.innerText = "ERROR DE CARGA";
        document.querySelector(".status-indicator").style.backgroundColor = "#991b1b"; // Rojo error
        throw err;
    }
}

function ocultarPantallaCarga() {
    document.getElementById("loading-overlay").style.display = "none";
}

// 2. Configurar Filtros
function inicializarFiltros() {
    const selectEfector = document.getElementById("filter-efector");
    const selectTipo = document.getElementById("filter-tipo");
    const selectCategoria = document.getElementById("filter-categoria");
    const selectCeb = document.getElementById("filter-ceb");
    const selectEstado = document.getElementById("filter-estado");
    const selectSexo = document.getElementById("filter-sexo");

    // Extraer valores únicos de la base de datos para los selectores
    const obtenerUnicos = (columna) => [...new Set(baseDeDatos.map(item => item[columna]).filter(Boolean))].sort();

    const poblarSelect = (select, valores) => {
        valores.forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.innerText = val;
            select.appendChild(opt);
        });
    };

    poblarSelect(selectEfector, obtenerUnicos("EFECTOR"));
    poblarSelect(selectTipo, obtenerUnicos("TIPO PRESTACIÓN"));
    poblarSelect(selectCategoria, obtenerUnicos("CATEGORIA"));
    poblarSelect(selectCeb, obtenerUnicos("CEB"));
    poblarSelect(selectEstado, obtenerUnicos("ESTADO"));
    poblarSelect(selectSexo, obtenerUnicos("SEXO"));

    // Eventos de Filtro
    const triggers = [selectEfector, selectTipo, selectCategoria, selectCeb, selectEstado, selectSexo];
    triggers.forEach(trigger => trigger.addEventListener("change", aplicarFiltros));

    document.getElementById("btn-reset-filters").addEventListener("click", () => {
        triggers.forEach(t => t.value = "all");
        aplicarFiltros();
    });
}

function aplicarFiltros() {
    const efector = document.getElementById("filter-efector").value;
    const tipo = document.getElementById("filter-tipo").value;
    const categoria = document.getElementById("filter-categoria").value;
    const ceb = document.getElementById("filter-ceb").value;
    const estado = document.getElementById("filter-estado").value;
    const sexo = document.getElementById("filter-sexo").value;

    datosFiltrados = baseDeDatos.filter(item => {
        return (efector === "all" || item["EFECTOR"] === efector) &&
               (tipo === "all" || item["TIPO PRESTACIÓN"] === tipo) &&
               (categoria === "all" || item["CATEGORIA"] === categoria) &&
               (ceb === "all" || item["CEB"] === ceb) &&
               (estado === "all" || item["ESTADO"] === estado) &&
               (sexo === "all" || item["SEXO"] === sexo);
    });

    renderizarTableros();
}

// 3. Dibujar Gráficos y Procesar Datos
function renderizarTableros() {
    renderizarGraficoInteranual();
    renderizarGraficoPrestaciones();
    procesarModuloDiabetes();
    procesarModuloHipertension();
}

// Gráfico de Líneas - Comparativa Interanual
function renderizarGraficoInteranual() {
    const ctx = document.getElementById("chart-interanual").getContext("2d");
    
    // Procesamos cantidades por año a partir de la columna 'FECHA PRESTACION'
    const prestadosPorAño = {};
    datosFiltrados.forEach(item => {
        const fecha = item["FECHA PRESTACION"];
        if (fecha) {
            // Extraer el año del string de fecha (soporta formatos DD/MM/YYYY o YYYY-MM-DD)
            const anio = fecha.includes("/") ? fecha.split("/")[2]?.split(" ")[0] : fecha.split("-")[0];
            if (anio && anio.length === 4) {
                prestadosPorAño[anio] = (prestadosPorAño[anio] || 0) + 1;
            }
        }
    });

    const anios = Object.keys(prestadosPorAño).sort();
    const cantidades = anios.map(a => prestadosPorAño[a]);

    if (graficoInteranual) graficoInteranual.destroy();

    graficoInteranual = new Chart(ctx, {
        type: 'line',
        data: {
            labels: anios,
            datasets: [{
                label: 'Prestaciones Médicas',
                data: cantidades,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Gráfico de Torta - Tipo de Prestación
function renderizarGraficoPrestaciones() {
    const ctx = document.getElementById("chart-prestacion").getContext("2d");
    
    const distribucion = {};
    datosFiltrados.forEach(item => {
        const tipo = item["TIPO PRESTACIÓN"] || "No especificado";
        distribucion[tipo] = (distribucion[tipo] || 0) + 1;
    });

    // Quedarse con el top 5 para que el gráfico sea legible
    const ordenado = Object.entries(distribucion).sort((a,b) => b[1] - a[1]);
    const top5 = ordenado.slice(0, 5);
    const otrosTotal = ordenado.slice(5).reduce((acc, curr) => acc + curr[1], 0);

    const labels = top5.map(i => i[0]);
    const valores = top5.map(i => i[1]);

    if (otrosTotal > 0) {
        labels.push("Otros");
        valores.push(otrosTotal);
    }

    if (graficoPrestacion) graficoPrestacion.destroy();

    graficoPrestacion = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// Módulo Diabetes
function procesarModuloDiabetes() {
    // Filtrar pacientes con diagnóstico de diabetes (DX)
    const diabéticos = datosFiltrados.filter(item => {
        const dx = String(item["DX"] || "").toUpperCase();
        return dx.includes("DIAB") || dx.includes("DBT") || dx.includes("E11") || dx.includes("E10");
    });

    // Obtener pacientes únicos por DNI
    const unicos = {};
    diabéticos.forEach(item => {
        if (item["DNI"]) unicos[item["DNI"]] = item;
    });
    const listaUnicos = Object.values(unicos);

    const cantidadAtendidos = listaUnicos.length;
    const poblacionAdulta = 28224;
    const potenciales = Math.round(poblacionAdulta * 0.109); // 10.9% esperado
    const porcentajeCobertura = potenciales > 0 ? ((cantidadAtendidos / potenciales) * 100).toFixed(1) : 0;

    // Actualizar métricas visuales
    document.getElementById("db-potenciales").innerText = potenciales.toLocaleString();
    document.getElementById("db-atendidos").innerText = cantidadAtendidos.toLocaleString();
    document.getElementById("db-cobertura").innerText = `${porcentajeCobertura}%`;
    document.getElementById("diabetes-status").innerText = "ACTIVO";
    document.getElementById("diabetes-status").className = "status-pill success";

    // Llenar tabla nominal
    const tbody = document.querySelector("#table-diabetes tbody");
    tbody.innerHTML = "";

    if (listaUnicos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron pacientes diabéticos con los filtros seleccionados</td></tr>`;
        return;
    }

    // Mostrar los primeros 15 por rendimiento en frontend
    listaUnicos.slice(0, 15).forEach(paciente => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td><strong>${paciente["APELLIDO"] || "-"}</strong></td>
            <td>${paciente["NOMBRE"] || "-"}</td>
            <td>${paciente["DNI"] || "-"}</td>
            <td>${paciente["EDAD"] || "-"} años</td>
            <td><span class="badge">${paciente["DX"] || "Diabetes"}</span></td>
            <td><span style="color: #10b981"><i class="fas fa-check-circle"></i> ${paciente["ESTADO"] || "Atendido"}</span></td>
        `;
        tbody.appendChild(fila);
    });
}

// Módulo Hipertensión
function procesarModuloHipertension() {
    // Filtrar pacientes con diagnóstico de HTA
    const hipertensos = datosFiltrados.filter(item => {
        const dx = String(item["DX"] || "").toUpperCase();
        return dx.includes("HIPERT") || dx.includes("HTA") || dx.includes("I10");
    });

    const unicos = {};
    hipertensos.forEach(item => {
        if (item["DNI"]) unicos[item["DNI"]] = item;
    });
    const listaUnicos = Object.values(unicos);

    const cantidadAtendidos = listaUnicos.length;
    const poblacionAdulta = 28224;
    const potenciales = Math.round(poblacionAdulta * 0.466); // 46.6% esperado
    const porcentajeCobertura = potenciales > 0 ? ((cantidadAtendidos / potenciales) * 100).toFixed(1) : 0;

    // Actualizar métricas visuales
    document.getElementById("hta-potenciales").innerText = potenciales.toLocaleString();
    document.getElementById("hta-atendidos").innerText = cantidadAtendidos.toLocaleString();
    document.getElementById("hta-cobertura").innerText = `${porcentajeCobertura}%`;
    document.getElementById("hta-status").innerText = "ACTIVO";
    document.getElementById("hta-status").className = "status-pill success";

    // Llenar tabla nominal
    const tbody = document.querySelector("#table-hta tbody");
    tbody.innerHTML = "";

    if (listaUnicos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron pacientes hipertensos con los filtros seleccionados</td></tr>`;
        return;
    }

    listaUnicos.slice(0, 15).forEach(paciente => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td><strong>${paciente["APELLIDO"] || "-"}</strong></td>
            <td>${paciente["NOMBRE"] || "-"}</td>
            <td>${paciente["DNI"] || "-"}</td>
            <td>${paciente["EDAD"] || "-"} años</td>
            <td><span class="badge" style="background-color: #fef2f2; color: #ef4444">${paciente["DX"] || "HTA"}</span></td>
            <td><span style="color: #10b981"><i class="fas fa-check-circle"></i> ${paciente["ESTADO"] || "Atendido"}</span></td>
        `;
        tbody.appendChild(fila);
    });
}