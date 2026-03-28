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

if (!userEmail || userRole !== 'admin') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '无管理员权限。' }).then(() => { window.location.href = "login.html"; });
} else {
    loadPendingTasks();
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
const navIds = ['nav-pending', 'nav-retro', 'nav-publish', 'nav-manage', 'nav-assess', 'nav-students'];
const secIds = ['section-pending', 'section-retro', 'section-publish', 'section-manage', 'section-assess', 'section-students'];
const titles = ["TERMINAL // 任务上架审批", "TERMINAL // 志愿补录审批", "TERMINAL // 发布官方任务", "TERMINAL // 官方任务进度", "TERMINAL // 官方考核结算", "TERMINAL // 全校学生数据"];

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

document.getElementById('nav-pending').onclick = (e) => { e.preventDefault(); switchTab(0); loadPendingTasks(); };
document.getElementById('nav-retro').onclick = (e) => { e.preventDefault(); switchTab(1); loadRetroEntries(); };
document.getElementById('nav-publish').onclick = (e) => { e.preventDefault(); switchTab(2); };
document.getElementById('nav-manage').onclick = (e) => { e.preventDefault(); switchTab(3); loadMyTasks(); };
document.getElementById('nav-assess').onclick = (e) => { e.preventDefault(); switchTab(4); loadAssessRecords(); };
document.getElementById('nav-students').onclick = (e) => { e.preventDefault(); switchTab(5); loadAllStudents(); };

// ================= 1. 任务上架审批 =================
async function loadPendingTasks() {
    const tbody = document.getElementById('pending-table-body');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/pending-tasks`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            document.getElementById('pending-count').textContent = result.data.length;
            tbody.innerHTML = ''; 
            result.data.forEach(task => {
                const date = new Date(task.createdAt).toLocaleDateString();
                tbody.innerHTML += `<tr>
                    <td class="ps-4 fw-bold font-monospace">${task.publisherEmail.split('@')[0]}</td>
                    <td class="fw-bold text-uppercase">${task.title}</td>
                    <td class="font-monospace fw-bold">${task.duration}H / <span class="text-danger">${task.baseCoins}C</span></td>
                    <td class="font-monospace fw-bold">${task.capacity} PROC</td>
                    <td class="font-monospace small">${date}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-brut py-1 me-1" onclick="handleAudit('${task._id}', 'reject')">REJECT</button>
                        <button class="btn btn-sm btn-brut btn-brut-red py-1" onclick="handleAudit('${task._id}', 'approve')">APPROVE</button>
                    </td>
                </tr>`;
            });
        } else {
            document.getElementById('pending-count').textContent = "0";
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 font-monospace fw-bold text-muted">NO PENDING TASKS.</td></tr>';
        }
    } catch (error) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger fw-bold font-monospace">FETCH FAILED.</td></tr>'; }
}

window.handleAudit = async function(taskId, action) {
    let reason = "";
    if (action === 'reject') {
        const { value: inputReason } = await Swal.fire({ ...brutSwalObj, title: 'REJECT REASON', input: 'text', inputPlaceholder: 'INPUT REASON...', showCancelButton: true });
        if (!inputReason) return; reason = inputReason;
    } else {
        const res = await Swal.fire({ ...brutSwalObj, title: 'APPROVE TASK?', text: '任务将直接上架大厅。', icon: 'warning', showCancelButton: true });
        if (!res.isConfirmed) return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/audit-task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, action, reason }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'EXECUTION SUCCESS.' }); loadPendingTasks(); } 
        else { Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' }); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }
};

// ================= 志愿补录审核与打分系统 =================

// 加载全校的待审核补录记录
async function loadRetroEntries() {
    const tbody = document.getElementById('retro-list-body');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/retro-entries`);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(entry => {
                const date = new Date(entry.createdAt).toLocaleDateString();
                // 把心得里的单引号转义，防止破坏 HTML
                const safeReflection = (entry.reflection || "旧版数据无心得").replace(/'/g, "\\'"); 
                
                tbody.innerHTML += `
                    <tr>
                        <td class="text-center fw-bold">${entry.studentEmail.split('@')[0]}</td>
                        <td class="text-center text-uppercase">${entry.eventName}</td>
                        <td class="text-center fw-black">${entry.hours}H</td>
                        <td class="text-center"><a href="#" class="text-primary text-decoration-none fw-bold" onclick="alert('证据链接: ${entry.evidence}')">VIEW_PROOF</a></td>
                        <td class="text-center">${date}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-brut btn-brut-red py-1 px-3" onclick="openAuditModal('${entry._id}', ${entry.hours}, '${safeReflection}')">REVIEW (审阅)</button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 font-monospace fw-bold text-muted">NO PENDING REQUESTS (暂无待审核补录)</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger fw-black font-monospace">FETCH_FAILED</td></tr>';
    }
}

// 打开带有心得和打分功能的酷炫弹窗
window.openAuditModal = async function(entryId, hours, reflectionText) {
    const { value: formValues, isConfirmed, isDenied } = await Swal.fire({
        ...brutSwalObj,
        title: 'SYS.AUDIT_REFLECTION',
        html: `
            <div class="text-start mb-4">
                <span class="badge-brut mb-2">STUDENT_REFLECTION [心得内容]</span>
                <div class="p-3 bg-light border border-dark border-2 small font-monospace" style="max-height: 200px; overflow-y: auto; text-align: justify; white-space: pre-wrap;">${reflectionText}</div>
            </div>
            
            <div class="text-start p-3 bg-dark text-white border border-dark border-2">
                <label class="form-label font-monospace fw-bold small text-danger mb-2">SCORE (0-20) [心得打分] *</label>
                <input type="number" id="swal-retro-score" class="form-control rounded-0 border-danger fw-bold fs-5" min="0" max="20" value="15">
                <div class="mt-3 font-monospace small">
                    <i class="bi bi-calculator-fill text-danger me-1"></i> CALC: (${hours}H × 10) + (SCORE × 3)
                </div>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'APPROVE <i class="bi bi-check-lg"></i>',
        denyButtonText: 'REJECT <i class="bi bi-x-lg"></i>',
        cancelButtonText: 'CANCEL',
        confirmButtonColor: '#e62117',
        denyButtonColor: '#0a0a0a',
        preConfirm: () => {
            const score = document.getElementById('swal-retro-score').value;
            if (score < 0 || score > 20) {
                Swal.showValidationMessage('分数必须在 0 到 20 之间！');
            }
            return { action: 'approve', score: score };
        }
    });

    if (isConfirmed) {
        // 执行批准和发钱
        executeRetroAudit(entryId, 'approve', formValues.score);
    } else if (isDenied) {
        // 执行驳回
        executeRetroAudit(entryId, 'reject', 0);
    }
};

// 提交审核结果到后端
async function executeRetroAudit(entryId, action, adminScore) {
    Swal.fire({ ...brutSwalObj, title: 'PROCESSING...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const response = await fetch(`${API_BASE_URL}/admin/audit-retro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, action, adminScore })
        });
        const data = await response.json();
        if (data.success) {
            Swal.fire({ ...brutSwalObj, title: 'EXECUTED', text: data.message, icon: 'success' });
            loadRetroEntries(); // 刷新列表
        } else {
            Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' });
        }
    } catch (error) {
        Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'NETWORK CONNECTION LOST.', icon: 'error' });
    }
}

