//[public:true]
//[title:麦当劳优惠券]
//[author:AI Assistant]
//[description:麦当劳优惠券管理插件，支持查询活动日历、领取优惠券、多账号管理和定时自动领券]
//[rule:^麦当劳$]
//[rule:^麦当劳\s+(.+)$]
//[cron:0 9 * * *]
//[admin:false]
//[priority:100]
//[disable:false]
//[version:1.0.1]

/**
 * 麦当劳优惠券管理插件
 * 基于麦当劳 MCP Server API
 * 支持多账号管理、自动领券、活动日历查询等功能
 */

// ==================== 配置常量 ====================
var MCP_URL = "https://mcp.mcd.cn/mcp-servers/mcd-mcp";
var MCP_PROTOCOL_VERSION = "2025-06-18";
var SESSION_CACHE_KEY = "maimai_sessions"; // 会话缓存
var USER_DATA_KEY = "maimai_users"; // 用户数据

// ==================== MCP 客户端 ====================

/**
 * MCP 客户端类
 * 实现 MCP 协议的 JSON-RPC 2.0 通信
 */
function MCPClient(token) {
    this.token = token;
    this.sessionId = null;
    this.initialized = false;
    this.requestId = 1;
}

/**
 * 初始化 MCP 会话
 */
MCPClient.prototype.initialize = function (callback) {
    if (this.initialized) {
        callback(null);
        return;
    }

    var self = this;
    var initMessage = {
        jsonrpc: "2.0",
        id: this.requestId++,
        method: "initialize",
        params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: "autMan_MaiMai",
                title: "autMan 麦当劳插件",
                version: "1.0.0"
            }
        }
    };

    this._sendRpc(initMessage, true, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        if (response.error) {
            callback(response.error.message || "初始化失败");
            return;
        }

        // 发送 initialized 通知
        var notifyMessage = {
            jsonrpc: "2.0",
            method: "notifications/initialized"
        };

        self._sendRpc(notifyMessage, false, function (err) {
            if (err) {
                callback(err);
                return;
            }
            self.initialized = true;
            callback(null);
        });
    });
};

/**
 * 调用 MCP 工具
 */
MCPClient.prototype.callTool = function (toolName, args, callback) {
    var self = this;

    this.initialize(function (error) {
        if (error) {
            callback(error);
            return;
        }

        var message = {
            jsonrpc: "2.0",
            id: self.requestId++,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args || {}
            }
        };

        self._sendRpc(message, true, function (err, response) {
            if (err) {
                callback(err);
                return;
            }

            if (response.error) {
                callback(response.error.message || "工具调用失败");
                return;
            }

            callback(null, response.result);
        });
    });
};

/**
 * 发送 JSON-RPC 请求
 */
MCPClient.prototype._sendRpc = function (message, expectResponse, callback) {
    var self = this;
    var headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json"
    };

    if (this.token) {
        headers["Authorization"] = "Bearer " + this.token;
    }

    if (this.sessionId) {
        headers["Mcp-Session-Id"] = this.sessionId;
    }

    headers["MCP-Protocol-Version"] = MCP_PROTOCOL_VERSION;

    request({
        url: MCP_URL,
        method: "post",
        headers: headers,
        data: JSON.stringify(message),
        dataType: "text", // 使用 text 以便处理 SSE
        timeOut: 30000
    }, function (error, response, header, body) {
        if (error) {
            callback("网络请求失败: " + error);
            return;
        }

        // 检查会话 ID
        var newSessionId = header["mcp-session-id"] || header["Mcp-Session-Id"];
        if (newSessionId && !self.sessionId) {
            self.sessionId = newSessionId;
        }

        if (!expectResponse) {
            callback(null);
            return;
        }

        // 解析响应
        var contentType = header["content-type"] || "";
        var result;

        try {
            if (contentType.indexOf("text/event-stream") !== -1) {
                // 处理 SSE 响应
                result = parseSseResponse(body, message.id);
            } else {
                // 处理 JSON 响应
                result = JSON.parse(body);
            }
            callback(null, result);
        } catch (e) {
            callback("响应解析失败: " + e.message);
        }
    });
};

