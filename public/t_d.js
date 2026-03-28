// ================= 全局配置与身份缓存提取 =================
const API_BASE_URL = "http://106.14.147.100:3000/api";

// 提取我们在登录页存入的本地数据
const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');

// 👇 这三行是新加的！用来把真实姓名、学号、班级从记忆里抽出来
const realName = localStorage.getItem('realName') || sessionStorage.getItem('realName') || 'UNKNOWN';
const studentId = localStorage.getItem('studentId') || sessionStorage.getItem('studentId') || '000000';
const studentClass = localStorage.getItem('studentClass') || sessionStorage.getItem('studentClass') || 'N/A';

// 👇 这一段的作用是：只要网页一加载完，立刻把刚才抽出来的名字和学号，强行拍到侧边栏的 HTML 标签里
document.addEventListener('DOMContentLoaded', () => {
    const nameEl = document.getElementById('sidebar-realname');
    const idEl = document.getElementById('sidebar-studentid');
    if(nameEl) nameEl.textContent = realName;
    if(idEl) idEl.textContent = studentId;
});
// ==========================================================
let globalStudentRecordsCache = [];

const brutSwalObj = {
    customClass: { popup: 'brut-modal', confirmButton: 'btn btn-brut btn-brut-red mx-2', cancelButton: 'btn btn-brut mx-2' },
    buttonsStyling: false
};
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: 'var(--brut-black)', color: 'var(--brut-white)', customClass: { popup: 'rounded-0 border border-white' }});

if (!userEmail || userRole !== 'teacher') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '无教师权限。' }).then(() => { window.location.href = "login.html"; });
} else {
    document.getElementById('user-email-display').textContent = userEmail.split('@')[0];
}

// ================= 暗黑模式切换 =================
const themeBtn = document.getElementById('btn-theme-toggle');
if (localStorage.getItem('sys-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
}
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('sys-theme', isDark ? 'dark' : 'light');
    themeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
    updateRadarTheme(isDark);
});

// ================= 雷达图初始化 =================
let radarChart;
const ctx = document.getElementById('radarChart').getContext('2d');
function initRadarChart() {
    const isDark = document.body.classList.contains('dark-mode');
    const lineColor = isDark ? '#f4f4f0' : '#000000';
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['EXEC', 'TEAM', 'COMM', 'LEAD', 'INNO'],
            datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: 'rgba(230, 33, 23, 0.2)', borderColor: '#e62117', pointBackgroundColor: '#e62117', borderWidth: 2 }]
        },
        options: {
            scales: { r: { min: 0, max: 5, angleLines: { color: lineColor }, grid: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }, pointLabels: { font: { size: 10, weight: 'bold', family: 'Courier New' }, color: lineColor }, ticks: { stepSize: 1, display: false } } },
            plugins: { legend: { display: false } }
        }
    });
}
initRadarChart();

function updateRadarTheme(isDark) {
    if(!radarChart) return;
    const lineColor = isDark ? '#f4f4f0' : '#000000';
    radarChart.options.scales.r.angleLines.color = lineColor;
    radarChart.options.scales.r.pointLabels.color = lineColor;
    radarChart.options.scales.r.grid.color = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    radarChart.update();
}

document.querySelectorAll('.dim-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
        document.getElementById(`val-${e.target.id}`).textContent = e.target.value;
        radarChart.data.datasets[0].data = [ document.getElementById('dim1').value, document.getElementById('dim2').value, document.getElementById('dim3').value, document.getElementById('dim4').value, document.getElementById('dim5').value ];
        radarChart.update();
    });
});

// ================= 导航切换逻辑 =================
const navIds = ['nav-publish', 'nav-manage', 'nav-audit'];
const secIds = ['section-publish', 'section-manage', 'section-audit'];
const titles = ["TERMINAL // 发布新任务", "TERMINAL // 任务进度管理", "TERMINAL // 考核与结算"];

