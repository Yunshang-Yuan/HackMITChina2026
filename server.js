// 1. 核心依赖导入与服务初始化：引入Express/MongoDB/CORS，创建服务实例、配置端口
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000; 

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/timebank')
    .then(() => console.log('✅ 数据库连接成功！TimeBank 记忆中枢已上线！'))
    .catch((err) => console.error('❌ 数据库连接失败：', err));

// 2. 数据模型定义：创建用户、任务、任务记录三大核心数据表结构
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true },           
    role: { type: String, required: true },               
    
    // === 新增：全局实名档案 ===
    realName: { type: String, required: true },           // 真实姓名
    englishName: { type: String, default: "" },           // 英文名 (可选)
    username: { type: String, required: true },           // 系统昵称
    
    // === 新增：学生专属档案 ===
    school: { type: String, default: "" },                // 所在学校
    studentId: { type: String, default: "" },             // 学号
    studentClass: { type: String, default: "" },          // 班级 (注意：class 是JS保留字，数据库里改叫 studentClass)

    // 原有资产与时间记录字段
    totalTime: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
    title: String, desc: String, tag: String,
    duration: Number, capacity: Number, publisherEmail: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, 
    dimensions: {
        dim1: { type: Number, default: 0, min: 0, max: 5 }, 
        dim2: { type: Number, default: 0, min: 0, max: 5 }, 
        dim3: { type: Number, default: 0, min: 0, max: 5 }, 
        dim4: { type: Number, default: 0, min: 0, max: 5 }, 
        dim5: { type: Number, default: 0, min: 0, max: 5 }  
    },
    baseCoins: { type: Number, default: 0 },
    status: { type: String, default: 'pending_audit' }, 
    rejectReason: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', TaskSchema);

const TaskRecordSchema = new mongoose.Schema({
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true }, 
    studentEmail: { type: String, required: true }, 
    status: { type: String, default: 'accepted' }, 
    reflection: { type: String, default: "" }, 
    gainedTime: { type: Number, default: 0 },       
    gainedBaseCoins: { type: Number, default: 0 },  
    gainedBonusCoins: { type: Number, default: 0 }, 
    deductedTime: { type: Number, default: 0 },     
    deductReason: { type: String, default: "" },    
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});
const TaskRecord = mongoose.model('TaskRecord', TaskRecordSchema);
// --- 升级版：志愿补录数据模型 ---
const RetroEntrySchema = new mongoose.Schema({
    studentEmail: { type: String, required: true },
    eventName: { type: String, required: true },
    hours: { type: Number, required: true },
    evidence: { type: String, required: true },
    reflection: { type: String, default: "无心得记录" }, // 新增：保存学生提交的心得
    earnedCoins: { type: Number, default: 0 },         // 新增：记录这笔补录最终发了多少心币
    status: { type: String, default: 'pending_audit' }, 
    createdAt: { type: Date, default: Date.now },
    auditedAt: { type: Date }
});
const RetroEntry = mongoose.model('RetroEntry', RetroEntrySchema);

// 3. 基础身份接口：服务状态检测、用户注册、登录验证
app.get('/api/status', (req, res) => {
    res.json({ message: "🚀 Polaris 11319 后端引擎全速运转中！" });
});

