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

### 健康记录插件(Python)

适用于肚子疼记录、便便记录和性格测试插件:

1. **下载插件文件**
   ```bash
   # 肚子疼插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/stomachache/肚子疼.py
   
   # 便便插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/poop/便便.py
   
   # 性格测试插件
   wget https://raw.githubusercontent.com/5jwoj/autMan_plugin/main/personality/性格测试.py
   ```

2. **上传到autMan**
   ```bash
   scp 肚子疼.py root@服务器:/root/aut/plugin/scripts/
   scp 便便.py root@服务器:/root/aut/plugin/scripts/
   scp 性格测试.py root@服务器:/root/aut/plugin/scripts/
   ```

3. **设置权限**
   ```bash
   chmod 755 /root/aut/plugin/scripts/肚子疼.py
   chmod 755 /root/aut/plugin/scripts/便便.py
   chmod 755 /root/aut/plugin/scripts/性格测试.py
   ```

4. **重启autMan**
   ```bash
   systemctl restart autman
   ```

## 📋 系统要求

- **autMan**: 支持Python和JavaScript插件的版本
- **Python**: 3.6+ (健康记录插件)
- **网络**: 需要访问高德地图API(天气查询插件)

## 🔧 技术栈

| 插件 | 语言 | API依赖 | 存储方式 |
|------|------|---------|----------|
| 天气查询 | JavaScript | 高德地图API | 无需存储 |
| 肚子疼记录 | Python | 无 | autMan存储桶 |
| 便便记录 | Python | 无 | autMan存储桶 |
| 性格测试 | Python | 无 | autMan存储桶 |

## 📖 文档

每个插件目录下都包含详细的README文档:

- [weather/README.md](weather/README.md) - 天气查询插件详细说明
- [stomachache/README.md](stomachache/README.md) - 肚子疼记录插件详细说明
- [poop/README.md](poop/README.md) - 便便记录插件详细说明
- [personality/README.md](personality/README.md) - 性格测试插件详细说明

## 🎯 开发计划

- [ ] 添加更多生活记录插件
- [ ] 支持数据导出功能
- [ ] 添加可视化图表
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
