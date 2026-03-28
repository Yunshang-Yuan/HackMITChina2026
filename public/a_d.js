// #region [01] Authorization & Initial State (权限校验与初始加载)
let globalStudentRecordsCache = [];

if (!userEmail || userRole !== 'admin') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '无管理员权限。' }).then(() => { window.location.href = "login.html"; });
} else {
    loadPendingTasks();
}

initGlobalRadarChart('radarChart');
// #endregion

// #region [02] Navigation & Tab Routing (导航切换与路由逻辑)
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
// #endregion

// #region [03] Task Approval & Audit (任务审批与管理)
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
// #endregion

// #region [04] Retroactive Application Review (志愿补录申请审核)
async function loadRetroEntries() {
    const tbody = document.getElementById('retro-list-body');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/retro-entries`);
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = '';
            result.data.forEach(entry => {
                const date = new Date(entry.createdAt).toLocaleDateString();
                const safeReflection = (entry.reflection || "旧版数据无心得").replace(/'/g, "\\'"); 
                tbody.innerHTML += `<tr>
                        <td class="text-center fw-bold">${entry.studentEmail.split('@')[0]}</td>
                        <td class="text-center text-uppercase">${entry.eventName}</td>
                        <td class="text-center fw-black">${entry.hours}H</td>
                        <td class="text-center"><a href="#" class="text-primary text-decoration-none fw-bold" onclick="alert('证据链接: ${entry.evidence}')">VIEW_PROOF</a></td>
                        <td class="text-center">${date}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-brut btn-brut-red py-1 px-3" onclick="openAuditModal('${entry._id}', ${entry.hours}, '${safeReflection}')">REVIEW</button>
                        </td>
                    </tr>`;
            });
        } else { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 font-monospace fw-bold text-muted">NO PENDING REQUESTS.</td></tr>'; }
    } catch (error) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger fw-black font-monospace">FETCH_FAILED</td></tr>'; }
}

window.openAuditModal = async function(entryId, hours, reflectionText) {
    const { value: formValues, isConfirmed, isDenied } = await Swal.fire({
        ...brutSwalObj, title: 'SYS.AUDIT_REFLECTION',
        html: `
            <div class="text-start mb-4">
                <span class="badge-brut mb-2">STUDENT_REFLECTION</span>
                <div class="p-3 bg-light border border-dark border-2 small font-monospace" style="max-height: 200px; overflow-y: auto; text-align: justify; white-space: pre-wrap;">${reflectionText}</div>
            </div>
            <div class="text-start p-3 bg-dark text-white border border-dark border-2">
                <label class="form-label font-monospace fw-bold small text-danger mb-2">SCORE (0-20) *</label>
                <input type="number" id="swal-retro-score" class="form-control rounded-0 border-danger fw-bold fs-5" min="0" max="20" value="15">
            </div>`,
        showCancelButton: true, showDenyButton: true, confirmButtonText: 'APPROVE', denyButtonText: 'REJECT', cancelButtonText: 'CANCEL',
        preConfirm: () => {
            const score = document.getElementById('swal-retro-score').value;
            if (score < 0 || score > 20) Swal.showValidationMessage('SCORE MUST BE 0-20!');
            return { action: 'approve', score: score };
        }
    });
    if (isConfirmed) executeRetroAudit(entryId, 'approve', formValues.score);
    else if (isDenied) executeRetroAudit(entryId, 'reject', 0);
};

async function executeRetroAudit(entryId, action, adminScore) {
    Swal.fire({ ...brutSwalObj, title: 'PROCESSING...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const response = await fetch(`${API_BASE_URL}/admin/audit-retro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId, action, adminScore }) });
        const data = await response.json();
        if (data.success) { Swal.fire({ ...brutSwalObj, title: 'EXECUTED', text: data.message, icon: 'success' }); loadRetroEntries(); } 
        else { Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' }); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'NETWORK CONNECTION LOST.', icon: 'error' }); }
}
// #endregion