/**
 * 解析 SSE 响应
 */
function parseSseResponse(text, requestId) {
    var events = [];
    var dataLines = [];
    var lines = text.split(/\r?\n/);

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf("data:") === 0) {
            dataLines.push(line.substring(5).trim());
        } else if (line.trim() === "") {
            if (dataLines.length > 0) {
                events.push(dataLines.join("\n"));
                dataLines = [];
            }
        }
    }

    if (dataLines.length > 0) {
        events.push(dataLines.join("\n"));
    }

    // 查找匹配的响应
    var lastEvent = null;
    for (var j = 0; j < events.length; j++) {
        try {
            var parsed = JSON.parse(events[j]);
            lastEvent = parsed;
            if (requestId !== undefined && parsed.id === requestId) {
                return parsed;
            }
        } catch (e) {
            continue;
        }
    }

    if (lastEvent) {
        return lastEvent;
    }

    throw new Error("未找到有效的 JSON-RPC 响应");
}

// ==================== 用户数据管理 ====================

/**
 * 获取用户数据
 */
function getUserData(userId) {
    var data = bucketGet(USER_DATA_KEY, userId);
    if (!data) {
        return {
            accounts: {},
            activeAccount: null,
            autoClaimEnabled: false,
            lastClaimDate: null
        };
    }
    return JSON.parse(data);
}

/**
 * 保存用户数据
 */
function saveUserData(userId, userData) {
    bucketSet(USER_DATA_KEY, userId, JSON.stringify(userData));
}

/**
 * 添加或更新账号
 */
function addOrUpdateAccount(userId, accountName, token, label) {
    var userData = getUserData(userId);
    userData.accounts[accountName] = {
        token: token,
        label: label || accountName,
        createdAt: new Date().toISOString()
    };

    // 如果是第一个账号，自动设为活跃账号
    if (!userData.activeAccount) {
        userData.activeAccount = accountName;
    }

    saveUserData(userId, userData);
    return true;
}

/**
 * 获取活跃账号
 */
function getActiveAccount(userId) {
    var userData = getUserData(userId);
    if (!userData.activeAccount || !userData.accounts[userData.activeAccount]) {
        return null;
    }
    return {
        name: userData.activeAccount,
        data: userData.accounts[userData.activeAccount]
    };
}

/**
 * 切换活跃账号
 */
function switchAccount(userId, accountName) {
    var userData = getUserData(userId);
    if (!userData.accounts[accountName]) {
        return false;
    }
    userData.activeAccount = accountName;
    saveUserData(userId, userData);
    return true;
}

/**
 * 删除账号
 */
function deleteAccount(userId, accountName) {
    var userData = getUserData(userId);
    if (!userData.accounts[accountName]) {
        return false;
    }

    delete userData.accounts[accountName];

    // 如果删除的是活跃账号，切换到第一个可用账号
    if (userData.activeAccount === accountName) {
        var accountNames = Object.keys(userData.accounts);
        userData.activeAccount = accountNames.length > 0 ? accountNames[0] : null;
    }

    saveUserData(userId, userData);
    return true;
}

// ==================== 工具调用封装 ====================

/**
 * 查询活动日历
 */
function queryCalendar(token, date, callback) {
    var client = new MCPClient(token);
    var args = date ? { date: date } : {};

    client.callTool("campaign-calender", args, function (error, result) {
        if (error) {
            callback(error);
            return;
        }
        callback(null, formatToolResult(result));
    });
}

/**
 * 查询可领优惠券
 */
function queryAvailableCoupons(token, callback) {
    var client = new MCPClient(token);

    client.callTool("available-coupons", {}, function (error, result) {
        if (error) {
            callback(error);
            return;
        }
        callback(null, formatToolResult(result));
    });
}

