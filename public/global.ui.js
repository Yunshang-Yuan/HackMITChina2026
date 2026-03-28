/**
 * GLOBAL UI LOGIC (BRUTALIST SYSTEM)
 * Handles universal UI components, thematic toggles, identity injection, and shared widget instances.
 */

//const API_BASE_URL = "http://106.14.147.100:3000/api";
const API_BASE_URL = "/api";

// --- 1. IDENTITY INJECTION ---
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

// --- 2. GLOBAL ALERT & TOAST CONFIGURATIONS (Pure English, Full Sentences) ---
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
    timerProgressBar: true, // Aligned with Student specs
    background: 'var(--brut-black)', 
    color: 'var(--brut-white)', 
    customClass: { popup: 'rounded-0 border border-white' }
});

// --- 3. THEME TOGGLE (Dark Mode) ---
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
        
        // Update radar chart theme globally if it exists on the page
        if (typeof updateRadarTheme === 'function') {
            updateRadarTheme(isDark);
        }
    });
}

// --- 4. GLOBAL SYSTEM SETTINGS TRIGGER ---
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

// --- 5. STANDARDIZED LOGOUT FLOW ---
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const res = await Swal.fire({ 
            ...brutSwalObj, 
            title: 'TERMINATE SESSION', 
            text: 'Are you sure you want to terminate the current session and log out?',
            icon: 'warning', 
            showCancelButton: true,
            confirmButtonText: 'OK',      // 强行指定按钮文字
            cancelButtonText: 'Cancel'    // 强行指定按钮文字
        });
        if (res.isConfirmed) { 
            localStorage.clear(); 
            window.location.href = 'login.html'; 
        }
    });
}

// --- 6. UNIVERSAL RADAR CHART LOGIC (Admin & Teacher architecture) ---
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
        // Adjust point border color based on theme for better visibility
        globalRadarChart.data.datasets[0].pointBorderColor = lineColor;
    }
    globalRadarChart.update();
}

// Bind radar sliders universally if they exist on the DOM
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
// 全局存储当前语言的翻译数据
let translations = {};

// 1. 初始化语言（优先读取用户之前的选择，默认使用英文）
const defaultLang = localStorage.getItem('userLang') || 'en';

// 2. 核心加载函数：去拉取对应的 JSON 文件
async function loadLanguage(lang) {
  try {
      // 注意：这里的路径要对应你实际存放 JSON 的位置
      const response = await fetch(`./locales/${lang}.json`);
      if (!response.ok) throw new Error('网络请求失败');
      
      translations = await response.json();
      
      // 拉取成功后，执行页面文本替换
      applyTranslations();
      
      // 把用户的选择存到浏览器里，下次打开网页还是这个语言
      localStorage.setItem('userLang', lang);
      
      // 同步更新下拉菜单的选中状态
      const switcher = document.getElementById('langSwitcher');
      if (switcher) switcher.value = lang;

      // 更新 HTML 标签的 lang 属性 (对 SEO 和屏幕阅读器友好)
      document.documentElement.lang = lang;

  } catch (error) {
      console.error('加载语言包失败:', error);
  }
}

// 3. 核心替换函数：遍历并替换网页上的文字
function applyTranslations() {
  // 找到页面上所有带有 data-i18n 属性的元素
  const elements = document.querySelectorAll('[data-i18n]');
  
  elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      // 如果 JSON 里有这个 key，就把文字替换掉
      if (translations[key]) {
          el.textContent = translations[key];
      }
  });
}

// 4. 暴露给 HTML 中 select 标签使用的切换函数
function changeLanguage(lang) {
  loadLanguage(lang);
}

// 5. 网页加载完成后，立刻执行初始化
document.addEventListener('DOMContentLoaded', () => {
  loadLanguage(defaultLang);
});