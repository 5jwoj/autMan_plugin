/**
 * 体重记录插件 v2.0.0
 * 基于autMan实际API结构重写
 * 功能: 体重记录、趋势分析、目标管理
 * 
 * 使用说明:
 * - 发送「体重 [数值]」→ 记录当前体重 (如: 体重 65.5)
 * - 发送「体重记录 [日期] [数值]」→ 补录历史数据
 * - 发送「体重记录」→ 查看最近记录和趋势
 * - 发送「体重详细记录」→ 查看带编号的完整记录
 * - 发送「体重统计」→ 查看统计信息
 * - 发送「设置目标体重 [数值]」→ 设定目标体重
 * - 发送「目标进度」→ 查看目标进度
 * - 发送「删除体重记录 [编号]」→ 删除指定记录
 * - 发送「修改体重记录 [编号] [新数值]」→ 修改指定记录
 * - 发送「清空体重记录」→ 清空所有记录
 * - 发送「体重帮助」→ 显示帮助
 * 
 * 交互说明:
 * - 关键操作需要回复 Y/y 确认
 * - 回复 Q/q 或 N/n 取消操作
 * - 30秒无操作自动退出
 * 
 * 更新历史:
 * v2.0.0 - 重构为 input() 模式，彻底解决指令冲突
 * v1.1.6 - 恢复独立Q监听，添加防冲突协同逻辑
 */

// [disable:false]
// [rule: (.*体重.*|.*目标.*)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: v2.0.0]
// [update: 重构为 input() 模式]