window.viewEvidence = function(evidenceStr) {
    Swal.fire({ ...brutSwalObj, title: 'EVIDENCE_DATA', text: evidenceStr, confirmButtonText: 'CLOSE' });
}

window.handleRetroAudit = async function(entryId, action) {
    // 调用后端接口审批补录，逻辑同上
    const res = await Swal.fire({ ...brutSwalObj, title: 'CONFIRM ACTION?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/audit-retro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId, action }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'PROCESSED.' }); loadRetroEntries(); } 
        else { Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' }); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'API ENDPOINT NOT READY YET.', icon: 'info' }); }
}

// ================= 3. 发布官方任务 =================
document.getElementById('btn-admin-publish').addEventListener('click', async (e) => {
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
            document.getElementById('admin-task-form').reset();
            radarChart.data.datasets[0].data = [0,0,0,0,0]; radarChart.update();
            document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
            document.getElementById('nav-manage').click();
        } else Swal.fire({ ...brutSwalObj, title: 'FAILED', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION FAILED.', icon: 'error' }); }
});

// ================= 4. 官方任务进度 =================
async function loadMyTasks() {
    const tbody = document.getElementById('my-tasks-body');
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/my-tasks?email=${encodeURIComponent(userEmail)}`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(task => {
                const dateObj = new Date(task.endDate);
                let statusBadge = task.status === 'published' ? `ACTIVE` : (task.status === 'settling' ? `SETTLING` : `UNKNOWN`);
                tbody.innerHTML += `<tr>
                    <td class="ps-4 fw-bold text-uppercase">${task.title}</td>
                    <td class="font-monospace fw-bold">${task.duration}H / <span class="text-danger">${task.baseCoins}C</span></td>
                    <td class="font-monospace small">${dateObj.toLocaleDateString()}</td>
                    <td class="font-monospace fw-bold">${statusBadge}</td>
                </tr>`;
            });
        } else tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 font-monospace fw-bold text-muted">NO OFFICIAL TASKS DEPLOYED.</td></tr>';
    } catch (error) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }
}

// ================= 5. 官方考核结算 =================
async function loadAssessRecords() {
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
                    <td class="fw-bold text-uppercase text-muted">${task.title}</td>
                    <td class="font-monospace fw-bold">${earnText}</td>
                    <td class="font-monospace fw-bold">${statusHtml}</td>
                    <td class="text-end pe-4 font-monospace">${actionHtml}</td>
                </tr>`;
            });
        } else tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 font-monospace fw-bold text-muted">NO RECORDS FOUND.</td></tr>';
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }
}

