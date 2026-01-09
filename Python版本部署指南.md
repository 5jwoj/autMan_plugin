# Python 版本插件部署指南

## 🎯 重要说明

这是 **Python 版本**的肚子疼插件，使用 **middleware 中间件**方式开发。

### 与 ES5 版本的区别

| 特性 | ES5 版本 (肚子疼.js) | Python 版本 (肚子疼.py) |
|------|---------------------|------------------------|
| 语言 | JavaScript (ES5) | Python 3 |
| 存放目录 | `plugin/replies/` | `plugin/scripts/` |
| 需要配置规则 | ✅ 需要在后台配置 | ❌ 不需要，规则在代码中 |
| 规则定义 | 在后台界面配置 | 在文件头部注释定义 |
| 运行环境 | autMan 内置 ES5 | 系统 Python 3 |
| 依赖 | 无需额外依赖 | 需要 Python 环境 |

## 📋 部署步骤

### 步骤 1：上传文件

将 `肚子疼.py` 上传到 autMan 服务器的 **scripts** 目录：

```bash
# 使用 scp 上传
scp 肚子疼.py root@你的服务器IP:/root/aut/plugin/scripts/

# 或使用 SFTP 上传到
/root/aut/plugin/scripts/肚子疼.py
```

**注意**：是 `scripts` 目录，不是 `replies` 目录！

### 步骤 2：设置文件权限

```bash
# SSH 登录服务器后执行
cd /root/aut/plugin/scripts/
chmod 755 肚子疼.py
```

### 步骤 3：检查 Python 环境

确保服务器安装了 Python 3：

```bash
# 检查 Python 版本
python3 --version

# 如果没有安装，安装 Python 3
# Ubuntu/Debian
apt-get install python3

# CentOS/RHEL
yum install python3
```

### 步骤 4：重启 autMan

```bash
# 方法1：如果使用 systemd
systemctl restart autman

# 方法2：如果使用 supervisor
supervisorctl restart autman

# 方法3：如果是手动启动
ps aux | grep autman
kill -9 <进程ID>
cd /root/aut && ./autman
```

### 步骤 5：测试

重启后，在 Telegram 发送：`肚子疼`

**预期响应**：
```
📝 确认要记录一次肚子疼事件吗？

请输入：
  y - 确认
  n - 取消
  q - 退出
```

## 🔍 规则说明

Python 版本的规则定义在文件头部：

```python
# [disable:false]        # 是否禁用插件
# [rule: ^肚子疼(.*)$]   # 正则表达式规则
# [admin: false]         # 是否需要管理员权限
# [price: 0.00]          # 价格（如果上架销售）
# [version: 1.0.0]       # 版本号
```

### 规则解释

- `^肚子疼(.*)$` - 这是一个正则表达式
  - `^` - 匹配开头
  - `肚子疼` - 匹配"肚子疼"文字
  - `(.*)` - 匹配任意字符（捕获组）
  - `$` - 匹配结尾

这个规则会匹配：
- ✅ `肚子疼`
- ✅ `肚子疼记录`
- ✅ `肚子疼删除`
- ✅ `肚子疼帮助`
- ✅ `肚子疼任意内容`

## 📁 文件结构

```
/root/aut/
├── plugin/
│   ├── replies/          # ES5 插件目录
│   │   └── 肚子疼.js     # ES5 版本（需要配置规则）
│   └── scripts/          # Python/NodeJS/Shell 插件目录
│       └── 肚子疼.py     # Python 版本（不需要配置规则）✅
```

## 🔧 数据存储

Python 版本使用不同的存储方式：

```python
# 存储数据
middleware.bucketSet(BUCKET_NAME, user_id, json_data)

# 获取数据
data = middleware.bucketGet(BUCKET_NAME, user_id)
```

**存储格式**：
- **存储桶名称**: `stomachache`
- **Key**: 用户 ID
- **Value**: JSON 数组，包含所有记录

```json
[
  {
    "username": "用户名",
    "userid": "用户ID",
    "datetime": "2026-01-09 20:00:00",
    "timestamp": 1704801600,
    "imtype": "tb"
  }
]
```

## ⚠️ 注意事项

1. **Python 环境**：服务器必须安装 Python 3
2. **文件位置**：必须放在 `plugin/scripts/` 目录
3. **文件权限**：必须有执行权限（755）
4. **规则定义**：规则在代码头部，不需要后台配置
5. **重启生效**：修改后需要重启 autMan

## 🆚 选择哪个版本？

### 推荐使用 Python 版本（肚子疼.py）✅

**优点**：
- ✅ 不需要在后台配置规则
- ✅ 代码更清晰易读
- ✅ 可以使用 Python 丰富的库
- ✅ 更容易调试

**缺点**：
- ❌ 需要服务器安装 Python 3
- ❌ 需要 autMan 授权有效

### ES5 版本（肚子疼.js）

**优点**：
- ✅ 不需要额外依赖
- ✅ 在 autMan 内置环境运行

**缺点**：
- ❌ 需要在后台配置规则
- ❌ ES5 语法限制较多
- ❌ 调试相对困难

## 🔍 问题排查

### 如果没有响应

1. **检查文件位置**
   ```bash
   ls -la /root/aut/plugin/scripts/肚子疼.py
   ```

2. **检查文件权限**
   ```bash
   chmod 755 /root/aut/plugin/scripts/肚子疼.py
   ```

3. **检查 Python 环境**
   ```bash
   python3 --version
   ```

4. **查看日志**
   ```bash
   tail -f /root/aut/logs/autman.log
   ```

5. **手动测试脚本**
   ```bash
   cd /root/aut/plugin/scripts/
   python3 肚子疼.py
   ```

## 💡 快速对比测试

你可以同时部署两个版本：
- `plugin/replies/肚子疼.js` - ES5 版本
- `plugin/scripts/肚子疼.py` - Python 版本

但建议只使用一个版本，避免冲突！

---

**推荐**：使用 Python 版本（`肚子疼.py`），更简单方便！
