// Bootstrap主题切换：深浅色模式切换、图标更新、本地存储持久化
const themeSwitcher = document.getElementById('themeSwitcher');
const htmlElement = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'light';
htmlElement.setAttribute('data-bs-theme', savedTheme);
updateThemeIcon(savedTheme);

themeSwitcher.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    if (theme === 'dark') {
        themeSwitcher.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
        themeSwitcher.classList.add('text-warning');
    } else {
        themeSwitcher.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
        themeSwitcher.classList.remove('text-warning');
    }
}

// 全局接口配置：后端API基础地址
const API_BASE_URL = "http://106.14.147.100:3000/api";

// 用户注册功能：表单校验、注册接口请求、状态提示
document.getElementById('btn-do-register').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;

    if (!email || !password) {
        alert("邮箱和密码不能为空哦！");
        return;
    }

    const btn = e.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 处理中...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();

        if (data.success) {
            alert(`注册成功！欢迎你，${role}。现在去登录吧！`);
            document.getElementById('tab-login').click(); 
        } else {
            alert("注册失败：" + data.message);
        }
    } catch (error) {
        console.error("注册请求报错:", error);
        alert("无法连接到云服务器，请检查后端是否启动！");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// 用户登录功能：表单校验、登录接口请求、权限跳转
document.getElementById('btn-do-login').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("请输入邮箱和密码！");
        return;
    }

    const btn = e.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 登录中...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userRole', data.role);
            window.location.href = `${data.role}_dashboard.html`;
        } else {
            alert("登录失败：" + data.message);
        }
    } catch (error) {
        console.error("登录请求报错:", error);
        alert("无法连接到云服务器，请检查网络或后端状态！");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});