function switchTab(activeIndex) {
    navIds.forEach((nid, idx) => {
        const nav = document.getElementById(nid);
        const sec = document.getElementById(secIds[idx]);
        if (idx === activeIndex) {
            nav.classList.add('active');
            sec.classList.add('active');
            document.getElementById('top-title').textContent = titles[idx];
        } else {
            nav.classList.remove('active');
            sec.classList.remove('active');
        }
    });
}

document.getElementById('nav-publish').onclick = (e) => { e.preventDefault(); switchTab(0); };
document.getElementById('nav-manage').onclick = (e) => { e.preventDefault(); switchTab(1); loadMyTasks(); };
document.getElementById('nav-audit').onclick = (e) => { e.preventDefault(); switchTab(2); loadAuditRecords(); };

// ================= 任务发布 =================
document.getElementById('btn-submit-task').addEventListener('click', async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('task-start').value;
    const endDate = document.getElementById('task-end').value;
    if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) return Swal.fire({ ...brutSwalObj, title: 'DATA_ERR', text: '时间冲突。', icon: 'error' });

    const payload = {
        title: document.getElementById('task-title').value, desc: document.getElementById('task-desc').value,
        startDate: startDate, endDate: endDate, duration: document.getElementById('task-time').value,
        capacity: document.getElementById('task-capacity').value, tag: document.getElementById('task-category').value,
        publisherEmail: userEmail, role: userRole,
        dims: { dim1: document.getElementById('dim1').value, dim2: document.getElementById('dim2').value, dim3: document.getElementById('dim3').value, dim4: document.getElementById('dim4').value, dim5: document.getElementById('dim5').value }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (data.success) {
            Swal.fire({ ...brutSwalObj, title: 'DEPLOYED', text: data.message, icon: 'success' });
            document.getElementById('task-publish-form').reset();
            radarChart.data.datasets[0].data = [0,0,0,0,0]; radarChart.update();
            document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
            document.getElementById('nav-manage').click();
        } else Swal.fire({ ...brutSwalObj, title: 'FAILED', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION FAILED.', icon: 'error' }); }
});

// ================= 加载任务进度 =================
async function loadMyTasks() {
    const tbody = document.getElementById('my-tasks-body');
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/my-tasks?email=${encodeURIComponent(userEmail)}`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(task => {
                const dateObj = new Date(task.endDate);
                let statusBadge = task.status === 'pending_audit' ? `AWAITING_ADMIN` :
                                  task.status === 'published' ? `ACTIVE` :
                                  task.status === 'settling' ? `SETTLING` : `REJECTED`;
                
                tbody.innerHTML += `<tr>
                    <td class="ps-4 fw-bold text-uppercase">${task.title}</td>
                    <td class="font-monospace fw-bold">${task.duration}H / <span class="text-danger">${task.baseCoins}C</span></td>
                    <td class="font-monospace small">${dateObj.toLocaleDateString()}</td>
                    <td class="font-monospace fw-bold">${statusBadge}</td>
                </tr>`;
            });
        } else tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 font-monospace fw-bold text-muted">NO TASKS DEPLOYED.</td></tr>';
    } catch (error) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }
}

// ================= 加载学生考核记录 =================
async function loadAuditRecords() {
    const tbody = document.getElementById('audit-records-body');
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/student-records?email=${encodeURIComponent(userEmail)}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            globalStudentRecordsCache = result.data;
            tbody.innerHTML = '';
            result.data.forEach(record => {
                const task = record.taskId; 
                if(!task) return; 

                let statusHtml = "", actionHtml = "";
                let earnText = `${record.gainedTime}H / <span class="text-danger">${record.gainedBaseCoins + record.gainedBonusCoins}C</span>`;
                if(record.deductedTime > 0) earnText += `<br><small class="text-danger font-monospace">-${record.deductedTime}H (${record.deductReason})</small>`;

                if (record.status === 'accepted') { statusHtml = `ACTIVE`; actionHtml = `LOCKED`; } 
                else if (record.status === 'settling') {
                    statusHtml = `REQ_LOGS`;
                    actionHtml = `<button class="btn btn-sm btn-brut py-1 me-1" onclick="deductTime('${record._id}')">-HOURS</button><button class="btn btn-sm btn-brut py-1" onclick="markAnomaly('${record._id}')">FLAG</button>`;
                } 
                else if (record.status === 'pending_audit') {
                    statusHtml = `AWAIT_REVIEW`;
                    actionHtml = `<button class="btn btn-sm btn-brut btn-brut-red py-1" onclick="openReviewModal('${record._id}')">REVIEW</button>`;
                } 
                else if (record.status === 'settled') { statusHtml = `SETTLED`; actionHtml = `DONE`; } 
                else if (record.status === 'anomaly') { statusHtml = `ANOMALY`; actionHtml = `FLAGGED`; }

                tbody.innerHTML += `<tr>
                    <td class="ps-4 font-monospace fw-bold">${record.studentEmail.split('@')[0]}</td>
                    <td class="text-muted small text-uppercase">${task.title}</td>
                    <td class="font-monospace fw-bold">${earnText}</td>
                    <td class="font-monospace fw-bold">${statusHtml}</td>
                    <td class="text-end pe-4 font-monospace">${actionHtml}</td>
                </tr>`;
            });
        } else tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 font-monospace fw-bold text-muted">NO RECORDS FOUND.</td></tr>';
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }
}

// ================= 教师操作 =================
window.deductTime = async function(recordId) {
    const { value: hours } = await Swal.fire({ ...brutSwalObj, title: 'DEDUCT HOURS', input: 'number', inputAttributes: { step: 0.5 }, showCancelButton: true });
    if (!hours || hours <= 0) return;
    const { value: reason } = await Swal.fire({ ...brutSwalObj, title: 'REASON', input: 'text', showCancelButton: true });
    if (!reason) return;

    try {
        const response = await fetch(`${API_BASE_URL}/teacher/deduct-time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, deductHours: hours, reason }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'DEDUCTED.' }); loadAuditRecords(); } 
        else Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }
};