/**
 * 一键领取所有优惠券
 */
function autoBindCoupons(token, callback) {
    var client = new MCPClient(token);

    client.callTool("auto-bind-coupons", {}, function (error, result) {
        if (error) {
            callback(error);
            return;
        }
        callback(null, formatToolResult(result));
    });
}

/**
 * 查询我的优惠券
 */
function queryMyCoupons(token, callback) {
    var client = new MCPClient(token);

    client.callTool("my-coupons", {}, function (error, result) {
        if (error) {
            callback(error);
            return;
        }
        callback(null, formatToolResult(result));
    });
}

/**
 * 格式化工具返回结果
 */
function formatToolResult(result) {
    if (!result || !result.content) {
        return "未获取到数据";
    }

    var text = "";
    for (var i = 0; i < result.content.length; i++) {
        var item = result.content[i];
        if (item.type === "text") {
            text += item.text;
        }
    }

    // 移除图片标记（微信不支持）
    text = text.replace(/!\[.*?\]\(.*?\)/g, "");

    // 限制长度（微信消息限制）
    if (text.length > 2000) {
        text = text.substring(0, 1997) + "...";
    }

    return text;
}

// ==================== 命令处理 ====================

/**
 * 显示帮助信息
 */
function showHelp() {
    var message = "🍔 麦当劳优惠券管理插件\n";
    message += "━━━━━━━━━━━━━━━\n\n";
    message += "📝 基础命令:\n";
    message += "• 麦当劳 - 显示主菜单\n";
    message += "• 麦当劳 帮助 - 显示此帮助\n\n";
    message += "🎫 优惠券功能:\n";
    message += "• 麦当劳 日历 - 查看活动日历\n";
    message += "• 麦当劳 优惠券 - 查看可领优惠券\n";
    message += "• 麦当劳 领券 - 一键领取所有优惠券\n";
    message += "• 麦当劳 我的优惠券 - 查看已领优惠券\n\n";
    message += "👤 账号管理:\n";
    message += "• 麦当劳 添加账号 名称 Token - 添加账号\n";
    message += "• 麦当劳 切换账号 名称 - 切换活跃账号\n";
    message += "• 麦当劳 账号列表 - 查看所有账号\n";
    message += "• 麦当劳 删除账号 名称 - 删除账号\n\n";
    message += "⏰ 自动领券:\n";
    message += "• 麦当劳 开启自动领券 - 每天自动领券\n";
    message += "• 麦当劳 关闭自动领券 - 关闭自动领券\n";
    message += "• 麦当劳 状态 - 查看账号状态\n\n";
    message += "🔑 获取 MCP Token:\n";
    message += "访问 https://open.mcd.cn/mcp/doc\n";
    message += "注册并获取您的 MCP Token\n\n";
    message += "━━━━━━━━━━━━━━━\n";
    message += "💡 提示: 支持多账号管理";

    sendText(message);
}

/**
 * 显示主菜单
 */
function showMainMenu() {
    var userId = GetUserID();
    var userData = getUserData(userId);
    var activeAccount = getActiveAccount(userId);

    var message = "🍔 麦当劳优惠券管理\n";
    message += "━━━━━━━━━━━━━━━\n\n";

    if (activeAccount) {
        message += "👤 当前账号: " + activeAccount.data.label + "\n";
        message += "🔄 自动领券: " + (userData.autoClaimEnabled ? "已开启 ✅" : "已关闭 ❌") + "\n\n";
        message += "快捷命令:\n";
        message += "• 麦当劳 日历\n";
        message += "• 麦当劳 优惠券\n";
        message += "• 麦当劳 领券\n";
        message += "• 麦当劳 我的优惠券\n";
    } else {
        message += "⚠️ 未配置账号\n\n";
        message += "请先添加账号:\n";
        message += "麦当劳 添加账号 我的账号 YOUR_TOKEN\n\n";
        message += "获取 Token:\n";
        message += "https://open.mcd.cn/mcp/doc\n";
    }

    message += "\n发送「麦当劳 帮助」查看完整命令";
    sendText(message);
}

