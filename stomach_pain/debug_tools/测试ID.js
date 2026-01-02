/**
 * SenderID获取测试
 * 测试不同方式获取senderID
 */

// [disable:false]
// [rule: ^测试ID$]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]

async function main() {
    let msg = "🔍 SenderID获取测试:\n\n";

    // 方式1: 检查process.argv (命令行参数)
    try {
        if (typeof process !== 'undefined' && process.argv) {
            msg += "✅ process.argv 可用:\n";
            process.argv.forEach((arg, i) => {
                msg += `   [${i}] ${arg}\n`;
            });
        }
    } catch (e) {
        msg += `❌ process.argv: ${e.message}\n`;
    }

    // 方式2: 检查全局变量
    msg += "\n🔍 检查可能的全局变量:\n";
    const possibleGlobals = [
        'senderID', 'SenderID', 'senderId',
        '__senderID', '_senderID', 'SENDER_ID',
        'messageID', 'MESSAGE_ID'
    ];

    for (const varName of possibleGlobals) {
        try {
            const val = eval(varName);
            if (val !== undefined) {
                msg += `✅ ${varName} = ${val}\n`;
            }
        } catch (e) {
            // 不存在
        }
    }

    // 方式3: 检查this
    try {
        msg += `\n🔍 this = ${JSON.stringify(this)}\n`;
    } catch (e) {
        msg += `\n❌ this: ${e.message}\n`;
    }

    // 方式4: 检查arguments
    try {
        if (typeof arguments !== 'undefined') {
            msg += `\n🔍 arguments.length = ${arguments.length}\n`;
            for (let i = 0; i < arguments.length; i++) {
                msg += `   arguments[${i}] = ${arguments[i]}\n`;
            }
        }
    } catch (e) {
        msg += `\n❌ arguments: ${e.message}\n`;
    }

    // 方式5: 尝试不带参数创建Sender
    try {
        msg += "\n🔍 尝试 new Sender() (无参数):\n";
        const sender1 = new Sender();
        msg += "✅ 成功! Sender不需要参数!\n";

        const testMsg = await sender1.getMessage();
        msg += `✅ getMessage() = ${testMsg}\n`;

        const userName = await sender1.getUserName();
        msg += `✅ getUserName() = ${userName}\n`;

        // 成功!发送结果
        sender1.reply(msg + "\n\n🎉 找到了!Sender不需要参数!");
        return;

    } catch (e) {
        msg += `❌ new Sender(): ${e.message}\n`;
    }

    // 方式6: 尝试用null参数
    try {
        msg += "\n🔍 尝试 new Sender(null):\n";
        const sender2 = new Sender(null);
        const testMsg = await sender2.getMessage();
        msg += `✅ getMessage() = ${testMsg}\n`;
        sender2.reply(msg + "\n\n🎉 找到了!Sender(null)有效!");
        return;
    } catch (e) {
        msg += `❌ new Sender(null): ${e.message}\n`;
    }

    console.log(msg + "\n❌ 所有方式都失败");
}

main().catch(e => console.error("Fatal:", e));
