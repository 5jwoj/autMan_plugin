/**
 * 体重记录插件 v1.0.1
 * 基于autMan实际API结构开发
 * 功能: 体重记录、趋势分析、目标管理
 * 
 * 使用说明:
 * - 发送「体重 [数值]」→ 记录当前体重 (如: 体重 65.5)
 * - 发送「体重记录 [日期] [数值]」→ 补录历史数据 (如: 体重记录 2026-01-01 65.5)
 * - 发送「体重记录」→ 查看最近记录和趋势
 * - 发送「体重详细记录」→ 查看带编号的完整记录
 * - 发送「体重统计」→ 查看统计信息
 * - 发送「体重统计 7」或「体重统计 30」→ 查看指定天数的统计
 * - 发送「设置目标体重 [数值]」→ 设定目标体重 (如: 设置目标体重 60)
 * - 发送「目标进度」→ 查看目标进度
 * - 发送「删除体重记录 [编号]」→ 删除指定记录
 * - 发送「修改体重记录 [编号] [新数值]」→ 修改指定记录
 * - 发送「清空体重记录」→ 清空所有记录
 * - 发送「体重帮助」→ 显示帮助
 * 
 * 更新历史:
 * v1.0.1 - 优化帮助信息显示,指令和说明分开更清晰
 * v1.0.0 - 初始版本,支持体重记录、趋势分析、目标管理
 */

// [disable:false]
// [rule: (.*体重.*|.*目标.*|^\\d+$)]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]
// [version: 2026.01.03.2]

// 定义存储桶名称
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
 * 记录体重
 */
async function recordWeight(weight, date) {
    try {
        const userID = getUserID();
        const userName = getUserName();
        const STORAGE_KEY = `user_${userID}`;

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
            await sendMessage(`✅ 已更新 ${userName} 在 ${recordDate} 的体重记录:\\n${oldWeight}kg → ${weightValue}kg (${diffStr}kg)\\n\\n当前共有 ${data.records.length} 条记录`);
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

            let message = `✅ 已记录 ${userName} 在 ${recordDate} 的体重: ${weightValue}kg\\n\\n当前共有 ${data.records.length} 条记录`;

            // 如果设置了目标,显示进度
            if (data.target) {
                const diff = weightValue - data.target;
                if (Math.abs(diff) < 0.1) {
                    message += `\\n\\n🎉 恭喜!已达成目标体重 ${data.target}kg!`;
                } else if (diff > 0) {
                    message += `\\n\\n📊 距离目标体重还差: ${diff.toFixed(1)}kg (需减重)`;
                } else {
                    message += `\\n\\n📊 距离目标体重还差: ${Math.abs(diff).toFixed(1)}kg (需增重)`;
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

        message += "\\n━━━━━━━━━━━━━━━━━━━━━━━━━\\n";
        message += "💡 现在可以直接发送编号删除记录\\n";
        message += "或使用「修改体重记录 [编号] [新数值]」修改";

        await sendMessage(message);

    } catch (error) {
        console.error("查询详细记录时出错:", error);
        await sendMessage(`❌ 查询详细记录时出错: ${error.message}`);
    }
}

/**
 * 设置目标体重
 */
async function setTargetWeight(target) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

        // 验证目标值
        const targetValue = parseFloat(target);
        if (isNaN(targetValue) || targetValue <= 0 || targetValue > 500) {
            await sendMessage("❌ 目标体重数值无效,请输入0-500之间的数字");
            return;
        }

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

            message += `\\n\\n📊 当前体重: ${latestWeight}kg\\n`;
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
 * 根据编号删除记录
 */
async function deleteRecordByIndex(indexStr) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

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
            await sendMessage(`❌ 无效的编号"${indexStr}"\\n请使用「体重详细记录」查看有效编号`);
            return;
        }

        // 获取要删除的记录
        const deletedRecord = sortedRecords[index - 1];

        // 从原数组中删除
        const originalIndex = data.records.findIndex(r => r.date === deletedRecord.date);
        data.records.splice(originalIndex, 1);

        // 保存更新后的数据
        if (data.records.length === 0 && !data.target) {
            await bucketDel(BUCKET_NAME, STORAGE_KEY);
        } else {
            await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));
        }

        await sendMessage(`✅ 已删除记录 [${index}]:\\n${deletedRecord.date}  ${deletedRecord.weight}kg\\n\\n剩余 ${data.records.length} 条记录`);

    } catch (error) {
        console.error("删除记录时出错:", error);
        await sendMessage(`❌ 删除记录时出错: ${error.message}`);
    }
}