/**
 * 处理账号管理命令
 */
function handleAccountCommand(args) {
    var userId = GetUserID();
    var userData = getUserData(userId);

    if (args[0] === "添加账号" && args.length >= 3) {
        var accountName = args[1];
        var token = args[2];
        var label = args.length > 3 ? args.slice(3).join(" ") : accountName;

        addOrUpdateAccount(userId, accountName, token, label);
        sendText("✅ 账号「" + label + "」添加成功！\n\n发送「麦当劳 优惠券」开始使用");
        return;
    }

    if (args[0] === "切换账号" && args.length >= 2) {
        var accountName = args[1];
        if (switchAccount(userId, accountName)) {
            var account = userData.accounts[accountName];
            sendText("✅ 已切换到账号「" + account.label + "」");
        } else {
            sendText("❌ 账号不存在\n\n发送「麦当劳 账号列表」查看所有账号");
        }
        return;
    }

    if (args[0] === "账号列表") {
        var accountNames = Object.keys(userData.accounts);
        if (accountNames.length === 0) {
            sendText("❌ 暂无账号\n\n发送「麦当劳 添加账号 名称 Token」添加账号");
            return;
        }

        var message = "👤 账号列表\n━━━━━━━━━━━━━━━\n\n";
        for (var i = 0; i < accountNames.length; i++) {
            var name = accountNames[i];
            var account = userData.accounts[name];
            var isActive = name === userData.activeAccount;
            message += (isActive ? "✅ " : "　 ") + account.label;
            if (isActive) {
                message += " (当前)";
            }
            message += "\n";
        }
        message += "\n发送「麦当劳 切换账号 名称」切换账号";
        sendText(message);
        return;
    }

    if (args[0] === "删除账号" && args.length >= 2) {
        var accountName = args[1];
        if (deleteAccount(userId, accountName)) {
            sendText("✅ 账号已删除");
        } else {
            sendText("❌ 账号不存在");
        }
        return;
    }

    sendText("❌ 未知命令\n\n发送「麦当劳 帮助」查看使用说明");
}

/**
 * 处理优惠券查询命令
 */
function handleCouponCommand(command) {
    var userId = GetUserID();
    var activeAccount = getActiveAccount(userId);

    if (!activeAccount) {
        sendText("❌ 未配置账号\n\n发送「麦当劳 添加账号 名称 Token」添加账号");
        return;
    }

    var token = activeAccount.data.token;

    if (command === "日历") {
        sendText("🔍 正在查询活动日历...");
        queryCalendar(token, null, function (error, result) {
            if (error) {
                sendText("❌ 查询失败: " + error);
            } else {
                sendText("📅 活动日历\n━━━━━━━━━━━━━━━\n\n" + result);
            }
        });
        return;
    }

    if (command === "优惠券") {
        sendText("🔍 正在查询可领优惠券...");
        queryAvailableCoupons(token, function (error, result) {
            if (error) {
                sendText("❌ 查询失败: " + error);
            } else {
                sendText("🎫 可领优惠券\n━━━━━━━━━━━━━━━\n\n" + result);
            }
        });
        return;
    }

    if (command === "领券") {
        sendText("🎁 正在领取优惠券...");
        autoBindCoupons(token, function (error, result) {
            if (error) {
                sendText("❌ 领取失败: " + error);
            } else {
                sendText("✅ 领券结果\n━━━━━━━━━━━━━━━\n\n" + result);
            }
        });
        return;
    }

    if (command === "我的优惠券") {
        sendText("🔍 正在查询我的优惠券...");
        queryMyCoupons(token, function (error, result) {
            if (error) {
                sendText("❌ 查询失败: " + error);
            } else {
                sendText("🎫 我的优惠券\n━━━━━━━━━━━━━━━\n\n" + result);
            }
        });
        return;
    }
}

