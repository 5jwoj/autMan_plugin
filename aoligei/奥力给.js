/**
 * 奥力给记录插件 v1.8.0
 * 基于autMan实际API结构开发
 * 功能: 自动记录每次拉屎的时间,并支持查询历史记录
 * 
 * 使用说明:
 * - 发送「奥力给」→ 自动记录拉屎时间(需确认)
 * - 发送「奥力给记录」→ 查看时间轴视图
 * - 发送「奥力给详细记录」→ 查看带编号的完整记录
 * - 发送「删除奥力给记录 [编号]」→ 删除指定编号的记录(需确认)
 * - 发送「清空奥力给记录」→ 清空所有记录(需确认)
 * - 发送「奥力给帮助」→ 显示帮助
 * 
 * 交互说明:
 * - 确认操作时回复 Y/y 执行
 * - 回复 Q/q 或 N/n 取消操作
 * - 记录后需按提示选择 A/B/C 类型
 * - 超时30秒自动退出
 * 
 * 更新历史:
 * v1.8.0 - 重构为 input() 模式，彻底解决指令冲突
 * v1.7.5 - 恢复独立Q监听，添加防冲突协同逻辑
 */

// [disable:false]
// [rule: (.*奥力给.*)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: v1.8.0]
// [update: 重构为 input() 模式]

