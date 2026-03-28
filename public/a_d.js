// ================= ADMIN 业务逻辑 (已瘦身) =================
let globalStudentRecordsCache = [];

// 1. 权限校验 (变量直接从 global.ui.js 继承)
if (!userEmail || userRole !== 'admin') {
    Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '无管理员权限。' }).then(() => { window.location.href = "login.html"; });
} else {
    loadPendingTasks();
}

// 2. 初始化发布任务的雷达图 (调用全局方法)
initGlobalRadarChart('radarChart');

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

// ================= 核心业务 API =================
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

// 志愿补录审核
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

// 官方任务发布
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

// 其他加载数据的 API 保持原样
async function loadMyTasks() {const tbody = document.getElementById('my-tasks-body');
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
    } catch (error) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }}
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
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED.</td></tr>'; }}
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
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }};
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
            loadAssessRecords(); 
        } else Swal.fire({ ...brutSwalObj, title: 'ERR', text: data.message, icon: 'error' });
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }});
window.markAnomaly = async function(recordId) {
    const res = await Swal.fire({ ...brutSwalObj, title: 'FLAG AS ANOMALY?', icon: 'warning', showCancelButton: true });
    if(!res.isConfirmed) return;
    const { value: reason } = await Swal.fire({ ...brutSwalObj, title: 'REASON', input: 'text', showCancelButton: true });
    try {
        const response = await fetch(`${API_BASE_URL}/teacher/mark-anomaly`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, reason: reason||"N/A" }) });
        const data = await response.json();
        if (data.success) { Toast.fire({ icon: 'success', title: 'FLAGGED.' }); loadAssessRecords(); }
    } catch (error) { Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: 'CONNECTION LOST.', icon: 'error' }); }};
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
    } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger font-monospace fw-bold">FETCH FAILED (WAITING FOR API).</td></tr>'; }}
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

// ============================================================================
// 🤖 POLARIS PROTOCOL: 官方任务发布全自动演示脚本
// ============================================================================

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 移动鼠标的引擎
async function moveCursorTo(selector, offsetX = 10, offsetY = 10) {
    const el = document.querySelector(selector);
    if (!el) { console.warn('找不到元素:', selector); return; }
    const rect = el.getBoundingClientRect();
    const cursor = document.getElementById('ghost-cursor');
    cursor.style.left = (rect.left + rect.width / 2 + offsetX) + 'px';
    cursor.style.top = (rect.top + rect.height / 2 + offsetY) + 'px';
    await wait(800); // 等待 CSS 动画滑过去
}

// 打字机引擎
async function typeIn(selector, text, speed = 50) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.value = '';
    el.focus();
    for (let i = 0; i < text.length; i++) {
        el.value += text[i];
        await wait(speed);
    }
}

// 拖拽滑块并触发雷达图更新的引擎
async function setSliderValue(selector, value) {
    const slider = document.querySelector(selector);
    if (!slider) return;
    slider.value = value;
    // ⚠️ 极其关键：必须派发 input 事件，你的图表和计算公式才会知道值变了！
    slider.dispatchEvent(new Event('input', { bubbles: true })); 
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(300); // 稍微停顿，感受拉动的过程
}

// ---------------- 主线剧情开始 ----------------
async function runTutorialDemo() {
    console.log(">> 🎬 幽灵模式：演示剧本启动...");

    // 1. 生成幽灵鼠标
    let cursor = document.getElementById('ghost-cursor');
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'ghost-cursor';
        document.body.appendChild(cursor);
    }

    await wait(1000);

    // 2. 模拟点击左侧菜单 (如果需要的话)
    await moveCursorTo('.nav-link.active'); 
    
    // 3. 填写标题和敷衍的描述
    await moveCursorTo('#task-title');
    await typeIn('#task-title', '校园开放日志愿引导', 80);
    
    await moveCursorTo('#task-desc');
    await typeIn('#task-desc', '帮忙发传单，给新生带路，很简单的。', 80);

    // 4. 召唤 AI 扩写
    const aiBtnSelector = '#btn-ai-refine';
    await moveCursorTo(aiBtnSelector);
    const aiBtn = document.querySelector(aiBtnSelector);
    aiBtn.classList.add('tut-click-blink');
    await wait(400);
    aiBtn.click(); // 真实点击！触发你的后端 DeepSeek 接口
    aiBtn.classList.remove('tut-click-blink');

    // ⚠️ 悬停等待 AI 思考（大概需要 3-5 秒，看你网络）
    // 这个期间你的界面应该会显示“正在施展魔法...”，效果极佳
    await wait(4500); 

    // 5. 填写时间和时长
    document.querySelector('#task-start').value = "2026-05-01T08:00";
    document.querySelector('#task-end').value = "2026-05-01T12:00";
    await moveCursorTo('#task-time');
    await typeIn('#task-time', '4', 100);
    document.querySelector('#task-time').dispatchEvent(new Event('input')); // 触发保底心币的重算

    // 6. 炫技时间：雷达图能力校准
    // 幽灵鼠标假装移到雷达图区域
    await moveCursorTo('#dim1', -50, 0); 
    await wait(500);
    
    // 依次给五个维度打分，你会看到雷达图随之疯狂变形！
    await setSliderValue('#dim1', 4); // EXEC 执行力
    await setSliderValue('#dim2', 3); // TEAM 团队协作
    await setSliderValue('#dim3', 5); // COMM 沟通能力
    await setSliderValue('#dim4', 2); // LEAD 领导力
    await setSliderValue('#dim5', 3); // INNO 创新力
    await wait(1000);

    // 7. 填写招募人数
    await moveCursorTo('#task-capacity');
    await typeIn('#task-capacity', '15', 100);

    // 8. 最终部署
    await moveCursorTo('#btn-admin-publish');
    const deployBtn = document.querySelector('#btn-admin-publish');
    deployBtn.classList.add('tut-click-blink');
    await wait(500);
    deployBtn.click(); // 触发真实提交！
    deployBtn.classList.remove('tut-click-blink');

    // 剧终散场
    await wait(2000);
    cursor.remove();
    console.log(">> 🎬 演示完成！");
}

// 网页加载后 3 秒自动开始
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runTutorialDemo, 3000); 
});