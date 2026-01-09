/**
 * 肚子疼记录插件 v1.9.0
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
 * - 超时60秒自动退出
 * 
 * 更新历史:
 * v1.9.0 - 添加交互式确认机制,支持回复Q退出
 * v1.8.0 - 优化删除体验：支持查看记录后直接输入数字删除
 * v1.4.0 - 采用时间轴视图,添加智能分页(默认显示最近7天)
 * v1.3.0 - 尝试日历UI设计
 * v1.2.0 - 新增日历视图
 */

// [disable:false]
// [rule: (.*肚子疼.*|^[YyNnQq]$)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: 2026.01.09.1]

// 定义存储桶名称
const BUCKET_NAME = "stomach_pain";
const PENDING_ACTION_BUCKET = "stomach_pain_pending"; // 等待用户确认的操作状态

/**
 * 等待用户输入 - 封装listen方法
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise<string|null>} - 用户输入或null(超时)
 */
async function waitForInput(timeout = 60000) {
    if (typeof Sender !== 'undefined' && Sender && typeof Sender.listen === 'function') {
        return Sender.listen(timeout);
    }
    if (this && this.Sender && typeof this.Sender.listen === 'function') {
        return this.Sender.listen(timeout);
    }
    console.log("[等待输入] listen方法不可用");
    return null;
}

/**
 * 检查用户输入是否为退出指令
 * @param {string} input - 用户输入
 * @returns {boolean} - 是否为退出指令
 */
function isQuitCommand(input) {
    if (!input) return false;
    const trimmed = input.trim().toLowerCase();
    return trimmed === 'q' || trimmed === 'n';
}

/**
 * 检查用户输入是否为确认指令
 * @param {string} input - 用户输入
 * @returns {boolean} - 是否为确认指令
 */
function isConfirmCommand(input) {
    if (!input) return false;
    const trimmed = input.trim().toLowerCase();
    return trimmed === 'y';
}

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
 * 请求确认记录肚子疼时间（第一阶段）
 */