// ================= 注册接口 (支持全量信息写入) =================
app.post('/api/register', async (req, res) => {
    try {
        // 接收前端传过来的所有新字段 (注意把前端传的 class 重命名为 studentClass)
        const { email, password, role, realName, englishName, username, school, studentId, class: studentClass } = req.body;
        
        const existingUser = await User.findOne({ email: email });
        if (existingUser) return res.status(400).json({ success: false, message: "这个邮箱已经被注册过啦！" });

        // [预留位置：后续在这里加入验证码比对、学号防撞校验、邀请码校验]

        // 写入数据库
        const newUser = new User({ 
            email, password, role, 
            realName, englishName, username, 
            school, studentId, studentClass 
        });
        await newUser.save();
        res.json({ success: true, message: `注册成功！欢迎你，${role}` });
    } catch (error) {
        console.error("注册报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

// ================= 登录接口 (附带开发者 GOD MODE 后门，新增档案下发) =================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 👾 开发者神之模式后门
        if (email === 'dev@polaris.sys' && password === '11319') {
            console.log("⚠️ [SECURITY_ALERT] DEVELOPER GOD MODE ACCESSED.");
            return res.json({ 
                success: true, message: "GOD_MODE UNLOCKED", role: "developer",
                realName: "SYS.ARCHITECT", studentId: "DEV-00", studentClass: "ROOT"
            });
        }

        // 普通用户的正常数据库比对流程
        const user = await User.findOne({ email: email, password: password });
        if (!user) return res.status(401).json({ success: false, message: "账号或密码错误！" });

        // 👇 核心改动：登录成功时，把名字、学号、班级一起打包发给前端
        res.json({ 
            success: true, message: "登录成功", 
            role: user.role, 
            realName: user.realName, 
            studentId: user.studentId,
            studentClass: user.studentClass
        });
    } catch (error) {
        console.error("登录报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

// 4. 学生个人数据接口：获取时长、心币、信誉分、活跃任务等个人信息 (新增档案下发)
app.get('/api/student/profile', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "缺少邮箱参数" });

        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).json({ success: false, message: "用户不存在" });

        const settledCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'settled' });
        const anomalyCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'anomaly' });
        
        let reputationScore = 100 + (settledCount * 2) - (anomalyCount * 10);
        let reputationText = "良好";
        let badgeColor = "bg-success";
        
        if (reputationScore >= 110) {
            reputationText = "极佳";
            badgeColor = "bg-primary";
        } else if (reputationScore < 90) {
            reputationText = "危险";
            badgeColor = "bg-danger";
        }

        const activeCount = await TaskRecord.countDocuments({ 
            studentEmail: email, 
            status: { $in: ['accepted', 'settling', 'pending_audit'] } 
        });

        res.json({
            success: true,
            data: {
                // 👇 核心改动：把刚查到的真实档案加进返回列表
                realName: user.realName,
                studentId: user.studentId,
                studentClass: user.studentClass,
                // 原有字段
                totalTime: user.totalTime,
                totalCoins: user.totalCoins,
                reputationScore: reputationScore,
                reputationText: reputationText,
                badgeColor: badgeColor,
                activeTasks: activeCount
            }
        });
    } catch (error) {
        console.error("拉取个人数据失败:", error);
        res.status(500).json({ success: false, message: "获取数据失败" });
    }
});

// ================= 新增模块：AI 辅助中枢 (DeepSeek 引擎) =================

