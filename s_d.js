// ================= 全局配置与身份缓存提取 =================
//const API_BASE_URL = "http://106.14.147.100:3000/api";
const API_BASE_URL = "/api";

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
let globalTasksCache = [];
let studentDetailChart = null;

const brutSwalObj = {
    customClass: { popup: 'brut-modal', confirmButton: 'btn btn-brut btn-brut-red mx-2', cancelButton: 'btn btn-brut mx-2' },
    buttonsStyling: false
};

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    background: 'var(--brut-black)', color: 'var(--brut-white)', customClass: { popup: 'rounded-0 border border-white' }
});

// 暗黑模式切换与主题持久化
const themeBtn = document.getElementById('btn-theme-toggle');
if (localStorage.getItem('sys-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('sys-theme', 'dark');
        themeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
    } else {
        localStorage.setItem('sys-theme', 'light');
        themeBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';
    }

    if(studentDetailChart) {
        const isDark = document.body.classList.contains('dark-mode');
        studentDetailChart.options.scales.r.angleLines.color = isDark ? '#f4f4f0' : '#000000';
        studentDetailChart.options.scales.r.pointLabels.color = isDark ? '#f4f4f0' : '#000000';
        studentDetailChart.data.datasets[0].borderColor = isDark ? '#f4f4f0' : '#000000';
        studentDetailChart.data.datasets[0].pointBorderColor = isDark ? '#f4f4f0' : '#000000';
        studentDetailChart.update();
    }
});

// 系统设置按钮交互
document.getElementById('btn-settings').addEventListener('click', () => {
    Swal.fire({
        ...brutSwalObj,
        title: 'SYS.SETTINGS',
        text: 'MODULE UNDER CONSTRUCTION (系统配置模块施工中，准备接入后续扩展功能)',
        icon: 'info',
        confirmButtonText: 'ACKNOWLEDGE'
    });
});

// 权限校验与用户数据初始化
if (!userEmail || userRole !== 'student') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '未授权的访问请求。' }).then(() => { window.location.href = "login.html"; });
} else {
    loadUserProfile();
    loadTasks();
}

