        const API_BASE_URL = "http://106.14.147.100:3000/api";
        const userEmail = localStorage.getItem('userEmail');
        const userRole = localStorage.getItem('userRole');
        let globalTasksCache = []; let studentDetailChart = null; 

        // ⬛ 定制 SweetAlert 的控制局极简风格
        const brutSwalObj = {
            customClass: { popup: 'brut-modal', confirmButton: 'btn btn-brut btn-brut-red mx-2', cancelButton: 'btn btn-brut mx-2' },
            buttonsStyling: false
        };

        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
            background: 'var(--brut-black)', color: 'var(--brut-white)', customClass: { popup: 'rounded-0 border border-white' }
        });

        // ==========================================
        // 🚀 新增功能：暗黑模式逻辑引擎
        // ==========================================
        const themeBtn = document.getElementById('btn-theme-toggle');
        // 从本地存储读取用户偏好
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
            
            // 触发重新绘制雷达图以适配黑白线框反转（如果有打开的弹窗）
            if(studentDetailChart) {
                const isDark = document.body.classList.contains('dark-mode');
                studentDetailChart.options.scales.r.angleLines.color = isDark ? '#f4f4f0' : '#000000';
                studentDetailChart.options.scales.r.pointLabels.color = isDark ? '#f4f4f0' : '#000000';
                studentDetailChart.data.datasets[0].borderColor = isDark ? '#f4f4f0' : '#000000';
                studentDetailChart.data.datasets[0].pointBorderColor = isDark ? '#f4f4f0' : '#000000';
                studentDetailChart.update();
            }
        });

        // ==========================================
        // 🚀 新增功能：占位的系统设置模块
        // ==========================================
        document.getElementById('btn-settings').addEventListener('click', () => {
            Swal.fire({
                ...brutSwalObj,
                title: 'SYS.SETTINGS',
                text: 'MODULE UNDER CONSTRUCTION (系统配置模块施工中，准备接入后续扩展功能)',
                icon: 'info',
                confirmButtonText: 'ACKNOWLEDGE'
            });
        });

        if (!userEmail || userRole !== 'student') {
            Swal.fire({ ...brutSwalObj, icon: 'error', title: 'ACCESS DENIED', text: '未授权的访问请求。' }).then(() => { window.location.href = "login.html"; });
        } else {
            document.getElementById('user-email-display').textContent = userEmail.split('@')[0];
            loadUserProfile(); loadTasks();       
        }

        async function loadUserProfile() {
            try {
                const response = await fetch(`${API_BASE_URL}/student/profile?email=${encodeURIComponent(userEmail)}`);
                const result = await response.json();
                if (result.success) {
                    document.getElementById('stat-time').textContent = result.data.totalTime;
                    document.getElementById('stat-coins').textContent = result.data.totalCoins;
                    document.getElementById('stat-rep-score').textContent = result.data.reputationScore;
                    document.getElementById('stat-active').textContent = result.data.activeTasks;
                    document.getElementById('stat-rep-badge').textContent = result.data.reputationText;
                    if(result.data.reputationScore < 80) document.getElementById('stat-rep-badge').classList.add('bg-danger', 'text-white');
                }
            } catch (error) { console.error("FETCH ERROR:", error); }
        }

        document.getElementById('nav-hub').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('nav-hub').classList.add('active'); document.getElementById('nav-my-tasks').classList.remove('active');
            document.getElementById('section-hub').classList.add('active'); document.getElementById('section-my-tasks').classList.remove('active');
            document.getElementById('top-title').textContent = "TERMINAL // 任务大厅"; loadTasks();
        });

        document.getElementById('nav-my-tasks').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('nav-my-tasks').classList.add('active'); document.getElementById('nav-hub').classList.remove('active');
            document.getElementById('section-my-tasks').classList.add('active'); document.getElementById('section-hub').classList.remove('active');
            document.getElementById('top-title').textContent = "TERMINAL // 个人进程"; loadMyRecords();
        });

        async function loadTasks() {
            const container = document.getElementById('task-list');
            try {
                const response = await fetch(`${API_BASE_URL}/tasks`);
                const result = await response.json();
                if (!result.success || result.data.length === 0) {
                    container.innerHTML = '<p class="font-monospace fw-bold text-muted">NO TASKS AVAILABLE AT THIS MOMENT.</p>'; return;
                }
                globalTasksCache = result.data; container.innerHTML = ''; 

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

            // 根据当前模式动态决定雷达图的主题色
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
                const modal = bootstrap.Modal.getInstance(document.getElementById('taskDetailModal')); modal.hide();
                acceptTask(taskId); 
            };
            new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
        };

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

        async function loadMyRecords() {
            const tbody = document.getElementById('my-records-body');
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/my?email=${encodeURIComponent(userEmail)}`);
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    tbody.innerHTML = '';
                    result.data.forEach(record => {
                        const task = record.taskId; if(!task) return; 
                        const date = new Date(record.createdAt).toLocaleDateString().replace(/\//g,'-');
                        let statusHtml = "", actionHtml = "";

                        if (record.status === 'settled') {
                            statusHtml = `<span class="badge bg-dark rounded-0 fw-bold border border-dark" style="color: var(--brut-white);">COMPLETED</span>`; actionHtml = `<span class="fw-black">+${record.gainedTime}H / +${record.gainedBaseCoins + record.gainedBonusCoins}C</span>`;
                        } else if (record.status === 'pending_audit') {
                            statusHtml = `<span class="badge bg-light text-dark rounded-0 fw-bold border border-dark">AWAITING_REVIEW</span>`; actionHtml = `<span class="font-monospace small fw-bold text-muted">AWAITING ADMIN</span>`;
                        } else if (record.status === 'anomaly') {
                            statusHtml = `<span class="badge bg-danger text-white rounded-0 fw-bold border border-dark">SYS_ANOMALY</span>`; actionHtml = `<span class="font-monospace small fw-bold text-danger">CONTACT ADMIN</span>`;
                        } else if (record.status === 'settling') {
                            statusHtml = `<span class="badge bg-warning text-dark rounded-0 fw-bold border border-dark">REQ_LOGS</span>`; actionHtml = `<button class="btn btn-sm btn-brut py-1" onclick="submitReflection('${record._id}')">UPLOAD LOG</button>`;
                        } else {
                            statusHtml = `<span class="badge bg-white text-dark rounded-0 fw-bold border border-dark">ACTIVE</span>`; actionHtml = `<span class="font-monospace small fw-bold text-muted">IN PROGRESS</span>`;
                        }
                        tbody.innerHTML += `<tr><td class="fw-black text-uppercase">${task.title}</td><td class="fw-black">${task.duration}H / <span class="text-danger">${task.baseCoins}C</span></td><td class="font-monospace small fw-bold">${date}</td><td>${statusHtml}</td><td class="text-end pe-4">${actionHtml}</td></tr>`;
                    });
                } else { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 font-monospace fw-bold text-muted">NO LOGS FOUND.</td></tr>'; }
            } catch (error) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger fw-black font-monospace">DATA FETCH FAILED.</td></tr>'; }
        }

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

        document.getElementById('btn-logout').addEventListener('click', async () => {
            const result = await Swal.fire({ ...brutSwalObj, title: 'TERMINATE SESSION?', icon: 'warning', showCancelButton: true, confirmButtonText: 'TERMINATE', cancelButtonText: 'CANCEL' });
            if (result.isConfirmed) { localStorage.clear(); window.location.href = 'login.html'; }
        });