window.deductTime = async function(recordId) {
    const { value: hours } = await Swal.fire({ ...brutSwalObj, title: 'DEDUCT HOURS', input: 'number', inputAttributes: { step: 0.5 }, showCancelButton: true });
    if (!hours || hours <= 0) return;
    const { value: reason } = await Swal.fire({ ...brutSwalObj, title: 'REASON', input: 'text', showCancelButton: true });
    if (!reason) return;
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/deduct-time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, deductHours: hours, reason }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'DEDUCTED.' }); loadAssessRecords(); } 
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
            loadAssessRecords(); 
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
        if (data.success) { Toast.fire({ icon: 'success', title: 'FLAGGED.' }); loadAssessRecords(); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }
};

// ================= 6. 全校学生数据 (新功能) =================
async function loadAllStudents() {
    const tbody = document.getElementById('all-students-body');
    // 注意：需要后端提供 /api/admin/all-students 接口
    try {
        const response = await fetch(`${API_BASE_URL}/admin/all-students`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(student => {
                tbody.innerHTML += `<tr>
                    <td class="ps-4 font-monospace fw-bold">${student.email.split('@')[0]}</td>
                    <td class="text-center font-monospace fw-bold">${student.totalTime}H</td>
                    <td class="text-center font-monospace fw-bold text-danger">${student.totalCoins}C</td>
                    <td class="text-center font-monospace fw-bold">${student.reputationScore}</td>
                    <td class="text-center font-monospace fw-bold">${student.activeTasks} PROC</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 font-monospace fw-bold text-muted">NO STUDENT DATA FOUND.</td></tr>';
        }
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED (WAITING FOR API).</td></tr>'; }
}

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

// ================= 退出登录 =================
document.getElementById('btn-logout').addEventListener('click', async () => {
    const res = await Swal.fire({ ...brutSwalObj, title: 'TERMINATE SESSION?', icon: 'warning', showCancelButton: true });
    if(res.isConfirmed) { localStorage.clear(); window.location.href = 'login.html'; }
});