// 加载学生个人数据统计
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/student/profile?email=${encodeURIComponent(userEmail)}`);
        const result = await response.json();
        if (result.success) {
            // 更新大卡片数据
            document.getElementById('stat-time').textContent = result.data.totalTime;
            document.getElementById('stat-coins').textContent = result.data.totalCoins;
            document.getElementById('stat-rep-score').textContent = result.data.reputationScore;
            document.getElementById('stat-active').textContent = result.data.activeTasks;
            
            // 处理信誉度徽章颜色
            const badge = document.getElementById('stat-rep-badge');
            badge.textContent = result.data.reputationText;
            badge.className = 'badge font-monospace fw-bold px-2 py-1 border border-dark'; // 重置样式
            if (result.data.reputationScore < 90) badge.classList.add('bg-danger', 'text-white');
            else if (result.data.reputationScore >= 110) badge.classList.add('bg-primary', 'text-white');
            else badge.classList.add('bg-light', 'text-dark');
            
            // 同步更新右上角导航栏的精简数据
            document.getElementById('nav-time').textContent = result.data.totalTime;
            document.getElementById('nav-coins').textContent = result.data.totalCoins;
            document.getElementById('nav-rep').textContent = result.data.reputationScore;
            document.getElementById('nav-active').textContent = result.data.activeTasks;
        }
    } catch (error) { console.error("FETCH ERROR:", error); }
}

// 顶部导航切换逻辑 (已移除冲突的旧代码)
const studentNavIds = ['nav-hub', 'nav-my-tasks', 'nav-retro', 'nav-my-data'];
const studentSecIds = ['section-hub', 'section-my-tasks', 'section-retro', 'section-my-data'];
const studentTitles = ["TERMINAL // 任务大厅", "TERMINAL // 个人进程", "TERMINAL // 志愿补录", "TERMINAL // 我的数据"];

function switchStudentTab(activeIndex) {
    studentNavIds.forEach((nid, idx) => {
        const nav = document.getElementById(nid);
        const sec = document.getElementById(studentSecIds[idx]);
        if (idx === activeIndex) {
            nav.classList.add('active');
            sec.classList.add('active');
            document.getElementById('top-title').textContent = studentTitles[idx];
        } else {
            nav.classList.remove('active');
            sec.classList.remove('active');
        }
    });
}

document.getElementById('nav-hub').addEventListener('click', (e) => { e.preventDefault(); switchStudentTab(0); loadTasks(); });
document.getElementById('nav-my-tasks').addEventListener('click', (e) => { e.preventDefault(); switchStudentTab(1); loadMyRecords(); });
document.getElementById('nav-retro').addEventListener('click', (e) => { e.preventDefault(); switchStudentTab(2); });
document.getElementById('nav-my-data').addEventListener('click', (e) => { e.preventDefault(); switchStudentTab(3); loadUserProfile(); });

// 加载任务大厅公共任务
async function loadTasks() {
    const container = document.getElementById('task-list');
    try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        const result = await response.json();
        if (!result.success || result.data.length === 0) {
            container.innerHTML = '<p class="font-monospace fw-bold text-muted">NO TASKS AVAILABLE AT THIS MOMENT.</p>';
            return;
        }
        globalTasksCache = result.data;
        container.innerHTML = '';

        result.data.forEach((task) => {
            const taskCard = `
                <div class="col-xl-4 col-md-6 mb-4">
                    <div class="brut-card h-100 p-4 d-flex flex-column">
                        <div class="d-flex justify-content-between mb-3"><span class="badge-brut">${task.tag}</span></div>
                        <h4 class="fw-black text-truncate text-uppercase" style="letter-spacing: -1px;">${task.title}</h4>
                        <div class="border-top my-3 pt-3 flex-grow-1" style="border-color: var(--brut-black) !important;">
                            <span class="fw-black fs-5 me-3">${task.duration}H</span>
                            <span class="fw-black fs-5 text-danger">${task.baseCoins} COIN</span>
                        </div>
                        <button class="btn btn-brut w-100 mt-auto" onclick="openTaskModal('${task._id}')">EXTRACT DATA</button>
                    </div>
                </div>`;
            container.innerHTML += taskCard;
        });
    } catch (error) { container.innerHTML = '<p class="text-danger font-monospace fw-bold">SYSTEM ERROR: UNABLE TO FETCH DATA.</p>'; }
}

// 打开任务详情弹窗并绘制雷达图
window.openTaskModal = function(taskId) {
    const task = globalTasksCache.find(t => t._id === taskId);
    if (!task) return;

    document.getElementById('modal-task-title').textContent = task.title;
    document.getElementById('modal-task-desc').textContent = task.desc;
    document.getElementById('modal-task-tag').textContent = task.tag;
    document.getElementById('modal-task-pub').textContent = task.publisherEmail || 'SYS.ADMIN';
    document.getElementById('modal-task-cap').textContent = task.capacity;
    document.getElementById('modal-task-time').textContent = task.duration;
    document.getElementById('modal-task-coins').textContent = task.baseCoins;

    const formatTime = (isoString) => { const d = new Date(isoString); return `${d.toLocaleDateString().replace(/\//g,'-')} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; };
    document.getElementById('modal-task-start').textContent = formatTime(task.startDate);

    const ctx = document.getElementById('studentRadarChart').getContext('2d');
    if (studentDetailChart) studentDetailChart.destroy();
    const dims = task.dimensions || { dim1:0, dim2:0, dim3:0, dim4:0, dim5:0 };

    const isDark = document.body.classList.contains('dark-mode');
    const radarLineColor = isDark ? '#f4f4f0' : '#000000';

    studentDetailChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['EXEC', 'TEAM', 'COMM', 'LEAD', 'INNO'],
            datasets: [{ label: 'DATA', data: [dims.dim1, dims.dim2, dims.dim3, dims.dim4, dims.dim5], backgroundColor: 'rgba(230, 33, 23, 0.2)', borderColor: radarLineColor, pointBackgroundColor: '#e62117', pointBorderColor: radarLineColor, borderWidth: 2, }]
        },
        options: {
            scales: {
                r: {
                    min: 0,
                    max: 5,
                    angleLines: { color: radarLineColor },
                    grid: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                    pointLabels: { font: { size: 10, weight: 'bold', family: 'Courier New' }, color: radarLineColor },
                    ticks: { stepSize: 1, display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    document.getElementById('btn-modal-accept').onclick = () => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskDetailModal'));
        modal.hide();
        acceptTask(taskId);
    };
    new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
};

// 学生接受任务接口调用
window.acceptTask = async function(taskId) {
    const result = await Swal.fire({
        ...brutSwalObj, title: 'CONFIRM EXECUTION', text: "确认执行此任务流？违约将导致系统降级处理。", icon: 'warning',
        showCancelButton: true, confirmButtonText: 'CONFIRM (确认)', cancelButtonText: 'ABORT (取消)'
    });
    if (!result.isConfirmed) return;

    Swal.fire({ ...brutSwalObj, title: 'PROCESSING...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const response = await fetch(`${API_BASE_URL}/tasks/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: taskId, studentEmail: userEmail }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'PROCESS EXECUTED.' }); loadUserProfile(); document.getElementById('nav-my-tasks').click(); }
        else { Swal.fire({ ...brutSwalObj, title: 'ERROR', text: data.message, icon: 'error' }); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'NETWORK CONNECTION LOST.', icon: 'error' }); }
};

// 加载个人任务记录列表
async function loadMyRecords() {
    const tbody = document.getElementById('my-records-body');
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/my?email=${encodeURIComponent(userEmail)}`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(record => {
                const task = record.taskId;
                if(!task) return;
                const date = new Date(record.createdAt).toLocaleDateString().replace(/\//g,'-');
                let statusHtml = "", actionHtml = "";

                if (record.status === 'settled') {
                    statusHtml = `<span class="badge status-badge bg-dark rounded-0 border border-dark" style="color: var(--brut-white);">COMPLETED</span>`;
                    actionHtml = `<span class="fw-black">+${record.gainedTime}H / +${record.gainedBaseCoins + record.gainedBonusCoins}C</span>`;
                } else if (record.status === 'pending_audit') {
                    statusHtml = `<span class="badge status-badge bg-light text-dark rounded-0 border border-dark">AWAITING_REVIEW</span>`;
                    actionHtml = `<span class="text-muted">AWAITING ADMIN</span>`;
                } else if (record.status === 'anomaly') {
                    statusHtml = `<span class="badge status-badge bg-danger text-white rounded-0 border border-dark">SYS_ANOMALY</span>`;
                    actionHtml = `<span class="text-danger">CONTACT ADMIN</span>`;
                } else if (record.status === 'settling') {
                    statusHtml = `<span class="badge status-badge bg-warning text-dark rounded-0 border border-dark">REQ_LOGS</span>`;
                    actionHtml = `<button class="btn btn-sm btn-brut py-1" onclick="submitReflection('${record._id}')">UPLOAD LOG</button>`;
                } else {
                    statusHtml = `<span class="badge status-badge bg-white text-dark rounded-0 border border-dark">ACTIVE</span>`;
                    actionHtml = `<span class="text-muted">IN PROGRESS</span>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td class="text-center fw-bold text-uppercase">${task.title}</td>
                        <td class="text-center fw-bold">${task.duration}H / <span class="text-danger">${task.baseCoins}C</span></td>
                        <td class="text-center">${date}</td>
                        <td class="text-center">${statusHtml}</td>
                        <td class="text-center">${actionHtml}</td>
                    </tr>`;
            });
        } else { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 font-monospace fw-bold text-muted">NO LOGS FOUND.</td></tr>'; }
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger fw-black font-monospace">DATA FETCH FAILED.</td></tr>'; }
}

// 提交任务心得日志
window.submitReflection = async function(recordId) {
    const { value: reflection, isConfirmed } = await Swal.fire({
        ...brutSwalObj, title: 'UPLOAD LOG_DATA', input: 'textarea', inputLabel: 'INPUT PROCESS OBSERVATIONS...', inputPlaceholder: 'MINIMUM 5 CHARACTERS REQ.',
        showCancelButton: true, confirmButtonText: 'UPLOAD', cancelButtonText: 'CANCEL',
        inputValidator: (value) => { if (!value || value.trim().length < 5) return 'DATA_ERROR: INSUFFICIENT LENGTH (MIN 5).' }
    });
    if (!isConfirmed) return;

    Swal.fire({ ...brutSwalObj, title: 'UPLOADING...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/reflect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, reflection }) });
        const data = await response.json();
        if (data.success) { Swal.fire({ ...brutSwalObj, title: 'UPLOADED', text: data.message, icon: 'success' }); loadMyRecords(); loadUserProfile(); }
        else { Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' }); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION FAILED.', icon: 'error' }); }
};

// ================= 志愿补录 V2 核心逻辑 =================

// 1. 真实拉取登录学生的个人信息 (用于补录表单)
function populateRetroProfile() {
    // 如果找不到这些框，就不执行，防止报错
    if(!document.getElementById('retro-email')) return;

    // 把刚才提取的真实数据，塞进只读的表单框里
    document.getElementById('retro-email').textContent = userEmail;
    document.getElementById('retro-name').textContent = realName;
    document.getElementById('retro-id').textContent = studentId;
    document.getElementById('retro-class').textContent = studentClass;
}

// 2. 自动计算服务时长
function calculateRetroHours() {
    const startStr = document.getElementById('retro-start').value;
    const endStr = document.getElementById('retro-end').value;
    const hourDisplay = document.getElementById('retro-total-hours');

    if (startStr && endStr) {
        const start = new Date(`1970-01-01T${startStr}Z`);
        const end = new Date(`1970-01-01T${endStr}Z`);
        let diffMs = end - start;
        
        // 如果结束时间小于开始时间（跨天的情况，虽然很少见，但防呆）
        if (diffMs < 0) { diffMs += 24 * 60 * 60 * 1000; }
        
        const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
        hourDisplay.innerHTML = `${diffHrs}<span class="fs-5">H</span>`;
        hourDisplay.setAttribute('data-hours', diffHrs);
    } else {
        hourDisplay.innerHTML = `0.0<span class="fs-5">H</span>`;
        hourDisplay.setAttribute('data-hours', 0);
    }
}

// 绑定时间输入框的监听事件
document.querySelectorAll('.calc-trigger').forEach(input => {
    input.addEventListener('change', calculateRetroHours);
});

// 3. 路途时间开关逻辑
document.getElementById('retro-travel-toggle').addEventListener('change', function() {
    const descBox = document.getElementById('retro-travel-desc-box');
    if (this.checked) {
        descBox.classList.remove('d-none');
        document.getElementById('retro-travel-desc').setAttribute('required', 'true');
    } else {
        descBox.classList.add('d-none');
        document.getElementById('retro-travel-desc').removeAttribute('required');
        document.getElementById('retro-travel-desc').value = '';
    }
});

// 4. 真实的提交表单逻辑 (直连 MongoDB)
document.getElementById('btn-submit-retro-v2').addEventListener('click', async () => {
    // 抓取表单数据
    const certify = document.getElementById('retro-certify').checked;
    const supEmail = document.getElementById('retro-sup-email').value;
    const reflection = document.getElementById('retro-reflection').value;
    const orgName = document.getElementById('retro-org-name').value;
    const position = document.getElementById('retro-position').value;
    const totalHours = parseFloat(document.getElementById('retro-total-hours').getAttribute('data-hours')) || 0;

    // 前端防呆校验
    if (!certify) return Swal.fire({ ...brutSwalObj, title: 'DECLARATION_REQ', text: '请先勾选底部的真实性声明！', icon: 'warning' });
    if (totalHours <= 0) return Swal.fire({ ...brutSwalObj, title: 'TIME_ERR', text: '服务时长必须大于 0！', icon: 'error' });
    if (!supEmail || !reflection || !orgName || !position) return Swal.fire({ ...brutSwalObj, title: 'DATA_MISSING', text: '主管邮箱、组织名称、职位和心得均为必填项！', icon: 'error' });

    // 把活动名称和职位拼接一下发给后端
    const eventNameCombined = `${orgName} - ${position}`;
    // 记录主管验证邮箱作为“证据”
    const evidenceStr = `主管邮箱验签: ${supEmail}`;

    // 弹出加载动画
    Swal.fire({ ...brutSwalObj, title: 'UPLOADING...', text: '正在向后端记忆中枢写入数据...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        // 真正的发送请求！
        const response = await fetch(`${API_BASE_URL}/student/retro-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                studentEmail: userEmail,
                eventName: eventNameCombined,
                hours: totalHours,
                evidence: evidenceStr,
                reflection: reflection
            })
        });
        
        const data = await response.json();
        if (data.success) {
            Swal.fire({ ...brutSwalObj, title: 'SUBMITTED', text: '补录已提交！主管验签模拟通过，已进入 Admin 审核流。', icon: 'success' });
            // 清空表单
            document.getElementById('form-retro-v2').reset();
            document.getElementById('retro-total-hours').innerHTML = `0.0<span class="fs-5">H</span>`;
            document.getElementById('retro-total-hours').setAttribute('data-hours', 0);
            document.getElementById('retro-travel-desc-box').classList.add('d-none');
        } else {
            Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' });
        }
    } catch (error) {
        Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: '服务器连接断开，请检查网络。', icon: 'error' });
    }
});

// 在初始化时调用拉取个人信息
populateRetroProfile();

// 退出登录功能
document.getElementById('btn-logout').addEventListener('click', async () => {
    const result = await Swal.fire({ ...brutSwalObj, title: 'TERMINATE SESSION?', icon: 'warning', showCancelButton: true, confirmButtonText: 'TERMINATE', cancelButtonText: 'CANCEL' });
    if (result.isConfirmed) { localStorage.clear(); window.location.href = 'login.html'; }
});