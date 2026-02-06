# [disable:false]
# [rule: ^便便(.*)$]
# [admin: false]
# [price: 0.00]
# [version: 1.4.0]
# [param:{"required":false,"key":"poop.zhipu_api_key","bool":false,"placeholder":"sk-","name":"智谱AI密钥","desc":"从 https://open.bigmodel.cn/ 获取，用于AI健康分析功能"}]
# [param:{"required":false,"key":"poop.zhipu_model","bool":false,"placeholder":"glm-4-flash","name":"智谱AI模型","desc":"默认使用 glm-4-flash，可选 glm-4、glm-4-plus 等"}]
# [param:{"required":false,"key":"poop.ai_prompt","bool":false,"placeholder":"","name":"AI分析提示词","desc":"自定义AI分析的提示词，留空使用默认提示词"}]

"""
autMan 插件 - 便便记录

功能：记录、查看和删除便便事件，支持AI健康分析
作者：AI Assistant
版本：v1.4.0
日期：2026-02-06

使用说明：
- 便便：记录一次便便事件
- 便便记录：查看所有历史记录
- 便便删除：删除指定的历史记录
- 便便分析：AI分析便便健康状况（需配置智谱AI）
- 便便帮助：显示帮助信息

配置说明：
- zhipu_api_key：智谱AI的API密钥（可选，用于AI分析功能）
- zhipu_model：智谱AI模型名称（可选，默认 glm-4-flash）
- ai_prompt：自定义AI分析提示词（可选，留空使用默认提示词）
"""

import middleware
import time
import json
import requests
from datetime import datetime

# 配置常量
BUCKET_NAME = "poop"
VERSION = "v1.4.0"
INPUT_TIMEOUT = 60000  # 60秒超时


class ZhipuAI:
    """智谱AI API 封装类"""
    
    def __init__(self, api_key, model="glm-4-flash"):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    
    def analyze_poop_health(self, records, custom_prompt=""):
        """
        分析便便健康状况
        :param records: 便便记录列表
        :param custom_prompt: 自定义提示词
        :return: AI分析结果
        """
        # 准备数据摘要
        from collections import Counter
        from datetime import datetime as dt, timedelta
        
        # 统计最近7天的数据
        recent_7days = []
        cutoff_date = dt.now() - timedelta(days=7)
        
        for record in records:
            record_date = dt.strptime(record['datetime'], '%Y-%m-%d %H:%M:%S')
            if record_date >= cutoff_date:
                recent_7days.append(record)
        
        if not recent_7days:
            return "暂无最近7天的记录，无法进行分析。"
        
        # 统计状态分布
        status_list = []
        for record in recent_7days:
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            status_list.append(status)
        
        status_dist = Counter(status_list)
        total_count = len(recent_7days)
        avg_freq = total_count / 7
        
        # 构建数据摘要
        data_summary = f"最近7天便便记录：\n"
        data_summary += f"- 总次数：{total_count}次\n"
        data_summary += f"- 平均频率：{avg_freq:.2f}次/天\n"
        data_summary += f"- 状态分布：\n"
        for status, count in status_dist.items():
            percent = count / total_count * 100
            data_summary += f"  • {status}：{count}次 ({percent:.1f}%)\n"
        
        # 构建提示词
        if custom_prompt:
            prompt = custom_prompt.replace("{data}", data_summary)
        else:
            prompt = f"""你是一位专业的健康顾问，请根据以下便便记录数据进行健康分析：

{data_summary}

请提供：
1. 健康状况评估（正常/需注意/建议就医）
2. 具体分析（从频率、状态等方面）
3. 健康建议（饮食、作息等方面）

要求：
- 语气专业但温和
- 控制在200字以内
- 给出实用的建议
- 如有异常情况，建议就医"""
        
        try:
            response = requests.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('choices'):
                    return data['choices'][0]['message']['content']
            
            raise Exception(f"智谱AI调用失败: {response.text}")
        except Exception as e:
            raise Exception(f"智谱AI调用失败: {e}")


