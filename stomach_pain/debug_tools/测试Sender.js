/**
 * Sender对象使用测试
 * 基于this对象中发现的结构
 */

// [disable:false]
// [rule: ^测试Sender$]
// [admin: false] 
// [service: 88489948]
// [price: 0.00]

async function main() {
    let msg = "🔍 Sender对象测试:\n\n";

    try {
        // 测试1: 直接使用全局Sender
        if (typeof Sender !== 'undefined') {
            msg += "✅ 全局Sender存在\n";
            msg += `   类型: ${typeof Sender}\n`;

            // 检查Sender的属性
            msg += "   属性:\n";
            for (const key in Sender) {
                msg += `   - ${key}: ${typeof Sender[key]}\n`;
            }

            // 尝试调用Sender的方法
            if (typeof Sender.reply === 'function') {
                msg += "\n✅ Sender.reply 是函数,尝试调用...\n";
                Sender.reply("测试回复");
                return;
            }

            if (typeof Sender.sendText === 'function') {
                msg += "\n✅ Sender.sendText 是函数,尝试调用...\n";
                Sender.sendText("测试发送");
                return;
            }
        }

        // 测试2: 使用this.Sender
        if (this && this.Sender) {
            msg += "\n✅ this.Sender 存在\n";

            // 检查this.Sender的方法
            for (const key in this.Sender) {
                if (typeof this.Sender[key] === 'function') {
                    msg += `   - ${key}(): function\n`;
                }
            }

            // 尝试reply
            if (typeof this.Sender.reply === 'function') {
                msg += "\n🎉 找到了! this.Sender.reply()\n";
                this.Sender.reply(msg);
                return;
            }
        }

        // 测试3: 使用autMan/AutMan对象
        if (this && this.autMan) {
            msg += "\n✅ this.autMan 存在\n";
            if (typeof this.autMan.reply === 'function') {
                this.autMan.reply(msg);
                return;
            }
        }

        if (this && this.AutMan) {
            msg += "\n✅ this.AutMan 存在\n";
            if (typeof this.AutMan.reply === 'function') {
                this.AutMan.reply(msg);
                return;
            }
        }

        console.log(msg + "\n❌ 未找到reply方法");

    } catch (e) {
        console.error("测试错误:", e);
        console.error(msg);
    }
}

main().catch(e => console.error("Fatal:", e));
