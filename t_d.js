// ================= TEACHER 业务逻辑 (已全量瘦身) =================
let globalStudentRecordsCache = [];

// 1. 权限校验
if (!userEmail || userRole !== 'teacher') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '无教师权限。' }).then(() => { window.location.href = "login.html"; });
} 

// 2. 初始化全局雷达图 (依赖 global.ui.js 提供的方法)
if (typeof initGlobalRadarChart === 'function') {
    initGlobalRadarChart('radarChart');
}

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

// ================= 核心业务 API =================
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
            // 访问 global.ui.js 中的全局雷达图实例重置数据
            if(typeof globalRadarChart !== 'undefined' && globalRadarChart) { 
                globalRadarChart.data.datasets[0].data = [0,0,0,0,0]; 
                globalRadarChart.update(); 
            }
            document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
            document.getElementById('nav-manage').click();
        } else Swal.fire({ ...brutSwalObj, title: 'FAILED', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION FAILED.', icon: 'error' }); }
});

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

    // 👇 ========= 新增的这两步 ========= 👇
    // 1. 把任务名称和时长绑到 AI 打分按钮的 dataset 上
    const aiBtn = document.getElementById('btn-ai-evaluate');
    if (aiBtn) {
        aiBtn.dataset.taskTitle = record.taskId.title;
        aiBtn.dataset.taskHours = record.taskId.duration;
    }
    // 2. 每次打开新弹窗时，把上一次的 AI 评估结果框隐藏掉
    document.getElementById('ai-eval-result-box').style.display = 'none';
    // 👆 =============================== 👆

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

// ================= 新增：AI 辅助功能 =================

// 1. AI 润色任务描述
document.getElementById('btn-ai-refine')?.addEventListener('click', async function() {
    const descInput = document.getElementById('task-desc');
    const originalText = descInput.value.trim();
    
    // 复用你已经配好的 SweetAlert (Toast)
    if (!originalText) return Toast.fire({ icon: 'warning', title: '请输入基础描述！' });

    const originalBtnHtml = this.innerHTML;
    this.innerHTML = '<i class="bi bi-hourglass-split"></i> 润色中...';
    this.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/ai/refine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: originalText })
        });
        const data = await response.json();
        
        if (data.success) {
            descInput.value = data.response;
            Toast.fire({ icon: 'success', title: '描述已扩写！' });
        } else throw new Error(data.message);
    } catch (error) {
        Swal.fire({ ...brutSwalObj, title: 'AI_ERR', text: '网络请求失败。', icon: 'error' });
    } finally {
        this.innerHTML = originalBtnHtml;
        this.disabled = false;
    }
});

// 2. AI 评估志愿心得
document.getElementById('btn-ai-evaluate')?.addEventListener('click', async function() {
    const reflectionText = document.getElementById('modal-reflection-text').textContent;
    // 从按钮自定义属性上读取上下文（下文会教你怎么绑上去）
    const taskTitle = this.dataset.taskTitle || '未知任务';
    const taskHours = this.dataset.taskHours || '未知时长';
    
    const resultBox = document.getElementById('ai-eval-result-box');
    const resultContent = document.getElementById('ai-eval-content');

    if (reflectionText.length < 5) return Toast.fire({ icon: 'warning', title: '字数太少，无需评估' });

    const originalBtnHtml = this.innerHTML;
    this.innerHTML = '<i class="bi bi-cpu-fill"></i> 分析中...';
    this.disabled = true;
    
    // 显示评估框，呈现极客风的 Loading 动画
    resultBox.style.display = 'block';
    resultContent.innerHTML = '<span class="text-danger fw-bold blinking-text">CONNECTING TO AI CORE...</span>';

    try {
        const response = await fetch(`${API_BASE_URL}/ai/evaluate-reflection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reflection: reflectionText, taskTitle, hours: taskHours })
        });
        const data = await response.json();
        
        if (data.success) {
            // 注意：如果你把之前的 parseMarkdown 放到 global.ui.js 里了，这里就可以直接调用。
            // 否则这里可以用 data.response.replace(/\n/g, '<br>') 做一个简单的换行回退处理。
            resultContent.innerHTML = typeof parseMarkdown === 'function' ? parseMarkdown(data.response) : data.response.replace(/\n/g, '<br>');
        } else throw new Error(data.message);
    } catch (error) {
        resultContent.innerHTML = '<span class="text-danger fw-bold">SYS_ERR: AI ENGINE OFFLINE.</span>';
    } finally {
        this.innerHTML = originalBtnHtml;
        this.disabled = false;
    }
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
