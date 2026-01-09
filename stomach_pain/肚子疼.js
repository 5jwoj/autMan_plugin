/**
 * 肚子疼记录插件 v2.0.0
 * 基于autMan实际API结构重写
 * 功能: 自动记录孩子肚子疼的时间,并支持查询历史记录
 * 
 * 使用说明:
 * - 发送「肚子疼」→ 自动记录时间(需确认)
 * - 发送「肚子疼记录」→ 查看时间轴视图
 * - 发送「肚子疼详细记录」→ 查看带编号的完整记录
 * - 发送「删除肚子疼记录 [编号]」→ 删除指定编号的记录(需确认)
 * - 发送「清空肚子疼记录」→ 清空所有记录(需确认)
 * - 发送「肚子疼帮助」→ 显示帮助
 * 
 * 交互说明:
 * - 确认操作时回复 Y/y 执行
 * - 回复 Q/q 或 N/n 取消操作
 * - 超时30秒自动退出
 * 
 * 更新历史:
 * v2.0.0 - 重构为 input() 模式，彻底解决指令冲突
 * v1.9.5 - 恢复独立Q监听，添加防冲突协同逻辑
 */

// [disable:false]
// [rule: (.*肚子疼.*)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: v2.0.0]
// [update: 重构为 input() 模式]

