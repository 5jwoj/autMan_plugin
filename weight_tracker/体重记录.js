/**
 * 体重记录插件 v1.1.0
 * 基于autMan实际API结构开发
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
 * - 60秒无操作自动退出
 * 
 * 更新历史:
 * v1.1.0 - 全面添加交互式确认机制
 * v1.0.2 - 优化指令输入
 * v1.0.1 - 优化帮助信息显示
 * v1.0.0 - 初始版本
 */

// [disable:false]
// [rule: (.*体重.*|.*目标.*|^\\d+$|^[YyNnQq]$)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: 2026.01.09.1]

// 定义存储桶名称
const BUCKET_NAME = "weight_tracker";
const PENDING_ACTION_BUCKET = "weight_pending_action"; // 等待确认的状态

/**
 * 检查用户输入是否为退出指令
 */
function isQuitCommand(input) {
    if (!input) return false;
    const trimmed = input.trim().toLowerCase();
    return trimmed === 'q' || trimmed === 'n';
}

/**
 * 检查用户输入是否为确认指令
 */
function isConfirmCommand(input) {
    if (!input) return false;
    const trimmed = input.trim().toLowerCase();
    return trimmed === 'y';
}

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
 * 验证日期格式 (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

/**
 * 请求确认记录体重
 */
async function requestRecordConfirmation(weight, date) {
    try {
        const userID = getUserID();
        const userName = getUserName();
        const PENDING_KEY = `user_${userID}`;

        // 验证体重值
        const weightValue = parseFloat(weight);
        if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
            await sendMessage("❌ 体重数值无效,请输入0-500之间的数字");
            return;
        }

        // 使用指定日期或当前日期
        const recordDate = date || getCurrentDate();

        // 如果指定了日期,验证日期格式
        if (date && !isValidDate(date)) {
            await sendMessage("❌ 日期格式无效,请使用 YYYY-MM-DD 格式 (如: 2026-01-01)");
            return;
        }

        // 保存等待状态
        const pendingAction = {
            action: 'record',
            weight: weightValue,
            date: recordDate,
            userName: userName,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`📝 准备记录 ${userName} 在 ${recordDate} 的体重: ${weightValue}kg\n\n确认记录请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求记录确认时出错:", error);
        await sendMessage(`❌ 请求记录确认时出错: ${error.message}`);
    }
}

/**
 * 执行记录体重
 */
async function executeRecordWeight(pendingAction) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const weightValue = pendingAction.weight;
        const recordDate = pendingAction.date;
        const userName = pendingAction.userName;

        // 获取已有数据
        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
                if (!data.records) data.records = [];
            } catch (e) {
                console.log("解析数据失败,初始化为空数据");
                data = { records: [], target: null };
            }
        }

        // 检查当天是否已有记录
        const existingIndex = data.records.findIndex(r => r.date === recordDate);

        if (existingIndex >= 0) {
            // 更新当天记录
            const oldWeight = data.records[existingIndex].weight;
            data.records[existingIndex].weight = weightValue;
            data.records[existingIndex].timestamp = new Date().getTime();

            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));

            const diff = weightValue - oldWeight;
            const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
            await sendMessage(`✅ 已更新 ${userName} 在 ${recordDate} 的体重记录:\n${oldWeight}kg → ${weightValue}kg (${diffStr}kg)\n\n当前共有 ${data.records.length} 条记录`);
        } else {
            // 添加新记录
            data.records.push({
                date: recordDate,
                weight: weightValue,
                timestamp: new Date().getTime()
            });

            // 按日期排序
            data.records.sort((a, b) => a.date.localeCompare(b.date));

            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));

            let message = `✅ 已记录 ${userName} 在 ${recordDate} 的体重: ${weightValue}kg\n\n当前共有 ${data.records.length} 条记录`;

            // 如果设置了目标,显示进度
            if (data.target) {
                const diff = weightValue - data.target;
                if (Math.abs(diff) < 0.1) {
                    message += `\n\n🎉 恭喜!已达成目标体重 ${data.target}kg!`;
                } else if (diff > 0) {
                    message += `\n\n📊 距离目标体重还差: ${diff.toFixed(1)}kg (需减重)`;
                } else {
                    message += `\n\n📊 距离目标体重还差: ${Math.abs(diff).toFixed(1)}kg (需增重)`;
                }
            }

            await sendMessage(message);
        }

    } catch (error) {
        console.error("记录体重时出错:", error);
        await sendMessage(`❌ 记录体重时出错: ${error.message}`);
    }
}

/**
 * 显示体重记录(时间轴视图)
 */
async function showWeightRecords(days) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        if (data.records.length === 0) {
            await sendMessage("📋 暂无体重记录\\n\\n💡 发送「体重 65.5」开始记录");
            return;
        }

        // 按日期排序(最新在前)
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        // 根据天数过滤
        let displayRecords = sortedRecords;
        if (days) {
            displayRecords = sortedRecords.slice(0, days);
        }

        let message = `📊 体重记录 (共${data.records.length}条)\\n`;
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n";

        displayRecords.forEach((record, index) => {
            const [year, month, day] = record.date.split('-');

            // 计算趋势
            let trend = "";
            if (index < displayRecords.length - 1) {
                const prevWeight = displayRecords[index + 1].weight;
                const diff = record.weight - prevWeight;
                if (diff > 0.1) {
                    trend = ` ↑ +${diff.toFixed(1)}kg`;
                } else if (diff < -0.1) {
                    trend = ` ↓ ${diff.toFixed(1)}kg`;
                } else {
                    trend = " → 持平";
                }
            }

            message += `🗓️ ${parseInt(month)}月${parseInt(day)}日\\n`;
            message += `  📊 ${record.weight}kg${trend}\\n\\n`;
        });

        // 如果还有更多记录
        if (days && sortedRecords.length > days) {
            message += `... 还有${sortedRecords.length - days}条记录\\n`;
            message += `发送「体重统计」查看全部\\n\\n`;
        }

        // 显示目标信息
        if (data.target) {
            const latestWeight = sortedRecords[0].weight;
            const diff = latestWeight - data.target;
            message += "━━━━━━━━━━━━━━━━━━━━━━━━━\\n";
            message += `🎯 目标体重: ${data.target}kg\\n`;
            if (Math.abs(diff) < 0.1) {
                message += `✅ 已达成目标!`;
            } else if (diff > 0) {
                message += `📊 还需减重: ${diff.toFixed(1)}kg`;
            } else {
                message += `📊 还需增重: ${Math.abs(diff).toFixed(1)}kg`;
            }
        }

        await sendMessage(message);

    } catch (error) {
        console.error("查询记录时出错:", error);
        await sendMessage(`❌ 查询记录时出错: ${error.message}`);
    }
}

/**
 * 显示统计信息
 */
async function showStatistics(days) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        if (data.records.length === 0) {
            await sendMessage("📋 暂无体重记录");
            return;
        }

        // 按日期排序
        const sortedRecords = data.records.slice().sort((a, b) => a.date.localeCompare(b.date));

        // 根据天数过滤
        let statsRecords = sortedRecords;
        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffStr = cutoffDate.toISOString().substring(0, 10);
            statsRecords = sortedRecords.filter(r => r.date >= cutoffStr);
        }

        if (statsRecords.length === 0) {
            await sendMessage(`📋 最近${days}天暂无体重记录`);
            return;
        }

        // 计算统计数据
        const weights = statsRecords.map(r => r.weight);
        const maxWeight = Math.max(...weights);
        const minWeight = Math.min(...weights);
        const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
        const totalChange = statsRecords[statsRecords.length - 1].weight - statsRecords[0].weight;

        // 找到最高和最低体重的日期
        const maxRecord = statsRecords.find(r => r.weight === maxWeight);
        const minRecord = statsRecords.find(r => r.weight === minWeight);

        let message = `📊 体重统计`;
        if (days) {
            message += ` (最近${days}天)`;
        }
        message += `\\n━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;

        message += `📈 最高体重: ${maxWeight}kg\\n`;
        message += `   🗓️ ${maxRecord.date}\\n\\n`;

        message += `📉 最低体重: ${minWeight}kg\\n`;
        message += `   🗓️ ${minRecord.date}\\n\\n`;

        message += `📊 平均体重: ${avgWeight.toFixed(1)}kg\\n\\n`;

        message += `📊 总体变化: `;
        if (totalChange > 0.1) {
            message += `↑ +${totalChange.toFixed(1)}kg`;
        } else if (totalChange < -0.1) {
            message += `↓ ${totalChange.toFixed(1)}kg`;
        } else {
            message += `→ 基本持平`;
        }
        message += `\\n`;

        message += `   从 ${statsRecords[0].date} 到 ${statsRecords[statsRecords.length - 1].date}\\n`;

        // 显示目标信息
        if (data.target) {
            message += `\\n━━━━━━━━━━━━━━━━━━━━━━━━━\\n`;
            message += `🎯 目标体重: ${data.target}kg\\n`;
            const latestWeight = sortedRecords[sortedRecords.length - 1].weight;
            const diff = latestWeight - data.target;
            if (Math.abs(diff) < 0.1) {
                message += `✅ 已达成目标!`;
            } else if (diff > 0) {
                message += `📊 还需减重: ${diff.toFixed(1)}kg`;
            } else {
                message += `📊 还需增重: ${Math.abs(diff).toFixed(1)}kg`;
            }
        }

        await sendMessage(message);

    } catch (error) {
        console.error("查询统计时出错:", error);
        await sendMessage(`❌ 查询统计时出错: ${error.message}`);
    }
}

/**
 * 显示带编号的详细记录
 */
async function showDetailedRecords() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        if (data.records.length === 0) {
            await sendMessage("📋 暂无体重记录");
            return;
        }

        // 按日期排序(最新在前)
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        let message = `📋 体重详细记录 (共${sortedRecords.length}条)\\n`;
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n";

        sortedRecords.forEach((record, index) => {
            const num = index + 1;
            message += `[${num}] ${record.date}  ${record.weight}kg\\n`;
        });

        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "💡 (60秒内) 发送数字编号可快速删除\n";
        message += "例如: 直接发送 3 即可删除第3条\n";
        message += "或使用「修改体重记录 [编号] [新数值]」修改";

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
 * 请求确认设置目标体重
 */
async function requestSetTargetConfirmation(target) {
    try {
        const userID = getUserID();
        const PENDING_KEY = `user_${userID}`;

        // 验证目标值
        const targetValue = parseFloat(target);
        if (isNaN(targetValue) || targetValue <= 0 || targetValue > 500) {
            await sendMessage("❌ 目标体重数值无效,请输入0-500之间的数字");
            return;
        }

        // 保存等待状态
        const pendingAction = {
            action: 'set_target',
            target: targetValue,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        await sendMessage(`🎯 准备设置目标体重为: ${targetValue}kg\n\n确认设置请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求设置目标确认时出错:", error);
        await sendMessage(`❌ 请求设置目标确认时出错: ${error.message}`);
    }
}

/**
 * 执行设置目标体重
 */
async function executeSetTargetWeight(pendingAction) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const targetValue = pendingAction.target;

        // 获取已有数据
        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
                if (!data.records) data.records = [];
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        data.target = targetValue;
        await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));

        let message = `✅ 已设置目标体重为: ${targetValue}kg`;

        // 如果有记录,显示当前进度
        if (data.records.length > 0) {
            const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));
            const latestWeight = sortedRecords[0].weight;
            const diff = latestWeight - targetValue;

            message += `\n\n📊 当前体重: ${latestWeight}kg\n`;
            if (Math.abs(diff) < 0.1) {
                message += `🎉 恭喜!已达成目标!`;
            } else if (diff > 0) {
                message += `📊 还需减重: ${diff.toFixed(1)}kg`;
            } else {
                message += `📊 还需增重: ${Math.abs(diff).toFixed(1)}kg`;
            }
        }

        await sendMessage(message);

    } catch (error) {
        console.error("设置目标时出错:", error);
        await sendMessage(`❌ 设置目标时出错: ${error.message}`);
    }
}

/**
 * 显示目标进度
 */
async function showTargetProgress() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        if (!data.target) {
            await sendMessage("❌ 尚未设置目标体重\\n\\n💡 发送「设置目标体重 60」来设定目标");
            return;
        }

        if (data.records.length === 0) {
            await sendMessage(`🎯 目标体重: ${data.target}kg\\n\\n📋 暂无体重记录,无法计算进度`);
            return;
        }

        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));
        const latestWeight = sortedRecords[0].weight;
        const diff = latestWeight - data.target;

        let message = `🎯 目标进度\\n━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n`;
        message += `📊 当前体重: ${latestWeight}kg\\n`;
        message += `🎯 目标体重: ${data.target}kg\\n\\n`;

        if (Math.abs(diff) < 0.1) {
            message += `🎉 恭喜!已达成目标体重!\\n\\n`;
            message += `继续保持健康的生活方式!`;
        } else if (diff > 0) {
            message += `📊 还需减重: ${diff.toFixed(1)}kg\\n`;
            const progress = ((1 - diff / latestWeight) * 100).toFixed(1);
            message += `📈 进度: ${progress}%`;
        } else {
            message += `📊 还需增重: ${Math.abs(diff).toFixed(1)}kg\\n`;
            const progress = ((1 - Math.abs(diff) / data.target) * 100).toFixed(1);
            message += `📈 进度: ${progress}%`;
        }

        await sendMessage(message);

    } catch (error) {
        console.error("查询目标进度时出错:", error);
        await sendMessage(`❌ 查询目标进度时出错: ${error.message}`);
    }
}

/**
 * 请求确认删除记录
 */
async function requestDeleteConfirmation(indexStr) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const PENDING_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                await sendMessage("❌ 记录数据格式错误");
                return;
            }
        }

        if (data.records.length === 0) {
            await sendMessage("📋 暂无记录可删除");
            return;
        }

        // 解析编号
        const index = parseInt(indexStr);

        // 按日期排序(最新在前)以匹配详细记录的显示顺序
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        if (isNaN(index) || index < 1 || index > sortedRecords.length) {
            await sendMessage(`❌ 无效的编号"${indexStr}"\n请使用「体重详细记录」查看有效编号`);
            return;
        }

        // 获取要删除的记录
        const targetRecord = sortedRecords[index - 1];

        // 保存等待状态
        const pendingAction = {
            action: 'delete',
            index: index,
            targetRecord: targetRecord, // 保存以供确认
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`🗑️ 准备删除记录 [${index}]:\n${targetRecord.date}  ${targetRecord.weight}kg\n\n确认删除请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求删除确认时出错:", error);
        await sendMessage(`❌ 请求删除确认时出错: ${error.message}`);
    }
}

/**
 * 执行删除记录
 */
async function executeDeleteRecord(pendingAction) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const index = pendingAction.index;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                await sendMessage("❌ 记录数据格式错误");
                return;
            }
        }

        // 按日期排序(最新在前)
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        if (index < 1 || index > sortedRecords.length) {
            await sendMessage("❌ 记录已变化,请重新操作");
            return;
        }

        // 验证记录一致性
        const targetRecordInSorted = sortedRecords[index - 1];
        if (targetRecordInSorted.date !== pendingAction.targetRecord.date) {
            await sendMessage("❌ 记录顺序已变更,请重新操作");
            return;
        }

        // 从原数组中删除
        const originalIndex = data.records.findIndex(r => r.date === targetRecordInSorted.date);

        if (originalIndex === -1) {
            await sendMessage("❌ 找不到原始记录");
            return;
        }

        const deletedRecord = data.records[originalIndex];
        data.records.splice(originalIndex, 1);

        // 保存更新后的数据
        if (data.records.length === 0 && !data.target) {
            await bucketDel(BUCKET_NAME, STORAGE_KEY);
        } else {
            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));
        }

        await sendMessage(`✅ 已删除记录 [${index}]:\n${deletedRecord.date}  ${deletedRecord.weight}kg\n\n剩余 ${data.records.length} 条记录`);

    } catch (error) {
        console.error("删除记录时出错:", error);
        await sendMessage(`❌ 删除记录时出错: ${error.message}`);
    }
}