class PoopPlugin:
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
        # 使用用户ID作为用户名
        try:
            self.username = self.user_id
        except:
            self.username = self.user_id
        self.imtype = self.sender.getImtype()
        self.message = self.sender.getMessage().strip()
        
        # 从插件头部注释读取配置
        # autMan会自动将 [param] 中定义的配置注入到otto桶
        self.zhipu_api_key = middleware.bucketGet("otto", "poop.zhipu_api_key") or ""
        self.zhipu_model = middleware.bucketGet("otto", "poop.zhipu_model") or "glm-4-flash"
        self.ai_prompt = middleware.bucketGet("otto", "poop.ai_prompt") or ""
    
    def get_user_confirmation(self, prompt):
        """
        获取用户确认（y/n/q）
        :param prompt: 提示信息
        :return: 用户输入或 None
        """
        self.sender.reply(f"{prompt}\n\n请输入：\n  y - 确认\n  n - 取消\n  q - 退出")
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return None
        
        return user_input.strip().lower()
    
    def get_current_timestamp(self):
        """获取当前时间戳（秒）"""
        return int(time.time())
    
    def format_time_diff(self, timestamp):
        """
        计算时间差并格式化
        :param timestamp: 过去的时间戳（秒）
        :return: 格式化的时间差
        """
        now = self.get_current_timestamp()
        diff = now - timestamp
        
        if diff < 60:
            return f"{diff}秒前"
        elif diff < 3600:
            return f"{diff // 60}分钟前"
        elif diff < 86400:
            return f"{diff // 3600}小时前"
        else:
            return f"{diff // 86400}天前"
    
    def get_user_records(self):
        """
        获取用户的所有记录
        :return: 记录列表
        """
        try:
            # 获取用户的所有记录
            data = middleware.bucketGet(BUCKET_NAME, self.user_id)
            if not data or data == '':
                return []
            
            records = json.loads(data)
            # 按时间戳降序排序
            records.sort(key=lambda x: x['timestamp'], reverse=True)
            return records
        except Exception as e:
            return []
    
    def save_user_records(self, records):
        """
        保存用户记录
        :param records: 记录列表
        """
        try:
            data = json.dumps(records, ensure_ascii=False)
            middleware.bucketSet(BUCKET_NAME, self.user_id, data)
        except Exception as e:
            self.sender.reply(f"❌ 保存失败：{e}")
    
    def show_help(self):
        """显示帮助信息"""
        help_text = f"📖 便便记录插件 {VERSION}\n\n"
        help_text += "🔹 功能说明：\n"
        help_text += "本插件帮助您记录和追踪便便事件，支持AI健康分析\n\n"
        help_text += "🔹 命令列表：\n"
        help_text += "• 便便 - 记录一次便便事件\n"
        help_text += "• 便便记录 - 查看所有历史记录\n"
        help_text += "• 便便删除 - 删除指定的历史记录\n"
        help_text += "• 便便分析 - AI分析便便健康状况\n"
        help_text += "• 便便帮助 - 显示此帮助信息\n\n"
        help_text += "🔹 确认机制：\n"
        help_text += "记录和删除操作需要确认：\n"
        help_text += "  y - 确认执行\n"
        help_text += "  n - 取消操作\n"
        help_text += "  q - 退出流程\n\n"
        
        # 检查AI配置状态
        if self.zhipu_api_key:
            help_text += "🤖 AI分析：已配置\n"
            help_text += f"  • 模型：{self.zhipu_model}\n"
            if self.ai_prompt:
                help_text += "  • 自定义提示词：已设置\n"
            help_text += "\n"
        else:
            help_text += "🤖 AI分析：未配置\n"
            help_text += "  • 需在插件管理中配置智谱AI密钥\n\n"
        
        help_text += "💡 提示：记录会包含时间信息，方便您追踪健康状况"
        
        self.sender.reply(help_text)
    
    def record_poop(self):
        """记录便便事件"""
        # 第一步：获取确认
        confirmation = self.get_user_confirmation("📝 确认要记录一次便便事件吗？")
        
        if not confirmation:
            return
        
        if confirmation == "q":
            self.sender.reply("👋 已退出记录流程")
            return
        
        if confirmation == "n":
            self.sender.reply("❌ 已取消记录")
            return
        
        if confirmation == "y":
            # 第二步：询问便便过程
            self.sender.reply("💩 请选择便便过程：\n\n  A - 通畅 😊\n  B - 一般 😐\n  C - 费劲 😣\n  D - 拉稀 💧\n  q - 退出")
            
            process_input = self.sender.listen(INPUT_TIMEOUT)
            
            if process_input is None:
                self.sender.reply("⏱️ 操作超时，已自动取消")
                return
            
            process = process_input.strip().upper()
            
            if process == "Q":
                self.sender.reply("👋 已退出记录流程")
                return
            
            # 验证输入
            if process not in ["A", "B", "C", "D"]:
                self.sender.reply("❌ 无效的选项，请输入 A、B、C 或 D")
                return
            
            # 映射过程描述
            process_map = {
                "A": "通畅 😊",
                "B": "一般 😐",
                "C": "费劲 😣",
                "D": "拉稀 💧"
            }
            process_desc = process_map[process]
            
            # 生成记录数据
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            timestamp = self.get_current_timestamp()
            
            record_data = {
                "username": self.username,
                "userid": self.user_id,
                "datetime": current_time,
                "timestamp": timestamp,
                "imtype": self.imtype,
                "process": process,  # 添加便便过程
                "process_desc": process_desc  # 添加过程描述
            }
            
            # 获取现有记录
            records = self.get_user_records()
            records.append(record_data)
            
            # 保存记录
            self.save_user_records(records)
            
            self.sender.reply(f"✅ 记录成功！\n\n📅 时间：{current_time}\n💩 过程：{process_desc}\n\n💡 发送「便便记录」可查看所有记录")
            return
        
        # 无效输入
        self.sender.reply("❓ 无效的输入，请重新操作")
    
    def get_date_label(self, date_str):
        """获取日期标签（如"今天"、"昨天"）"""
        from datetime import datetime as dt, timedelta
        today = dt.now().date()
        date_obj = dt.strptime(date_str, '%Y-%m-%d').date()
        
        if date_obj == today:
            return f"{date_obj.month}月{date_obj.day}日 (今天)"
        elif date_obj == today - timedelta(days=1):
            return f"{date_obj.month}月{date_obj.day}日 (昨天)"
        else:
            return f"{date_obj.month}月{date_obj.day}日"
    
    def get_status_summary(self, day_records):
        """获取某天的状态概要"""
        from collections import Counter
        status_count = Counter([r['status'] for r in day_records])
        summary_parts = [f"{status}×{count}" for status, count in status_count.items()]
        return ", ".join(summary_parts)
    
    def get_status_distribution(self, records):
        """计算状态分布"""
        from collections import Counter
        status_list = []
        for record in records:
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            status_list.append(status)
        return Counter(status_list)
    
    def calculate_period_stats(self, records, days=None):
        """计算指定时段的统计信息"""
        from datetime import datetime as dt, timedelta
        
        if days:
            cutoff_date = dt.now() - timedelta(days=days)
            filtered_records = [r for r in records if dt.strptime(r['datetime'], '%Y-%m-%d %H:%M:%S') >= cutoff_date]
        else:
            filtered_records = records
        
        if not filtered_records:
            return None
        
        status_dist = self.get_status_distribution(filtered_records)
        total = len(filtered_records)
        status_percent = {status: (count / total * 100) for status, count in status_dist.items()}
        
        return {
            'total': total,
            'status_dist': status_dist,
            'status_percent': status_percent
        }
    
    def view_records(self):
        """查看历史记录（交互式菜单）"""
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无记录\n\n💡 发送「便便」可以记录新的事件")
            return
        
        # 显示概览和菜单
        self.show_overview(records)
        
        # 等待用户选择
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已退出")
            return
        
        choice = user_input.strip().lower()
        
        if choice == "q":
            self.sender.reply("👋 已退出查看")
            return
        elif choice == "1":
            self.show_recent_details(records, 7)
            return
        elif choice == "2":
            self.show_recent_details(records, 30)
            return
        elif choice == "3":
            self.show_all_records(records)
            return
        elif choice == "4":
            self.show_statistics(records)
            return
        else:
            self.sender.reply("❌ 无效的选项，请输入 1-4 或 q")
    
    def show_overview(self, records):
        """显示概览和菜单"""
        from collections import defaultdict
        from datetime import datetime as dt, timedelta
        
        # 按日期分组记录
        records_by_date = defaultdict(list)
        
        for record in records:
            date_str = record['datetime'].split(' ')[0]
            time_str = record['datetime'].split(' ')[1][:5]
            
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            
            records_by_date[date_str].append({
                'time': time_str,
                'timestamp': record['timestamp'],
                'status': status
            })
        
        # 计算统计信息
        total_count = len(records)
        total_days = len(records_by_date)
        dates = sorted(records_by_date.keys())
        first_date = dates[0]
        last_date = dates[-1]
        date_span = (dt.strptime(last_date, '%Y-%m-%d') - dt.strptime(first_date, '%Y-%m-%d')).days + 1
        avg_freq = total_count / total_days if total_days > 0 else 0
        
        # 构建概览消息
        message = "📊 便便记录概览\n\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📈 总体统计\n"
        message += f"• 记录时段: {first_date} 至 {last_date}\n"
        message += f"• 记录天数: {total_days}天 (跨度{date_span}天)\n"
        message += f"• 总计次数: {total_count}次\n"
        message += f"• 平均频率: {avg_freq:.2f}次/天\n\n"
        
        # 最近7天概要
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📅 最近7天概要\n\n"
        
        # 获取最近7天的日期
        today = dt.now().date()
        recent_dates = []
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            recent_dates.append(date.strftime('%Y-%m-%d'))
        
        for date_str in recent_dates:
            date_label = self.get_date_label(date_str)
            if date_str in records_by_date:
                day_records = records_by_date[date_str]
                day_count = len(day_records)
                summary = self.get_status_summary(day_records)
                message += f"{date_label:<20} {day_count}次 [{summary}]\n"
            else:
                message += f"{date_label:<20} 0次\n"
        
        # 菜单选项
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📋 查看选项\n\n"
        message += "请选择查看方式：\n"
        message += "  1 - 查看最近7天详细记录\n"
        message += "  2 - 查看最近30天详细记录\n"
        message += "  3 - 查看全部记录\n"
        message += "  4 - 查看统计分析\n"
        message += "  q - 退出\n\n"
        message += "请输入选项编号："
        
        self.sender.reply(message)
    
    def show_recent_details(self, records, days):
        """显示最近N天的详细记录"""
        from collections import defaultdict
        from datetime import datetime as dt, timedelta
        
        # 筛选最近N天的记录
        cutoff_date = dt.now() - timedelta(days=days)
        recent_records = [r for r in records if dt.strptime(r['datetime'], '%Y-%m-%d %H:%M:%S') >= cutoff_date]
        
        if not recent_records:
            self.sender.reply(f"📭 最近{days}天没有记录")
            return
        
        # 按日期分组
        records_by_date = defaultdict(list)
        for record in recent_records:
            date_str = record['datetime'].split(' ')[0]
            time_str = record['datetime'].split(' ')[1][:5]
            
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            
            records_by_date[date_str].append({
                'time': time_str,
                'status': status
            })
        
        # 构建消息
        message = f"📊 最近{days}天详细记录\n\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        
        # 按日期倒序显示
        for date_str in sorted(records_by_date.keys(), reverse=True):
            date_label = self.get_date_label(date_str)
            day_records = records_by_date[date_str]
            day_count = len(day_records)
            
            message += f"🗓️ {date_label}\n"
            
            # 按时间排序显示
            sorted_records = sorted(day_records, key=lambda x: x['time'])
            for day_record in sorted_records:
                message += f"  └─ {day_record['time']} - {day_record['status']}\n"
            
            message += f"  📊 当天{day_count}次\n\n"
        
        # 统计信息
        stats = self.calculate_period_stats(recent_records, days)
        if stats:
            message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            message += f"📈 {days}天统计\n"
            message += f"• 总计: {stats['total']}次\n"
            message += f"• 平均: {stats['total']/days:.2f}次/天\n"
            
            # 状态分布
            status_parts = []
            for status, percent in stats['status_percent'].items():
                status_parts.append(f"{status} {percent:.0f}%")
            message += f"• 状态分布: {', '.join(status_parts)}"
        
        self.sender.reply(message)
    
    def show_all_records(self, records):
        """显示全部记录"""
        from collections import defaultdict
        
        # 按日期分组
        records_by_date = defaultdict(list)
        for record in records:
            date_str = record['datetime'].split(' ')[0]
            time_str = record['datetime'].split(' ')[1][:5]
            
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            
            records_by_date[date_str].append({
                'time': time_str,
                'status': status
            })
        
        total_days = len(records_by_date)
        
        # 如果记录太多，只显示最近30天
        if total_days > 30:
            display_dates = sorted(records_by_date.keys(), reverse=True)[:30]
            message = f"📊 全部记录 (显示最近30天，共{total_days}天)\n\n"
        else:
            display_dates = sorted(records_by_date.keys(), reverse=True)
            message = f"� 全部记录 (共{total_days}天)\n\n"
        
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        
        # 显示记录
        for date_str in display_dates:
            date_label = self.get_date_label(date_str)
            day_records = records_by_date[date_str]
            day_count = len(day_records)
            
            message += f"🗓️ {date_label}\n"
            
            sorted_records = sorted(day_records, key=lambda x: x['time'])
            for day_record in sorted_records:
                message += f"  └─ {day_record['time']} - {day_record['status']}\n"
            
            message += f"  📊 当天{day_count}次\n\n"
        
        if total_days > 30:
            message += f"... 还有{total_days - 30}天的记录未显示"
        
        self.sender.reply(message)
    
    def show_statistics(self, records):
        """显示统计分析"""
        from collections import defaultdict
        from datetime import datetime as dt
        
        # 按日期分组
        records_by_date = defaultdict(list)
        for record in records:
            date_str = record['datetime'].split(' ')[0]
            
            if 'process_desc' in record:
                status = record['process_desc'].split()[0] if record['process_desc'] else "未知"
            else:
                status = "未知"
            
            records_by_date[date_str].append({'status': status})
        
        # 计算统计信息
        total_count = len(records)
        total_days = len(records_by_date)
        dates = sorted(records_by_date.keys())
        first_date = dates[0]
        last_date = dates[-1]
        date_span = (dt.strptime(last_date, '%Y-%m-%d') - dt.strptime(first_date, '%Y-%m-%d')).days + 1
        avg_freq = total_count / total_days if total_days > 0 else 0
        coverage = (total_days / date_span * 100) if date_span > 0 else 0
        
        # 状态分布
        status_dist = self.get_status_distribution(records)
        
        # 频率分布
        freq_dist = {}
        for day_records in records_by_date.values():
            count = len(day_records)
            freq_dist[count] = freq_dist.get(count, 0) + 1
        
        # 构建消息
        message = "📊 便便记录统计分析\n\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📈 总体数据\n"
        message += f"• 记录时段: {first_date} 至 {last_date} ({date_span}天)\n"
        message += f"• 记录天数: {total_days}天 (覆盖率 {coverage:.1f}%)\n"
        message += f"• 总计次数: {total_count}次\n"
        message += f"• 平均频率: {avg_freq:.2f}次/天\n\n"
        
        # 状态分布
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "💩 状态分布\n"
        for status, count in sorted(status_dist.items(), key=lambda x: x[1], reverse=True):
            percent = count / total_count * 100
            bar_length = int(percent / 5)  # 每5%一个方块
            bar = "█" * bar_length
            message += f"• {status}: {count}次 ({percent:.1f}%) {bar}\n"
        
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "� 频率分布\n"
        for freq in sorted(freq_dist.keys()):
            days_count = freq_dist[freq]
            percent = days_count / total_days * 100
            message += f"• 每天{freq}次: {days_count}天 ({percent:.1f}%)\n"
        
        # 健康分析
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "🔍 健康分析\n"
        
        # 频率分析
        if 1 <= avg_freq <= 2:
            message += "✅ 平均频率正常 (1-2次/天)\n"
        elif avg_freq < 1:
            message += "⚠️ 平均频率偏低 (<1次/天)\n"
        else:
            message += "⚠️ 平均频率偏高 (>2次/天)\n"
        
        # 通畅状态分析
        if "通畅" in status_dist:
            smooth_percent = status_dist["通畅"] / total_count * 100
            if smooth_percent >= 60:
                message += "✅ 通畅状态占比良好 (≥60%)\n"
            else:
                message += "⚠️ 通畅状态占比偏低 (<60%)\n"
        
        # 拉稀分析
        if "拉稀" in status_dist:
            # 检查最近7天是否有拉稀
            recent_7days_stats = self.calculate_period_stats(records, 7)
            if recent_7days_stats and "拉稀" in recent_7days_stats['status_dist']:
                message += f"⚠️ 拉稀情况需注意 (近7天出现{recent_7days_stats['status_dist']['拉稀']}次)\n"
        
        message += "\n�💡 建议: 保持良好的饮食习惯和作息规律"
        
        self.sender.reply(message)
    
    def delete_record(self):
        """删除记录"""
        # 先获取所有记录
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无记录可删除")
            return
        
        # 显示记录列表
        message = f"🗑️ 请选择要删除的记录（共 {len(records)} 条）\n\n"
        
        for i, record in enumerate(records, 1):
            time_diff = self.format_time_diff(record['timestamp'])
            message += f"【{i}】 {record['datetime']} ({time_diff})\n"
        
        message += f"\n请输入要删除的记录编号（1-{len(records)}），或输入 q 退出："
        
        self.sender.reply(message)
        
        # 等待用户输入编号
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return
        
        input_content = user_input.strip().lower()
        
        if input_content == "q":
            self.sender.reply("👋 已退出删除流程")
            return
        
        # 验证输入是否为有效数字
        try:
            record_index = int(input_content)
        except ValueError:
            self.sender.reply(f"❌ 无效的编号，请输入 1 到 {len(records)} 之间的数字")
            return
        
        if record_index < 1 or record_index > len(records):
            self.sender.reply(f"❌ 无效的编号，请输入 1 到 {len(records)} 之间的数字")
            return
        
        # 获取要删除的记录
        selected_record = records[record_index - 1]
        
        # 二次确认删除
        confirm_message = "⚠️ 确认要删除以下记录吗？\n\n"
        confirm_message += f"📅 {selected_record['datetime']}\n"
        confirm_message += f"⏰ {self.format_time_diff(selected_record['timestamp'])}"
        
        confirmation = self.get_user_confirmation(confirm_message)
        
        if not confirmation:
            return
        
        if confirmation == "q":
            self.sender.reply("👋 已退出删除流程")
            return
        
        if confirmation == "n":
            self.sender.reply("❌ 已取消删除")
            return
        
        if confirmation == "y":
            # 执行删除
            records.pop(record_index - 1)
            self.save_user_records(records)
            self.sender.reply("✅ 删除成功！\n\n💡 发送「便便记录」可查看剩余记录")
            return
        
        # 无效输入
        self.sender.reply("❓ 无效的输入，已取消删除")
    
    def analyze_health(self):
        """AI分析便便健康状况"""
        # 检查是否配置了智谱AI
        if not self.zhipu_api_key:
            self.sender.reply("❌ AI分析功能未配置\n\n请在插件管理中配置智谱AI密钥\n访问 https://open.bigmodel.cn/ 获取API密钥")
            return
        
        # 获取用户记录
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无记录，无法进行分析\n\n💡 发送「便便」可以记录新的事件")
            return
        
        # 显示分析提示
        self.sender.reply("🤖 正在分析您的便便健康状况...\n\n⏳ 请稍候，这可能需要几秒钟")
        
        try:
            # 调用智谱AI进行分析
            ai = ZhipuAI(self.zhipu_api_key, self.zhipu_model)
            analysis_result = ai.analyze_poop_health(records, self.ai_prompt)
            
            # 格式化并发送分析结果
            result_message = "🏥 便便健康分析报告\n\n"
            result_message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            result_message += f"{analysis_result}\n"
            result_message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            result_message += "⚠️ 免责声明：\n"
            result_message += "本分析仅供参考，不能替代专业医疗建议。\n"
            result_message += "如有健康问题，请咨询专业医生。\n\n"
            result_message += f"🤖 分析模型：{self.zhipu_model}\n"
            result_message += "💡 发送「便便记录」可查看详细记录"
            
            self.sender.reply(result_message)
            
        except Exception as e:
            error_msg = str(e)
            self.sender.reply(f"❌ AI分析失败：{error_msg}\n\n可能的原因：\n• API密钥无效或已过期\n• 网络连接问题\n• API调用额度不足\n\n请检查配置后重试")
    
    def run(self):
        """主程序入口"""
        try:
            # 路由到对应功能
            if self.message == "便便帮助":
                self.show_help()
            elif self.message == "便便记录":
                self.view_records()
            elif self.message == "便便删除":
                self.delete_record()
            elif self.message == "便便分析":
                self.analyze_health()
            elif self.message == "便便":
                self.record_poop()
            else:
                # 未匹配到命令，显示帮助
                self.sender.reply("❓ 未识别的命令\n\n💡 发送「便便帮助」查看使用说明")
        
        except Exception as e:
            self.sender.reply(f"❌ 插件执行错误：{e}")


if __name__ == '__main__':
    # 创建插件实例并运行
    plugin = PoopPlugin()
    plugin.run()
