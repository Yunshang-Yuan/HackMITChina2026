// ================= 全局配置与最高权限校验 =================
const API_BASE_URL = "/api";
const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');

// 专属重工业暗黑弹窗配置 (去掉绿色，改为黑白灰红对比)
const devSwalObj = {
    background: '#1a1a1a', 
    color: '#e0e0e0',
    customClass: { 
        popup: 'brut-modal border border-light border-2', 
        confirmButton: 'btn btn-brut mx-2 bg-light text-dark border-light', 
        cancelButton: 'btn btn-brut mx-2 bg-transparent text-light border-secondary' 
    },
    buttonsStyling: false
};

// 铁血权限校验
document.addEventListener('DOMContentLoaded', () => {
    if (userRole !== 'developer') {
        Swal.fire({ ...devSwalObj, icon: 'error', title: 'ACCESS DENIED', text: 'FATAL ERROR: REQUIRES ROOT CLEARANCE.' }).then(() => {
            window.location.href = "login.html"; // 或者 index.html
        });
    } else {
        fetchUsersMatrix();
    }
});

// 退出登录
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "login.html";
});

// 手动刷新数据
document.getElementById('btn-refresh').addEventListener('click', fetchUsersMatrix);

// ================= 核心功能 1：拉取全量数据库 =================
async function fetchUsersMatrix() {
    const tbody = document.getElementById('users-tbody');
    document.getElementById('db-status').textContent = "PULLING FROM CLOUD...";
    
    try {
        const response = await fetch(`${API_BASE_URL}/dev/users`);
        const data = await response.json();

        if (data.success) {
            renderTable(data.users);
            document.getElementById('db-status').textContent = `LIVE. TOTAL NODES: ${data.users.length}`;
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">ERROR: ${data.message}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4 font-monospace fw-bold">CONNECTION LOST TO DATABASE.</td></tr>`;
    }
}

function renderTable(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    
    users.forEach(u => {
        const isDev = u.role === 'developer';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-uppercase">${u.role}</td>
            <td>${u.realName || 'N/A'}</td>
            <td>${u.email}</td>
            <td>${u.studentId || '--'}</td>
            <td>${u.totalCoins || 0}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-light btn-dev-action me-2" onclick="editNode('${u.email}', '${u.realName}', '${u.role}')" ${isDev ? 'disabled' : ''}>EDIT</button>
                <button class="btn btn-sm btn-outline-danger btn-dev-action" onclick="deleteNode('${u.email}')" ${isDev ? 'disabled' : ''}>DEL</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= 核心功能 2：修改数据节点 =================
async function editNode(email, currentName, currentRole) {
    const { value: formValues } = await Swal.fire({
        ...devSwalObj,
        title: 'OVERRIDE_NODE',
        html: `
            <div class="text-start font-monospace small">
                <label class="mb-1 text-muted">TARGET_EMAIL:</label>
                <input id="swal-email" class="form-control brut-input bg-dark text-muted border-secondary mb-3" value="${email}" disabled>
                
                <label class="mb-1 text-light">OVERRIDE_REAL_NAME:</label>
                <input id="swal-name" class="form-control brut-input bg-black text-white border-light mb-3" value="${currentName}">
                
                <label class="mb-1 text-light">OVERRIDE_ROLE:</label>
                <select id="swal-role" class="form-select brut-input bg-black text-white border-light">
                    <option value="student" ${currentRole==='student'?'selected':''}>STUDENT</option>
                    <option value="teacher" ${currentRole==='teacher'?'selected':''}>TEACHER</option>
                    <option value="admin" ${currentRole==='admin'?'selected':''}>ADMIN</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'EXECUTE_UPDATE',
        preConfirm: () => {
            return {
                realName: document.getElementById('swal-name').value,
                role: document.getElementById('swal-role').value
            }
        }
    });

    if (formValues) {
        try {
            const response = await fetch(`${API_BASE_URL}/dev/users/${email}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            const data = await response.json();
            
            if (data.success) {
                Swal.fire({...devSwalObj, title: 'NODE_UPDATED', icon: 'success', timer: 1500, showConfirmButton: false});
                fetchUsersMatrix();
            } else {
                Swal.fire({...devSwalObj, title: 'UPDATE_FAILED', text: data.message, icon: 'error'});
            }
        } catch (error) {
            Swal.fire({...devSwalObj, title: 'SYS_ERR', text: 'CONNECTION_FAILED', icon: 'error'});
        }
    }
}

// ================= 核心功能 3：抹除数据节点 =================
async function deleteNode(email) {
    const result = await Swal.fire({
        ...devSwalObj,
        title: 'TERMINATE_NODE?',
        text: `WARNING: This action will permanently delete user [${email}]. Data cannot be recovered.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONFIRM_DELETE',
        confirmButtonColor: '#ff473e',
        customClass: { 
            popup: 'brut-modal border border-danger border-3', 
            confirmButton: 'btn btn-brut mx-2 border-danger bg-danger text-white',
            cancelButton: 'btn btn-brut mx-2 border-secondary bg-transparent text-light'
        }
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE_URL}/dev/users/${email}`, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                Swal.fire({...devSwalObj, title: 'NODE_TERMINATED', icon: 'success', timer: 1500, showConfirmButton: false});
                fetchUsersMatrix();
            } else {
                Swal.fire({...devSwalObj, title: 'TERMINATE_FAILED', text: data.message, icon: 'error'});
            }
        } catch (error) {
            Swal.fire({...devSwalObj, title: 'SYS_ERR', text: 'CONNECTION_FAILED', icon: 'error'});
        }
    }
}