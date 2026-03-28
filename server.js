// #region [01] Dependencies and Environment (依赖导入与环境配置)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000; 

app.use(cors());
app.use(express.json());
// #endregion

// #region [02] Database Connection (数据库连接初始化)
const mongoURI = process.env.MONGODB_URI || 'mongodb://timebank:1D2U2S2c0v8c13@127.0.0.1:27017/timebank';

mongoose.connect(mongoURI)
    .then(() => console.log('✅ Database Connected! TimeBank Center is Online.'))
    .catch((err) => console.error('❌ Database Connection Error:', err));
// #endregion

// #region [03] Data Models & Schemas (数据模型与结构定义)
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true },           
    role: { type: String, required: true },               
    realName: { type: String, required: true },           
    englishName: { type: String, default: "" },           
    username: { type: String, required: true },           
    school: { type: String, default: "" },                
    studentId: { type: String, default: "" },             
    studentClass: { type: String, default: "" },
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

const RetroEntrySchema = new mongoose.Schema({
    studentEmail: { type: String, required: true },
    eventName: { type: String, required: true },
    hours: { type: Number, required: true },
    evidence: { type: String, required: true },
    reflection: { type: String, default: "无心得记录" },
    earnedCoins: { type: Number, default: 0 },
    status: { type: String, default: 'pending_audit' }, 
    createdAt: { type: Date, default: Date.now },
    auditedAt: { type: Date }
});
const RetroEntry = mongoose.model('RetroEntry', RetroEntrySchema);
// #endregion

// #region [04] Authentication & Identity API (身份验证与注册接口)
app.get('/api/status', (req, res) => {
    res.json({ message: "🚀 Polaris 11319 Backend Engine is Running!" });
});

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, role, realName, englishName, username, school, studentId, class: studentClass } = req.body;
        const existingUser = await User.findOne({ email: email });
        if (existingUser) return res.status(400).json({ success: false, message: "Email already registered!" });

        const newUser = new User({ 
            email, password, role, 
            realName, englishName, username, 
            school, studentId, studentClass 
        });
        await newUser.save();
        res.json({ success: true, message: `Registration Successful! Welcome, ${role}` });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === 'dev@polaris.sys' && password === '11319') {
            return res.json({ 
                success: true, message: "GOD_MODE UNLOCKED", role: "developer",
                realName: "SYS.ARCHITECT", studentId: "DEV-00", studentClass: "ROOT"
            });
        }
        const user = await User.findOne({ email: email, password: password });
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials!" });

        res.json({ 
            success: true, message: "Login Successful", 
            role: user.role, realName: user.realName, 
            studentId: user.studentId, studentClass: user.studentClass
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});
// #endregion

// #region [05] Student Profile API (学生个人档案与数据统计)
app.get('/api/student/profile', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ success: false, message: "Email missing" });

        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const settledCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'settled' });
        const anomalyCount = await TaskRecord.countDocuments({ studentEmail: email, status: 'anomaly' });
        
        let reputationScore = 100 + (settledCount * 2) - (anomalyCount * 10);
        let reputationText = "Good";
        let badgeColor = "bg-success";
        
        if (reputationScore >= 110) { reputationText = "Excellent"; badgeColor = "bg-primary"; } 
        else if (reputationScore < 90) { reputationText = "Warning"; badgeColor = "bg-danger"; }

        const activeCount = await TaskRecord.countDocuments({ 
            studentEmail: email, status: { $in: ['accepted', 'settling', 'pending_audit'] } 
        });

        res.json({
            success: true,
            data: {
                realName: user.realName, studentId: user.studentId, studentClass: user.studentClass,
                totalTime: user.totalTime, totalCoins: user.totalCoins,
                reputationScore, reputationText, badgeColor, activeTasks: activeCount
            }
        });
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ success: false, message: "Fetch failed" });
    }
});
// #endregion

// #region [06] AI Services Hub (AI 辅助增强功能)
async function callDeepSeekAPI(userMessage, systemPrompt) {
    const provider = process.env.AI_PROVIDER || 'mock';
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (provider !== 'deepseek' || !apiKey) return "【System Mock】AI API not called.";

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'deepseek-chat', 
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return "AI service temporarily unavailable.";
    }
}

app.post('/api/ai/refine', async (req, res) => {
    try {
        const { description } = req.body;
        const systemPrompt = `You are a professional volunteer coordinator. Refine the following task description into a professional recruitment post. Output the result directly.`;
        const aiResponse = await callDeepSeekAPI(description, systemPrompt);
        res.json({ success: true, response: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: "AI Refine Failed" });
    }
});

app.post('/api/ai/evaluate-reflection', async (req, res) => {
    try {
        const { reflection, taskTitle, hours } = req.body;
        const systemPrompt = `Evaluate this student's volunteer reflection. Format: Report title, Score (out of 10), Reference comment, Highlights, and Suggestions.`;
        const userMsg = `Task: ${taskTitle}\nHours: ${hours}\nReflection: ${reflection}`;
        const aiResponse = await callDeepSeekAPI(userMsg, systemPrompt);
        res.json({ success: true, response: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: "AI Evaluation Failed" });
    }
});
// #endregion