/**
 * 请求确认修改记录
 */
async function requestModifyConfirmation(indexStr, newWeight) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const PENDING_KEY = `user_${userID}`;

        // 验证新体重值
        const newWeightValue = parseFloat(newWeight);
        if (isNaN(newWeightValue) || newWeightValue <= 0 || newWeightValue > 500) {
            await sendMessage("❌ 体重数值无效,请输入0-500之间的数字");
            return;
        }

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                await sendMessage("❌ 记录数据格式错误");
                return;
            }
        }

        if (data.records.length === 0) {
            await sendMessage("📋 暂无记录可修改");
            return;
        }

        // 解析编号
        const index = parseInt(indexStr);

        // 按日期排序(最新在前)
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        if (isNaN(index) || index < 1 || index > sortedRecords.length) {
            await sendMessage(`❌ 无效的编号"${indexStr}"\n请使用「体重详细记录」查看有效编号`);
            return;
        }

        // 获取要修改的记录
        const targetRecord = sortedRecords[index - 1];

        // 保存等待状态
        const pendingAction = {
            action: 'modify',
            index: index,
            newWeight: newWeightValue,
            targetRecord: targetRecord, // 保存旧记录以供确认
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        // 发送确认提示
        await sendMessage(`✏️ 准备修改记录 [${index}]:\n${targetRecord.date}\n${targetRecord.weight}kg → ${newWeightValue}kg\n\n确认修改请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`);

    } catch (error) {
        console.error("请求修改确认时出错:", error);
        await sendMessage(`❌ 请求修改确认时出错: ${error.message}`);
    }
}

