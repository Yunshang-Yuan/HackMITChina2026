// #region [01] Base Configuration & Constants (基础配置与常量)
const API_BASE_URL = "/api";
// #endregion

// #region [02] Identity & Profile Injection (身份与档案注入)
const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
const realName = localStorage.getItem('realName') || sessionStorage.getItem('realName') || 'UNKNOWN';
const studentId = localStorage.getItem('studentId') || sessionStorage.getItem('studentId') || '000000';

document.addEventListener('DOMContentLoaded', () => {
    const nameEl = document.getElementById('sidebar-realname');
    const idEl = document.getElementById('sidebar-studentid');
    if (nameEl) nameEl.textContent = realName;
    if (idEl) idEl.textContent = studentId;
});
// #endregion

// #region [03] UI Alert & Notification Setup (UI 弹窗与通知配置)
const brutSwalObj = {
    customClass: { 
        popup: 'brut-modal', 
        confirmButton: 'btn btn-brut btn-brut-red mx-2', 
        cancelButton: 'btn btn-brut mx-2' 
    },
    buttonsStyling: false
};

const Toast = Swal.mixin({
    toast: true, 
    position: 'top-end', 
    showConfirmButton: false, 
    timer: 3000, 
    timerProgressBar: true, 
    background: 'var(--brut-black)', 
    color: 'var(--brut-white)', 
    customClass: { popup: 'rounded-0 border border-white' }
});
// #endregion

// #region [04] Thematic Engine & Dark Mode (主题引擎与暗黑模式)
const themeBtn = document.getElementById('btn-theme-toggle');
if (themeBtn) {
    if (localStorage.getItem('sys-theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('sys-theme', isDark ? 'dark' : 'light');
        themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
        
        if (typeof updateRadarTheme === 'function') {
            updateRadarTheme(isDark);
        }
    });
}
// #endregion

// #region [05] Session & System Controls (会话与系统控制)
const settingsBtn = document.getElementById('btn-settings');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        Swal.fire({
            ...brutSwalObj,
            title: 'SYSTEM SETTINGS',
            text: 'This module is currently under construction. Preparing for future system expansions.',
            icon: 'info',
            confirmButtonText: 'ACKNOWLEDGE'
        });
    });
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const res = await Swal.fire({ 
            ...brutSwalObj, 
            title: 'TERMINATE SESSION', 
            text: 'Are you sure you want to terminate the current session and log out?',
            icon: 'warning', 
            showCancelButton: true,
            confirmButtonText: 'OK',
            cancelButtonText: 'Cancel'
        });
        if (res.isConfirmed) { 
            localStorage.clear(); 
            window.location.href = 'login.html'; 
        }
    });
}
// #endregion

// #region [06] Data Visualization Hub (数据可视化中枢)
let globalRadarChart;

function initGlobalRadarChart(canvasId, initialData = [0, 0, 0, 0, 0]) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const lineColor = isDark ? '#f4f4f0' : '#000000';
    
    const chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['EXEC', 'TEAM', 'COMM', 'LEAD', 'INNO'],
            datasets: [{ 
                data: initialData, 
                backgroundColor: 'rgba(230, 33, 23, 0.2)', 
                borderColor: '#e62117', 
                pointBackgroundColor: '#e62117', 
                pointBorderColor: lineColor,
                borderWidth: 2 
            }]
        },
        options: {
            scales: { 
                r: { 
                    min: 0, 
                    max: 5, 
                    angleLines: { color: lineColor }, 
                    grid: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }, 
                    pointLabels: { font: { size: 10, weight: 'bold', family: 'Courier New' }, color: lineColor }, 
                    ticks: { stepSize: 1, display: false } 
                } 
            },
            plugins: { legend: { display: false } }
        }
    });
    
    globalRadarChart = chart;
    return chart;
}

function updateRadarTheme(isDark) {
    if (!globalRadarChart) return;
    const lineColor = isDark ? '#f4f4f0' : '#000000';
    globalRadarChart.options.scales.r.angleLines.color = lineColor;
    globalRadarChart.options.scales.r.pointLabels.color = lineColor;
    globalRadarChart.options.scales.r.grid.color = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    
    if (globalRadarChart.data.datasets.length > 0) {
        globalRadarChart.data.datasets[0].pointBorderColor = lineColor;
    }
    globalRadarChart.update();
}
// #endregion

// #region [07] Global Input Event Bindings (全局输入事件绑定)
document.querySelectorAll('.dim-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
        const valDisplay = document.getElementById(`val-${e.target.id}`);
        if (valDisplay) valDisplay.textContent = e.target.value;
        
        if (globalRadarChart) {
            globalRadarChart.data.datasets[0].data = [ 
                document.getElementById('dim1').value || 0, 
                document.getElementById('dim2').value || 0, 
                document.getElementById('dim3').value || 0, 
                document.getElementById('dim4').value || 0, 
                document.getElementById('dim5').value || 0 
            ];
            globalRadarChart.update();
        }
    });
});
// #endregion