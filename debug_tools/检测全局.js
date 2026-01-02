/**
 * 全局对象检测插件
 * 检查autMan是否将函数注入到全局作用域
 */

// [disable:false]
// [rule: ^检测全局$]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]

async function main() {
    let msg = "🔍 autMan全局对象检测:\n\n";

    // 检查所有可能的全局函数
    const globalFuncs = [
        'getSenderID', 'Sender', 'bucketGet', 'bucketSet', 'bucketDel',
        'push', 'name', 'machineId', 'version', 'get', 'set', 'del',
        'bucketKeys', 'bucketAllKeys', 'notifyMasters', 'coffee', 'spread'
    ];

    const available = [];
    const unavailable = [];

    for (const funcName of globalFuncs) {
        try {
            if (typeof eval(funcName) !== 'undefined') {
                available.push(funcName);
            } else {
                unavailable.push(funcName);
            }
        } catch (e) {
            unavailable.push(funcName);
        }
    }

    msg += `✅ 可用的全局函数 (${available.length}):\n`;
    available.forEach(f => msg += `   - ${f}\n`);

    msg += `\n❌ 不可用的全局函数 (${unavailable.length}):\n`;
    unavailable.forEach(f => msg += `   - ${f}\n`);

    // 尝试使用全局函数
    msg += "\n📝 尝试使用全局函数:\n";
    try {
        const senderID = getSenderID();
        msg += `✅ getSenderID() = ${senderID}\n`;

        const sender = new Sender(senderID);
        msg += `✅ new Sender() 成功\n`;

        const testMsg = await sender.getMessage();
        msg += `✅ getMessage() = ${testMsg}\n`;

        const userName = await sender.getUserName();
        msg += `✅ getUserName() = ${userName}\n`;

        // 如果到这里都成功了,发送完整信息
        sender.reply(msg + "\n\n🎉 可以使用全局函数!");

    } catch (e) {
        msg += `❌ 使用失败: ${e.message}\n`;
        console.log(msg);
    }
}

main().catch(e => console.error("Fatal:", e));
