    const API_BASE_URL = "http://106.14.147.100:3000/api";
        const userEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole');

        let globalStudentRecordsCache = []; // 缓存学生记录，供弹窗使用

        if (!userEmail || userRole !== 'teacher') {
            alert("⚠️ 权限拦截：您未登录或没有教师权限！");
            window.location.href = "login.html";
        } else {
            document.getElementById('user-email-display').textContent = userEmail.split('@')[0];
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
                        backgroundColor: 'rgba(255, 193, 7, 0.4)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        pointBackgroundColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 2,
                    }]
                },
                options: {
                    scales: {
                        r: { min: 0, max: 5, angleLines: { color: 'rgba(0,0,0,0.1)' }, grid: { color: 'rgba(0,0,0,0.1)' }, pointLabels: { font: { size: 12, weight: 'bold' } }, ticks: { stepSize: 1, display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
        initRadarChart();

        const sliders = document.querySelectorAll('.dim-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                document.getElementById(`val-${e.target.id}`).textContent = e.target.value;
                const values = [
                    document.getElementById('dim1').value, document.getElementById('dim2').value,
                    document.getElementById('dim3').value, document.getElementById('dim4').value, document.getElementById('dim5').value
                ];
                radarChart.data.datasets[0].data = values;
                radarChart.update();
            });
        });

        // ==========================================
        // 导航切换逻辑
        // ==========================================
        const navIds = ['nav-publish', 'nav-manage', 'nav-audit'];
        const secIds = ['section-publish', 'section-manage', 'section-audit'];
        
        function switchTab(activeNavId) {
            navIds.forEach((nid, idx) => {
                const nav = document.getElementById(nid);
                const sec = document.getElementById(secIds[idx]);
                if (nid === activeNavId) {
                    nav.classList.add('active', 'bg-warning', 'text-dark');
                    nav.classList.remove('text-white');
                    sec.classList.add('active');
                } else {
                    nav.classList.remove('active', 'bg-warning', 'text-dark');
                    nav.classList.add('text-white');
                    sec.classList.remove('active');
                }
            });
        }

        document.getElementById('nav-publish').addEventListener('click', (e) => { e.preventDefault(); switchTab('nav-publish'); document.getElementById('top-title').textContent = "工作台 / 发布任务"; });
        
        document.getElementById('nav-manage').addEventListener('click', (e) => { e.preventDefault(); switchTab('nav-manage'); document.getElementById('top-title').textContent = "工作台 / 任务进度管理"; loadMyTasks(); });
        
        // 🚀 激活审核结算菜单的点击事件
        document.getElementById('nav-audit').addEventListener('click', (e) => { 
            e.preventDefault(); 
            switchTab('nav-audit'); 
            document.getElementById('top-title').textContent = "工作台 / 学生考核与结算"; 
            loadAuditRecords(); // 拉取学生记录
        });

        // ==========================================
        // 发布任务
        // ==========================================
        document.getElementById('btn-submit-task').addEventListener('click', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('task-start').value;
            const endDate = document.getElementById('task-end').value;
            if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) return alert("⚠️ 任务的时间填写不合法哦！");

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
                    alert("✅ " + data.message);
                    document.getElementById('task-publish-form').reset();
                    radarChart.data.datasets[0].data = [0,0,0,0,0]; radarChart.update();
                    document.querySelectorAll('.dim-slider').forEach(s => document.getElementById(`val-${s.id}`).textContent = 0);
                    document.getElementById('nav-manage').click();
                } else alert("发布失败：" + data.message);
            } catch (error) { alert("无法连接到云服务器！"); }
        });

        // ==========================================
        // 拉取发布的任务
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
                        let statusBadge = task.status === 'pending_audit' ? `<span class="badge bg-warning text-dark">待上架审核</span>` :
                                          task.status === 'published' ? `<span class="badge bg-success">进行中</span>` :
                                          task.status === 'settling' ? `<span class="badge bg-info text-dark">进入结算期</span>` : `<span class="badge bg-danger">已驳回</span>`;
                        
                        tbody.innerHTML += `<tr>
                            <td class="fw-bold">${task.title}</td>
                            <td><span class="text-primary fw-bold">${task.duration}h</span> / 保底 <i class="bi bi-coin text-warning"></i>${task.baseCoins}</td>
                            <td class="text-muted small">${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td>${statusBadge}</td>
                        </tr>`;
                    });
                } else tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">您还没有发布过任何任务哦。</td></tr>';
            } catch (error) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">加载失败，请检查网络。</td></tr>'; }
        }

        // ==========================================
        // 🚀 核心控制台：拉取并渲染学生的结算考核列表
        // ==========================================
        async function loadAuditRecords() {
            const tbody = document.getElementById('audit-records-body');
            try {
                const response = await fetch(`${API_BASE_URL}/teacher/student-records?email=${encodeURIComponent(userEmail)}`);
                const result = await response.json();

                if (result.success && result.data.length > 0) {
                    globalStudentRecordsCache = result.data; // 存入缓存供弹窗使用
                    tbody.innerHTML = '';
                    
                    result.data.forEach(record => {
                        const task = record.taskId; 
                        if(!task) return; 

                        let statusHtml = "";
                        let actionHtml = "";
                        
                        // 收益统计文字
                        let earnText = `<span class="text-success fw-bold">${record.gainedTime}h</span> / <span class="text-warning fw-bold">${record.gainedBaseCoins + record.gainedBonusCoins}币</span>`;
                        // 如果有扣除记录，显示出来
                        if(record.deductedTime > 0) {
                            earnText += `<br><small class="text-danger">已扣除 ${record.deductedTime}h (${record.deductReason})</small>`;
                        }

                        // 根据状态判断应该出现什么按钮
                        if (record.status === 'accepted') {
                            statusHtml = `<span class="badge bg-secondary">任务进行中</span>`;
                            actionHtml = `<span class="text-muted small">不可操作</span>`;
                        } else if (record.status === 'settling') {
                            statusHtml = `<span class="badge bg-info text-dark">待交心得 (3天核减期)</span>`;
                            actionHtml = `
                                <button class="btn btn-sm btn-outline-danger me-1" onclick="deductTime('${record._id}')">扣除工时</button>
                                <button class="btn btn-sm btn-outline-dark" onclick="markAnomaly('${record._id}')">标记异常</button>
                            `;
                        } else if (record.status === 'pending_audit') {
                            statusHtml = `<span class="badge bg-primary">心得已交 (待批阅)</span>`;
                            actionHtml = `<button class="btn btn-sm btn-warning fw-bold text-dark" onclick="openReviewModal('${record._id}')">批阅发奖金</button>`;
                        } else if (record.status === 'settled') {
                            statusHtml = `<span class="badge bg-success">彻底完结</span>`;
                            actionHtml = `<span class="text-success small"><i class="bi bi-check-circle"></i> 已结算</span>`;
                        } else if (record.status === 'anomaly') {
                            statusHtml = `<span class="badge bg-danger">异常纠纷中</span>`;
                            actionHtml = `<span class="text-danger small">线下处理</span>`;
                        }

                        const row = `
                            <tr>
                                <td class="fw-bold">${record.studentEmail.split('@')[0]}</td>
                                <td class="text-muted small">${task.title}</td>
                                <td>${earnText}</td>
                                <td>${statusHtml}</td>
                                <td class="text-end pe-4">${actionHtml}</td>
                            </tr>
                        `;
                        tbody.innerHTML += row;
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">目前还没有学生接取您的任务，或任务尚未进入结算期。</td></tr>';
                }
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">加载失败，请检查网络。</td></tr>';
            }
        }

        // ==========================================
        // 🚀 教师动作 1：扣除工时
        // ==========================================
        window.deductTime = async function(recordId) {
            const hours = parseFloat(prompt("你要扣除该学生几小时的工时？(请输入数字)"));
            if (isNaN(hours) || hours <= 0) return;
            
            const reason = prompt("请输入扣除理由 (必填，如：迟到早退/摸鱼)：");
            if (!reason) return alert("必须填写扣除理由！");

            try {
                const response = await fetch(`${API_BASE_URL}/teacher/deduct-time`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId, deductHours: hours, reason })
                });
                const data = await response.json();
                alert(data.success ? "✅ " + data.message : "⚠️ " + data.message);
                if (data.success) loadAuditRecords(); 
            } catch (error) { alert("无法连接到云服务器！"); }
        };

        // ==========================================
        // 🚀 教师动作 2：打开批阅弹窗并发奖金
        // ==========================================
        window.openReviewModal = function(recordId) {
            // 从缓存里找到这条数据
            const record = globalStudentRecordsCache.find(r => r._id === recordId);
            if (!record) return;

            // 把数据填入弹窗
            document.getElementById('modal-reflection-text').textContent = record.reflection;
            document.getElementById('modal-max-bonus').textContent = record.taskId.baseCoins;
            document.getElementById('modal-bonus-input').value = 0; // 默认给0分
            
            // 把 ID 藏进隐藏的 input 里，供提交按钮使用
            document.getElementById('modal-current-record-id').value = recordId;

            // 呼出弹窗
            const myModal = new bootstrap.Modal(document.getElementById('reviewModal'));
            myModal.show();
        };

        // 处理弹窗里的“发放奖励并完结”按钮
        document.getElementById('btn-submit-review').addEventListener('click', async () => {
            const recordId = document.getElementById('modal-current-record-id').value;
            const bonusAmount = parseInt(document.getElementById('modal-bonus-input').value) || 0;

            try {
                const response = await fetch(`${API_BASE_URL}/teacher/award-bonus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId, bonusAmount })
                });
                const data = await response.json();
                
                if (data.success) {
                    alert("🎉 " + data.message);
                    // 关闭弹窗
                    const myModalEl = document.getElementById('reviewModal');
                    const modal = bootstrap.Modal.getInstance(myModalEl);
                    modal.hide();
                    
                    loadAuditRecords(); // 刷新表格，看着它变绿！
                } else {
                    alert("⚠️ 提交失败：" + data.message);
                }
            } catch (error) { alert("无法连接到云服务器！"); }
        });

        // ==========================================
        // 🚀 教师动作 3：标记异常
        // ==========================================
        window.markAnomaly = async function(recordId) {
            if(!confirm("确定要将该记录挂起为异常吗？这会停止一切自动结算，并将案件转入线下纠纷处理。")) return;
            const reason = prompt("请输入标记异常的原因：") || "未填原因";
            try {
                const response = await fetch(`${API_BASE_URL}/teacher/mark-anomaly`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId, reason })
                });
                const data = await response.json();
                alert(data.success ? "✅ " + data.message : "⚠️ " + data.message);
                if (data.success) loadAuditRecords(); 
            } catch (error) { alert("无法连接到云服务器！"); }
        };

        // 退出登录
        document.getElementById('btn-logout').addEventListener('click', () => {
            if(confirm("确定退出？")) { localStorage.clear(); window.location.href = 'login.html'; }
        });