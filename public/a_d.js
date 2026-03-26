        const API_BASE_URL = "http://106.14.147.100:3000/api";
        const userEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole');
        let globalStudentRecordsCache = [];

        // 1. 权限守卫
        if (!userEmail || userRole !== 'admin') {
            alert("⚠️ 权限拦截：您未登录或没有管理员权限！");
            window.location.href = "login.html";
        } else {
            document.getElementById('user-email-display').textContent = userEmail.split('@')[0];
            loadPendingTasks(); // 初始加载待办列表
        }

        // ==========================================
        // 雷达图引擎 (Chart.js)
        // ==========================================
        let radarChart;
        const ctx = document.getElementById('radarChart').getContext('2d');
        function initRadarChart() {
            radarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['执行力', '团队协作', '沟通表达', '领导力', '创新思维'],
                    datasets: [{
                        label: '能力维度要求',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(220, 53, 69, 0.4)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        pointBackgroundColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2,
                    }]
                },
                options: {
                    scales: { r: { min: 0, max: 5, angleLines: { color: 'rgba(0,0,0,0.1)' }, grid: { color: 'rgba(0,0,0,0.1)' }, pointLabels: { font: { size: 12, weight: 'bold' } }, ticks: { stepSize: 1, display: false } } },
                    plugins: { legend: { display: false } }
                }
            });
        }
        initRadarChart();

        const sliders = document.querySelectorAll('.dim-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                document.getElementById(`val-${e.target.id}`).textContent = e.target.value;
                const values = [ document.getElementById('dim1').value, document.getElementById('dim2').value, document.getElementById('dim3').value, document.getElementById('dim4').value, document.getElementById('dim5').value ];
                radarChart.data.datasets[0].data = values;
                radarChart.update();
            });
        });

        // ==========================================
        // 导航切换逻辑 (重构以支持 4 个菜单)
        // ==========================================
        const navIds = ['nav-pending', 'nav-publish', 'nav-manage', 'nav-assess'];
        const secIds = ['section-pending', 'section-publish', 'section-manage', 'section-assess'];
        const titles = ["工作台 / 待办审批", "工作台 / 发布官方任务", "工作台 / 官方任务进度", "工作台 / 官方考核结算"];
        
        function switchTab(activeIndex) {
            navIds.forEach((nid, idx) => {
                const nav = document.getElementById(nid);
                const sec = document.getElementById(secIds[idx]);
                if (idx === activeIndex) {
                    nav.classList.add('active', 'bg-success', 'text-white');
                    nav.classList.remove('text-white');
                    sec.classList.add('active');
                    document.getElementById('top-title').textContent = titles[idx];
                } else {
                    nav.classList.remove('active', 'bg-success', 'text-white');
                    nav.classList.add('text-white');
                    sec.classList.remove('active');
                }
            });
        }

        document.getElementById('nav-pending').addEventListener('click', (e) => { e.preventDefault(); switchTab(0); loadPendingTasks(); });
        document.getElementById('nav-publish').addEventListener('click', (e) => { e.preventDefault(); switchTab(1); });
        document.getElementById('nav-manage').addEventListener('click', (e) => { e.preventDefault(); switchTab(2); loadMyTasks(); });
        document.getElementById('nav-assess').addEventListener('click', (e) => { e.preventDefault(); switchTab(3); loadAssessRecords(); });

        // ==========================================
        // API 引擎 A：拉取全校待办审批 (Admin 核心特权)
        // ==========================================
        async function loadPendingTasks() {
            const tbody = document.getElementById('pending-table-body');
            try {
                const response = await fetch(`${API_BASE_URL}/admin/pending-tasks`);
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    document.getElementById('pending-count').textContent = result.data.length;
                    tbody.innerHTML = ''; 
                    result.data.forEach(task => {
                        const date = new Date(task.createdAt).toLocaleString();
                        tbody.innerHTML += `
                            <tr>
                                <td class="ps-4 fw-bold">${task.publisherEmail || '未知'}</td>
                                <td><span class="badge bg-warning text-dark me-1">待审</span> ${task.title}</td>
                                <td class="fw-bold text-primary">${task.duration}h / <i class="bi bi-coin text-warning"></i>${task.baseCoins}</td>
                                <td>${task.capacity} 人</td>
                                <td class="text-muted small">${date}</td>
                                <td class="text-end pe-4">
                                    <button class="btn btn-sm btn-outline-danger me-1" onclick="handleAudit('${task._id}', 'reject')"><i class="bi bi-x"></i> 驳回</button>
                                    <button class="btn btn-sm btn-success" onclick="handleAudit('${task._id}', 'approve')"><i class="bi bi-check2"></i> 通过</button>
                                </td>
                            </tr>
                        `;
                    });
                } else {
                    document.getElementById('pending-count').textContent = "0";
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">🎉 太棒了！当前没有任何待办任务。</td></tr>';
                }
            } catch (error) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">加载失败，请检查网络。</td></tr>'; }
        }

        window.handleAudit = async function(taskId, action) {
            let reason = "";
            if (action === 'reject') {
                reason = prompt("请输入驳回原因 (必填)：");
                if (!reason) return; 
            } else { if(!confirm("确定要让这个任务上架到学生大厅吗？")) return; }

            try {
                const response = await fetch(`${API_BASE_URL}/admin/audit-task`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, action, reason })
                });
                const data = await response.json();
                if (data.success) { alert("✅ " + data.message); loadPendingTasks(); } 
                else { alert("⚠️ 操作失败：" + data.message); }
            } catch (error) { alert("请求出错，请检查服务器！"); }
        };

        // ==========================================
        // API 引擎 B：发布官方任务 (免审)
        // ==========================================
        document.getElementById('btn-admin-publish').addEventListener('click', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('task-start').value;
            const endDate = document.getElementById('task-end').value;
            if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) return alert("⚠️ 任务时间填写不合法！");

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
                    alert("🚀 " + data.message);
                    document.getElementById('admin-task-form').reset();
                    radarChart.data.datasets[0].data = [0,0,0,0,0]; radarChart.update();
                    document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
                    document.getElementById('nav-manage').click(); // 发完跳去进度页
                } else alert("发布失败：" + data.message);
            } catch (error) { alert("发布失败，请检查服务器。"); }
        });

        // ==========================================
        // API 引擎 C：官方任务进度管理 
        // ==========================================
        async function loadMyTasks() {
            const tbody = document.getElementById('my-tasks-body');
            try {
                const response = await fetch(`${API_BASE_URL}/teacher/my-tasks?email=${encodeURIComponent(userEmail)}`);
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    tbody.innerHTML = '';
                    result.data.forEach(task => {
                        const dateObj = new Date(task.endDate);
                        let statusBadge = task.status === 'published' ? `<span class="badge bg-success">进行中</span>` :
                                          task.status === 'settling' ? `<span class="badge bg-info text-dark">进入结算期</span>` : `<span class="badge bg-secondary">未知</span>`;
                        
                        tbody.innerHTML += `<tr>
                            <td class="fw-bold">${task.title} <span class="badge bg-danger ms-1 small">官方</span></td>
                            <td><span class="text-primary fw-bold">${task.duration}h</span> / 保底 <i class="bi bi-coin text-warning"></i>${task.baseCoins}</td>
                            <td class="text-muted small">${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td>${statusBadge}</td>
                        </tr>`;
                    });
                } else tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">您还没有发布过官方任务。</td></tr>';
            } catch (error) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">加载失败，请检查网络。</td></tr>'; }
        }

        // ==========================================
        // API 引擎 D：官方任务考核与结算台
        // ==========================================
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
                        let earnText = `<span class="text-success fw-bold">${record.gainedTime}h</span> / <span class="text-warning fw-bold">${record.gainedBaseCoins + record.gainedBonusCoins}币</span>`;
                        if(record.deductedTime > 0) earnText += `<br><small class="text-danger">已扣除 ${record.deductedTime}h (${record.deductReason})</small>`;

                        if (record.status === 'accepted') { statusHtml = `<span class="badge bg-secondary">任务进行中</span>`; actionHtml = `<span class="text-muted small">不可操作</span>`; } 
                        else if (record.status === 'settling') {
                            statusHtml = `<span class="badge bg-info text-dark">待交心得 (3天核减期)</span>`;
                            actionHtml = `<button class="btn btn-sm btn-outline-danger me-1" onclick="deductTime('${record._id}')">扣工时</button> <button class="btn btn-sm btn-outline-dark" onclick="markAnomaly('${record._id}')">标记异常</button>`;
                        } 
                        else if (record.status === 'pending_audit') {
                            statusHtml = `<span class="badge bg-primary">心得已交 (待批阅)</span>`;
                            actionHtml = `<button class="btn btn-sm btn-danger fw-bold" onclick="openReviewModal('${record._id}')">批阅发奖金</button>`;
                        } 
                        else if (record.status === 'settled') { statusHtml = `<span class="badge bg-success">彻底完结</span>`; actionHtml = `<span class="text-success small"><i class="bi bi-check-circle"></i> 已结算</span>`; } 
                        else if (record.status === 'anomaly') { statusHtml = `<span class="badge bg-danger">异常纠纷中</span>`; actionHtml = `<span class="text-danger small">线下处理</span>`; }

                        tbody.innerHTML += `<tr>
                            <td class="fw-bold">${record.studentEmail.split('@')[0]}</td>
                            <td class="text-muted small">${task.title}</td>
                            <td>${earnText}</td>
                            <td>${statusHtml}</td>
                            <td class="text-end pe-4">${actionHtml}</td>
                        </tr>`;
                    });
                } else tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">目前还没有学生接取您的官方任务。</td></tr>';
            } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">加载失败。</td></tr>'; }
        }

        window.deductTime = async function(recordId) {
            const hours = parseFloat(prompt("你要扣除该学生几小时的工时？(请输入数字)"));
            if (isNaN(hours) || hours <= 0) return;
            const reason = prompt("请输入扣除理由 (必填，如：迟到早退/摸鱼)：");
            if (!reason) return alert("必须填写扣除理由！");

            try {
                const response = await fetch(`${API_BASE_URL}/teacher/deduct-time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, deductHours: hours, reason }) });
                const data = await response.json();
                alert(data.success ? "✅ " + data.message : "⚠️ " + data.message);
                if (data.success) loadAssessRecords(); 
            } catch (error) { alert("无法连接到云服务器！"); }
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
                    alert("🎉 " + data.message);
                    bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
                    loadAssessRecords(); 
                } else alert("⚠️ 提交失败：" + data.message);
            } catch (error) { alert("无法连接到云服务器！"); }
        });

        window.markAnomaly = async function(recordId) {
            if(!confirm("确定要将该记录挂起为异常吗？")) return;
            const reason = prompt("请输入标记异常的原因：") || "未填原因";
            try {
                const response = await fetch(`${API_BASE_URL}/teacher/mark-anomaly`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId, reason }) });
                const data = await response.json();
                alert(data.success ? "✅ " + data.message : "⚠️ " + data.message);
                if (data.success) loadAssessRecords(); 
            } catch (error) { alert("无法连接！"); }
        };

        document.getElementById('btn-logout').addEventListener('click', () => {
            if(confirm("确定退出？")) { localStorage.clear(); window.location.href = 'login.html'; }
        });