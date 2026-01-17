# [disable:false]
# [rule: ^麦当劳(.*)$]
# [cron: 0 9 * * *]
# [admin: false]
# [price: 0.00]
# [version: 2.1.0]

"""
autMan 插件 - 麦当劳优惠券管理（Python 版本）

功能：查询活动日历、领取优惠券、多账号管理、定时自动领券
作者：AI Assistant
版本：v2.0.0
日期：2026-01-17

使用说明：
- 麦当劳：显示主菜单
- 麦当劳管理：账号管理菜单
- 麦当劳日历：查看活动日历
- 麦当劳优惠券：查看可领优惠券
- 麦当劳领券：一键领取所有优惠券
- 麦当劳我的优惠券：查看已领优惠券
- 麦当劳帮助：显示帮助信息
"""

import middleware
import requests
import json
import time
from datetime import datetime

# 配置常量
MCP_URL = "https://mcp.mcd.cn/mcp-servers/mcd-mcp"
MCP_PROTOCOL_VERSION = "2025-06-18"
BUCKET_NAME = "maimai"
VERSION = "v2.0.0"
INPUT_TIMEOUT = 60000  # 60秒超时


class MCPClient:
    """麦当劳 MCP 客户端"""
    
    def __init__(self, token):
        """初始化客户端"""
        self.token = token
        self.session_id = None
        self.initialized = False
        self.request_id = 1
    
    def initialize(self):
        """初始化 MCP 会话"""
        if self.initialized:
            return True
        
        init_message = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {
                    "name": "autMan_MaiMai",
                    "title": "autMan 麦当劳插件",
                    "version": VERSION
                }
            }
        }
        self.request_id += 1
        
        try:
            response = self._send_rpc(init_message, expect_response=True)
            if response and "error" not in response:
                # 发送 initialized 通知
                notify_message = {
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                }
                self._send_rpc(notify_message, expect_response=False)
                self.initialized = True
                return True
        except Exception as e:
            raise Exception(f"初始化失败: {e}")
        
        return False
    
    def call_tool(self, tool_name, args=None):
        """调用 MCP 工具"""
        if not self.initialize():
            raise Exception("会话初始化失败")
        
        message = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args or {}
            }
        }
        self.request_id += 1
        
        try:
            response = self._send_rpc(message, expect_response=True)
            if response and "error" in response:
                raise Exception(response["error"].get("message", "工具调用失败"))
            
            return response.get("result")
        except Exception as e:
            raise Exception(f"工具调用失败: {e}")
    
    def _send_rpc(self, message, expect_response=True):
        """发送 JSON-RPC 请求"""
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": MCP_PROTOCOL_VERSION
        }
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        
        try:
            response = requests.post(
                MCP_URL,
                headers=headers,
                json=message,
                timeout=30
            )
            
            # 检查会话 ID
            new_session_id = response.headers.get("Mcp-Session-Id") or response.headers.get("mcp-session-id")
            if new_session_id and not self.session_id:
                self.session_id = new_session_id
            
            if not expect_response:
                return None
            
            # 解析响应
            content_type = response.headers.get("content-type", "")
            if "text/event-stream" in content_type:
                return self._parse_sse_response(response.text, message.get("id"))
            else:
                return response.json()
        
        except Exception as e:
            raise Exception(f"网络请求失败: {e}")
    
    def _parse_sse_response(self, text, request_id):
        """解析 SSE 响应"""
        events = []
        data_lines = []
        
        for line in text.split('\n'):
            line = line.strip()
            if line.startswith("data:"):
                data_lines.append(line[5:].strip())
            elif line == "":
                if data_lines:
                    events.append('\n'.join(data_lines))
                    data_lines = []
        
        if data_lines:
            events.append('\n'.join(data_lines))
        
        # 查找匹配的响应
        last_event = None
        for event_data in events:
            try:
                parsed = json.loads(event_data)
                last_event = parsed
                if request_id is not None and parsed.get("id") == request_id:
                    return parsed
            except:
                continue
        
        if last_event:
            return last_event
        
        raise Exception("未找到有效的 JSON-RPC 响应")