// #region [07] Task Management API (任务发布与管理)
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, desc, duration, capacity, tag, publisherEmail, role, startDate, endDate, dims } = req.body;
        const d = dims || { dim1:0, dim2:0, dim3:0, dim4:0, dim5:0 };
        const totalDimScore = (Number(d.dim1) + Number(d.dim2) + Number(d.dim3) + Number(d.dim4) + Number(d.dim5));
        const autoBaseCoins = Math.floor((duration * 10) + (totalDimScore * 2));
        const initialStatus = (role === 'admin') ? 'published' : 'pending_audit';

        const newTask = new Task({
            title, desc, duration, capacity, tag, publisherEmail, 
            startDate, endDate, dimensions: d, baseCoins: autoBaseCoins, status: initialStatus
        });
        await newTask.save();
        res.json({ success: true, message: "Task submitted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ status: 'published' }).sort({ createdAt: -1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: "Fetch failed" });
    }
});

app.post('/api/admin/audit-task', async (req, res) => {
    try {
        const { taskId, action, reason } = req.body; 
        const task = await Task.findById(taskId);
        if (action === 'approve') { task.status = 'published'; task.rejectReason = ""; } 
        else { task.status = 'rejected'; task.rejectReason = reason || "Does not meet criteria"; }
        await task.save();
        res.json({ success: true, message: "Audit completed" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Audit failed" });
    }
});
// #endregion

// #region [08] Student Task Flow (学生任务接取与反馈)
app.post('/api/tasks/accept', async (req, res) => {
    try {
        const { taskId, studentEmail } = req.body;
        const existingRecord = await TaskRecord.findOne({ taskId: taskId, studentEmail: studentEmail });
        if (existingRecord) return res.status(400).json({ success: false, message: "Already accepted!" });

        const newRecord = new TaskRecord({ taskId, studentEmail, status: 'accepted' });
        await newRecord.save();
        res.json({ success: true, message: "Accepted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.post('/api/tasks/reflect', async (req, res) => {
    try {
        const { recordId, reflection } = req.body;
        const record = await TaskRecord.findById(recordId);
        const now = new Date();
        if (now - record.completedAt > 259200000) return res.status(400).json({ success: false, message: "Past 3-day deadline" });

        record.reflection = reflection;
        record.status = 'pending_audit'; 
        await record.save();
        res.json({ success: true, message: "Reflection submitted!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Submission failed" });
    }
});
// #endregion

// #region [09] Teacher & Supervisor Tools (教师与审核员工具)
app.post('/api/teacher/deduct-time', async (req, res) => {
    try {
        const { recordId, deductHours, reason } = req.body;
        const record = await TaskRecord.findById(recordId);
        record.deductedTime += deductHours;
        record.gainedTime -= deductHours;
        record.deductReason = reason;
        await record.save();
        await User.findOneAndUpdate({ email: record.studentEmail }, { $inc: { totalTime: -deductHours } });
        res.json({ success: true, message: "Hours deducted successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Operation failed" });
    }
});

app.post('/api/teacher/award-bonus', async (req, res) => {
    try {
        const { recordId, bonusAmount } = req.body;
        const record = await TaskRecord.findById(recordId);
        record.gainedBonusCoins = bonusAmount;
        record.status = 'settled'; 
        await record.save();
        await User.findOneAndUpdate({ email: record.studentEmail }, { $inc: { totalCoins: bonusAmount } });
        res.json({ success: true, message: "Bonus awarded successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Operation failed" });
    }
});
// #endregion

// #region [10] Settlement Engine (自动结算后台引擎)
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
        }
    } catch (error) {
        console.error("Engine Error:", error);
    }
}, 60000); 
// #endregion

// #region [11] Retroactive Entry & Admin Dashboard (志愿补录与管理员面板)
app.post('/api/student/retro-entry', async (req, res) => {
    try {
        const { studentEmail, eventName, hours, evidence, reflection } = req.body;
        const newEntry = new RetroEntry({ studentEmail, eventName, hours, evidence, reflection });
        await newEntry.save();
        res.json({ success: true, message: "Retroactive application submitted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error" });
    }
});

app.post('/api/admin/audit-retro', async (req, res) => {
    try {
        const { entryId, action, adminScore } = req.body;
        const entry = await RetroEntry.findById(entryId);
        if (action === 'approve') {
            const calculatedCoins = Math.floor((entry.hours * 10) + (Number(adminScore) * 3));
            entry.status = 'approved';
            entry.earnedCoins = calculatedCoins;
            await entry.save();
            await User.findOneAndUpdate(
                { email: entry.studentEmail },
                { $inc: { totalTime: entry.hours, totalCoins: calculatedCoins } }
            );
            res.json({ success: true, message: "Retro entry approved!" });
        } else {
            entry.status = 'rejected';
            await entry.save();
            res.json({ success: true, message: "Retro entry rejected." });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Audit failed" });
    }
});
// #endregion

// #region [12] Developer God Mode (开发者特权指令)
app.get('/api/dev/users', async (req, res) => {
    try {
        const users = await User.find({}, 'email role realName studentId totalCoins createdAt').sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Scan failed" });
    }
});

app.delete('/api/dev/users/:email', async (req, res) => {
    try {
        if (req.params.email === 'dev@polaris.sys') return res.status(403).json({ message: "Cannot delete Root Node" });
        await User.findOneAndDelete({ email: req.params.email });
        res.json({ success: true, message: "Node terminated." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Termination failed" });
    }
});
// #endregion

// #region [13] Server Activation & Export (服务启动与导出)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`✅ Local Server Active on Port ${PORT}...`);
    });
}

module.exports = app;
// #endregion