window.openReviewModal = function(recordId) {
    const record = globalStudentRecordsCache.find(r => r._id === recordId);
    if (!record) return;
    document.getElementById('modal-reflection-text').textContent = record.reflection;
    document.getElementById('modal-max-bonus').textContent = record.taskId.baseCoins;
    document.getElementById('modal-bonus-input').value = 0;
    document.getElementById('modal-current-record-id').value = recordId;
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
};

document.getElementById('btn-submit-review').addEventListener('click', async () => {
    const recordId = document.getElementById('modal-current-record-id').value;
    const bonusAmount = parseInt(document.getElementById('modal-bonus-input').value) || 0;
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/award-bonus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, bonusAmount }) });
        const data = await response.json();
        if (data.success) {
            Toast.fire({ icon: 'success', title: 'AUTHORIZED.' });
            bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
            loadAuditRecords();
        } else Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }
});

window.markAnomaly = async function(recordId) {
    const res = await Swal.fire({ ...brutSwalObj, title: 'FLAG AS ANOMALY?', icon: 'warning', showCancelButton: true });
    if(!res.isConfirmed) return;
    const { value: reason } = await Swal.fire({ ...brutSwalObj, title: 'REASON', input: 'text', showCancelButton: true });
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/mark-anomaly`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, reason: reason||"N/A" }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'FLAGGED.' }); loadAuditRecords(); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }
};

// ================= 系统设置按钮交互 =================
document.getElementById('btn-settings').addEventListener('click', () => {
    Swal.fire({
        ...brutSwalObj,
        title: 'SYS.SETTINGS',
        text: 'MODULE UNDER CONSTRUCTION (系统配置模块施工中，准备接入后续扩展功能)',
        icon: 'info',
        confirmButtonText: 'ACKNOWLEDGE'
    });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    const res = await Swal.fire({ ...brutSwalObj, title: 'TERMINATE SESSION?', icon: 'warning', showCancelButton: true });
    if(res.isConfirmed) { localStorage.clear(); window.location.href = 'login.html'; }
});

