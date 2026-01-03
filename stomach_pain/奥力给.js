/**
 * 奥力给记录插件 v1.2.0
 * 基于autMan实际API结构开发
 * 功能: 自动记录每次拉屎的时间,并支持查询历史记录
 * 
 * 使用说明:
 * - 发送「奥力给」→ 自动记录拉屎时间
 * - 发送「奥力给记录」→ 查看时间轴视图
 * - 发送「奥力给详细记录」→ 查看带编号的完整记录
 * - 发送「删除奥力给记录 [编号]」→ 删除指定编号的记录
 * - 发送「清空奥力给记录」→ 清空所有记录
 * - 发送「奥力给帮助」→ 显示帮助
 * 
 * 更新历史:
 * v1.2.0 - 新增智能删除模式：查看记录后可直接发送编号删除（5分钟有效）
 * v1.0.0 - 初始版本,采用时间轴视图,支持智能分页
 */

// [disable:false]
// [rule: .*奥力给.*]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: 2026.01.03.3]

// 定义存储桶名称
const BUCKET_NAME = "aoligei_record";
const DELETE_MODE_BUCKET = "aoligei_delete_mode"; // 删除模式状态存储
const DELETE_MODE_TIMEOUT = 5 * 60 * 1000; // 5分钟超时

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
async function sendMessage(text) {
    // 尝试多种发送方式
    if (typeof Sender !== 'undefined' && Sender && typeof Sender.reply === 'function') {
        return Sender.reply(text);
    }
    if (this && this.Sender && typeof this.Sender.reply === 'function') {
        return this.Sender.reply(text);
    }
    if (typeof reply === 'function') {
        return reply(text);
    }
    if (typeof sendText === 'function') {
        return sendText(text);
    }
    console.log("[发送消息]", text);
}

/**
 * 获取消息内容
 */
function getMessageContent() {
    // 从this.Sender.sender.message获取
    if (this && this.Sender && this.Sender.sender && this.Sender.sender.message) {
        return this.Sender.sender.message.text || "";
    }
    // 从this.Sender.sender.baseSender获取
    if (this && this.Sender && this.Sender.sender && this.Sender.sender.baseSender) {
        return this.Sender.sender.baseSender.content || "";
    }
    // 从this.Sender.sender.content获取
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
        if (msg.sender && msg.sender.iD) {
            return String(msg.sender.iD);
        }
        if (msg.chat && msg.chat.iD) {
            return String(msg.chat.iD);
        }
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

/**
 * 记录拉屎时间
 */
async function recordPoopTime() {
    try {
        const currentTime = getCurrentTime();
        const userID = getUserID();
        const userName = getUserName();

        // 定义存储键
        const STORAGE_KEY = `user_${userID}`;

        // 获取已有记录
        const existingRecords = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let records = [];

        if (existingRecords && existingRecords !== "" && existingRecords !== "null") {
            try {
                records = JSON.parse(existingRecords);
            } catch (e) {
                console.log("解析记录失败,初始化为空数组");
                records = [];
            }
        }

        // 添加新记录
        records.push({
            time: currentTime,
            timestamp: new Date().getTime()
        });

        // 保存记录
        await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(records));

        // 发送确认消息
        const message = `✅ 奥力给! 已记录 ${userName} 的拉屎时间:\n${currentTime}\n\n当前共有 ${records.length} 条记录`;
        await sendMessage(message);

    } catch (error) {
        console.error("记录时出错:", error);
        await sendMessage(`❌ 记录时出错: ${error.message}`);
    }
}

/**
 * 生成时间轴视图
 */
