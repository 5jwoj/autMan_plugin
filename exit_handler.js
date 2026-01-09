/**
 * 全局退出/取消处理器 v1.0.1
 * 用于解决 autMan 多插件监听简短指令(Q/取消)时的冲突问题
 */

// [disable:false]
// [rule: ^([Qq]|[Nn]|取消|退出)$]
// [admin: false]
// [service: 88489948]
// [price: 0.00]
// [version: v1.0.1]

// buckets
const BUCKETS = [
    { name: "aoligei_pending_action", label: "奥力给" },
    { name: "stomach_pain_pending", label: "肚子疼" },
    { name: "weight_pending_action", label: "体重记录" }
];

function getUserID() {
    if (typeof GetUserID === 'function') return GetUserID();
    if (typeof GetUserID === 'undefined' && typeof GetUsername === 'function') return GetUsername();
    return "user_default";
}

function bucketDel(bucket, key) {
    if (typeof BucketDel === 'function') return BucketDel(bucket, key);
    if (typeof plugin_bucket_del === 'function') return plugin_bucket_del(bucket, key);
    return null;
}

function bucketGet(bucket, key) {
    if (typeof BucketGet === 'function') return BucketGet(bucket, key);
    if (typeof plugin_bucket_get === 'function') return plugin_bucket_get(bucket, key);
    return "";
}

function sendMessage(text) {
    if (typeof Sender !== 'undefined' && Sender && typeof Sender.reply === 'function') {
        Sender.reply(text);
        return;
    }
    console.log(text);
}

function main() {
    const userID = getUserID();
    const KEY = `user_${userID}`;
    let cleared = [];

    // 遍历所有插件的 pending bucket
    for (const b of BUCKETS) {
        const state = bucketGet(b.name, KEY);
        if (state && state !== "null" && state !== "") {
            bucketDel(b.name, KEY);
            cleared.push(b.label);
        }
    }

    if (cleared.length > 0) {
        sendMessage(`✅ 已退出: ${cleared.join(", ")} 操作`);
    } else {
        // 如果没有正在进行的任务，可以选择静默，或者提示
        // 为了避免误触打扰，选择静默，或仅在日志输出
        console.log("[全局退出] 当前无活跃任务");
    }
}

main();