// 辅助函数：调用 AI API (基于 Node 18+ 原生 fetch)
// ⚠️ 注意：记得在运行前设置环境变量，或者直接替换 '你的_DEEPSEEK_API_KEY'
async function callDeepSeekAPI(userMessage, systemPrompt) {
    const apiKey = process.env.DEEPSEEK_API_KEY || '你的_DEEPSEEK_API_KEY';
    
    if (!apiKey || apiKey === '你的_DEEPSEEK_API_KEY') {
        return "[模拟回复] API Key 未配置。如果是真实环境，这里会返回 AI 生成的内容。";
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat', // 推荐使用 chat 模型，速度比 reasoner 快，适合文本处理
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ]
            })
        });

        if (!response.ok) throw new Error(`API 错误: ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('DeepSeek 调用失败:', error);
        return "AI 服务暂时开小差了，请稍后再试。";
    }
}

// 接口 1：AI 任务描述润色 (供教师/管理员发布任务时使用)
app.post('/api/ai/refine', async (req, res) => {
    try {
        const { description } = req.body;
        if (!description) return res.status(400).json({ success: false, message: "描述不能为空" });

        const systemPrompt = `你是一个专业的青年志愿服务活动策划师。请将用户输入的简短任务描述，扩写、润色为专业、清晰、富有吸引力的志愿任务招募文案。
        要求：保留原意，分点说明（如：任务目标、具体工作、注意事项），语气要鼓励、积极。直接输出结果，不要包含寒暄。`;

        const aiResponse = await callDeepSeekAPI(description, systemPrompt);
        res.json({ success: true, response: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: "AI 润色失败" });
    }
});

// 接口 2：AI 志愿心得评估 (供老师/审核员打分参考)
app.post('/api/ai/evaluate-reflection', async (req, res) => {
    try {
        // 可以传入心得内容，以及对应的任务标题和工时作为上下文
        const { reflection, taskTitle, hours } = req.body;
        if (!reflection) return res.status(400).json({ success: false, message: "心得内容不能为空" });

        const systemPrompt = `你是中学生 TimeBank 志愿服务系统的严格但公平的 AI 审核助手。
        请根据学生提交的志愿心得进行评估。
        评估标准：1. 真实性与细节；2. 情感投入与个人成长；3. 篇幅是否匹配其申请的工时长度。
        
        请严格按照以下 Markdown 格式输出：
        ### 📊 AI 评估报告
        - **建议评分 (10分制)**: [给出分数，如 8/10]
        - **评语参考**: [提供2-3句鼓励且中肯的评语，供老师直接复制使用]
        - **核心亮点**: [指出写得好的地方]
        - **扣分项/不足**: [如果没有可填"无"]`;

        const userMsg = `任务名称：${taskTitle || '未知'}\n申请工时：${hours || '未知'}小时\n学生心得：${reflection}`;
        const aiResponse = await callDeepSeekAPI(userMsg, systemPrompt);
        
        res.json({ success: true, response: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: "AI 评估失败" });
    }
});
// ============================================================================

// 5. 任务管理接口：任务发布、列表查询、审核、教师个人任务管理
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, desc, duration, capacity, tag, publisherEmail, role, startDate, endDate, dims } = req.body;
        
        const d = dims || { dim1:0, dim2:0, dim3:0, dim4:0, dim5:0 };
        const totalDimScore = (Number(d.dim1) + Number(d.dim2) + Number(d.dim3) + Number(d.dim4) + Number(d.dim5));
        const autoBaseCoins = Math.floor((duration * 10) + (totalDimScore * 2));

        const initialStatus = (role === 'admin') ? 'published' : 'pending_audit';

        const newTask = new Task({
            title, desc, duration, capacity, tag, publisherEmail, 
            startDate, endDate, 
            dimensions: d, 
            baseCoins: autoBaseCoins,
            status: initialStatus
        });
        await newTask.save();
        
        const msg = (role === 'admin') ? `官方任务已上架！自动测算保底心币为: ${autoBaseCoins} 枚` : `任务已提交审核！自动测算保底心币为: ${autoBaseCoins} 枚`;
        res.json({ success: true, message: msg });
    } catch (error) {
        console.error("发布任务报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ status: 'published' }).sort({ createdAt: -1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "服务器拉取任务失败" });
    }
});

app.get('/api/admin/pending-tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ status: 'pending_audit' }).sort({ createdAt: 1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取待审核列表失败" });
    }
});

app.post('/api/admin/audit-task', async (req, res) => {
    try {
        const { taskId, action, reason } = req.body; 
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: "任务不存在" });

        if (action === 'approve') {
            task.status = 'published'; 
            task.rejectReason = "";
        } else if (action === 'reject') {
            task.status = 'rejected';  
            task.rejectReason = reason || "不符合规范，请修改后重试";
        }
        await task.save();
        res.json({ success: true, message: action === 'approve' ? "任务已通过并上架！" : "任务已驳回！" });
    } catch (error) {
        res.status(500).json({ success: false, message: "审核处理失败" });
    }
});

app.get('/api/teacher/my-tasks', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "缺少邮箱参数" });
        const tasks = await Task.find({ publisherEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取任务进度失败" });
    }
});

// 6. 任务流转接口：学生接取任务、查询个人任务、提交任务心得
app.post('/api/tasks/accept', async (req, res) => {
    try {
        const { taskId, studentEmail } = req.body;
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: "任务不存在" });

        const existingRecord = await TaskRecord.findOne({ taskId: taskId, studentEmail: studentEmail });
        if (existingRecord) return res.status(400).json({ success: false, message: "不能重复接取哦！" });

        const newRecord = new TaskRecord({ taskId, studentEmail, status: 'accepted' });
        await newRecord.save();
        res.json({ success: true, message: "接取成功！请按时完成！" });
    } catch (error) {
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

app.get('/api/tasks/my', async (req, res) => {
    try {
        const email = req.query.email; 
        if (!email) return res.status(400).json({ success: false, message: "缺少参数" });
        const myRecords = await TaskRecord.find({ studentEmail: email }).populate('taskId');
        res.json({ success: true, data: myRecords });
    } catch (error) {
        res.status(500).json({ success: false, message: "查询失败" });
    }
});

app.post('/api/tasks/reflect', async (req, res) => {
    try {
        const { recordId, reflection } = req.body;
        if (!reflection || reflection.trim().length < 5) {
            return res.status(400).json({ success: false, message: "心得不能太敷衍，至少5个字哦！" });
        }

        const record = await TaskRecord.findById(recordId).populate('taskId');
        if (!record || record.status !== 'settling') {
            return res.status(400).json({ success: false, message: "当前状态无法提交心得" });
        }
        
        const now = new Date();
        if (now - record.completedAt > 259200000) {
            return res.status(400).json({ success: false, message: "已经超过了 3 天的心得提交期限哦，无法再获取额外奖励了。" });
        }

        record.reflection = reflection;
        record.status = 'pending_audit'; 
        await record.save();

        res.json({ success: true, message: "心得已提交！等待老师审核后发放附加奖励。" });
    } catch (error) {
        res.status(500).json({ success: false, message: "提交失败" });
    }
});

// 7. 教师管理接口：核减工时、发放心得奖金、标记任务异常
app.post('/api/teacher/deduct-time', async (req, res) => {
    try {
        const { recordId, deductHours, reason } = req.body;
        const record = await TaskRecord.findById(recordId);
        
        const now = new Date();
        if (now - record.completedAt > 259200000) {
            return res.status(400).json({ success: false, message: "已超过 3 天追诉期，无法再修改学生工时！" });
        }
        if (!reason) return res.status(400).json({ success: false, message: "扣除工时必须给出理由！" });

        record.deductedTime += deductHours;
        record.gainedTime -= deductHours;
        record.deductReason = reason;
        await record.save();

        await User.findOneAndUpdate({ email: record.studentEmail }, { $inc: { totalTime: -deductHours } });
        res.json({ success: true, message: `已成功核减该学生 ${deductHours} 小时工时。` });
    } catch (error) {
        res.status(500).json({ success: false, message: "操作失败" });
    }
});

app.post('/api/teacher/award-bonus', async (req, res) => {
    try {
        const { recordId, bonusAmount } = req.body;
        const record = await TaskRecord.findById(recordId).populate('taskId');
        
        const now = new Date();
        if (now - record.completedAt > 604800000) {
            return res.status(400).json({ success: false, message: "已超过 7 天评审期，无法再发放额外奖励！" });
        }

        const maxBonus = record.taskId.baseCoins; 
        if (bonusAmount > maxBonus) {
            return res.status(400).json({ success: false, message: `额外奖励不能超过上限 ${maxBonus} 枚哦！` });
        }

        record.gainedBonusCoins = bonusAmount;
        record.status = 'settled'; 
        await record.save();

        await User.findOneAndUpdate({ email: record.studentEmail }, { $inc: { totalCoins: bonusAmount } });
        res.json({ success: true, message: `批阅完成！已为该心得发放 ${bonusAmount} 枚附加心币。` });
    } catch (error) {
        res.status(500).json({ success: false, message: "操作失败" });
    }
});

app.post('/api/teacher/mark-anomaly', async (req, res) => {
    try {
        const { recordId, reason } = req.body;
        const record = await TaskRecord.findById(recordId);
        if (!record) return res.status(404).json({ success: false, message: "记录不存在" });

        record.status = 'anomaly'; 
        await record.save();
        res.json({ success: true, message: "已标记为异常，停止一切自动结算流转！" });
    } catch (error) {
        res.status(500).json({ success: false, message: "操作失败" });
    }
});

// 8. 定时结算引擎：任务到期自动下发时长和保底心币
setInterval(async () => {
    try {
        const now = new Date();
        const expiredTasks = await Task.find({ status: 'published', endDate: { $lte: now } });

        for (let task of expiredTasks) {
            task.status = 'settling'; 
            await task.save();

            const records = await TaskRecord.find({ taskId: task._id, status: 'accepted' });
            for (let record of records) {
                record.status = 'settling';
                record.completedAt = now;
                record.gainedTime = task.duration;    
                record.gainedBaseCoins = task.baseCoins; 
                await record.save();

                await User.findOneAndUpdate(
                    { email: record.studentEmail }, 
                    { $inc: { totalTime: task.duration, totalCoins: task.baseCoins } }
                );
            }
            console.log(`[时间引擎] ⏰ 任务 "${task.title}" 结束，已自动下发 ${task.duration}h 时长与 ${task.baseCoins} 枚保底心币！`);
        }
    } catch (error) {
        console.error("时间引擎报错:", error);
    }
}, 60000); 

// 9. 教师数据查询接口：查询自己发布任务下的所有学生记录
app.get('/api/teacher/student-records', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "缺少邮箱参数" });

        const myTasks = await Task.find({ publisherEmail: email });
        const taskIds = myTasks.map(t => t._id);

        const records = await TaskRecord.find({ taskId: { $in: taskIds } })
                                        .populate('taskId')
                                        .sort({ createdAt: -1 });
        
        res.json({ success: true, data: records });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取学生记录失败" });
    }
});

// ================= 新增模块：志愿补录与全局数据管理 =================

// 1. 学生提交志愿补录申请 (V2 完整版)
app.post('/api/student/retro-entry', async (req, res) => {
    try {
        // 增加了解析 reflection（心得）字段
        const { studentEmail, eventName, hours, evidence, reflection } = req.body;
        if (!studentEmail || !eventName || !hours) {
            return res.status(400).json({ success: false, message: "参数不完整" });
        }
        
        const newEntry = new RetroEntry({ 
            studentEmail, 
            eventName, 
            hours, 
            evidence: evidence || "系统内发信验证",
            reflection: reflection // 存入心得
        });
        await newEntry.save();
        res.json({ success: true, message: "补录申请已提交" });
    } catch (error) {
        console.error("提交补录报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

// 2. 管理员拉取待审核的补录列表
app.get('/api/admin/retro-entries', async (req, res) => {
    try {
        const entries = await RetroEntry.find({ status: 'pending_audit' }).sort({ createdAt: 1 });
        res.json({ success: true, data: entries });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取补录列表失败" });
    }
});

// 3. 管理员审批志愿补录 (带心得打分算薪引擎)
app.post('/api/admin/audit-retro', async (req, res) => {
    try {
        const { entryId, action, adminScore } = req.body;
        const entry = await RetroEntry.findById(entryId);
        if (!entry) return res.status(404).json({ success: false, message: "补录记录不存在" });

        if (action === 'approve') {
            // 核心计薪引擎： (工时 × 10) + (打分 × 3)
            const score = Number(adminScore) || 0;
            const calculatedCoins = Math.floor((entry.hours * 10) + (score * 3));

            entry.status = 'approved';
            entry.auditedAt = new Date();
            entry.earnedCoins = calculatedCoins; // 记录发的钱
            await entry.save();
            
            // 同时给学生增加：工时 + 算出来的心币
            await User.findOneAndUpdate(
                { email: entry.studentEmail },
                { $inc: { totalTime: entry.hours, totalCoins: calculatedCoins } }
            );
            res.json({ success: true, message: `审批通过！已下发 ${entry.hours}H 工时与 ${calculatedCoins} 枚心币。` });
            
        } else if (action === 'reject') {
            entry.status = 'rejected';
            entry.auditedAt = new Date();
            await entry.save();
            res.json({ success: true, message: "已驳回该补录申请。" });
        } else {
            res.status(400).json({ success: false, message: "未知操作" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "审核处理失败" });
    }
});

// 4. 管理员拉取全校学生数据总览
app.get('/api/admin/all-students', async (req, res) => {
    try {
        // 查找所有角色为 student 的用户
        const students = await User.find({ role: 'student' });
        
        // 并行计算每个学生的信誉分和活跃任务数
        const result = await Promise.all(students.map(async (student) => {
            const activeCount = await TaskRecord.countDocuments({ 
                studentEmail: student.email, 
                status: { $in: ['accepted', 'settling', 'pending_audit'] } 
            });
            const settledCount = await TaskRecord.countDocuments({ studentEmail: student.email, status: 'settled' });
            const anomalyCount = await TaskRecord.countDocuments({ studentEmail: student.email, status: 'anomaly' });
            
            let reputationScore = 100 + (settledCount * 2) - (anomalyCount * 10);
            
            return {
                email: student.email,
                totalTime: student.totalTime,
                totalCoins: student.totalCoins,
                reputationScore: reputationScore,
                activeTasks: activeCount
            };
        }));
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("拉取学生数据失败:", error);
        res.status(500).json({ success: false, message: "拉取全校学生数据失败" });
    }
});

// ============================================================================
// 👾 DEVELOPER GOD_MODE API (开发者专属高权限接口)
// ============================================================================

// 1. 获取全量数据库节点 (Database Matrix)
app.get('/api/dev/users', async (req, res) => {
    try {
        // 从数据库里拉取所有用户，为了安全和传输速度，我们只提取需要的字段，不传密码
        const users = await User.find({}, 'email role realName studentId totalCoins createdAt').sort({ createdAt: -1 });
        res.json({ success: true, users: users });
    } catch (error) {
        console.error("拉取全量数据失败:", error);
        res.status(500).json({ success: false, message: "数据库扫描失败" });
    }
});

// 2. 覆写数据节点 (Override Node)
app.put('/api/dev/users/:email', async (req, res) => {
    try {
        const targetEmail = req.params.email;
        const { realName, role } = req.body;

        // 不允许通过 API 修改开发者自己的权限（防呆设计，防止把自己踢出局）
        if (targetEmail === 'dev@polaris.sys') {
            return res.status(403).json({ success: false, message: "SYSTEM_DENIED: 不能修改根节点权限。" });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email: targetEmail }, 
            { realName: realName, role: role },
            { new: true } // 返回修改后的新数据
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "找不到该目标节点" });
        }

        res.json({ success: true, message: "节点覆写成功" });
    } catch (error) {
        console.error("修改节点报错:", error);
        res.status(500).json({ success: false, message: "执行覆写指令失败" });
    }
});

// 3. 抹除数据节点 (Terminate Node)
app.delete('/api/dev/users/:email', async (req, res) => {
    try {
        const targetEmail = req.params.email;

        // 绝对防御：禁止删除开发者本体
        if (targetEmail === 'dev@polaris.sys') {
            return res.status(403).json({ success: false, message: "SYSTEM_DENIED: 根节点不可摧毁。" });
        }

        const deletedUser = await User.findOneAndDelete({ email: targetEmail });
        
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "该节点不存在或已被摧毁" });
        }

        // [进阶预留] 如果删除了用户，最好把他的任务记录也一起删掉（级联删除）
        // await TaskRecord.deleteMany({ studentEmail: targetEmail }); 

        res.json({ success: true, message: "节点已彻底抹除" });
    } catch (error) {
        console.error("删除节点报错:", error);
        res.status(500).json({ success: false, message: "执行抹除指令失败" });
    }
});
// ============================================================================

// 10. 服务启动：监听端口，启动后端服务
app.listen(PORT, () => {
    console.log(`✅ 服务器启动完毕！正在监听 ${PORT} 端口...`);
});