// 定义存储桶名称
(function () {
    // 定义存储桶名称 (放入 IIFE 防止与其他插件冲突)
    const BUCKET_NAME = "weight_tracker";

    /**
     * 获取当前日期字符串 (YYYY-MM-DD)
     */
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 发送消息
     */
    function sendMessage(text) {
        try {
            if (typeof Sender !== 'undefined' && Sender && typeof Sender.reply === 'function') {
                Sender.reply(text);
                return;
            }
            if (this && this.Sender && typeof this.Sender.reply === 'function') {
                this.Sender.reply(text);
                return;
            }
            if (typeof reply === 'function') {
                reply(text);
                return;
            }
            if (typeof sendText === 'function') {
                sendText(text);
                return;
            }
            console.log("[发送消息]", text);
        } catch (error) {
            console.error("[发送消息失败]", error);
        }
    }

    /**
     * 获取消息内容
     */
    function getMessageContent() {
        if (this && this.Sender && this.Sender.sender && this.Sender.sender.message) {
            return this.Sender.sender.message.text || "";
        }
        if (this && this.Sender && this.Sender.sender && this.Sender.sender.baseSender) {
            return this.Sender.sender.baseSender.content || "";
        }
        if (this && this.Sender && this.Sender.sender) {
            return this.Sender.sender.content || "";
        }
        return "";
    }

    /**
     * 获取用户ID
     */
    function getUserID() {
        if (this && this.Sender && this.Sender.sender && this.Sender.sender.message) {
            const msg = this.Sender.sender.message;
            if (msg.sender && msg.sender.iD) return String(msg.sender.iD);
            if (msg.chat && msg.chat.iD) return String(msg.chat.iD);
        }
        return "unknown";
    }

    /**
     * 获取用户名
     */
    function getUserName() {
        if (this && this.Sender && this.Sender.sender && this.Sender.sender.message) {
            const sender = this.Sender.sender.message.sender;
            if (sender) {
                const name = `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
                return name || sender.username || "用户";
            }
        }
        return "用户";
    }

    // 封装 Bucket 操作
    function safeBucketGet(key) {
        if (typeof bucketGet === 'function') return bucketGet(BUCKET_NAME, key);
        return "";
    }

    function safeBucketSet(key, value) {
        if (typeof bucketSet === 'function') bucketSet(BUCKET_NAME, key, value);
    }

    function safeBucketDel(key) {
        if (typeof bucketDel === 'function') bucketDel(BUCKET_NAME, key);
    }

    // 等待用户确认 (封装 input)
    function waitForConfirm(promptText) {
        sendMessage(promptText);
        // 等待30秒
        const userReply = input(30000);
        if (!userReply) return false; // 超时

        const trimmed = userReply.trim().toLowerCase();
        if (trimmed === 'y') return true;
        return false;
    }

    // 获取数据辅助函数
    function getData() {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const existingData = safeBucketGet(STORAGE_KEY);
        let data = { records: [], target: null };
        if (existingData) {
            try { data = JSON.parse(existingData); } catch (e) { }
            if (!data.records) data.records = []; // 修复旧数据结构
        }
        return data;
    }

    // 保存数据辅助函数
    function saveData(data) {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        safeBucketSet(STORAGE_KEY, JSON.stringify(data));
    }

    // 处理记录体重
    function handleRecord(content) {
        // 解析指令
        // 格式1: 体重 60
        // 格式2: 体重记录 2023-01-01 60
        let weight = null;
        let date = getCurrentDate();

        // 简单的正则解析
        const numMatch = content.match(/(\d+(\.\d+)?)/g);
        const dateMatch = content.match(/\d{4}-\d{2}-\d{2}/);

        if (dateMatch) date = dateMatch[0];

        // 尝试从数字中找体重 (如果找到多个，且有一个匹配了日期格式，则排除日期的数字部分... 比较复杂，这里简化处理)
        // 假设用户输入: "体重记录 2026-01-01 65.5" -> nums: 2026, 01, 01, 65.5
        // 简单的策略：取最后一个数字作为体重，如果它看起来像合理的体重 (0-500)
        if (numMatch) {
            const candidate = parseFloat(numMatch[numMatch.length - 1]);
            if (candidate > 0 && candidate < 500) {
                weight = candidate;
            }
        }

        if (!weight) {
            sendMessage("❌ 请输入有效的体重数值 (如: 体重 65.5)");
            return;
        }

        const userName = getUserName();
        const confirmed = waitForConfirm(`📝 准备记录 ${userName} 在 ${date} 的体重: ${weight}kg\n\n确认记录请回复 Y, 取消请回复 Q`);

        if (confirmed) {
            const data = getData();
            // 检查当天是否已有
            const idx = data.records.findIndex(r => r.date === date);
            let msg = "";

            if (idx >= 0) {
                const old = data.records[idx].weight;
                data.records[idx].weight = weight;
                data.records[idx].timestamp = new Date().getTime();
                msg = `✅ 已更新 ${date} 的记录: ${old}kg → ${weight}kg`;
            } else {
                data.records.push({
                    date: date,
                    weight: weight,
                    timestamp: new Date().getTime()
                });
                msg = `✅ 已记录 ${date} 的体重: ${weight}kg`;
            }

            // 排序
            data.records.sort((a, b) => a.date.localeCompare(b.date));
            saveData(data);

            // 目标检查
            if (data.target) {
                const diff = weight - data.target;
                if (Math.abs(diff) < 0.1) msg += `\n🎉 达成目标!`;
                else if (diff > 0) msg += `\n📊 距目标还差 ${diff.toFixed(1)}kg`;
                else msg += `\n📊 距目标还差 ${Math.abs(diff).toFixed(1)}kg`;
            }
            sendMessage(msg);
        } else {
            sendMessage("已取消");
        }
    }

    // 处理设置目标
    function handleSetTarget(content) {
        const match = content.match(/(\d+(\.\d+)?)/);
        if (!match) {
            sendMessage("❌ 请输入有效数值");
            return;
        }
        const target = parseFloat(match[0]);

        if (waitForConfirm(`🎯 确认设置目标体重为: ${target}kg?`)) {
            const data = getData();
            data.target = target;
            saveData(data);
            sendMessage(`✅ 目标已设为 ${target}kg`);
        } else {
            sendMessage("已取消");
        }
    }

    // 处理目标进度
    function showProgress() {
        const data = getData();
        if (!data.target) {
            sendMessage("❌ 未设置目标");
            return;
        }
        if (data.records.length === 0) {
            sendMessage("📋 暂无记录");
            return;
        }

        // 取最新一条（最后一条，因为已排序）
        const latest = data.records[data.records.length - 1];
        const diff = latest.weight - data.target;

        let msg = `🎯 目标进度\n当前: ${latest.weight}kg\n目标: ${data.target}kg\n`;
        if (Math.abs(diff) < 0.1) msg += "🎉 已达标!";
        else if (diff > 0) msg += `📊 需减重 ${diff.toFixed(1)}kg`;
        else msg += `📊 需增重 ${Math.abs(diff).toFixed(1)}kg`;

        sendMessage(msg);
    }

    // 列表显示
    function showRecords(detailed) {
        const data = getData();
        if (data.records.length === 0) {
            sendMessage("📋 暂无记录");
            return;
        }
        // 反序显示（最新在前）
        const list = data.records.slice().reverse();

        if (detailed) {
            let msg = `📋 详细记录 (共${list.length}条)\n━━━━━━━━━━\n`;
            list.forEach((r, i) => {
                msg += `[${i + 1}] ${r.date}  ${r.weight}kg\n`;
            });
            msg += "\n💡 (30秒内) 发送数字可快速删除\n(回复 Q 退出)";
            sendMessage(msg);

            // 等待快速删除
            const reply = input(30000);
            if (reply && /^\d+$/.test(reply)) {
                handleDeleteIndex(parseInt(reply), list); // 注意 list 是反序的
            } else if (reply && /^[Qq]$/i.test(reply)) {
                sendMessage("✅ 已退出");
            }
        } else {
            // 简略（时间轴）
            const recent = list.slice(0, 7);
            let msg = `📊 最近记录\n`;
            recent.forEach(r => {
                msg += `🗓️ ${r.date}  ${r.weight}kg\n`;
            });
            if (list.length > 7) msg += `... 等共${list.length}条`;
            sendMessage(msg);
        }
    }

    // 删除指定索引（基于反序后的 index 1-based）
    function handleDeleteIndex(index, reversedList) {
        if (index < 1 || index > reversedList.length) {
            sendMessage("❌ 编号无效");
            return;
        }
        const target = reversedList[index - 1];
        if (waitForConfirm(`🗑️ 确认删除 [${index}]: ${target.date} ${target.weight}kg ?`)) {
            const data = getData();
            // 在原数据中找到对应日期删除 (日期是唯一的)
            const realIdx = data.records.findIndex(r => r.date === target.date);
            if (realIdx >= 0) {
                data.records.splice(realIdx, 1);
                saveData(data);
                sendMessage("✅ 删除成功");
            } else {
                sendMessage("❌ 数据同步错误");
            }
        } else {
            sendMessage("已取消");
        }
    }

    // 处理删除指令
    function handleDeleteCommand(content) {
        const match = content.match(/(\d+)/);
        if (match) {
            // 用户直接指定了编号，但这里的编号通常是指详细列表里的顺序
            // 为了安全，建议先看列表。或者这里直接获取列表并删除
            const data = getData();
            const list = data.records.slice().reverse();
            handleDeleteIndex(parseInt(match[1]), list);
        } else {
            showRecords(true);
        }
    }

    // 处理修改指令
    function handleModify(content) {
        // 格式: 修改体重记录 1 60
        const parts = content.split(/\s+/);
        if (parts.length < 3) {
            sendMessage("❌ 格式错误，例: 修改体重记录 1 60.5");
            return;
        }
        const index = parseInt(parts[1]);
        const newWeight = parseFloat(parts[2]);

        const data = getData();
        const list = data.records.slice().reverse();

        if (index < 1 || index > list.length) {
            sendMessage("❌ 编号无效");
            return;
        }

        const target = list[index - 1];
        if (waitForConfirm(`📝 将 [${index}] ${target.date} 从 ${target.weight}kg 修改为 ${newWeight}kg ?`)) {
            const realIdx = data.records.findIndex(r => r.date === target.date);
            if (realIdx >= 0) {
                data.records[realIdx].weight = newWeight;
                data.records[realIdx].timestamp = new Date().getTime();
                saveData(data);
                sendMessage("✅ 修改成功");
            }
        } else {
            sendMessage("已取消");
        }
    }

    function handleClear() {
        if (waitForConfirm("⚠️ 确认清空所有数据？(不可恢复)")) {
            safeBucketDel(`user_${getUserID()}`);
            sendMessage("🗑️ 已清空");
        } else {
            sendMessage("已取消");
        }
    }

    function showStatistics() {
        const data = getData();
        if (data.records.length === 0) { sendMessage("暂无记录"); return; }
        const weights = data.records.map(r => r.weight);
        const max = Math.max(...weights);
        const min = Math.min(...weights);
        const avg = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);

        sendMessage(`📊 统计信息\n最高: ${max}kg\n最低: ${min}kg\n平均: ${avg}kg\n记录数: ${weights.length}`);
    }

    function showHelp() {
        sendMessage(`📖 体重记录 v2.0.0
体重 60 → 记录
体重记录 → 查看
体重详细记录 → 管理
删除体重记录 [编号]
修改体重记录 [编号] [数值]
体重统计
设置目标体重 [数值]
目标进度
清空体重记录`);
    }

    function main() {
        const content = getMessageContent().trim();

        // 简单路由
        if (content.startsWith("设置目标体重")) {
            handleSetTarget(content);
        } else if (content === "目标进度") {
            showProgress();
        } else if (content === "体重统计") {
            showStatistics();
        } else if (content.startsWith("修改体重记录")) {
            handleModify(content);
        } else if (content.startsWith("删除体重记录")) {
            handleDeleteCommand(content);
        } else if (content.startsWith("清空体重记录")) {
            handleClear();
        } else if (content === "体重详细记录") {
            showRecords(true);
        } else if (content === "体重记录") {
            showRecords(false);
        } else if (content === "体重帮助") {
            showHelp();
        } else if (content.startsWith("体重 ") || content.startsWith("体重记录 ")) {
            // "体重 60" 或 "体重记录 2023-01-01 60"
            handleRecord(content);
        }
    }

    main();
})();