// 定义存储桶名称
const BUCKET_NAME = "stomach_pain";
(function () {
    // 放入 IIFE 防止变量冲突

    /**
     * 获取当前时间字符串
     */
    function getCurrentTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
        // 其他输入视为取消
        return false;
    }

    // 记录流程
    function handleRecord() {
        const currentTime = getCurrentTime();
        const userName = getUserName();

        // 1. 确认
        const confirmed = waitForConfirm(`📝 准备记录 ${userName} 的肚子疼时间:\n${currentTime}\n\n确认记录请回复 Y, 取消请回复 Q 或 N\n(30秒内有效)`);

        if (!confirmed) {
            sendMessage("已取消记录");
            return;
        }

        // 2. 写入数据
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        let existingData = safeBucketGet(STORAGE_KEY);
        let records = [];

        if (existingData && existingData !== "" && existingData !== "null") {
            try { records = JSON.parse(existingData); } catch (e) { }
        }
        if (!Array.isArray(records)) records = [];

        records.push({
            time: currentTime,
            timestamp: new Date().getTime()
        });

        safeBucketSet(STORAGE_KEY, JSON.stringify(records));
        sendMessage(`✅ 已记录 ${userName} 的肚子疼时间:\n${currentTime}\n\n当前共有 ${records.length} 条记录`);
    }

    // 生成时间轴视图
    function generateTimelineView(records) {
        if (records.length === 0) return "";
        const groupedByDate = {};
        records.forEach(record => {
            const date = record.time.substring(0, 10);
            if (!groupedByDate[date]) groupedByDate[date] = [];
            groupedByDate[date].push(record.time.substring(11, 16));
        });
        const dates = Object.keys(groupedByDate).sort().reverse();
        const totalRecords = records.length;

        let message = `📊 肚子疼记录 (共${totalRecords}条)\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        const maxDaysToShow = 7;
        const recentDays = dates.slice(0, maxDaysToShow);

        recentDays.forEach(date => {
            const times = groupedByDate[date];
            const [year, month, day] = date.split('-');
            const count = times.length;
            let marker = count === 1 ? "🟢" : (count === 2 ? "🟡" : (count === 3 ? "🟠" : "🔴"));

            message += `🗓️ ${parseInt(month)}月${parseInt(day)}日 ${marker}\n`;
            times.forEach((time, index) => {
                const isLast = index === times.length - 1;
                const prefix = isLast ? "└─" : "├─";
                message += `  ${prefix} ${time}\n`;
            });
            message += `  📊 当天${count}次\n\n`;
        });

        if (dates.length > maxDaysToShow) {
            message += `... 还有更多历史记录\n\n`;
        }
        return message;
    }

    function showAllRecords() {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const existingData = safeBucketGet(STORAGE_KEY);
        let records = [];
        if (existingData) {
            try { records = JSON.parse(existingData); } catch (e) { }
        }

        if (records.length === 0) {
            sendMessage("📋 暂无肚子疼记录");
        } else {
            sendMessage(generateTimelineView(records));
        }
    }

    function handleDetailedRecords() {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const existingData = safeBucketGet(STORAGE_KEY);
        let records = [];
        if (existingData) {
            try { records = JSON.parse(existingData); } catch (e) { }
        }

        if (records.length === 0) {
            sendMessage("📋 暂无肚子疼记录");
            return;
        }

        let message = `📋 肚子疼详细记录 (共${records.length}条)\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        records.forEach((record, index) => {
            const num = index + 1;
            message += `[${num}] ${record.time}\n`;
        });
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "💡 (30秒内) 发送数字编号可快速删除\n例如: 直接发送 3 即可删除第3条\n(回复 Q 退出)";

        sendMessage(message);

        // 等待用户输入编号
        const reply = input(30000);
        if (!reply) return; // 超时

        if (/^\d+$/.test(reply)) {
            // 是数字，尝试删除
            handleDelete(reply, records);
        } else if (/^[Qq]$/i.test(reply)) {
            sendMessage("✅ 已退出");
        }
    }

    function handleDelete(indexStr, records) {
        if (!records) {
            // 重新获取一下以防万一
            const userID = getUserID();
            const STORAGE_KEY = `user_${userID}`;
            const existingData = safeBucketGet(STORAGE_KEY);
            if (existingData) {
                try { records = JSON.parse(existingData); } catch (e) { }
            }
            if (!records) records = [];
        }

        const index = parseInt(indexStr);
        if (isNaN(index) || index < 1 || index > records.length) {
            sendMessage(`❌ 无效的编号"${indexStr}"`);
            return;
        }

        const targetRecord = records[index - 1];
        const confirmed = waitForConfirm(`🗑️ 准备删除记录 [${index}]:\n${targetRecord.time}\n\n确认删除请回复 Y, 取消请回复 Q`);

        if (confirmed) {
            records.splice(index - 1, 1);
            const userID = getUserID();
            const STORAGE_KEY = `user_${userID}`;

            if (records.length === 0) safeBucketDel(STORAGE_KEY);
            else safeBucketSet(STORAGE_KEY, JSON.stringify(records));

            sendMessage("✅ 删除成功");
        } else {
            sendMessage("已取消删除");
        }
    }

    function handleClear() {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const existingData = safeBucketGet(STORAGE_KEY);
        if (!existingData) {
            sendMessage("📋 暂无记录");
            return;
        }

        const confirmed = waitForConfirm(`⚠️ 确定要清空所有记录吗？\n\n此操作不可恢复!\n\n确认清空请回复 Y`);
        if (confirmed) {
            safeBucketDel(STORAGE_KEY);
            sendMessage("🗑️ 已清空所有记录");
        } else {
            sendMessage("已取消清空");
        }
    }

    function showHelp() {
        let helpMessage = "📖 肚子疼记录插件使用说明 v2.0.0\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";
        helpMessage += "🔹 发送「肚子疼」→ 自动记录时间(需确认)\n";
        helpMessage += "🔹 发送「肚子疼记录」→ 查看时间轴视图\n";
        helpMessage += "🔹 发送「肚子疼详细记录」→ 查看带编号的完整记录\n";
        helpMessage += "🔹 发送「删除肚子疼记录 [编号]」→ 删除指定记录(需确认)\n";
        helpMessage += "🔹 发送「清空肚子疼记录」→ 清空所有记录(需确认)\n";
        sendMessage(helpMessage);
    }

    // 主函数
    function main() {
        const content = getMessageContent().trim();

        if (content === '肚子疼' || content === '肚子疼记录' || content === '肚子疼帮助') {
            // 精确匹配
        } else if (content.indexOf("肚子疼") === -1 && !content.match(/^[YyNnQq]$/)) {
            return;
        }

        if (content.indexOf("清空肚子疼记录") !== -1) {
            handleClear();
        } else if (content.indexOf("删除肚子疼记录") !== -1) {
            const match = content.match(/删除肚子疼记录\s+(\d+)/);
            if (match && match[1]) {
                handleDelete(match[1]);
            } else {
                handleDetailedRecords(); // 没给编号就去详细列表
            }
        } else if (content.indexOf("肚子疼详细记录") !== -1) {
            handleDetailedRecords();
        } else if (content.indexOf("肚子疼记录") !== -1) {
            showAllRecords();
        } else if (content.indexOf("肚子疼帮助") !== -1) {
            showHelp();
        } else if (content === "肚子疼") {
            handleRecord();
        }
    }

    main();
})();