// #region [05] Official Task Deployment (官方任务发布逻辑)
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
            if(globalRadarChart) { globalRadarChart.data.datasets[0].data = [0,0,0,0,0]; globalRadarChart.update(); }
            document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
            document.getElementById('nav-manage').click();
        } else Swal.fire({ ...brutSwalObj, title: 'FAILED', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION FAILED.', icon: 'error' }); }
});
// #endregion

// #region [06] Data Retrieval Helpers (数据拉取辅助函数)
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
// #endregion

// #region [07] Supervisory Management Tools (教师/督导管理工具)
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

    const aiBtn = document.getElementById('btn-ai-evaluate');
    if (aiBtn) {
        aiBtn.dataset.taskTitle = record.taskId.title;
        aiBtn.dataset.taskHours = record.taskId.duration;
    }
    document.getElementById('ai-eval-result-box').style.display = 'none';

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
// #endregion

// #region [08] Global Student Analytics (全校学生数据总览)
async function loadAllStudents() {
    const tbody = document.getElementById('all-students-body');
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
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }
}
// #endregion

// #region [09] AI Services Hub (AI 服务中心)
document.getElementById('btn-ai-refine')?.addEventListener('click', async function() {
    const descInput = document.getElementById('task-desc');
    const originalText = descInput.value.trim();
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

document.getElementById('btn-ai-evaluate')?.addEventListener('click', async function() {
    const reflectionText = document.getElementById('modal-reflection-text').textContent;
    const taskTitle = this.dataset.taskTitle || '未知任务';
    const taskHours = this.dataset.taskHours || '未知时长';
    const resultBox = document.getElementById('ai-eval-result-box');
    const resultContent = document.getElementById('ai-eval-content');

    if (reflectionText.length < 5) return Toast.fire({ icon: 'warning', title: '字数太少，无需评估' });

    const originalBtnHtml = this.innerHTML;
    this.innerHTML = '<i class="bi bi-cpu-fill"></i> 分析中...';
    this.disabled = true;
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
            resultContent.innerHTML = typeof parseMarkdown === 'function' ? parseMarkdown(data.response) : data.response.replace(/\n/g, '<br>');
        } else throw new Error(data.message);
    } catch (error) {
        resultContent.innerHTML = '<span class="text-danger fw-bold">SYS_ERR: AI ENGINE OFFLINE.</span>';
    } finally {
        this.innerHTML = originalBtnHtml;
        this.disabled = false;
    }
});
// #endregion

// #region [10] Polaris Protocol: Animation Core (北极星协议：动画核心引擎)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function moveCursorTo(selector, offsetX = 10, offsetY = 10) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(400);
    const rect = el.getBoundingClientRect();
    const cursor = document.getElementById('ghost-cursor');
    cursor.style.transition = 'all 0.8s ease-out';
    cursor.style.left = (rect.left + rect.width / 2 + offsetX) + 'px';
    cursor.style.top = (rect.top + rect.height / 2 + offsetY) + 'px';
    await wait(800); 
}

async function typeIn(selector, text, speed = 40) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.value = '';
    el.focus();
    for (let i = 0; i < text.length; i++) {
        el.value += text[i];
        await wait(speed);
    }
}