/**
 * 处理自动领券设置
 */
function handleAutoClaimCommand(command) {
    var userId = GetUserID();
    var userData = getUserData(userId);
    var activeAccount = getActiveAccount(userId);

    if (!activeAccount) {
        sendText("❌ 未配置账号\n\n发送「麦当劳 添加账号 名称 Token」添加账号");
        return;
    }

    if (command === "开启自动领券") {
        userData.autoClaimEnabled = true;
        saveUserData(userId, userData);
        sendText("✅ 自动领券已开启\n\n每天 09:00 自动领取优惠券");
        return;
    }

    if (command === "关闭自动领券") {
        userData.autoClaimEnabled = false;
        saveUserData(userId, userData);
        sendText("✅ 自动领券已关闭");
        return;
    }

    if (command === "状态") {
        var message = "📊 账号状态\n━━━━━━━━━━━━━━━\n\n";
        message += "👤 当前账号: " + activeAccount.data.label + "\n";
        message += "🔄 自动领券: " + (userData.autoClaimEnabled ? "已开启 ✅" : "已关闭 ❌") + "\n";
        if (userData.lastClaimDate) {
            message += "📅 上次领券: " + userData.lastClaimDate + "\n";
        }
        sendText(message);
        return;
    }
}

// ==================== 定时任务 ====================

/**
 * 定时任务入口（每天 09:00 执行）
 */
function cronTask() {
    // 获取所有用户数据
    var allUsers = bucketKeys(USER_DATA_KEY);
    if (!allUsers || allUsers.length === 0) {
        return;
    }

    var today = new Date().toISOString().split("T")[0];

    for (var i = 0; i < allUsers.length; i++) {
        var userId = allUsers[i];
        var userData = getUserData(userId);

        // 检查是否开启自动领券
        if (!userData.autoClaimEnabled) {
            continue;
        }

        // 检查今天是否已领取
        if (userData.lastClaimDate === today) {
            continue;
        }

        // 获取活跃账号
        var activeAccount = getActiveAccount(userId);
        if (!activeAccount) {
            continue;
        }

        // 执行自动领券
        autoBindCoupons(activeAccount.data.token, function (error, result) {
            if (!error) {
                userData.lastClaimDate = today;
                saveUserData(userId, userData);

                // 发送通知给用户
                sendTextTo(userId, "🎁 自动领券成功\n━━━━━━━━━━━━━━━\n\n" + result);
            }
        });
    }
}

// ==================== 主函数 ====================

function main() {
    var content = GetContent().trim();

    // 检查是否是定时任务触发（定时任务时消息内容为空）
    if (!content || content === "") {
        cronTask();
        return;
    }

    // 解析命令
    if (content === "麦当劳") {
        showMainMenu();
        return;
    }

    // 提取子命令
    var match = content.match(/^麦当劳\s+(.+)$/);
    if (!match) {
        showMainMenu();
        return;
    }

    var subCommand = match[1].trim();
    var args = subCommand.split(/\s+/);

    // 帮助命令
    if (args[0] === "帮助") {
        showHelp();
        return;
    }

    // 账号管理命令
    if (["添加账号", "切换账号", "账号列表", "删除账号"].indexOf(args[0]) !== -1) {
        handleAccountCommand(args);
        return;
    }

    // 优惠券查询命令
    if (["日历", "优惠券", "领券", "我的优惠券"].indexOf(args[0]) !== -1) {
        handleCouponCommand(args[0]);
        return;
    }

    // 自动领券设置
    if (["开启自动领券", "关闭自动领券", "状态"].indexOf(args[0]) !== -1) {
        handleAutoClaimCommand(args[0]);
        return;
    }

    // 未知命令
    sendText("❌ 未知命令\n\n发送「麦当劳 帮助」查看使用说明");
}

// 执行主函数
main();