function generateTimelineView(records) {
    if (records.length === 0) return "";

    // 按日期分组
    const groupedByDate = {};
    records.forEach(record => {
        const date = record.time.substring(0, 10);
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(record.time.substring(11, 16)); // 时:分
    });

    // 获取日期列表并排序(最新在前)
    const dates = Object.keys(groupedByDate).sort().reverse();

    // 计算统计信息
    const totalDays = dates.length;
    const totalRecords = records.length;
    const firstDate = new Date(records[0].timestamp);
    const lastDate = new Date(records[records.length - 1].timestamp);
    const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;

    let message = `📊 奥力给记录 (共${totalRecords}条)\n`;
    message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    // 智能分页策略
    const maxDaysToShow = 7; // 最多显示7天的详细记录
    const recentDays = dates.slice(0, maxDaysToShow);

    // 如果数据很多,先显示月度摘要
    if (totalDays > maxDaysToShow) {
        message += "📈 月度统计摘要\n";
        message += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n";

        // 按月统计
        const monthlyStats = {};
        dates.forEach(date => {
            const month = date.substring(0, 7); // YYYY-MM
            if (!monthlyStats[month]) {
                monthlyStats[month] = 0;
            }
            monthlyStats[month] += groupedByDate[date].length;
        });

        Object.keys(monthlyStats).sort().reverse().forEach(month => {
            const [year, mon] = month.split('-');
            message += `${year}年${mon}月: ${monthlyStats[month]}次\n`;
        });

        message += `\n📅 最近${maxDaysToShow}天详细记录\n`;
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // 显示详细记录
    recentDays.forEach(date => {
        const times = groupedByDate[date];
        const [year, month, day] = date.split('-');
        const count = times.length;

        // 频率标记
        let marker = "";
        if (count === 1) marker = "🟢";
        else if (count === 2) marker = "🟡";
        else if (count === 3) marker = "🟠";
        else marker = "🔴";

        message += `🗓️ ${parseInt(month)}月${parseInt(day)}日 ${marker}\n`;

        times.forEach((time, index) => {
            const isLast = index === times.length - 1;
            const prefix = isLast ? "└─" : "├─";
            message += `  ${prefix} ${time}\n`;
        });

        message += `  📊 当天${count}次\n\n`;
    });

    // 如果还有更多记录
    if (dates.length > maxDaysToShow) {
        const hiddenDays = dates.length - maxDaysToShow;
        const hiddenRecords = dates.slice(maxDaysToShow).reduce((sum, date) => {
            return sum + groupedByDate[date].length;
        }, 0);
        message += `... 还有${hiddenDays}天${hiddenRecords}条记录\n\n`;
    }

    // 总体统计
    message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    message += "📈 总体统计\n";
    message += `• 记录时段: ${dates[dates.length - 1]} 至 ${dates[0]}\n`;
    message += `• 记录天数: ${totalDays}天 (跨度${daysDiff}天)\n`;
    message += `• 总计次数: ${totalRecords}次\n`;

    if (daysDiff > 0) {
        const avgFreq = (totalRecords / daysDiff).toFixed(2);
        message += `• 平均频率: ${avgFreq}次/天`;
    }

    return message;
}

/**
 * 显示所有记录
 */
async function showAllRecords() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingRecords = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let records = [];

        if (existingRecords && existingRecords !== "" && existingRecords !== "null") {
            try {
                records = JSON.parse(existingRecords);
            } catch (e) {
                records = [];
            }
        }

        if (records.length === 0) {
            await sendMessage("📋 暂无奥力给记录");
            return;
        }

        // 生成时间轴视图
        const message = generateTimelineView(records);
        await sendMessage(message);

    } catch (error) {
        console.error("查询时出错:", error);
        await sendMessage(`❌ 查询时出错: ${error.message}`);
    }
}

/**
 * 显示带编号的详细记录
 */
async function showDetailedRecords() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingRecords = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let records = [];

        if (existingRecords && existingRecords !== "" && existingRecords !== "null") {
            try {
                records = JSON.parse(existingRecords);
            } catch (e) {
                records = [];
            }
        }

        if (records.length === 0) {
            await sendMessage("📋 暂无奥力给记录");
            return;
        }

        // 生成带编号的详细记录
        let message = `📋 奥力给详细记录 (共${records.length}条)\n`;
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

        records.forEach((record, index) => {
            const num = index + 1;
            message += `[${num}] ${record.time}\n`;
        });

        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "💡 现在可以直接发送编号删除记录\n";
        message += "例如: 直接发送 3 即可删除第3条\n";
        message += "或使用完整指令: 删除奥力给记录 3";

        await sendMessage(message);

        // 设置删除模式状态
        await setDeleteMode(userID);

    } catch (error) {
        console.error("查询详细记录时出错:", error);
        await sendMessage(`❌ 查询详细记录时出错: ${error.message}`);
    }
}

