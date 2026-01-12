# 体重记录插件 v2.1.0

[![Python](https://img.shields.io/badge/Python-3.6+-blue.svg)](https://www.python.org/)
[![matplotlib](https://img.shields.io/badge/matplotlib-required-orange.svg)](https://matplotlib.org/)

智能体重管理工具,支持记录、统计分析和可视化曲线图。

## ✨ 功能特性

### 📝 核心功能
- ✅ 记录每日体重(带确认机制)
- ✅ 查看最近记录(最近7天)
- ✅ 统计分析(最高/最低/平均/变化趋势)
- ✅ 目标体重管理
- ✅ 目标进度追踪

### 🎨 可视化功能 (v2.1.0新增)
- ✅ 自动生成体重变化曲线图
- ✅ 蓝色曲线显示体重趋势
- ✅ 红色虚线显示目标体重
- ✅ 数据点标注具体数值
- ✅ 网格线辅助读取

### 🔒 安全机制
- ✅ 关键操作需要确认(y/n/q)
- ✅ 60秒超时自动退出
- ✅ 数据隔离(每个用户独立)

## 📖 使用说明

### 基础命令

```
体重 65.5              # 记录当前体重(需确认)
体重记录               # 查看最近记录 + 曲线图
体重统计               # 查看统计信息
设置目标体重 60        # 设定目标体重(需确认)
目标进度               # 查看目标进度
体重帮助               # 显示帮助信息
```

### 使用示例

#### 记录体重
```
你: 体重 65.5

插件: 📝 确认要记录 [用户ID] 在 2026-01-12 的体重: 65.5kg 吗？

请输入：
  y - 确认
  n - 取消
  q - 退出

你: y

插件: ✅ 已记录 2026-01-12 的体重: 65.5kg

当前共有 1 条记录
```

#### 查看记录(含曲线图)
```
你: 体重记录

插件: 📊 体重记录 (共5条)
━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ 1月12日
  📊 65.5kg

🗓️ 1月11日
  📊 66.0kg ↓ -0.5kg

🗓️ 1月10日
  📊 66.5kg ↓ -0.5kg

[随后自动发送曲线图图片]
```

#### 设置目标
```
你: 设置目标体重 60

插件: 🎯 确认要设置目标体重为: 60.0kg 吗？

你: y

插件: ✅ 已设置目标体重为: 60.0kg

📊 当前体重: 65.5kg
📊 还需减重: 5.5kg
```

## 🚀 快速部署

### 1. 安装依赖

```bash
# 方法1: 使用安装脚本(推荐)
cd weight_tracker
chmod +x install_dependencies.sh
./install_dependencies.sh

# 方法2: 手动安装
pip3 install matplotlib
```

### 2. 部署插件

```bash
# 下载插件文件
wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/weight_tracker/体重记录.py

# 上传到autMan
scp 体重记录.py root@服务器:/root/aut/plugin/scripts/

# 设置权限
chmod 755 /root/aut/plugin/scripts/体重记录.py

# 重启autMan
systemctl restart autman
```

### 3. 测试

发送消息:
```
体重帮助
```

如果收到帮助信息,说明安装成功! 🎉

## 📊 曲线图功能

### 图表特点
- 📈 **蓝色曲线**: 体重变化趋势
- 🎯 **红色虚线**: 目标体重线(如已设置)
- 📊 **数据标注**: 每个点标注具体数值
- 🗓️ **日期轴**: X轴显示日期
- 📏 **网格线**: 辅助读取数值

### 依赖要求
- Python 3.6+
- matplotlib库
- 中文字体(macOS通常已内置)

详见: [CHART_FEATURE.md](CHART_FEATURE.md)

## 🔧 技术细节

### 数据存储
- **存储桶**: `weight_tracker`
- **格式**: JSON
- **结构**:
  ```json
  {
    "records": [
      {
        "date": "2026-01-12",
        "weight": 65.5,
        "timestamp": 1736668800000
      }
    ],
    "target": 60.0
  }
  ```

### API调用
```python
# 使用middleware.Sender
sender_id = middleware.getSenderID()
sender = middleware.Sender(sender_id)

# 获取用户信息
user_id = sender.getUserID()
message = sender.getMessage()

# 发送消息
sender.reply("消息内容")

# 发送图片
sender.sendImage(f"file://{image_path}")

# 等待用户输入
user_input = sender.listen(60000)
```

## 📋 系统要求

- **autMan**: 2.4.7+ (支持Python插件)
- **Python**: 3.6+
- **matplotlib**: 最新版本
- **中文字体**: 用于图表显示

## 🐛 故障排除

### 问题1: 插件无响应
**解决方案**:
1. 检查触发规则: `^体重(.*)$`
2. 确认middleware已正确导入
3. 查看autMan日志

### 问题2: 曲线图不显示
**解决方案**:
```bash
# 安装matplotlib
pip3 install matplotlib

# Linux系统安装中文字体
sudo apt-get install fonts-wqy-microhei
```

### 问题3: 确认超时
**说明**: 正常现象,60秒内未回复会自动退出,重新发送指令即可。

## 📝 更新日志

### v2.1.0 (2026-01-12)
- 🎨 新增体重变化曲线图
- ✅ 集成matplotlib图表生成
- ✅ 自动发送可视化图表
- ✅ 优化数据展示

### v2.0.0 (2026-01-12)
- 🎉 Python版本首次发布
- ✅ 核心功能完整实现
- ✅ 使用middleware.Sender API
- ✅ 交互式确认机制

## 💡 使用建议

1. **每天记录**: 建议每天同一时间记录(如早晨起床后)
2. **设定目标**: 根据BMI等健康指标设定合理目标
3. **关注趋势**: 重点看整体趋势,不要过分关注单日波动
4. **定期查看**: 每周查看一次曲线图,了解整体进展

## 📚 相关文档

- [CHART_FEATURE.md](CHART_FEATURE.md) - 曲线图功能详细说明
- [install_dependencies.sh](install_dependencies.sh) - 依赖安装脚本

## 🤝 贡献

欢迎提交Issue和Pull Request!

## 📄 许可证

MIT License

---

**健康生活从记录开始! 💪**