/**
 * 修改记录
 */
async function modifyRecordByIndex(indexStr, newWeight) {
    try {
        const userID = getUserID();
        const STORAGE_KEY = `user_${userID}`;

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
            await sendMessage(`❌ 无效的编号"${indexStr}"\\n请使用「体重详细记录」查看有效编号`);
            return;
        }

        // 获取要修改的记录
        const targetRecord = sortedRecords[index - 1];

        // 在原数组中找到并修改
        const originalIndex = data.records.findIndex(r => r.date === targetRecord.date);
        const oldWeight = data.records[originalIndex].weight;
        data.records[originalIndex].weight = newWeightValue;
        data.records[originalIndex].timestamp = new Date().getTime();

        await bucketSet(BUCKET_NAME, STORAGE_KEY, JSON.stringify(data));

        const diff = newWeightValue - oldWeight;
        const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
        await sendMessage(`✅ 已修改记录 [${index}]:\\n${targetRecord.date}\\n${oldWeight}kg → ${newWeightValue}kg (${diffStr}kg)`);

    } catch (error) {
        console.error("修改记录时出错:", error);
        await sendMessage(`❌ 修改记录时出错: ${error.message}`);
    }
}

/**
 * 清空记录
 */
async function clearAllRecords() {
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
            await sendMessage(`🗑️ 已清空所有体重记录\\n\\n🎯 目标体重 ${data.target}kg 已保留`);
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
        let helpMessage = "📖 体重记录插件使用说明 v1.0.1\\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\\n\\n";

        helpMessage += "📝 记录体重\\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\\n";
        helpMessage += "指令: 体重 65.5\\n";
        helpMessage += "说明: 记录今天的体重为65.5kg\\n\\n";
        helpMessage += "指令: 体重记录 2026-01-01 65.5\\n";
        helpMessage += "说明: 补录2026年1月1日的体重为65.5kg\\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\\n\\n";

        helpMessage += "📊 查看记录\\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\\n";
        helpMessage += "指令: 体重记录\\n";
        helpMessage += "说明: 查看最近7天的体重变化\\n\\n";
        helpMessage += "指令: 体重详细记录\\n";
        helpMessage += "说明: 查看所有记录(带编号)\\n\\n";
        helpMessage += "指令: 体重统计\\n";
        helpMessage += "说明: 查看全部数据统计\\n\\n";
        helpMessage += "指令: 体重统计 7\\n";
        helpMessage += "说明: 查看最近7天统计\\n\\n";
        helpMessage += "指令: 体重统计 30\\n";
        helpMessage += "说明: 查看最近30天统计\\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\\n\\n";

        helpMessage += "🎯 目标管理\\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\\n";
        helpMessage += "指令: 设置目标体重 60\\n";
        helpMessage += "说明: 设定目标体重为60kg\\n\\n";
        helpMessage += "指令: 目标进度\\n";
        helpMessage += "说明: 查看当前离目标还差多少\\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\\n\\n";

        helpMessage += "✏️ 数据管理\\n";
        helpMessage += "▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\\n";
        helpMessage += "指令: 删除体重记录 3\\n";
        helpMessage += "说明: 删除编号为3的记录\\n";
        helpMessage += "(先发送「体重详细记录」查看编号)\\n\\n";
        helpMessage += "指令: 修改体重记录 3 66\\n";
        helpMessage += "说明: 将编号3的记录改为66kg\\n\\n";
        helpMessage += "指令: 清空体重记录\\n";
        helpMessage += "说明: 清空所有记录(保留目标)\\n";
        helpMessage += "━━━━━━━━━━━━━━━━━━\\n\\n";

        helpMessage += "💡 小技巧\\n";
        helpMessage += "• 单日多次记录会保留最新值\\n";
        helpMessage += "• 查看详细记录后可直接发送数字删除\\n";
        helpMessage += "  (例如: 发送 3 即可删除第3条)";

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

        console.log(`[体重记录插件] 收到消息: [${content}]`);

        // 检查是否是纯数字(智能删除)
        const isPureNumber = /^\d+$/.test(content);
        if (isPureNumber) {
            console.log(`[体重记录插件] 检测到纯数字输入: ${content},尝试删除该编号记录`);
            await deleteRecordByIndex(content);
            return;
        }

        // 命令匹配(按长度从长到短)
        if (content.indexOf("清空体重记录") !== -1) {
            console.log("[体重记录插件] 执行: 清空记录");
            await clearAllRecords();
        } else if (content.indexOf("修改体重记录") !== -1) {
            console.log("[体重记录插件] 执行: 修改记录");
            const match = content.match(/修改体重记录\s+(\d+)\s+([\d.]+)/);
            if (match && match[1] && match[2]) {
                await modifyRecordByIndex(match[1], match[2]);
            } else {
                await sendMessage("❌ 格式错误\\n正确格式: 修改体重记录 [编号] [新数值]\\n例如: 修改体重记录 3 66");
            }
        } else if (content.indexOf("删除体重记录") !== -1) {
            console.log("[体重记录插件] 执行: 删除记录");
            const match = content.match(/删除体重记录\s+(\d+)/);
            if (match && match[1]) {
                await deleteRecordByIndex(match[1]);
            } else {
                await showDetailedRecords();
            }
        } else if (content.indexOf("体重详细记录") !== -1) {
            console.log("[体重记录插件] 执行: 查看详细记录");
            await showDetailedRecords();
        } else if (content.indexOf("体重统计") !== -1) {
            console.log("[体重记录插件] 执行: 查看统计");
            const match = content.match(/体重统计\s+(\d+)/);
            const days = match && match[1] ? parseInt(match[1]) : null;
            await showStatistics(days);
        } else if (content.indexOf("设置目标体重") !== -1) {
            console.log("[体重记录插件] 执行: 设置目标体重");
            const match = content.match(/设置目标体重\s+([\d.]+)/);
            if (match && match[1]) {
                await setTargetWeight(match[1]);
            } else {
                await sendMessage("❌ 格式错误\\n正确格式: 设置目标体重 [数值]\\n例如: 设置目标体重 60");
            }
        } else if (content.indexOf("目标进度") !== -1) {
            console.log("[体重记录插件] 执行: 查看目标进度");
            await showTargetProgress();
        } else if (content.indexOf("体重记录") !== -1) {
            console.log("[体重记录插件] 执行: 查看记录");
            // 检查是否是补录格式: 体重记录 2026-01-01 65.5
            const match = content.match(/体重记录\s+([\d-]+)\s+([\d.]+)/);
            if (match && match[1] && match[2]) {
                await recordWeight(match[2], match[1]);
            } else {
                await showWeightRecords(7); // 默认显示最近7天
            }
        } else if (content.indexOf("体重帮助") !== -1) {
            console.log("[体重记录插件] 执行: 显示帮助");
            await showHelp();
        } else if (content.indexOf("体重") !== -1) {
            console.log("[体重记录插件] 执行: 记录体重");
            // 提取体重值
            const match = content.match(/体重\s+([\d.]+)/);
            if (match && match[1]) {
                await recordWeight(match[1]);
            } else {
                await sendMessage("❌ 格式错误\\n正确格式: 体重 [数值]\\n例如: 体重 65.5");
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