// 定义存储桶名称
const BUCKET_NAME = "aoligei_record";
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
     * 发送消息 - 兼容多种方式
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
        const confirmed = waitForConfirm(`📝 准备记录 ${userName} 的拉屎时间:\n${currentTime}\n\n确认记录请回复 Y, 取消请回复 Q 或 N\n(30秒内有效)`);

        if (!confirmed) {
            sendMessage("已取消记录");
            return;
        }

        // 2. 写入数据
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        let existingData = safeBucketGet(STORAGE_KEY);
        let data = { records: [] };

        if (existingData && existingData !== "" && existingData !== "null") {
            try { data = JSON.parse(existingData); } catch (e) { }
            if (Array.isArray(data)) data = { records: data };
            if (!data.records) data.records = [];
        }

        const newRecord = {
            time: currentTime,
            timestamp: new Date().getTime(),
            type: null
        };
        data.records.push(newRecord);
        safeBucketSet(STORAGE_KEY, JSON.stringify(data));

        // 3. 选择类型
        sendMessage(`✅ 已记录!\n\n💩 请选择类型：\nA - 通畅\nB - 费劲\nC - 拉稀\n\n直接发送 A、B 或 C\n(回复其他跳过)`);

        const typeReply = input(30000);
        if (typeReply) {
            const typeMatch = typeReply.trim().match(/^([ABCabc])$/i);
            if (typeMatch) {
                const typeChoice = typeMatch[1].toUpperCase();
                const typeName = typeChoice === 'A' ? '通畅' : (typeChoice === 'B' ? '费劲' : '拉稀');

                // 更新最后一条记录
                data.records[data.records.length - 1].type = typeChoice;
                safeBucketSet(STORAGE_KEY, JSON.stringify(data));
                sendMessage(`✅ 已设置类型为: ${typeChoice} - ${typeName}`);
            } else {
                sendMessage("已跳过类型选择");
            }
        } else {
            sendMessage("超时未选择，已跳过");
        }
    }

    // 生成时间轴视图
    function generateTimelineView(records) {
        if (records.length === 0) return "";
        const groupedByDate = {};
        records.forEach(record => {
            const date = record.time.substring(0, 10);
            if (!groupedByDate[date]) groupedByDate[date] = [];
            groupedByDate[date].push(record);
        });
        const dates = Object.keys(groupedByDate).sort().reverse();
        const totalRecords = records.length;

        let message = `📊 奥力给记录 (共${totalRecords}条)\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        const maxDaysToShow = 7;
        const recentDays = dates.slice(0, maxDaysToShow);

        recentDays.forEach(date => {
            const dayRecords = groupedByDate[date];
            const [year, month, day] = date.split('-');
            const count = dayRecords.length;
            let marker = count === 1 ? "🟢" : (count === 2 ? "🟡" : (count === 3 ? "🟠" : "🔴"));

            message += `🗓️ ${parseInt(month)}月${parseInt(day)}日 ${marker}\n`;
            dayRecords.forEach((record, index) => {
                const isLast = index === dayRecords.length - 1;
                const prefix = isLast ? "└─" : "├─";
                const timeStr = record.time.substring(11, 16);
                const typeIcon = record.type ? (record.type === 'A' ? '🟢' : (record.type === 'B' ? '🟡' : '🔴')) : '';
                const typeName = record.type ? (record.type === 'A' ? '通畅' : (record.type === 'B' ? '费劲' : '拉稀')) : '';
                const typeDisplay = record.type ? ` ${typeIcon}${typeName}` : '';
                message += `  ${prefix} ${timeStr}${typeDisplay}\n`;
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
            try {
                const parsed = JSON.parse(existingData);
                records = Array.isArray(parsed) ? parsed : (parsed.records || []);
            } catch (e) { }
        }

        if (records.length === 0) {
            sendMessage("📋 暂无奥力给记录");
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
            try {
                const parsed = JSON.parse(existingData);
                records = Array.isArray(parsed) ? parsed : (parsed.records || []);
            } catch (e) { }
        }

        if (records.length === 0) {
            sendMessage("📋 暂无奥力给记录");
            return;
        }

        let message = `📋 奥力给详细记录 (共${records.length}条)\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        records.forEach((record, index) => {
            const num = index + 1;
            const typeIcon = record.type ? (record.type === 'A' ? '🟢' : (record.type === 'B' ? '🟡' : '🔴')) : '⬜';
            const typeName = record.type ? (record.type === 'A' ? '通畅' : (record.type === 'B' ? '费劲' : '拉稀')) : '未设置';
            message += `[${num}] ${record.time} ${typeIcon} ${typeName}\n`;
        });
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "💡 (30秒内) 发送数字编号可快速删除\n例如: 直接发送 2 即可删除第2条\n(回复 Q 退出)";

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
                try {
                    const parsed = JSON.parse(existingData);
                    records = Array.isArray(parsed) ? parsed : (parsed.records || []);
                } catch (e) { }
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
            let data = { records: records };
            const userID = getUserID();
            const STORAGE_KEY = `user_${userID}`;

            if (records.length === 0) safeBucketDel(STORAGE_KEY);
            else safeBucketSet(STORAGE_KEY, JSON.stringify(data));

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
        let helpMessage = "📖 奥力给记录插件使用说明 v1.8.0\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";
        helpMessage += "🔹 发送「奥力给」→ 自动记录拉屎时间(需确认)\n";
        helpMessage += "🔹 发送「奥力给记录」→ 查看时间轴视图\n";
        helpMessage += "🔹 发送「奥力给详细记录」→ 查看带编号的完整记录\n";
        helpMessage += "🔹 发送「删除奥力给记录 [编号]」→ 删除指定记录(需确认)\n";
        helpMessage += "🔹 发送「清空奥力给记录」→ 清空所有记录(需确认)\n";
        sendMessage(helpMessage);
    }

    // 主函数
    function main() {
        const content = getMessageContent().trim();

        if (content === '奥力给' || content === '奥力给记录' || content === '奥力给帮助') {
            // 精确匹配
        } else if (content.indexOf("奥力给") === -1 && !content.match(/^[ABCabcYyNnQq]$/)) {
            // 如果不包含关键词且不是简短指令(虽然rule限制了，但防万一)
            return;
        }

        if (content.indexOf("清空奥力给记录") !== -1) {
            handleClear();
        } else if (content.indexOf("删除奥力给记录") !== -1) {
            const match = content.match(/删除奥力给记录\s+(\d+)/);
            if (match && match[1]) {
                handleDelete(match[1]);
            } else {
                handleDetailedRecords(); // 没给编号就去详细列表
            }
        } else if (content.indexOf("奥力给详细记录") !== -1) {
            handleDetailedRecords();
        } else if (content.indexOf("奥力给记录") !== -1) {
            showAllRecords();
        } else if (content.indexOf("奥力给帮助") !== -1) {
            showHelp();
        } else if (content === "奥力给") {
            handleRecord();
        }
    }

    main();
})();