async function requestRecordConfirmation() {
    try {
        const currentTime = getCurrentTime();
        const userID = getUserID();
        const userName = getUserName();
        const PENDING_KEY = `user_${userID}`;

        // 保存等待状态
        const pendingAction = {
            action: 'record',
            time: currentTime,
            userName: userName,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`📝 准备记录 ${userName} 的肚子疼时间:\n${currentTime}\n\n确认记录请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求确认时出错:", error);
        await sendMessage(`❌ 请求确认时出错: ${error.message}`);
    }
}

/**
 * 执行记录肚子疼时间（第二阶段-确认后执行）
 */
async function executeRecordPainTime(pendingAction) {
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
                console.log("解析记录失败,初始化为空数组");
                records = [];
            }
        }

        // 添加新记录
        records.push({
            time: pendingAction.time,
            timestamp: pendingAction.timestamp
        });

        // 保存记录
        await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(records));

        // 发送确认消息
        const message = `✅ 已记录 ${pendingAction.userName} 的肚子疼时间:\n${pendingAction.time}\n\n当前共有 ${records.length} 条记录`;
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

    let message = `📊 肚子疼记录 (共${totalRecords}条)\n`;
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
            await sendMessage("📋 暂无肚子疼记录");
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
            await sendMessage("📋 暂无肚子疼记录");
            return;
        }

        // 生成带编号的详细记录
        let message = `📋 肚子疼详细记录 (共${records.length}条)\n`;
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

        records.forEach((record, index) => {
            const num = index + 1;
            message += `[${num}] ${record.time}\n`;
        });

        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "💡 (60秒内) 发送数字编号可快速删除\n";
        message += "例如: 直接发送 3 即可删除第3条\n";
        message += "或使用完整指令: 删除肚子疼记录 3";

        await sendMessage(message);

        // 设置 "查看详情" 状态，允许后续输入数字删除
        const PENDING_KEY = `user_${userID}`;
        const pendingAction = {
            action: 'view_details',
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

    } catch (error) {
        console.error("查询详细记录时出错:", error);
        await sendMessage(`❌ 查询详细记录时出错: ${error.message}`);
    }
}


/**
 * 请求确认删除记录（第一阶段）
 */
async function requestDeleteConfirmation(indexStr) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const PENDING_KEY = `user_${userID}`;

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
            await sendMessage(`❌ 无效的编号"${indexStr}"\n请使用「肚子疼详细记录」查看有效编号`);
            return;
        }

        const targetRecord = records[index - 1];

        // 保存等待状态
        const pendingAction = {
            action: 'delete',
            index: index,
            record: targetRecord,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`🗑️ 准备删除记录 [${index}]:\n${targetRecord.time}\n\n确认删除请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求删除确认时出错:", error);
        await sendMessage(`❌ 请求删除确认时出错: ${error.message}`);
    }
}

/**
 * 执行删除记录（第二阶段-确认后执行）
 */
async function executeDeleteRecord(pendingAction) {
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

        const index = pendingAction.index;
        if (index < 1 || index > records.length) {
            await sendMessage(`❌ 记录已变化,请重新操作`);
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
 * 请求确认清空记录（第一阶段）
 */
async function requestClearConfirmation() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const PENDING_KEY = `user_${userID}`;

        // 检查是否有数据
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
            await sendMessage("📋 暂无记录可清空");
            return;
        }

        // 保存等待状态
        const pendingAction = {
            action: 'clear',
            count: records.length,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`⚠️ 确定要清空所有 ${records.length} 条肚子疼记录吗？\n\n此操作不可恢复!\n\n确认清空请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求清空确认时出错:", error);
        await sendMessage(`❌ 请求清空确认时出错: ${error.message}`);
    }
}

/**
 * 执行清空记录（第二阶段-确认后执行）
 */
async function executeClearAllRecords() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        console.log(`[清空记录] 用户ID: ${userID}, 存储键: ${STORAGE_KEY}`);

        // 执行删除
        const delResult = await bucketDel(BUCKET_NAME, STORAGE_KEY);
        console.log(`[清空记录] bucketDel返回值: ${delResult}`);

        // 删除后验证
        const afterDelete = await bucketGet(BUCKET_NAME, STORAGE_KEY);

        // 如果删除后仍有数据,尝试设置为空
        if (afterDelete && afterDelete !== "" && afterDelete !== "null") {
            await bucketSet(BUCKET_NAME, STORAGE_KEY, "");
        }

        await sendMessage("🗑️ 已清空所有肚子疼记录");

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
        let helpMessage = "📖 肚子疼记录插件使用说明 v1.9.0\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";
        helpMessage += "🔹 发送「肚子疼」→ 自动记录时间(需确认)\n";
        helpMessage += "🔹 发送「肚子疼记录」→ 查看时间轴视图\n";
        helpMessage += "🔹 发送「肚子疼详细记录」→ 查看带编号的完整记录\n";
        helpMessage += "🔹 发送「删除肚子疼记录 [编号]」→ 删除指定记录(需确认)\n";
        helpMessage += "🔹 发送「清空肚子疼记录」→ 清空所有记录(需确认)\n";
        helpMessage += "🔹 发送「肚子疼帮助」→ 显示此帮助\n\n";
        helpMessage += "⚙️ 交互说明:\n";
        helpMessage += "• 关键操作需要二次确认\n";
        helpMessage += "• 回复 Y 确认执行\n";
        helpMessage += "• 回复 Q 或 N 取消操作\n\n";
        helpMessage += "✨ 快捷操作:\n";
        helpMessage += "• 查看详细记录后，直接发送数字可删除对应记录\n";

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
        const PENDING_KEY = `user_${userID}`;

        console.log(`[肚子疼插件] 收到消息: [${content}]`);

        // 1. 优先检查是否存在等待确认的操作
        const pendingStateStr = await bucketGet(PENDING_ACTION_BUCKET, PENDING_KEY);
        if (pendingStateStr && pendingStateStr !== "" && pendingStateStr !== "null") {
            try {
                const pendingAction = JSON.parse(pendingStateStr);
                const now = new Date().getTime();

                // 检查是否超时 (60秒)
                if (now - pendingAction.timestamp > 60000) {
                    console.log("[肚子疼插件] 等待操作已超时，清除状态");
                    await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                } else {
                    if (pendingAction.action === 'view_details') {
                        // 在详情浏览模式下，检查是否输入了数字
                        const isPureNumber = /^\d+$/.test(content);
                        if (isPureNumber) {
                            console.log(`[肚子疼插件] 详情浏览模式下检测到数字: ${content}，请求删除确认`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY); // 清除 view_details
                            await requestDeleteConfirmation(content); // 进入删除确认流程
                            return;
                        } else {
                            // 输入非数字，视为退出详情模式，继续匹配其他指令
                            console.log(`[肚子疼插件] 详情浏览模式下输入非数字，清除状态并继续`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                            // 注意：这里不 return，让代码继续向下匹配常规指令
                        }
                    } else {
                        // 检查用户输入
                        if (isConfirmCommand(content)) {
                            // 用户确认执行
                            console.log(`[肚子疼插件] 用户确认执行操作: ${pendingAction.action}`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY); // 先清除状态

                            if (pendingAction.action === 'record') {
                                await executeRecordPainTime(pendingAction);
                            } else if (pendingAction.action === 'delete') {
                                await executeDeleteRecord(pendingAction);
                            } else if (pendingAction.action === 'clear') {
                                await executeClearAllRecords();
                            }
                            return; // 处理完毕，退出

                        } else if (isQuitCommand(content)) {
                            // 用户取消
                            console.log(`[肚子疼插件] 用户取消操作: ${pendingAction.action}`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                            await sendMessage("已退出操作");
                            return; // 处理完毕，退出
                        } else {
                            // 用户输入了其他内容，如果不是触发词，则提示；如果是触发词，可以在下面继续处理（相当于放弃了当前的pending）
                            // 这里策略：如果输入不符合 Y/N/Q，但又不是别的有效命令，提示用户。
                            // 如果是别的有效命令（比如用户突然想查记录），则让下面的逻辑去处理，并清除 pending？
                            // 为了简单和符合直觉：只有 Y/N/Q 会被 pending 逻辑捕获。
                            // 其他输入将清除 pending 并尝试作为新命令执行。
                            console.log("[肚子疼插件] 用户输入非确认指令，清除等待状态，尝试匹配新命令");
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                        }
                    }
                }
            } catch (e) {
                console.error("解析等待状态失败:", e);
                await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
            }
        }

        // 2. 常规命令匹配
        // (已移除原有的直接纯数字匹配逻辑，改为依赖 view_details 状态)

        // 检查是否包含关键词(按长度从长到短匹配)
        if (content.indexOf("清空肚子疼记录") !== -1) {
            console.log("[肚子疼插件] 执行: 请求清空确认");
            await requestClearConfirmation();
        } else if (content.indexOf("删除肚子疼记录") !== -1) {
            console.log("[肚子疼插件] 执行: 请求删除确认");
            // 提取编号
            const match = content.match(/删除肚子疼记录\s+(\d+)/);
            if (match && match[1]) {
                await requestDeleteConfirmation(match[1]);
            } else {
                // 没有编号时，自动显示详细记录
                console.log("[肚子疼插件] 未提供编号，显示详细记录");
                await showDetailedRecords();
            }
        } else if (content.indexOf("肚子疼详细记录") !== -1) {
            console.log("[肚子疼插件] 执行: 查看详细记录");
            await showDetailedRecords();
        } else if (content.indexOf("肚子疼记录") !== -1) {
            console.log("[肚子疼插件] 执行: 查看记录");
            await showAllRecords();
        } else if (content.indexOf("肚子疼帮助") !== -1) {
            console.log("[肚子疼插件] 执行: 显示帮助");
            await showHelp();
        } else if (content.indexOf("肚子疼") !== -1) {
            // 注意：排除包含其他关键词的情况（比如“肚子疼记录”也会匹配“肚子疼”）
            // 由于上面的 if-else 顺序，长的关键词优先，所以这里其实是安全的。
            // 但为了保险，还是确认一下不是 Y/N/Q (虽然上面的 pending 逻辑处理了，但如果 pending 超时或不存在，单纯输入 Y 不应记录)
            if (!isConfirmCommand(content) && !isQuitCommand(content)) {
                console.log("[肚子疼插件] 执行: 请求记录确认");
                await requestRecordConfirmation();
            }
        }

    } catch (error) {
        console.error("[肚子疼插件] 执行出错:", error);
        try {
            await sendMessage(`💥 插件执行出错: ${error.message}`);
        } catch (e) {
            console.error("无法发送错误消息:", e);
        }
    }
}

// 执行主函数
main().catch(error => {
    console.error("[肚子疼插件] Fatal error:", error);
});