/**
 * 执行修改记录
 */
async function executeModifyRecord(pendingAction) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const newWeightValue = pendingAction.newWeight;
        const index = pendingAction.index;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                await sendMessage("❌ 记录数据格式错误");
                return;
            }
        }

        // 按日期排序(最新在前)以重新找到对应的记录
        const sortedRecords = data.records.slice().sort((a, b) => b.date.localeCompare(a.date));

        if (index < 1 || index > sortedRecords.length) {
            await sendMessage("❌ 记录索引无效(数据可能已变更)");
            return;
        }

        // 再次确认是否是同一条记录 (通过日期匹配)
        const targetRecordInSorted = sortedRecords[index - 1];
        if (targetRecordInSorted.date !== pendingAction.targetRecord.date) {
            await sendMessage("❌ 记录顺序已变更,请重新操作");
            return;
        }

        // 在原数组中找到并修改
        const originalIndex = data.records.findIndex(r => r.date === targetRecordInSorted.date);

        if (originalIndex === -1) {
            await sendMessage("❌ 找不到原始记录");
            return;
        }

        const oldWeight = data.records[originalIndex].weight;
        data.records[originalIndex].weight = newWeightValue;
        data.records[originalIndex].timestamp = new Date().getTime();

        await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));

        const diff = newWeightValue - oldWeight;
        const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
        await sendMessage(`✅ 已修改记录 [${index}]:\n${targetRecordInSorted.date}\n${oldWeight}kg → ${newWeightValue}kg (${diffStr}kg)`);

    } catch (error) {
        console.error("修改记录时出错:", error);
        await sendMessage(`❌ 修改记录时出错: ${error.message}`);
    }
}

