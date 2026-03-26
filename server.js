/* jshint esversion: 8 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000; 

// 1. 装载中间件：允许跨域，解析 JSON
app.use(cors());
app.use(express.json());

// 2. 连接 MongoDB 数据库
mongoose.connect('mongodb://127.0.0.1:27017/timebank')
    .then(() => console.log('✅ 数据库连接成功！TimeBank 记忆中枢已上线！'))
    .catch((err) => console.error('❌ 数据库连接失败：', err));

// ==========================================
// 核心模块 A：定义用户数据表 (User)
// ==========================================
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true },           
    role: { type: String, required: true },               
    school_id: { type: String, default: "demo_high_school" },
    
    // ✅ 补全财产字段：确保发工资时数据库能找到对应的口袋
    totalTime: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
    
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// ==========================================
// 核心模块 B：用户身份 API
// ==========================================
app.get('/api/status', (req, res) => {
    res.json({ message: "🚀 Polaris 11319 后端引擎全速运转中！" });
});

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const existingUser = await User.findOne({ email: email });
        if (existingUser) return res.status(400).json({ success: false, message: "这个邮箱已经被注册过啦！" });

        const newUser = new User({ email, password, role });
        await newUser.save();
        res.json({ success: true, message: `注册成功！欢迎你，${role}` });
    } catch (error) {
        console.error("注册报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email, password: password });
        if (!user) return res.status(401).json({ success: false, message: "账号或密码错误！" });

        res.json({ success: true, message: "登录成功", role: user.role });
    } catch (error) {
        console.error("登录报错:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});
// ==========================================
// API: 获取学生个人实时数据 (时长、心币、信誉)
// ==========================================
app.get('/api/student/profile', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "缺少邮箱参数" });

        // 1. 抓取用户的钱包基础数据（总时长和心币）
        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).json({ success: false, message: "用户不存在" });

        // 2. 动态计算信誉分 (Reputation Score)
        // 逻辑设计：初始信用 100 分。完美结算一个任务 +2 分，如果被老师标记“异常(anomaly)”扣 10 分！
        const settledCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'settled' });
        const anomalyCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'anomaly' });
        
        let reputationScore = 100 + (settledCount * 2) - (anomalyCount * 10);
        
        // 根据分数给出评级标签
        let reputationText = "良好";
        let badgeColor = "bg-success"; // 绿色
        if (reputationScore >= 110) {
            reputationText = "极佳";
            badgeColor = "bg-primary"; // 蓝色
        } else if (reputationScore < 90) {
            reputationText = "危险";
            badgeColor = "bg-danger";  // 红色
        }

        // 3. 统计一下当前“进行中”和“待结算”的任务数量
        const activeCount = await TaskRecord.countDocuments({ 
            studentEmail: email, 
            status: { $in: ['accepted', 'settling', 'pending_audit'] } 
        });

        // 4. 打包发送给前端
        res.json({
            success: true,
            data: {
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

// ==========================================
// 核心模块 C：任务系统 (Task) - RPG维度版
// ==========================================
const TaskSchema = new mongoose.Schema({
    title: String, desc: String, tag: String,
    duration: Number, capacity: Number, publisherEmail: String,
    
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, 
    
    // ✅ 5维能力雷达图数据 (默认0分，最高5分)
    dimensions: {
        dim1: { type: Number, default: 0, min: 0, max: 5 }, 
        dim2: { type: Number, default: 0, min: 0, max: 5 }, 
        dim3: { type: Number, default: 0, min: 0, max: 5 }, 
        dim4: { type: Number, default: 0, min: 0, max: 5 }, 
        dim5: { type: Number, default: 0, min: 0, max: 5 }  
    },
    
    // ✅ 系统自动计算的保底心币，原来的 coins 字段废弃不用了
    baseCoins: { type: Number, default: 0 },
    
    status: { type: String, default: 'pending_audit' }, 
    rejectReason: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', TaskSchema);

// 发布任务 (计算底薪公式)
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, desc, duration, capacity, tag, publisherEmail, role, startDate, endDate, dims } = req.body;
        
        // 🚀 核心算薪公式：(时长 * 10) + (五维总分 * 2) 
        // 这里的 dims 需要前端发请求时打包传过来，如果没有传，就默认为全0
        const d = dims || { dim1:0, dim2:0, dim3:0, dim4:0, dim5:0 };
        const totalDimScore = (Number(d.dim1) + Number(d.dim2) + Number(d.dim3) + Number(d.dim4) + Number(d.dim5));
        const autoBaseCoins = Math.floor((duration * 10) + (totalDimScore * 2));

        const initialStatus = (role === 'admin') ? 'published' : 'pending_audit';

        const newTask = new Task({
            title, desc, duration, capacity, tag, publisherEmail, 
            startDate, endDate, 
            dimensions: d, 
            baseCoins: autoBaseCoins, // 存入算好的底薪
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

// 学生拉取任务大厅
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ status: 'published' }).sort({ createdAt: -1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "服务器拉取任务失败" });
    }
});

// 审核端拉取待办 (Admin)
app.get('/api/admin/pending-tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ status: 'pending_audit' }).sort({ createdAt: 1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取待审核列表失败" });
    }
});

// 审核动作处理器
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

// 教师拉取自己的任务
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

// ==========================================
// 核心模块 D：任务流转中枢 (TaskRecord) - 底薪奖金分离版
// ==========================================
const TaskRecordSchema = new mongoose.Schema({
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true }, 
    studentEmail: { type: String, required: true }, 
    
    // 状态机：'accepted' -> 'settling' -> 'pending_audit' -> 'settled' / 'anomaly'
    status: { type: String, default: 'accepted' }, 
    reflection: { type: String, default: "" }, 
    
    // 收益拆分
    gainedTime: { type: Number, default: 0 },       
    gainedBaseCoins: { type: Number, default: 0 },  
    gainedBonusCoins: { type: Number, default: 0 }, 
    
    // 惩罚记录
    deductedTime: { type: Number, default: 0 },     
    deductReason: { type: String, default: "" },    
    
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date } // 任务彻底结束的时间，用于起算SLA期限
});
const TaskRecord = mongoose.model('TaskRecord', TaskRecordSchema);

// 学生接取任务
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

// 学生拉取接取记录
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

// 学生写心得
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
        
        // 检查是不是超出了 3 天没写心得
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

// ==========================================
// 🚀 教师端终极控制台 API
// ==========================================

// 教师操作：核减工时 (3天内)
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

// 教师操作：批阅心得发奖金 (7天内)
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

// 教师操作：标记异常挂起
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

// ==========================================
// 核心模块 E：时间守护进程 (发底薪咯！)
// ==========================================
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
                record.completedAt = now; // 记录确切结束时间，开始 3天/7天 倒计时
                record.gainedTime = task.duration;    
                record.gainedBaseCoins = task.baseCoins; 
                await record.save();

                // 🚀 时间一到，立刻把基础时间和保底心币打入学生账户！
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

// ------------------------------------------
// 🚀 终极接口：教师获取自己名下所有学生的任务记录与心得
// ------------------------------------------
app.get('/api/teacher/student-records', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "缺少邮箱参数" });

        // 1. 先查出这个老师发的所有任务的 ID
        const myTasks = await Task.find({ publisherEmail: email });
        const taskIds = myTasks.map(t => t._id);

        // 2. 用这些任务ID去记录表里找对应的学生记录，并把任务的具体详情拼上去，按时间倒序
        const records = await TaskRecord.find({ taskId: { $in: taskIds } })
                                        .populate('taskId')
                                        .sort({ createdAt: -1 });
        
        res.json({ success: true, data: records });
    } catch (error) {
        res.status(500).json({ success: false, message: "拉取学生记录失败" });
    }
});

// ==========================================
// 🚀 终极启动开关 (必须放在文件最底部)
// ==========================================
app.listen(PORT, () => {
    console.log(`✅ 服务器启动完毕！正在监听 ${PORT} 端口...`);
});