/**
 * 设置删除模式状态
 */
async function setDeleteMode(userID) {
    try {
        const state = {
            timestamp: new Date().getTime(),
            mode: "delete"
        };
        await bucketSet(DELETE_MODE_BUCKET, `user_${userID}`, JSON.stringify(state));
        console.log(`[删除模式] 已为用户 ${userID} 设置删除模式`);
    } catch (error) {
        console.error("设置删除模式失败:", error);
    }
}

/**
 * 检查是否处于删除模式
 */
async function isInDeleteMode(userID) {
    try {
        const stateStr = await bucketGet(DELETE_MODE_BUCKET, `user_${userID}`);
        if (!stateStr || stateStr === "" || stateStr === "null") {
            return false;
        }

        const state = JSON.parse(stateStr);
        const now = new Date().getTime();
        const elapsed = now - state.timestamp;

        // 检查是否超时
        if (elapsed > DELETE_MODE_TIMEOUT) {
            console.log(`[删除模式] 已超时 ${elapsed}ms，清除状态`);
            await bucketDel(DELETE_MODE_BUCKET, `user_${userID}`);
            return false;
        }

        console.log(`[删除模式] 用户处于删除模式，剩余时间: ${DELETE_MODE_TIMEOUT - elapsed}ms`);
        return true;
    } catch (error) {
        console.error("检查删除模式失败:", error);
        return false;
    }
}

/**
 * 清除删除模式状态
 */
async function clearDeleteMode(userID) {
    try {
        await bucketDel(DELETE_MODE_BUCKET, `user_${userID}`);
        console.log(`[删除模式] 已清除用户 ${userID} 的删除模式`);
    } catch (error) {
        console.error("清除删除模式失败:", error);
    }
}

/**
 * 根据编号删除记录
 */
async function deleteRecordByIndex(indexStr) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        // 获取已有记录
        const existingRecords = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let records = [];

        if (existingRecords && existingRecords !== "" && existingRecords !== "null") {
            try {
                records = JSON.parse(existingRecords);
            } catch (e) {
                await sendMessage("❌ 记录数据格式错误");
                return;
            }
        }

        if (records.length === 0) {
            await sendMessage("📋 暂无记录可删除");
            return;
        }

        // 解析编号
        const index = parseInt(indexStr);
        if (isNaN(index) || index < 1 || index > records.length) {
            await sendMessage(`❌ 无效的编号"${indexStr}"\n请使用「奥力给详细记录」查看有效编号`);
            return;
        }

        // 删除指定记录
        const deletedRecord = records[index - 1];
        records.splice(index - 1, 1);

        // 保存更新后的记录
        if (records.length === 0) {
            await bucketDel(BUCKET_NAME, STORAGE_KEY);
        } else {
            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(records));
        }

        // 发送确认消息
        const message = `✅ 已删除记录 [${index}]:\n${deletedRecord.time}\n\n剩余 ${records.length} 条记录`;
        await sendMessage(message);

    } catch (error) {
        console.error("删除记录时出错:", error);
        await sendMessage(`❌ 删除记录时出错: ${error.message}`);
    }
}

/**
 * 清空记录
 */
async function clearAllRecords() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        console.log(`[清空记录] 用户ID: ${userID}, 存储键: ${STORAGE_KEY}`);

        // 删除前先检查是否有数据
        const beforeDelete = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        console.log(`[清空记录] 删除前的数据: ${beforeDelete}`);

        // 执行删除
        const delResult = await bucketDel(BUCKET_NAME, STORAGE_KEY);
        console.log(`[清空记录] bucketDel返回值: ${delResult}`);

        // 删除后验证
        const afterDelete = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        console.log(`[清空记录] 删除后的数据: ${afterDelete}`);

        // 如果删除后仍有数据,尝试设置为空
        if (afterDelete && afterDelete !== "" && afterDelete !== "null") {
            console.log(`[清空记录] 数据未删除,尝试设置为空`);
            await bucketSet(BUCKET_NAME, STORAGE_KEY, "");
            await sendMessage("🗑️ 已清空所有奥力给记录 (使用清空方式)");
        } else {
            await sendMessage("🗑️ 已清空所有奥力给记录");
        }

    } catch (error) {
        console.error("清空记录时出错:", error);
        await sendMessage(`❌ 清空记录时出错: ${error.message}`);
    }
}