/**
 * 请求确认清空记录
 */
async function requestClearConfirmation() {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;
        const PENDING_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        if (!data.records || data.records.length === 0) {
            await sendMessage("📋 暂无记录可清空");
            return;
        }

        // 保存等待状态
        const pendingAction = {
            action: 'clear',
            count: data.records.length,
            target: data.target,
            timestamp: new Date().getTime()
        };
        await bucketSet(PENDING_ACTION_BUCKET, PENDING_KEY, JSON.stringify(pendingAction));

        let message = `⚠️ 确定要清空所有 ${data.records.length} 条体重记录吗？\n\n此操作不可恢复!`;
        if (data.target) {
            message += `\n(目标体重 ${data.target}kg 将被保留)`;
        }
        message += `\n\n确认清空请回复 Y, 取消请回复 Q 或 N\n(60秒内有效)`;

        await sendMessage(message);

    } catch (error) {
        console.error("请求清空确认时出错:", error);
        await sendMessage(`❌ 请求清空确认时出错: ${error.message}`);
    }
}

/**
 * 执行清空记录
 */
async function executeClearAllRecords(pendingAction) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        const existingData = await bucketGet(BUCKET_NAME, STORAGE_KEY);
        let data = { records: [], target: null };

        if (existingData && existingData !== "" && existingData !== "null") {
            try {
                data = JSON.parse(existingData);
            } catch (e) {
                data = { records: [], target: null };
            }
        }

        // 保留目标体重,只清空记录
        data.records = [];

        if (!data.target) {
            await bucketDel(BUCKET_NAME, STORAGE_KEY);
            await sendMessage("🗑️ 已清空所有体重记录");
        } else {
            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));
            await sendMessage(`🗑️ 已清空所有体重记录\n\n🎯 目标体重 ${data.target}kg 已保留`);
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
        let helpMessage = "📖 体重记录插件使用说明 v1.1.0\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";

        helpMessage += "📝 记录体重\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n";
        helpMessage += "指令: 体重 65.5\n";
        helpMessage += "说明: 记录今天的体重(需确认)\n\n";
        helpMessage += "指令: 体重记录 2026-01-01 65.5\n";
        helpMessage += "说明: 补录指定日期体重(需确认)\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";

        helpMessage += "📊 查看记录\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n";
        helpMessage += "指令: 体重记录\n";
        helpMessage += "说明: 查看最近7天的体重变化\n\n";
        helpMessage += "指令: 体重详细记录\n";
        helpMessage += "说明: 查看所有记录(带编号)\n\n";
        helpMessage += "指令: 体重统计\n";
        helpMessage += "说明: 查看全部数据统计\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";

        helpMessage += "🎯 目标管理\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n";
        helpMessage += "指令: 设置目标体重 60\n";
        helpMessage += "说明: 设定目标体重(需确认)\n\n";
        helpMessage += "指令: 目标进度\n";
        helpMessage += "说明: 查看当前离目标还差多少\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";

        helpMessage += "✏️ 数据管理\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n";
        helpMessage += "指令: 删除体重记录 3\n";
        helpMessage += "说明: 删除编号为3的记录(需确认)\n\n";
        helpMessage += "指令: 修改体重记录 3 66\n";
        helpMessage += "说明: 修改编号3的记录为66(需确认)\n\n";
        helpMessage += "指令: 清空体重记录\n";
        helpMessage += "说明: 清空所有记录(需确认)\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\n\n";

        helpMessage += "⚙️ 交互说明\n";
        helpMessage += "• 关键操作需要回复 Y 确认\n";
        helpMessage += "• 回复 Q 或 N 取消操作\n";
        helpMessage += "• 60秒无操作自动退出\n\n";

        helpMessage += "💡 小技巧\n";
        helpMessage += "• 查看详细记录后可直接发送数字删除";

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
        const content = getMessageContent().trim();
        const userID = getUserID();
        const PENDING_KEY = `user_${userID}`;

        console.log(`[体重记录插件] 收到消息: [${content}]`);

        // 1. 优先检查是否存在等待确认的操作
        const pendingStateStr = await bucketGet(PENDING_ACTION_BUCKET, PENDING_KEY);
        if (pendingStateStr && pendingStateStr !== "" && pendingStateStr !== "null") {
            try {
                const pendingAction = JSON.parse(pendingStateStr);
                const now = new Date().getTime();

                // 检查是否超时 (60秒)
                if (now - pendingAction.timestamp > 60000) {
                    console.log("[体重记录插件] 等待操作已超时，清除状态");
                    await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                } else {
                    if (pendingAction.action === 'view_details') {
                        // 在详情浏览模式下，检查是否输入了数字
                        const isPureNumber = /^\d+$/.test(content);
                        if (isPureNumber) {
                            console.log(`[体重记录插件] 详情浏览模式下检测到数字: ${content}，请求删除确认`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY); // 清除 view_details
                            await requestDeleteConfirmation(content); // 进入删除确认流程
                            return;
                        } else {
                            // 输入非数字，视为退出详情模式，继续匹配其他指令
                            console.log(`[体重记录插件] 详情浏览模式下输入非数字，清除状态并继续`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                        }
                    } else {
                        // 检查用户输入
                        if (isConfirmCommand(content)) {
                            // 用户确认执行
                            console.log(`[体重记录插件] 用户确认执行操作: ${pendingAction.action}`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY); // 先清除状态

                            if (pendingAction.action === 'record') {
                                await executeRecordWeight(pendingAction);
                            } else if (pendingAction.action === 'delete') {
                                await executeDeleteRecord(pendingAction);
                            } else if (pendingAction.action === 'modify') {
                                await executeModifyRecord(pendingAction);
                            } else if (pendingAction.action === 'clear') {
                                await executeClearAllRecords(pendingAction);
                            } else if (pendingAction.action === 'set_target') {
                                await executeSetTargetWeight(pendingAction);
                            }
                            return; // 处理完毕，退出

                        } else if (isQuitCommand(content)) {
                            // 用户取消
                            console.log(`[体重记录插件] 用户取消操作: ${pendingAction.action}`);
                            await bucketDel(PENDING_ACTION_BUCKET, PENDING_KEY);
                            await sendMessage("已退出操作");
                            return; // 处理完毕，退出
                        } else {
                            // 用户输入了其他内容，如果不是触发词，则提示；如果是触发词，可以在下面继续处理
                            // 为了简单和符合直觉：只有 Y/N/Q 会被 pending 逻辑捕获。
                            console.log("[体重记录插件] 用户输入非确认指令，清除等待状态，尝试匹配新命令");
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

        // 关键词匹配
        if (content.indexOf("体重统计") !== -1) {
            const daysMatch = content.match(/体重统计\s*(\d+)/);
            const days = daysMatch ? parseInt(daysMatch[1]) : 0;
            console.log(`[体重记录插件] 执行: 查看统计 (天数: ${days || '全部'})`);
            await showStatistics(days);

        } else if (content.indexOf("设置目标体重") !== -1 || content.indexOf("设定目标体重") !== -1) {
            const match = content.match(/(?:设置|设定)目标体重\s*([\d.]+)/);
            if (match && match[1]) {
                console.log("[体重记录插件] 执行: 请求设置目标确认");
                await requestSetTargetConfirmation(match[1]);
            } else {
                await sendMessage("❓ 请输入目标体重数值 (如: 设置目标体重 60)");
            }

        } else if (content.indexOf("目标进度") !== -1) {
            console.log("[体重记录插件] 执行: 查看目标进度");
            await showTargetProgress();

        } else if (content.indexOf("删除体重记录") !== -1) {
            const match = content.match(/删除体重记录\s+(\d+)/);
            if (match && match[1]) {
                console.log("[体重记录插件] 执行: 请求删除确认");
                await requestDeleteConfirmation(match[1]);
            } else {
                console.log("[体重记录插件] 未提供编号，显示详细记录");
                await showDetailedRecords();
            }

        } else if (content.indexOf("修改体重记录") !== -1) {
            const match = content.match(/修改体重记录\s+(\d+)\s+([\d.]+)/);
            if (match && match[1] && match[2]) {
                console.log("[体重记录插件] 执行: 请求修改确认");
                await requestModifyConfirmation(match[1], match[2]);
            } else {
                await sendMessage("❓ 指令格式错误\n正确格式: 修改体重记录 [编号] [新数值]\n示例: 修改体重记录 1 65.5");
            }

        } else if (content.indexOf("清空体重记录") !== -1) {
            console.log("[体重记录插件] 执行: 请求清空确认");
            await requestClearConfirmation();

        } else if (content.indexOf("体重详细记录") !== -1) {
            console.log("[体重记录插件] 执行: 查看详细记录");
            await showDetailedRecords();

        } else if (content.indexOf("体重记录") !== -1) {
            // 检查是否是补录指令 (体重记录 [日期] [数值])
            // 格式支持: 体重记录 2026-01-01 65.5
            const recordMatch = content.match(/体重记录\s+(\d{4}-\d{2}-\d{2})\s+([\d.]+)/);

            if (recordMatch && recordMatch[1] && recordMatch[2]) {
                console.log("[体重记录插件] 执行: 请求补录确认");
                await requestRecordConfirmation(recordMatch[2], recordMatch[1]);
            } else if (content.trim() === "体重记录") {
                console.log("[体重记录插件] 执行: 查看记录");
                await showWeightRecords(7); // 默认显示最近7条
            }

        } else if (content.indexOf("体重帮助") !== -1) {
            console.log("[体重记录插件] 执行: 显示帮助");
            await showHelp();

        } else if (content.indexOf("体重") !== -1) {
            // 匹配记录指令 (体重 [数值])
            // 支持格式: 体重 65.5 或 体重65.5
            // 注意排除 "体重记录" 等关键词已被上方捕获的情况

            // 再次确认不是 Y/N/Q，防止误触 (虽然有Pending检查，但为了逻辑严谨)
            if (!isConfirmCommand(content) && !isQuitCommand(content)) {
                // 提取数值
                const numMatch = content.match(/体重\s*([\d.]+)/);
                if (numMatch && numMatch[1]) {
                    console.log("[体重记录插件] 执行: 请求记录确认");
                    await requestRecordConfirmation(numMatch[1]);
                }
            }
        }

    } catch (error) {
        console.error("[体重记录插件] 执行出错:", error);
        try {
            await sendMessage(`💥 插件执行出错: ${error.message}`);
        } catch (e) {
            console.error("无法发送错误消息:", e);
        }
    }
}

// 执行主函数
main().catch(error => {
    console.error("[体重记录插件] Fatal error:", error);
});
