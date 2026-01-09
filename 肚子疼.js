/**
 * autMan 插件 - 肚子疼记录
 * 
 * 功能：记录、查看和删除肚子疼事件
 * 作者：AI Assistant
 * 版本：v1.0.0
 * 日期：2026-01-09
 * 
 * 使用说明：
 * - 肚子疼：记录一次肚子疼事件
 * - 肚子疼记录：查看所有历史记录
 * - 肚子疼删除：删除指定的历史记录
 * - 肚子疼帮助：显示帮助信息
 */

// ==================== 配置常量 ====================
var BUCKET_NAME = "stomachache";
var VERSION = "v1.0.0";
var INPUT_TIMEOUT = 60000; // 60秒超时

// ==================== 工具函数 ====================

/**
 * 获取用户确认（y/n/q）
 * @param {string} prompt 提示信息
 * @returns {string} 用户输入（y/n/q）或 null（超时/错误）
 */
function getUserConfirmation(prompt) {
    sendText(prompt + "\n\n请输入：\n  y - 确认\n  n - 取消\n  q - 退出");

    var userInput = input(INPUT_TIMEOUT);

    if (!userInput || userInput.content === undefined) {
        sendText("⏱️ 操作超时，已自动取消");
        return null;
    }

    var response = userInput.content.trim().toLowerCase();
    return response;
}

/**
 * 生成存储键
 * @param {string} userid 用户ID
 * @returns {string} 存储键
 */
function generateKey(userid) {
    // 使用当前时间生成时间戳
    var now = new Date();
    var timestamp = Math.floor(now.getTime() / 1000);
    var uuid = call("uuid")();
    return userid + "_" + timestamp + "_" + uuid;
}

/**
 * 获取当前时间戳（秒）
 * @returns {number} Unix时间戳
 */
function getCurrentTimestamp() {
    var now = new Date();
    return Math.floor(now.getTime() / 1000);
}

/**
 * 计算时间差并格式化
 * @param {number} timestamp 过去的时间戳（秒）
 * @returns {string} 格式化的时间差
 */
function formatTimeDiff(timestamp) {
    var now = getCurrentTimestamp();
    var diff = now - timestamp;

    if (diff < 60) {
        return diff + "秒前";
    } else if (diff < 3600) {
        return Math.floor(diff / 60) + "分钟前";
    } else if (diff < 86400) {
        return Math.floor(diff / 3600) + "小时前";
    } else {
        return Math.floor(diff / 86400) + "天前";
    }
}

/**
 * 获取用户的所有记录
 * @param {string} userid 用户ID
 * @returns {Array} 记录数组，每个元素包含 {key, data}
 */
function getUserRecords(userid) {
    var allKeys = bucketAllKeys(BUCKET_NAME);
    var records = [];

    if (!allKeys || allKeys.length === 0) {
        return records;
    }

    for (var i = 0; i < allKeys.length; i++) {
        var key = allKeys[i];
        // 检查key是否属于当前用户
        if (key.indexOf(userid + "_") === 0) {
            var data = bucketGet(BUCKET_NAME, key);
            if (data) {
                try {
                    var recordData = JSON.parse(data);
                    records.push({
                        key: key,
                        data: recordData
                    });
                } catch (e) {
                    console.error("解析记录失败: " + key);
                }
            }
        }
    }

    // 按时间戳降序排序（最新的在前）
    records.sort(function (a, b) {
        return b.data.timestamp - a.data.timestamp;
    });

    return records;
}

// ==================== 核心功能 ====================

/**
 * 显示帮助信息
 */
function showHelp() {
    var helpText = "📖 肚子疼记录插件 " + VERSION + "\n\n";
    helpText += "🔹 功能说明：\n";
    helpText += "本插件帮助您记录和追踪肚子疼事件\n\n";
    helpText += "🔹 命令列表：\n";
    helpText += "• 肚子疼 - 记录一次肚子疼事件\n";
    helpText += "• 肚子疼记录 - 查看所有历史记录\n";
    helpText += "• 肚子疼删除 - 删除指定的历史记录\n";
    helpText += "• 肚子疼帮助 - 显示此帮助信息\n\n";
    helpText += "🔹 确认机制：\n";
    helpText += "所有操作都需要确认：\n";
    helpText += "  y - 确认执行\n";
    helpText += "  n - 取消操作\n";
    helpText += "  q - 退出流程\n\n";
    helpText += "💡 提示：记录会包含时间信息，方便您追踪症状";

    sendText(helpText);
}

/**
 * 记录肚子疼事件
 */
