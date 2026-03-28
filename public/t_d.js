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
// ============================================================================
// 🤖 POLARIS PROTOCOL: 全自动新手指引脚本 (应急测试版)
// ============================================================================

// 辅助工具：让脚本“休息”一段时间 (毫秒)
// 这就像剧本里的“（停顿 2 秒）”
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================= 主自动化流程 =================
// 加上 async，我们才能在里面用 await 也就是“等待”指令
async function runTutorialDemo() {
    console.log(">> 🎬 幽灵模式：演示剧本启动...");

    // 道具 1：找到你 CSS 里定义好的那个红方块 (现在它在 0,0)
    // 如果它还没加载到 HTML 里，我们手动创建一个
    let cursor = document.getElementById('ghost-cursor');
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'ghost-cursor';
        document.body.appendChild(cursor);
    }

    // --- 剧情开始 ---

    // 剧情 A: 脚本启动，先停顿 1.5 秒，给用户一个心理准备
    await wait(1500);

    // 剧情 B: 移动到 AI 助手气泡
    // 1. 找到你要点击的那个 AI 按钮（这里假设它的 ID 是 #chat-toggle）
    const aiButton = document.querySelector('#chat-toggle'); 
    
    if (aiButton) {
        // 2. 计算这个按钮在屏幕上的精确位置
        const rect = aiButton.getBoundingClientRect();
        
        // 3. 命令红方块：飞过去！(飞到按钮的中心点)
        // 这一步会触发 CSS 的 transition，产生滑动的动画效果
        cursor.style.left = (rect.left + rect.width / 2 - 12) + 'px'; 
        cursor.style.top = (rect.top + rect.height / 2 - 12) + 'px';
        
        // 4. “（等待 1 秒）”，等待方块滑行到位
        await wait(1000);
        
        // 5. 模拟高亮反馈 (闪烁两下)
        aiButton.classList.add('tut-click-blink');
        await wait(600); 

        // 剧情 C: 真实点击！
        // 这一步会真实地触发你之前写的点击事件，打开 AI 对话框
        aiButton.click(); 
        console.log(">> 🤖 幽灵鼠标：已真实点击 AI 助手气泡。");
        
        // 清理高亮样式
        aiButton.classList.remove('tut-click-blink');
    } else {
        console.error(">> ❌ 报错：找不到 ID 为 #chat-toggle 的 AI 按钮，剧情无法推进。");
    }

    // --- 后续剧情预留位置 ---
    // 你可以在这里继续加 wait() 和 moveCursorTo() 来演示 Hub、数据中心等。

    // 演示结束：2 秒后抹除幽灵鼠标
    await wait(2000);
    cursor.remove();
    console.log(">> 🎬 幽灵模式：演示剧本结束。");
}

// ================= 全自动启动器 =================
// ⚠️ 测试用：网页加载完成后，自动运行演示
// 如果你想手动启动，就在控制台里输入 runTutorialDemo()
document.addEventListener('DOMContentLoaded', () => {
    // 先停顿 3 秒，防止跟页面初始化逻辑冲突
    setTimeout(runTutorialDemo, 3000); 
});