class MaiMaiPlugin:
    """麦当劳优惠券插件"""
    
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
        self.message = self.sender.getMessage().strip()
        # 定时任务时消息为空
        self.is_cron = (not self.message or self.message == "")
    
    def get_user_data(self):
        """获取用户数据"""
        try:
            data = middleware.bucketGet(BUCKET_NAME, self.user_id)
            if not data or data == '':
                return {
                    "accounts": {},
                    "active_account": None,
                    "auto_claim_enabled": False,
                    "last_claim_date": None
                }
            return json.loads(data)
        except:
            return {
                "accounts": {},
                "active_account": None,
                "auto_claim_enabled": False,
                "last_claim_date": None
            }
    
    def save_user_data(self, user_data):
        """保存用户数据"""
        try:
            data = json.dumps(user_data, ensure_ascii=False)
            middleware.bucketSet(BUCKET_NAME, self.user_id, data)
        except Exception as e:
            self.sender.reply(f"❌ 保存失败: {e}")
    
    def get_active_account(self):
        """获取活跃账号"""
        user_data = self.get_user_data()
        active_name = user_data.get("active_account")
        
        if not active_name or active_name not in user_data["accounts"]:
            return None
        
        return {
            "name": active_name,
            "data": user_data["accounts"][active_name]
        }
    
    def format_tool_result(self, result):
        """格式化工具返回结果"""
        if not result or "content" not in result:
            return "未获取到数据"
        
        text = ""
        for item in result["content"]:
            if item.get("type") == "text":
                text += item.get("text", "")
        
        import re
        
        # 提取并转换 HTML 图片标签为文本链接
        def replace_img_tag(match):
            img_tag = match.group(0)
            # 提取 src 属性
            src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
            if src_match:
                url = src_match.group(1)
                # 提取 alt 属性（如果有）
                alt_match = re.search(r'alt=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
                alt_text = alt_match.group(1) if alt_match else "查看图片"
                return f"[{alt_text}]({url})"
            return ""
        
        text = re.sub(r'<\s*img[^>]*>', replace_img_tag, text, flags=re.IGNORECASE | re.DOTALL)
        
        # Markdown 图片语法已经是 ![alt](url) 格式，转换为 [alt](url)
        text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'[\1](\2)', text)
        
        # 移除行尾的反斜杠
        text = re.sub(r'\\\s*$', '', text, flags=re.MULTILINE)
        
        # 清理多余的空行
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        
        # 移除 Markdown 标题语法（###）
        text = re.sub(r'^###\s+', '', text, flags=re.MULTILINE)
        
        # 限制长度
        if len(text) > 2000:
            text = text[:1997] + "..."
        
        return text.strip()
    
    def show_help(self):
        """显示帮助信息"""
        help_text = f"🍔 麦当劳优惠券管理插件 {VERSION}\n\n"
        help_text += "📝 基础命令:\n"
        help_text += "• 麦当劳 - 显示主菜单\n"
        help_text += "• 麦当劳帮助 - 显示此帮助\n\n"
        help_text += "🎫 优惠券功能:\n"
        help_text += "• 麦当劳日历 - 查看活动日历\n"
        help_text += "• 麦当劳优惠券 - 查看可领优惠券\n"
        help_text += "• 麦当劳领券 - 一键领取所有优惠券\n"
        help_text += "• 麦当劳我的优惠券 - 查看已领优惠券\n\n"
        help_text += "👤 账号管理:\n"
        help_text += "• 麦当劳管理 - 进入账号管理菜单\n\n"
        help_text += "⏰ 自动领券:\n"
        help_text += "• 麦当劳开启自动领券 - 每天自动领券\n"
        help_text += "• 麦当劳关闭自动领券 - 关闭自动领券\n"
        help_text += "• 麦当劳状态 - 查看账号状态\n\n"
        help_text += "🔑 获取 MCP Token:\n"
        help_text += "访问 https://open.mcd.cn/mcp/doc\n"
        help_text += "注册并获取您的 MCP Token\n\n"
        help_text += "━━━━━━━━━━━━━━━\n"
        help_text += "💡 提示: 支持多账号管理"
        
        self.sender.reply(help_text)
    
    def show_main_menu(self):
        """显示主菜单"""
        user_data = self.get_user_data()
        active_account = self.get_active_account()
        
        message = "🍔 麦当劳优惠券管理\n"
        message += "━━━━━━━━━━━━━━━\n\n"
        
        if active_account:
            message += f"👤 当前账号: {active_account['data']['label']}\n"
            message += f"🔄 自动领券: {'已开启 ✅' if user_data['auto_claim_enabled'] else '已关闭 ❌'}\n\n"
            message += "快捷命令:\n"
            message += "• 麦当劳日历\n"
            message += "• 麦当劳优惠券\n"
            message += "• 麦当劳领券\n"
            message += "• 麦当劳我的优惠券\n"
            message += "• 麦当劳管理\n"
        else:
            message += "⚠️ 未配置账号\n\n"
            message += "发送「麦当劳管理」进入账号管理\n"
            message += "\n获取 Token:\n"
            message += "https://open.mcd.cn/mcp/doc\n"
        
        message += "\n发送「麦当劳帮助」查看完整命令"
        self.sender.reply(message)
    
    def show_manage_menu(self):
        """显示账号管理菜单"""
        user_data = self.get_user_data()
        active_account = self.get_active_account()
        
        message = "👤 账号管理\n"
        message += "━━━━━━━━━━━━━━━\n\n"
        
        if active_account:
            message += f"当前账号: {active_account['data']['label']}\n\n"
        
        message += "请选择操作:\n"
        message += "1️⃣ 添加账号\n"
        message += "2️⃣ 切换账号\n"
        message += "3️⃣ 查看账号列表\n"
        message += "4️⃣ 删除账号\n"
        message += "q - 退出\n\n"
        message += "请回复数字选择操作:"
        
        self.sender.reply(message)
        
        # 等待用户输入
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        choice = user_input.strip().lower()
        
        if choice == "q":
            self.sender.reply("👋 已退出账号管理")
            return
        
        if choice == "1":
            self.add_account()
        elif choice == "2":
            self.switch_account()
        elif choice == "3":
            self.list_accounts()
        elif choice == "4":
            self.delete_account()
        else:
            self.sender.reply("❌ 无效选择\n\n请回复 1-4 或 q")
    
    def add_account(self):
        """添加账号"""
        self.sender.reply("📝 请输入账号名称（如：主账号）:\n\n回复 q 取消")
        
        account_name = self.sender.listen(INPUT_TIMEOUT)
        
        if account_name is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        account_name = account_name.strip()
        
        if account_name.lower() == "q":
            self.sender.reply("👋 已取消添加")
            return
        
        self.sender.reply("📝 请输入 MCP Token:\n\n回复 q 取消")
        
        token = self.sender.listen(INPUT_TIMEOUT)
        
        if token is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        token = token.strip()
        
        if token.lower() == "q":
            self.sender.reply("👋 已取消添加")
            return
        
        # 保存账号
        user_data = self.get_user_data()
        user_data["accounts"][account_name] = {
            "token": token,
            "label": account_name,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 如果是第一个账号，自动设为活跃账号
        if not user_data["active_account"]:
            user_data["active_account"] = account_name
        
        self.save_user_data(user_data)
        self.sender.reply(f"✅ 账号「{account_name}」添加成功!\n\n发送「麦当劳优惠券」开始使用")
    
    def switch_account(self):
        """切换账号"""
        user_data = self.get_user_data()
        accounts = user_data.get("accounts", {})
        
        if not accounts:
            self.sender.reply("❌ 暂无账号\n\n请先添加账号")
            return
        
        account_names = list(accounts.keys())
        message = "🔄 切换账号\n━━━━━━━━━━━━━━━\n\n"
        
        for i, name in enumerate(account_names, 1):
            account = accounts[name]
            is_active = name == user_data.get("active_account")
            message += f"{i}️⃣ {account['label']}"
            if is_active:
                message += " ✅"
            message += "\n"
        
        message += "q - 取消\n\n请回复数字选择账号:"
        
        self.sender.reply(message)
        
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        choice = user_input.strip().lower()
        
        if choice == "q":
            self.sender.reply("👋 已取消切换")
            return
        
        try:
            index = int(choice) - 1
            if 0 <= index < len(account_names):
                selected_name = account_names[index]
                user_data["active_account"] = selected_name
                self.save_user_data(user_data)
                self.sender.reply(f"✅ 已切换到账号「{accounts[selected_name]['label']}」")
            else:
                self.sender.reply("❌ 无效选择")
        except ValueError:
            self.sender.reply("❌ 无效选择")
    
    def list_accounts(self):
        """查看账号列表"""
        user_data = self.get_user_data()
        accounts = user_data.get("accounts", {})
        
        if not accounts:
            self.sender.reply("❌ 暂无账号\n\n发送「麦当劳管理」添加账号")
            return
        
        message = "👤 账号列表\n━━━━━━━━━━━━━━━\n\n"
        
        for name, account in accounts.items():
            is_active = name == user_data.get("active_account")
            message += ("✅ " if is_active else "　 ") + account['label'] + "\n"
        
        self.sender.reply(message)
    
    def delete_account(self):
        """删除账号"""
        user_data = self.get_user_data()
        accounts = user_data.get("accounts", {})
        
        if not accounts:
            self.sender.reply("❌ 暂无账号")
            return
        
        account_names = list(accounts.keys())
        message = "🗑 删除账号\n━━━━━━━━━━━━━━━\n\n"
        
        for i, name in enumerate(account_names, 1):
            account = accounts[name]
            message += f"{i}️⃣ {account['label']}\n"
        
        message += "q - 取消\n\n请回复数字选择要删除的账号:"
        
        self.sender.reply(message)
        
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        choice = user_input.strip().lower()
        
        if choice == "q":
            self.sender.reply("👋 已取消删除")
            return
        
        try:
            index = int(choice) - 1
            if 0 <= index < len(account_names):
                selected_name = account_names[index]
                selected_label = accounts[selected_name]['label']
                
                # 二次确认
                self.sender.reply(f"⚠️ 确认要删除账号「{selected_label}」吗?\n\ny - 确认\nn - 取消")
                
                confirm = self.sender.listen(INPUT_TIMEOUT)
                
                if confirm and confirm.strip().lower() == "y":
                    del user_data["accounts"][selected_name]
                    
                    # 如果删除的是活跃账号，切换到第一个可用账号
                    if user_data.get("active_account") == selected_name:
                        remaining = list(user_data["accounts"].keys())
                        user_data["active_account"] = remaining[0] if remaining else None
                    
                    self.save_user_data(user_data)
                    self.sender.reply(f"✅ 账号「{selected_label}」已删除")
                else:
                    self.sender.reply("❌ 已取消删除")
            else:
                self.sender.reply("❌ 无效选择")
        except ValueError:
            self.sender.reply("❌ 无效选择")
    
    def query_calendar(self):
        """查询活动日历"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        try:
            self.sender.reply("🔍 正在查询活动日历...")
            client = MCPClient(active_account['data']['token'])
            result = client.call_tool("campaign-calender", {})
            formatted = self.format_tool_result(result)
            self.sender.reply(f"📅 活动日历\n━━━━━━━━━━━━━━━\n\n{formatted}")
        except Exception as e:
            self.sender.reply(f"❌ 查询失败: {e}")
    
    def query_available_coupons(self):
        """查询可领优惠券"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        try:
            self.sender.reply("🔍 正在查询可领优惠券...")
            client = MCPClient(active_account['data']['token'])
            result = client.call_tool("available-coupons", {})
            formatted = self.format_tool_result(result)
            
            # 显示查询结果
            self.sender.reply(f"🎫 可领优惠券\n━━━━━━━━━━━━━━━\n\n{formatted}")
            
            # 询问是否要一键领取
            self.sender.reply("\n💡 是否要一键领取所有优惠券？\n\ny - 立即领取\nn - 暂不领取")
            
            user_input = self.sender.listen(INPUT_TIMEOUT)
            
            if user_input and user_input.strip().lower() == "y":
                # 执行一键领取
                self.sender.reply("🎁 正在领取优惠券...")
                claim_result = client.call_tool("auto-bind-coupons", {})
                claim_formatted = self.format_tool_result(claim_result)
                self.sender.reply(f"✅ 领券结果\n━━━━━━━━━━━━━━━\n\n{claim_formatted}")
            elif user_input and user_input.strip().lower() == "n":
                self.sender.reply("👌 已取消领取")
            else:
                # 超时或其他输入，不做处理
                pass
                
        except Exception as e:
            self.sender.reply(f"❌ 查询失败: {e}")
    
    def auto_bind_coupons(self):
        """一键领取所有优惠券"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        try:
            self.sender.reply("🎁 正在领取优惠券...")
            client = MCPClient(active_account['data']['token'])
            result = client.call_tool("auto-bind-coupons", {})
            formatted = self.format_tool_result(result)
            self.sender.reply(f"✅ 领券结果\n━━━━━━━━━━━━━━━\n\n{formatted}")
        except Exception as e:
            self.sender.reply(f"❌ 领取失败: {e}")
    
    def query_my_coupons(self):
        """查询我的优惠券"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        try:
            self.sender.reply("🔍 正在查询我的优惠券...")
            client = MCPClient(active_account['data']['token'])
            result = client.call_tool("my-coupons", {})
            formatted = self.format_tool_result(result)
            self.sender.reply(f"🎫 我的优惠券\n━━━━━━━━━━━━━━━\n\n{formatted}")
        except Exception as e:
            self.sender.reply(f"❌ 查询失败: {e}")
    
    def enable_auto_claim(self):
        """开启自动领券"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        user_data = self.get_user_data()
        user_data["auto_claim_enabled"] = True
        self.save_user_data(user_data)
        self.sender.reply("✅ 自动领券已开启\n\n每天 09:00 自动领取优惠券")
    
    def disable_auto_claim(self):
        """关闭自动领券"""
        user_data = self.get_user_data()
        user_data["auto_claim_enabled"] = False
        self.save_user_data(user_data)
        self.sender.reply("✅ 自动领券已关闭")
    
    def show_status(self):
        """查看账号状态"""
        active_account = self.get_active_account()
        
        if not active_account:
            self.sender.reply("❌ 未配置账号\n\n发送「麦当劳管理」添加账号")
            return
        
        user_data = self.get_user_data()
        
        message = "📊 账号状态\n━━━━━━━━━━━━━━━\n\n"
        message += f"👤 当前账号: {active_account['data']['label']}\n"
        message += f"🔄 自动领券: {'已开启 ✅' if user_data['auto_claim_enabled'] else '已关闭 ❌'}\n"
        
        if user_data.get("last_claim_date"):
            message += f"📅 上次领券: {user_data['last_claim_date']}\n"
        
        self.sender.reply(message)
    
    def handle_cron_task(self):
        """处理定时任务"""
        # 这里需要遍历所有用户，但 Python 插件可能无法获取所有用户
        # 简化处理：只处理当前触发的用户
        user_data = self.get_user_data()
        
        if not user_data.get("auto_claim_enabled"):
            return
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        if user_data.get("last_claim_date") == today:
            return
        
        active_account = self.get_active_account()
        if not active_account:
            return
        
        try:
            client = MCPClient(active_account['data']['token'])
            result = client.call_tool("auto-bind-coupons", {})
            formatted = self.format_tool_result(result)
            
            user_data["last_claim_date"] = today
            self.save_user_data(user_data)
            
            self.sender.reply(f"🎁 自动领券成功\n━━━━━━━━━━━━━━━\n\n{formatted}")
        except Exception as e:
            self.sender.reply(f"❌ 自动领券失败: {e}")
    
    def run(self):
        """主程序入口"""
        try:
            # 定时任务处理
            if self.is_cron:
                self.handle_cron_task()
                return
            
            # 命令路由
            if self.message == "麦当劳":
                self.show_main_menu()
            elif self.message == "麦当劳帮助":
                self.show_help()
            elif self.message == "麦当劳管理":
                self.show_manage_menu()
            elif self.message == "麦当劳日历":
                self.query_calendar()
            elif self.message == "麦当劳优惠券":
                self.query_available_coupons()
            elif self.message == "麦当劳领券":
                self.auto_bind_coupons()
            elif self.message == "麦当劳我的优惠券":
                self.query_my_coupons()
            elif self.message == "麦当劳开启自动领券":
                self.enable_auto_claim()
            elif self.message == "麦当劳关闭自动领券":
                self.disable_auto_claim()
            elif self.message == "麦当劳状态":
                self.show_status()
            else:
                self.sender.reply("❓ 未识别的命令\n\n💡 发送「麦当劳帮助」查看使用说明")
        
        except Exception as e:
            self.sender.reply(f"❌ 插件执行错误: {e}")


if __name__ == '__main__':
    # 创建插件实例并运行
    plugin = MaiMaiPlugin()
    plugin.run()
