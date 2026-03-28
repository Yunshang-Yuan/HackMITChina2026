// #region [01] Global Configuration & Constants (全局配置与常量)
const API_BASE_URL = "/api";

const brutSwalObj = {
    customClass: { 
        popup: 'brut-modal', 
        confirmButton: 'btn btn-brut btn-brut-red mx-2', 
        cancelButton: 'btn btn-brut mx-2' 
    },
    buttonsStyling: false
};
// #endregion

// #region [02] Theme & Visual Mode Control (主题与视觉模式控制)
const themeBtn = document.getElementById('btn-theme-toggle');

if (localStorage.getItem('sys-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
} else {
    themeBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';
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
});
// #endregion

// #region [03] UI Interactivity & Input Helpers (UI 交互与输入辅助)
document.querySelectorAll('.pwd-toggle').forEach(icon => {
    icon.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input.type === 'password') {
            input.type = 'text';
            this.classList.remove('bi-eye-slash-fill');
            this.classList.add('bi-eye-fill', 'text-danger');
        } else {
            input.type = 'password';
            this.classList.remove('bi-eye-fill', 'text-danger');
            this.classList.add('bi-eye-slash-fill');
        }
    });
});

document.getElementById('btn-forgot-pwd').addEventListener('click', (e) => {
    e.preventDefault();
    Swal.fire({
        ...brutSwalObj, title: 'RESET_PASSWORD', input: 'email', 
        inputLabel: 'INPUT REGISTERED EMAIL:',
        inputPlaceholder: 'user@school.edu', showCancelButton: true, 
        confirmButtonText: 'SEND CODE'
    });
});

document.getElementById('reg-role').addEventListener('change', function() {
    const studentFields = document.getElementById('student-fields-wrapper');
    const inviteLabel = document.getElementById('invite-code-label');
    
    if (this.value === 'student') {
        studentFields.style.display = 'block';
        inviteLabel.textContent = 'INVITE_CODE [学生邀请码] *';
    } else {
        studentFields.style.display = 'none';
        inviteLabel.textContent = `INVITE_CODE [${this.value.toUpperCase()} 专用邀请码] *`;
    }
});
// #endregion

// #region [04] Password Strength Engine (密码强度实时检测引擎)
document.getElementById('reg-password').addEventListener('input', function() {
    const val = this.value;
    let score = 0;
    
    if(val.length >= 8) score += 25;
    if(/[a-z]/.test(val) && /[A-Z]/.test(val)) score += 25;
    if(/\d/.test(val)) score += 25;
    if(/[^a-zA-Z0-9]/.test(val)) score += 25;

    const bar = document.getElementById('pwd-strength-bar');
    const text = document.getElementById('pwd-strength-text');

    bar.style.width = score + '%';
    if(val.length === 0) {
        bar.style.width = '0%';
        bar.className = 'progress-bar';
        text.innerHTML = 'NONE';
    } else if(score <= 25) { 
        bar.className = 'progress-bar bg-danger'; 
        text.innerHTML = '<span class="text-danger fw-bold">WEAK</span>'; 
    } else if(score <= 75) { 
        bar.className = 'progress-bar bg-warning'; 
        text.innerHTML = '<span class="text-warning fw-bold">MEDIUM</span>'; 
    } else { 
        bar.className = 'progress-bar bg-success'; 
        text.innerHTML = '<span class="text-success fw-bold">STRONG</span>'; 
    }
});
// #endregion

// #region [05] Secret Developer Access / Easter Egg (开发者秘密准入与彩蛋)
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            triggerHackerMode();
            konamiIndex = 0; 
        }
    } else {
        konamiIndex = 0; 
    }
});

function triggerHackerMode() {
    document.body.classList.add('hacker-mode'); 
    document.getElementById('sys-badge').classList.add('bg-danger', 'text-white');
    document.getElementById('sys-badge').textContent = 'SYS.OVERRIDE // GOD_MODE';
    document.getElementById('main-title').textContent = 'DEVELOPER_LOGIN';
    document.getElementById('tab-register-wrapper').style.display = 'none';
    document.getElementById('tab-login').click();
    document.getElementById('tab-login').textContent = 'DEV_ACCESS // 极客准入';

    Swal.fire({
        ...brutSwalObj, 
        title: 'GOD_MODE UNLOCKED', 
        text: 'EASTER EGG ACTIVATED. REGISTRATION DISABLED. DEVELOPER LOGIN ONLY.', 
        icon: 'success',
        background: '#0a0a0a',
        color: '#00ff00',
        customClass: { popup: 'brut-modal border-success' }
    });
}
// #endregion

// #region [06] OTP & Cooldown Logic (验证码发送与冷却控制)
let cooldownTimer = null;
let cooldownCount = 0;

