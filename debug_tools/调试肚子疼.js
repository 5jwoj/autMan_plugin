/**
 * 调试版插件 - 检查关键词匹配
 */

// [disable:false]
// [rule: ^肚子疼(.*)$]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]

async function sendMessage(text) {
    if (typeof Sender !== 'undefined' && Sender && typeof Sender.reply === 'function') {
        return Sender.reply(text);
    }
    console.log("[发送消息]", text);
}

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

async function main() {
    try {
        const content = getMessageContent().trim();

        let msg = `🔍 调试信息:\n\n`;
        msg += `原始消息: [${content}]\n`;
        msg += `消息长度: ${content.length}\n\n`;

        msg += `匹配测试:\n`;
        msg += `包含"清空肚子疼记录": ${content.indexOf("清空肚子疼记录") !== -1}\n`;
        msg += `包含"肚子疼记录": ${content.indexOf("肚子疼记录") !== -1}\n`;
        msg += `包含"肚子疼帮助": ${content.indexOf("肚子疼帮助") !== -1}\n`;
        msg += `包含"肚子疼": ${content.indexOf("肚子疼") !== -1}\n\n`;

        // 逐字符显示
        msg += `字符分析:\n`;
        for (let i = 0; i < content.length && i < 20; i++) {
            msg += `[${i}] '${content[i]}' (${content.charCodeAt(i)})\n`;
        }

        // 执行匹配
        msg += `\n执行结果:\n`;
        if (content.indexOf("清空肚子疼记录") !== -1) {
            msg += `✅ 匹配到: 清空肚子疼记录`;
        } else if (content.indexOf("肚子疼记录") !== -1) {
            msg += `✅ 匹配到: 肚子疼记录`;
        } else if (content.indexOf("肚子疼帮助") !== -1) {
            msg += `✅ 匹配到: 肚子疼帮助`;
        } else if (content.indexOf("肚子疼") !== -1) {
            msg += `✅ 匹配到: 肚子疼`;
        } else {
            msg += `❌ 未匹配任何关键词`;
        }

        await sendMessage(msg);

    } catch (error) {
        console.error("调试错误:", error);
        await sendMessage(`❌ 错误: ${error.message}`);
    }
}

main().catch(e => console.error("Fatal:", e));
