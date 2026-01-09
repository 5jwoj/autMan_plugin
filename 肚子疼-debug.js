/**
 * autMan 插件 - 肚子疼记录（调试版本）
 * 
 * 这是一个简化的调试版本，用于测试插件是否能正常响应
 * 版本：v1.0.1-debug
 */

// 测试基本响应
try {
    var content = GetContent();
    console.log("接收到消息: " + content);

    if (!content) {
        console.log("内容为空，退出");
        sendText("❌ DEBUG: 消息内容为空");
    } else {
        var command = content.trim();
        console.log("处理命令: " + command);

        if (command === "肚子疼") {
            console.log("匹配到肚子疼命令");
            sendText("✅ DEBUG: 插件正常工作！\n收到命令：" + command);
        } else if (command === "肚子疼测试") {
            var userid = GetUserID();
            var username = GetUsername();
            var imtype = GetImType();

            var info = "📊 DEBUG 信息：\n";
            info += "用户ID: " + userid + "\n";
            info += "用户名: " + username + "\n";
            info += "渠道: " + imtype + "\n";
            info += "命令: " + command;

            sendText(info);
        } else {
            console.log("未匹配到命令: " + command);
            sendText("❓ DEBUG: 未识别的命令\n收到：" + command + "\n\n请发送：肚子疼 或 肚子疼测试");
        }
    }
} catch (e) {
    console.error("插件错误: " + e);
    sendText("❌ 插件执行错误: " + e);
}
