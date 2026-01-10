# [disable:false]
# [rule: ^便便(.*)$]
# [admin: false]
# [price: 0.00]
# [version: 1.1.0]

"""
autMan 插件 - 便便记录

功能：记录、查看和删除便便事件
作者：AI Assistant
版本：v1.1.0
日期：2026-01-09

使用说明：
- 便便：记录一次便便事件
- 便便记录：查看所有历史记录
- 便便删除：删除指定的历史记录
- 便便帮助：显示帮助信息
"""

import middleware
import time
import json
from datetime import datetime

# 配置常量
BUCKET_NAME = "poop"
VERSION = "v1.1.0"
INPUT_TIMEOUT = 60000  # 60秒超时


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
        help_text += "本插件帮助您记录和追踪便便事件\n\n"
        help_text += "🔹 命令列表：\n"
        help_text += "• 便便 - 记录一次便便事件\n"
        help_text += "• 便便记录 - 查看所有历史记录\n"
        help_text += "• 便便删除 - 删除指定的历史记录\n"
        help_text += "• 便便帮助 - 显示此帮助信息\n\n"
        help_text += "🔹 确认机制：\n"
        help_text += "记录和删除操作需要确认：\n"
        help_text += "  y - 确认执行\n"
        help_text += "  n - 取消操作\n"
        help_text += "  q - 退出流程\n\n"
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
            self.sender.reply("💩 请选择便便过程：\n\n  A - 通畅 😊\n  B - 一般 😐\n  C - 费劲 😣\n  q - 退出")
            
            process_input = self.sender.listen(INPUT_TIMEOUT)
            
            if process_input is None:
                self.sender.reply("⏱️ 操作超时，已自动取消")
                return
            
            process = process_input.strip().upper()
            
            if process == "Q":
                self.sender.reply("👋 已退出记录流程")
                return
            
            # 验证输入
            if process not in ["A", "B", "C"]:
                self.sender.reply("❌ 无效的选项，请输入 A、B 或 C")
                return
            
            # 映射过程描述
            process_map = {
                "A": "通畅 😊",
                "B": "一般 😐",
                "C": "费劲 😣"
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
    
    def view_records(self):
        """查看历史记录"""
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无记录\n\n💡 发送「便便」可以记录新的事件")
            return
        
        # 按日期分组记录
        from collections import defaultdict
        records_by_date = defaultdict(list)
        
        for record in records:
            # 提取日期部分（YYYY-MM-DD）
            date_str = record['datetime'].split(' ')[0]
            time_str = record['datetime'].split(' ')[1][:5]  # HH:MM
            records_by_date[date_str].append({
                'time': time_str,
                'timestamp': record['timestamp']
            })
        
        # 计算统计信息
        total_count = len(records)
        total_days = len(records_by_date)
        
        # 获取日期范围
        dates = sorted(records_by_date.keys())
        first_date = dates[0]
        last_date = dates[-1]
        
        # 计算跨度天数
        from datetime import datetime as dt
        date_span = (dt.strptime(last_date, '%Y-%m-%d') - dt.strptime(first_date, '%Y-%m-%d')).days + 1
        
        # 计算平均频率
        avg_freq = total_count / total_days if total_days > 0 else 0
        
        # 构建消息
        message = f"📊 便便记录 (共{total_count}条)\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        # 按日期显示记录（最多显示最近10天，避免消息过长）
        display_dates = sorted(records_by_date.keys(), reverse=True)[:10]
        
        for date_str in display_dates:
            day_records = records_by_date[date_str]
            day_count = len(day_records)
            
            # 格式化日期显示（如：1月2日）
            date_obj = dt.strptime(date_str, '%Y-%m-%d')
            month_day = f"{date_obj.month}月{date_obj.day}日"
            
            # 根据次数选择颜色标记
            if day_count == 1:
                color_mark = "🟢"
            elif day_count == 2:
                color_mark = "🟡"
            else:
                color_mark = "🔴"
            
            message += f"🗓️ {month_day} {color_mark}\n"
            
            # 显示当天的时间记录
            times = sorted([r['time'] for r in day_records])
            for time in times:
                message += f"  └─ {time}\n"
            
            message += f"  📊 当天{day_count}次\n\n"
        
        # 如果记录超过10天，显示提示
        if len(records_by_date) > 10:
            hidden_days = len(records_by_date) - 10
            message += f"... 还有{hidden_days}天的记录未显示\n\n"
        
        # 添加统计信息
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📈 总体统计\n"
        message += f"• 记录时段: {first_date} 至 {last_date}\n"
        message += f"• 记录天数: {total_days}天 (跨度{date_span}天)\n"
        message += f"• 总计次数: {total_count}次\n"
        message += f"• 平均频率: {avg_freq:.2f}次/天\n\n"
        message += "💡 发送「便便删除」可以删除记录"
        
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