document.getElementById('btn-get-code').addEventListener('click', function() {
    const email = document.getElementById('reg-email').value;
    if (!email) return Swal.fire({ ...brutSwalObj, title: 'EMAIL_REQ', text: '请先填写邮箱地址。', icon: 'warning' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return Swal.fire({ ...brutSwalObj, title: 'FORMAT_ERR', text: '邮箱格式不正确。', icon: 'error' });
    if (cooldownCount > 0) return; 

    Swal.fire({ ...brutSwalObj, title: 'CODE_SENT', text: '验证码已发送至您的邮箱，请查收。', icon: 'info' });
    
    cooldownCount = 60;
    this.disabled = true;
    this.classList.replace('btn-brut', 'btn-secondary'); 
    
    cooldownTimer = setInterval(() => {
        this.innerHTML = `WAIT (${cooldownCount}s)`;
        cooldownCount--;
        if (cooldownCount < 0) {
            clearInterval(cooldownTimer);
            this.disabled = false;
            this.classList.replace('btn-secondary', 'btn-brut');
            this.innerHTML = 'GET CODE';
        }
    }, 1000);
});
// #endregion

// #region [07] User Registration Logic (用户注册核心逻辑)
document.getElementById('btn-do-register').addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    
    const role = document.getElementById('reg-role').value;
    const realName = document.getElementById('reg-name').value;
    const engName = document.getElementById('reg-ename').value;
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const code = document.getElementById('reg-code').value;
    const pwd1 = document.getElementById('reg-password').value;
    const pwd2 = document.getElementById('reg-password-confirm').value;
    const inviteCode = document.getElementById('reg-invite-code').value;
    const isIntegrityChecked = document.getElementById('reg-integrity').checked;

    if (!realName || !username || !email || !pwd1 || !pwd2 || !code || !inviteCode) {
        return Swal.fire({ ...brutSwalObj, title: 'DATA_ERR', text: '所有必填项均不能为空。', icon: 'warning' });
    }
    if (pwd1 !== pwd2) return Swal.fire({ ...brutSwalObj, title: 'PWD_MISMATCH', text: '两次输入的密码不一致。', icon: 'error' });
    if (!isIntegrityChecked) return Swal.fire({ ...brutSwalObj, title: 'CONSENT_REQ', text: '必须同意隐私协议并承诺学术诚信！', icon: 'error' });

    let studentData = {};
    if (role === 'student') {
        studentData = {
            school: document.getElementById('reg-school').value,
            studentId: document.getElementById('reg-studentid').value,
            class: document.getElementById('reg-class').value,
        };
        for (let key in studentData) {
            if (!studentData[key]) return Swal.fire({ ...brutSwalObj, title: 'ARCHIVE_INC', text: '学生档案信息填写不完整！', icon: 'warning' });
        }
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = 'PROCESSING... <i class="bi bi-arrow-repeat"></i>';
    btn.disabled = true;

    try {
        const payload = { realName, englishName: engName, username, email, password: pwd1, role, verifyCode: code, inviteCode, ...studentData };
        
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            Swal.fire({ ...brutSwalObj, title: 'NODE CREATED', text: `注册成功！欢迎，${role}。`, icon: 'success' }).then(() => {
                document.getElementById('register-form').reset();
                document.getElementById('pwd-strength-bar').style.width = '0%';
                document.getElementById('pwd-strength-text').innerHTML = 'NONE';
                document.getElementById('tab-login').click(); 
            });
        } else {
            Swal.fire({ ...brutSwalObj, title: 'REG_FAILED', text: data.message, icon: 'error' });
        }
    } catch (error) {
        Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: '无法连接到云服务器。', icon: 'error' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
// #endregion

// #region [08] User Login Logic (用户登录核心逻辑)
document.getElementById('btn-do-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('login-remember').checked;

    if (!email || !password) return Swal.fire({ ...brutSwalObj, title: 'DATA_ERR', text: '请输入邮箱和密码。', icon: 'warning' });

    const originalText = btn.innerHTML;
    btn.innerHTML = 'VERIFYING... <i class="bi bi-arrow-repeat"></i>';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (data.success) {
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('userEmail', email);
            storage.setItem('userRole', data.role);
            storage.setItem('realName', data.realName || '未知用户');
            storage.setItem('studentId', data.studentId || 'SYS-000');
            storage.setItem('studentClass', data.studentClass || 'N/A');
            
            if(!rememberMe) localStorage.removeItem('userEmail'); 
            window.location.href = `${data.role}_dashboard.html`;
        } else {
            Swal.fire({ ...brutSwalObj, title: 'AUTH_FAILED', text: data.message, icon: 'error' });
        }
    } catch (error) {
        Swal.fire({ ...brutSwalObj, title: 'SYS_ERR', text: '无法连接到云服务器！', icon: 'error' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
// #endregion