/**
 * 显示帮助信息
 */
async function showHelp() {
    try {
        let helpMessage = "📖 奥力给记录插件使用说明 v1.1.0\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";
        helpMessage += "🔹 发送「奥力给」→ 自动记录拉屎时间\n";
        helpMessage += "🔹 发送「奥力给记录」→ 查看时间轴视图\n";
        helpMessage += "🔹 发送「奥力给详细记录」→ 查看带编号的完整记录 🆕\n";
        helpMessage += "🔹 发送「删除奥力给记录 [编号]」→ 删除指定记录 🆕\n";
        helpMessage += "🔹 发送「清空奥力给记录」→ 清空所有记录\n";
        helpMessage += "🔹 发送「奥力给帮助」→ 显示此帮助\n\n";
        helpMessage += "✨ 新功能: 删除单条记录\n";
        helpMessage += "• 发送「奥力给详细记录」查看编号\n";
        helpMessage += "• 发送「删除奥力给记录 3」删除第3条\n";
        helpMessage += "• 误操作可以精准撤销\n\n";
        helpMessage += "💡 提示: 每次记录都会自动保存,可随时查询历史数据";

        await sendMessage(helpMessage);

    } catch (error) {
        console.error("显示帮助时出错:", error);
        await sendMessage(`❌ 显示帮助时出错: ${error.message}`);
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        // 获取消息内容
        const content = getMessageContent().trim();
        const userID = getUserID();

        console.log(`[奥力给插件] 收到消息: [${content}]`);

        // 检查是否是纯数字（智能删除模式）
        const isPureNumber = /^\d+$/.test(content);
        if (isPureNumber) {
            const inDeleteMode = await isInDeleteMode(userID);
            if (inDeleteMode) {
                console.log(`[奥力给插件] 智能删除模式: 删除编号 ${content}`);
                await deleteRecordByIndex(content);
                await clearDeleteMode(userID);
                return;
            }
        }

        // 检查是否包含关键词(按长度从长到短匹配)
        if (content.indexOf("清空奥力给记录") !== -1) {
            console.log("[奥力给插件] 执行: 清空记录");
            await clearAllRecords();
        } else if (content.indexOf("删除奥力给记录") !== -1) {
            console.log("[奥力给插件] 执行: 删除指定记录");
            // 提取编号
            const match = content.match(/删除奥力给记录\s+(\d+)/);
            if (match && match[1]) {
                await deleteRecordByIndex(match[1]);
            } else {
                // 没有编号时，自动显示详细记录
                console.log("[奥力给插件] 未提供编号，显示详细记录");
                await showDetailedRecords();
            }
        } else if (content.indexOf("奥力给详细记录") !== -1) {
            console.log("[奥力给插件] 执行: 查看详细记录");
            await showDetailedRecords();
        } else if (content.indexOf("奥力给记录") !== -1) {
            console.log("[奥力给插件] 执行: 查看记录");
            await showAllRecords();
        } else if (content.indexOf("奥力给帮助") !== -1) {
            console.log("[奥力给插件] 执行: 显示帮助");
            await showHelp();
        } else if (content.indexOf("奥力给") !== -1) {
            console.log("[奥力给插件] 执行: 记录时间");
            await recordPoopTime();
        }

    } catch (error) {
        console.error("[奥力给插件] 执行出错:", error);
        try {
            await sendMessage(`💥 插件执行出错: ${error.message}`);
        } catch (e) {
            console.error("无法发送错误消息:", e);
        }
    }
}

// 执行主函数
main().catch(error => {
    console.error("[奥力给插件] Fatal error:", error);
});