function recordStomachache() {
    var userid = GetUserID();
    var username = GetUsername();
    var imtype = GetImType();

    // 获取确认
    var confirmation = getUserConfirmation("📝 确认要记录一次肚子疼事件吗？");

    if (!confirmation) {
        return;
    }

    if (confirmation === "q") {
        sendText("👋 已退出记录流程");
        return;
    }

    if (confirmation === "n") {
        sendText("❌ 已取消记录");
        return;
    }

    if (confirmation === "y") {
        // 生成记录数据
        var currentTime = timeFmt("yyyy-MM-dd HH:mm:ss");
        var timestamp = getCurrentTimestamp();

        var recordData = {
            username: username,
            userid: userid,
            datetime: currentTime,
            timestamp: timestamp,
            imtype: imtype
        };

        // 保存到存储桶
        var key = generateKey(userid);
        bucketSet(BUCKET_NAME, key, JSON.stringify(recordData));

        sendText("✅ 记录成功！\n\n📅 时间：" + currentTime + "\n\n💡 发送「肚子疼记录」可查看所有记录");
        return;
    }

    // 无效输入
    sendText("❓ 无效的输入，请重新操作");
}

/**
 * 查看历史记录
 */
function viewRecords() {
    var userid = GetUserID();

    // 获取确认
    var confirmation = getUserConfirmation("📋 确认要查看肚子疼历史记录吗？");

    if (!confirmation) {
        return;
    }

    if (confirmation === "q") {
        sendText("👋 已退出查看流程");
        return;
    }

    if (confirmation === "n") {
        sendText("❌ 已取消查看");
        return;
    }

    if (confirmation === "y") {
        var records = getUserRecords(userid);

        if (records.length === 0) {
            sendText("📭 暂无记录\n\n💡 发送「肚子疼」可以记录新的事件");
            return;
        }

        var message = "📊 肚子疼历史记录（共 " + records.length + " 条）\n\n";

        for (var i = 0; i < records.length; i++) {
            var record = records[i].data;
            var timeDiff = formatTimeDiff(record.timestamp);

            message += "【" + (i + 1) + "】\n";
            message += "  📅 " + record.datetime + "\n";
            message += "  ⏰ " + timeDiff + "\n";
            message += "\n";
        }

        message += "💡 发送「肚子疼删除」可以删除记录";

        sendText(message);
        return;
    }

    // 无效输入
    sendText("❓ 无效的输入，请重新操作");
}

/**
 * 删除记录
 */
function deleteRecord() {
    var userid = GetUserID();

    // 先获取所有记录
    var records = getUserRecords(userid);

    if (records.length === 0) {
        sendText("📭 暂无记录可删除");
        return;
    }

    // 显示记录列表
    var message = "🗑️ 请选择要删除的记录（共 " + records.length + " 条）\n\n";

    for (var i = 0; i < records.length; i++) {
        var record = records[i].data;
        var timeDiff = formatTimeDiff(record.timestamp);

        message += "【" + (i + 1) + "】";
        message += " " + record.datetime;
        message += " (" + timeDiff + ")\n";
    }

    message += "\n请输入要删除的记录编号（1-" + records.length + "），或输入 q 退出：";

    sendText(message);

    // 等待用户输入编号
    var userInput = input(INPUT_TIMEOUT);

    if (!userInput || userInput.content === undefined) {
        sendText("⏱️ 操作超时，已自动取消");
        return;
    }

    var inputContent = userInput.content.trim().toLowerCase();

    if (inputContent === "q") {
        sendText("👋 已退出删除流程");
        return;
    }

    // 验证输入是否为有效数字
    var recordIndex = parseInt(inputContent);

    if (isNaN(recordIndex) || recordIndex < 1 || recordIndex > records.length) {
        sendText("❌ 无效的编号，请输入 1 到 " + records.length + " 之间的数字");
        return;
    }

    // 获取要删除的记录
    var selectedRecord = records[recordIndex - 1];

    // 二次确认删除
    var confirmMessage = "⚠️ 确认要删除以下记录吗？\n\n";
    confirmMessage += "📅 " + selectedRecord.data.datetime + "\n";
    confirmMessage += "⏰ " + formatTimeDiff(selectedRecord.data.timestamp);

    var confirmation = getUserConfirmation(confirmMessage);

    if (!confirmation) {
        return;
    }

    if (confirmation === "q") {
        sendText("👋 已退出删除流程");
        return;
    }

    if (confirmation === "n") {
        sendText("❌ 已取消删除");
        return;
    }

    if (confirmation === "y") {
        // 执行删除
        bucketDel(BUCKET_NAME, selectedRecord.key);
        sendText("✅ 删除成功！\n\n💡 发送「肚子疼记录」可查看剩余记录");
        return;
    }

    // 无效输入
    sendText("❓ 无效的输入，已取消删除");
}

// ==================== 主程序入口 ====================

function main() {
    var content = GetContent();

    if (!content) {
        return;
    }

    // 去除首尾空格并转换为小写进行匹配
    var command = content.trim();

    // 路由到对应功能
    if (command === "肚子疼帮助") {
        showHelp();
    } else if (command === "肚子疼记录") {
        viewRecords();
    } else if (command === "肚子疼删除") {
        deleteRecord();
    } else if (command === "肚子疼") {
        recordStomachache();
    } else {
        // 未匹配到命令，显示帮助
        sendText("❓ 未识别的命令\n\n💡 发送「肚子疼帮助」查看使用说明");
    }
}

// 执行主程序
main();
