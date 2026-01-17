# autMan 插件集合

[![GitHub stars](https://img.shields.io/github/stars/5jwoj/autMan_plugin?style=social)](https://github.com/5jwoj/autMan_plugin/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/5jwoj/autMan_plugin?style=social)](https://github.com/5jwoj/autMan_plugin/network/members)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

精心打造的 autMan 插件集合,提供实用的生活记录和信息查询功能。

## 📦 插件列表

### 🌤 天气查询插件 v1.2.0

基于高德地图API的智能天气查询插件,支持全国所有城市区县。

**特性**:
- ✅ 支持全国3000+城市区县查询
- ✅ 实时天气 + 未来4天预报
- ✅ 智能识别城市名称(无需查询编码)
- ✅ 美观的Emoji图标显示
- ✅ 自动地理编码查询

**使用示例**:
```
北京天气                    # 查询北京实时天气
海淀区天气                  # 查询北京海淀区天气
上海浦东新区天气预报        # 查询浦东新区未来4天天气
天气帮助                    # 显示帮助信息
```

**查看详情**: [weather/README.md](weather/README.md)

---

### 🤕 肚子疼记录插件 v1.2.1

健康追踪工具,记录和分析肚子疼事件,帮助了解症状规律。

**特性**:
- ✅ 记录肚子疼事件(含地点信息)
- ✅ 按日期分组显示历史记录
- ✅ 详细统计分析(频率、趋势)
- ✅ 支持删除指定记录
- ✅ 交互式确认机制

**使用示例**:
```
肚子疼                      # 记录一次肚子疼事件
肚子疼记录                  # 查看所有历史记录
肚子疼删除                  # 删除指定记录
肚子疼帮助                  # 显示帮助信息
```

**查看详情**: [stomachache/README.md](stomachache/README.md)

---

### 💩 便便记录插件 v1.1.0

健康生活追踪工具,记录和分析便便事件。

**特性**:
- ✅ 记录便便事件(含过程评级)
- ✅ 按日期分组显示历史记录
- ✅ 详细统计分析(频率、趋势)
- ✅ 支持删除指定记录
- ✅ 交互式确认机制

**使用示例**:
```
便便                        # 记录一次便便事件
便便记录                    # 查看所有历史记录
便便删除                    # 删除指定记录
便便帮助                    # 显示帮助信息
```

**查看详情**: [poop/README.md](poop/README.md)

---

### 🧠 性格测试插件 v1.2.0

基于MBTI理论的性格测试插件,通过16道精选问题帮助用户了解自己的性格类型,支持查询任意MBTI类型的详细解释。

**特性**:
- ✅ 基于MBTI四维度理论
- ✅ 仅需16道题,3-5分钟完成
- ✅ 16种性格类型详细分析
- ✅ 保存测试历史记录
- ✅ 交互友好,支持中途退出
- ✅ 直接发送MBTI类型查看解释

**使用示例**:
```
性格测试                    # 开始新的性格测试
性格测试记录                # 查看历史测试记录
性格测试删除                # 删除指定记录
性格测试帮助                # 显示帮助信息
```

**查看详情**: [personality/README.md](personality/README.md)

---

### ⚖️ 体重记录插件 v2.1.0

智能体重管理工具,支持记录、统计分析和可视化曲线图。

**特性**:
- ✅ 记录每日体重(带确认机制)
- ✅ 查看最近记录(最近7天)
- ✅ 统计分析(最高/最低/平均/变化趋势)
- ✅ 目标体重管理和进度追踪
- ✅ 自动生成体重变化曲线图 🎨
- ✅ 可视化图表(matplotlib)

**使用示例**:
```
体重 65.5                   # 记录当前体重
体重记录                    # 查看记录 + 曲线图
体重统计                    # 查看统计信息
设置目标体重 60             # 设定目标体重
目标进度                    # 查看目标进度
体重帮助                    # 显示帮助信息
```

**查看详情**: [weight_tracker/README.md](weight_tracker/README.md)

---

### 🍔 麦当劳优惠券插件 v1.0.0

基于麦当劳 MCP Server API 的优惠券管理插件，支持活动日历查询、优惠券领取、多账号管理和定时自动领券。

**特性**:
- ✅ 活动日历查询
- ✅ 优惠券管理（查看可领/已领优惠券）
- ✅ 一键领取所有优惠券
- ✅ 多账号管理（支持添加多个 MCP 账号）
- ✅ 定时自动领券（每天 09:00 自动领取）
- ✅ 完整的 MCP 协议支持

**使用示例**:
```
麦当劳                      # 显示主菜单
麦当劳 优惠券               # 查看可领优惠券
麦当劳 领券                 # 一键领取所有优惠券
麦当劳 我的优惠券           # 查看已领优惠券
麦当劳 添加账号 名称 Token  # 添加账号
麦当劳 开启自动领券         # 开启自动领券
麦当劳 帮助                 # 显示帮助信息
```

**查看详情**: [maimai/README.md](maimai/README.md)

---

## 🚀 快速开始

### 天气查询插件(JavaScript)

1. **下载插件文件**
   ```bash
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/weather/天气查询.js
   ```

2. **上传到autMan**
   ```bash
   scp 天气查询.js root@服务器:/root/aut/plugin/replies/
   ```

3. **配置API Key**
   - 访问 [高德开放平台](https://console.amap.com)
   - 注册并创建应用
   - 获取 Web服务 API Key
   - 在autMan插件管理界面配置

4. **重启autMan**
   ```bash
   systemctl restart autman
   ```

### 麦当劳优惠券插件(JavaScript)

1. **下载插件文件**
   ```bash
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/maimai/麦当劳优惠券.js
   ```

2. **上传到autMan**
   ```bash
   scp 麦当劳优惠券.js root@服务器:/root/aut/plugin/replies/
   ```

3. **获取 MCP Token**
   - 访问 [麦当劳开放平台](https://open.mcd.cn/mcp/doc)
   - 注册并创建应用
   - 获取 MCP Token

4. **重启autMan**
   ```bash
   systemctl restart autman
   ```

5. **添加账号**
   - 在微信中发送：`麦当劳 添加账号 我的账号 YOUR_TOKEN`
   - 开始使用：`麦当劳 优惠券`

### 健康记录插件(Python)

适用于肚子疼记录、便便记录、性格测试和体重记录插件:

1. **安装依赖** (体重记录插件需要)
   ```bash
   # 体重记录插件需要matplotlib
   pip3 install matplotlib
   ```

2. **下载插件文件**
   ```bash
   # 肚子疼插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/stomachache/肚子疼.py
   
   # 便便插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/poop/便便.py
   
   # 性格测试插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/personality/性格测试.py
   
   # 体重记录插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/weight_tracker/体重记录.py
   ```

3. **上传到autMan**
   ```bash
   scp 肚子疼.py root@服务器:/root/aut/plugin/scripts/
   scp 便便.py root@服务器:/root/aut/plugin/scripts/
   scp 性格测试.py root@服务器:/root/aut/plugin/scripts/
   scp 体重记录.py root@服务器:/root/aut/plugin/scripts/
   ```

4. **设置权限**
   ```bash
   chmod 755 /root/aut/plugin/scripts/肚子疼.py
   chmod 755 /root/aut/plugin/scripts/便便.py
   chmod 755 /root/aut/plugin/scripts/性格测试.py
   chmod 755 /root/aut/plugin/scripts/体重记录.py
   ```

5. **重启autMan**
   ```bash
   systemctl restart autman
   ```

## 📍 系统要求

- **autMan**: 支持Python和JavaScript插件、定时任务的版本
- **Python**: 3.6+ (健康记录插件)
- **matplotlib**: 最新版本 (体重记录插件)
- **网络**: 需要访问高德地图API(天气查询插件)、麦当劳MCP API(麦当劳优惠券插件)

## 🔧 技术栈

| 插件 | 语言 | API依赖 | 存储方式 |
|------|------|---------|----------|
| 天气查询 | JavaScript | 高德地图API | 无需存储 |
| 肚子疼记录 | Python | 无 | autMan存储桶 |
| 便便记录 | Python | 无 | autMan存储桶 |
| 性格测试 | Python | 无 | autMan存储桶 |
| 体重记录 | Python | matplotlib | autMan存储桶 |
| 麦当劳优惠券 | JavaScript | 麦当劳MCP API | autMan存储桶 |

## 📖 文档

每个插件目录下都包含详细的README文档:

- [weather/README.md](weather/README.md) - 天气查询插件详细说明
- [stomachache/README.md](stomachache/README.md) - 肚子疼记录插件详细说明
- [poop/README.md](poop/README.md) - 便便记录插件详细说明
- [personality/README.md](personality/README.md) - 性格测试插件详细说明
- [weight_tracker/README.md](weight_tracker/README.md) - 体重记录插件详细说明
- [maimai/README.md](maimai/README.md) - 麦当劳优惠券插件详细说明

## 🎯 开发计划

- [x] 添加体重记录插件 (已完成 v2.1.0)
- [x] 支持可视化图表 (体重曲线图)
- [ ] 添加更多生活记录插件
- [ ] 支持数据导出功能
- [ ] 支持多语言

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议!

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 支持

- 提交 [Issue](https://github.com/5jwoj/autMan_plugin/issues)
- 查看 [Wiki](https://github.com/5jwoj/autMan_plugin/wiki)

## ⭐ Star History

如果这个项目对你有帮助,请给个 Star ⭐️

---

**Made with ❤️ by [5jwoj](https://github.com/5jwoj)**