async function dragSlider(selector, targetValue) {
    const slider = document.querySelector(selector);
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 5;
    const currentVal = parseFloat(slider.value) || 0;
    const rect = slider.getBoundingClientRect();
    const cursor = document.getElementById('ghost-cursor');
    
    slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(300);
    const currentPct = (currentVal - min) / (max - min);
    const startX = rect.left + (rect.width * currentPct);
    const centerY = rect.top + rect.height / 2;
    
    cursor.style.transition = 'all 0.5s ease-out';
    cursor.style.left = startX + 'px';
    cursor.style.top = centerY + 'px';
    await wait(600); 

    cursor.style.transform = 'scale(0.7)';
    cursor.style.backgroundColor = '#8b0000'; 
    await wait(200);

    const targetPct = (targetValue - min) / (max - min);
    const endX = rect.left + (rect.width * targetPct);
    cursor.style.transition = 'all 0.6s linear'; 
    cursor.style.left = endX + 'px';
    
    const steps = 10;
    const stepTime = 600 / steps;
    const valStep = (targetValue - currentVal) / steps;
    
    for(let i = 1; i <= steps; i++) {
        await wait(stepTime);
        slider.value = currentVal + (valStep * i);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    slider.value = targetValue;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    cursor.style.transform = 'scale(1)';
    cursor.style.backgroundColor = 'var(--brut-red, #ff0000)';
    await wait(300);
}
// #endregion

// #region [11] Polaris Protocol: Demo Scenario (北极星协议：演示剧本)
async function runTutorialDemo() {
    let cursor = document.getElementById('ghost-cursor');
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'ghost-cursor';
        document.body.appendChild(cursor);
    }

    await wait(1000);
    await moveCursorTo('#nav-publish'); 
    const navBtn = document.querySelector('#nav-publish');
    if (navBtn) {
        navBtn.classList.add('tut-click-blink');
        await wait(300);
        navBtn.click(); 
        navBtn.classList.remove('tut-click-blink');
    }
    await wait(500);

    await moveCursorTo('#task-title');
    await typeIn('#task-title', 'FRC Regional: Pit Crew & Scouting', 50);
    await moveCursorTo('#task-desc');
    await typeIn('#task-desc', 'Help setup the pit, organize tools, and scout other teams for Polaris 11319.', 40);

    const aiBtnSelector = '#btn-ai-refine';
    await moveCursorTo(aiBtnSelector);
    const aiBtn = document.querySelector(aiBtnSelector);
    aiBtn.classList.add('tut-click-blink');
    await wait(400);
    aiBtn.classList.remove('tut-click-blink');

    const originalBtnHtml = aiBtn.innerHTML;
    aiBtn.innerHTML = '<i class="bi bi-cpu"></i> OPTIMIZING...';
    aiBtn.disabled = true;
    await wait(2500); 

    const mockAIResponse = `### 🤖 FRC 11319 Polaris: Pit & Scouting Crew

**MISSION OBJECTIVE**:
Join Team Polaris 11319 at the upcoming FIRST Robotics Competition Regional! We need dedicated volunteers to maintain the pit area and gather crucial match data.

**CORE RESPONSIBILITIES**:
1. **Pit Operations**: Organize tools, manage battery charging stations, and assist the drive team with rapid robot repairs.
2. **Match Scouting**: Observe assigned teams, record teleop scoring metrics, and input data into the Polaris App.
3. **Strategy Support**: Deliver scouting reports to the drive coach before alliance selection.

**REQUIREMENTS**:
- Safety glasses are MANDATORY in the pit area.
- Gracious Professionalism must be demonstrated at all times!`;

    const descInput = document.querySelector('#task-desc');
    descInput.value = mockAIResponse;
    descInput.dispatchEvent(new Event('input', { bubbles: true }));
    aiBtn.innerHTML = originalBtnHtml;
    aiBtn.disabled = false;
    if (typeof Toast !== 'undefined') Toast.fire({ icon: 'success', title: 'AI ENHANCED!' });
    await wait(1500);

    document.querySelector('#task-start').value = "2026-04-15T08:00";
    document.querySelector('#task-end').value = "2026-04-15T16:00";
    await moveCursorTo('#task-time');
    await typeIn('#task-time', '8', 100);
    document.querySelector('#task-time').dispatchEvent(new Event('input')); 

    await wait(500);
    await dragSlider('#dim1', 5); 
    await dragSlider('#dim2', 5); 
    await dragSlider('#dim3', 4); 
    await dragSlider('#dim4', 3); 
    await dragSlider('#dim5', 4); 
    await wait(800);

    await moveCursorTo('#task-capacity');
    await typeIn('#task-capacity', '6', 100); 
    await moveCursorTo('#btn-admin-publish');
    const deployBtn = document.querySelector('#btn-admin-publish');
    deployBtn.classList.add('tut-click-blink');
    await wait(500);
    deployBtn.click(); 
    deployBtn.classList.remove('tut-click-blink');

    await wait(2000);
    cursor.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runTutorialDemo, 3000); 
});
// #endregion