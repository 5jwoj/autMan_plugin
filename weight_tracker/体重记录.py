# [disable:false]
# [rule: ^体重(.*)$]
# [admin: false]
# [price: 0.00]
# [version: v2.1.1]

"""
autMan 插件 - 体重记录

功能: 体重记录、趋势分析、目标管理
作者: AI Assistant
版本: v2.1.1
日期: 2026-01-12

使用说明:
- 体重 [数值]: 记录当前体重 (如: 体重 65.5)
- 体重记录: 查看最近记录
- 体重详细记录: 查看带编号的完整记录
- 体重统计: 查看统计信息
- 设置目标体重 [数值]: 设定目标体重
- 目标进度: 查看目标进度
- 删除体重记录 [编号]: 删除指定记录
- 修改体重记录 [编号] [新数值]: 修改指定记录
- 清空体重记录: 清空所有记录
- 体重帮助: 显示帮助

交互说明:
- 查看详细记录后,30秒内可直接发送编号快速删除
- 关键操作需要回复 y 确认
- 回复 q 或 n 取消操作
- 60秒无操作自动退出
"""

import middleware
import time
import json
import re
from datetime import datetime

# 配置常量
BUCKET_NAME = "weight_tracker"
PENDING_ACTION_BUCKET = "weight_pending_action"
VERSION = "v2.1.1"
INPUT_TIMEOUT = 60000  # 60秒超时


class WeightPlugin:
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
        self.username = self.user_id
        self.message = self.sender.getMessage().strip()
        self.content = self.message  # 添加content属性用于处理逻辑
    
    def get_user_confirmation(self, prompt):
        """获取用户确认"""
        self.sender.reply(f"{prompt}\n\n请输入：\n  y - 确认\n  n - 取消\n  q - 退出")
        user_input = self.sender.listen(INPUT_TIMEOUT)
        
        if user_input is None:
            self.sender.reply("⏱️ 操作超时，已自动取消")
            return None
        
        return user_input.strip().lower()
    
    def get_data(self):
        """获取用户数据"""
        try:
            data = middleware.bucketGet(BUCKET_NAME, self.user_id)
            if not data or data == '':
                return {'records': [], 'target': None}
            return json.loads(data)
        except:
            return {'records': [], 'target': None}
    
    def save_data(self, data):
        """保存用户数据"""
        try:
            json_data = json.dumps(data, ensure_ascii=False)
            middleware.bucketSet(BUCKET_NAME, self.user_id, json_data)
        except Exception as e:
            self.sender.reply(f"❌ 保存失败：{e}")
    
    def get_pending_action(self):
        """获取等待确认的操作"""
        try:
            pending_str = middleware.bucketGet(PENDING_ACTION_BUCKET, self.user_id)
            
            if pending_str and pending_str != '':
                pending_action = json.loads(pending_str)
                
                # 检查是否超时 (30秒)
                now = int(time.time() * 1000)
                if now - pending_action.get('timestamp', 0) > 30000:
                    self.clear_pending_action()
                    return None
                
                return pending_action
        except:
            self.clear_pending_action()
        
        return None
    
    def save_pending_action(self, action):
        """保存等待确认的操作"""
        try:
            action['timestamp'] = int(time.time() * 1000)
            json_data = json.dumps(action, ensure_ascii=False)
            middleware.bucketSet(PENDING_ACTION_BUCKET, self.user_id, json_data)
        except Exception as e:
            print(f"[保存等待状态失败] {e}")
    
    def clear_pending_action(self):
        """清除等待确认的操作"""
        try:
            middleware.bucketDel(PENDING_ACTION_BUCKET, self.user_id)
        except:
            pass
    
    def record_weight(self, weight_str):
        """记录体重"""
        try:
            weight = float(weight_str)
            if weight <= 0 or weight > 500:
                self.sender.reply("❌ 体重数值无效,请输入0-500之间的数字")
                return
        except ValueError:
            self.sender.reply("❌ 体重数值无效,请输入0-500之间的数字")
            return
        
        # 请求确认
        date = datetime.now().strftime("%Y-%m-%d")
        prompt = f"📝 确认要记录 {self.username} 在 {date} 的体重: {weight}kg 吗？"
        confirmation = self.get_user_confirmation(prompt)
        
        if not confirmation:
            return
        
        if confirmation == "q":
            self.sender.reply("👋 已退出记录流程")
            return
        
        if confirmation == "n":
            self.sender.reply("❌ 已取消记录")
            return
        
        if confirmation == "y":
            # 执行记录
            data = self.get_data()
            
            # 检查当天是否已有记录
            existing_index = -1
            for i, record in enumerate(data['records']):
                if record['date'] == date:
                    existing_index = i
                    break
            
            if existing_index >= 0:
                # 更新记录
                old_weight = data['records'][existing_index]['weight']
                data['records'][existing_index]['weight'] = weight
                data['records'][existing_index]['timestamp'] = int(time.time() * 1000)
                
                self.save_data(data)
                
                diff = weight - old_weight
                diff_str = f"+{diff:.1f}" if diff > 0 else f"{diff:.1f}"
                message = f"✅ 已更新 {date} 的体重记录:\n"
                message += f"{old_weight}kg → {weight}kg ({diff_str}kg)\n\n"
                message += f"当前共有 {len(data['records'])} 条记录"
                self.sender.reply(message)
            else:
                # 添加新记录
                data['records'].append({
                    'date': date,
                    'weight': weight,
                    'timestamp': int(time.time() * 1000)
                })
                
                data['records'].sort(key=lambda x: x['date'])
                self.save_data(data)
                
                message = f"✅ 已记录 {date} 的体重: {weight}kg\n\n"
                message += f"当前共有 {len(data['records'])} 条记录"
                
                # 如果设置了目标,显示进度
                if data.get('target'):
                    diff = weight - data['target']
                    if abs(diff) < 0.1:
                        message += f"\n\n🎉 恭喜!已达成目标体重 {data['target']}kg!"
                    elif diff > 0:
                        message += f"\n\n📊 距离目标体重还差: {diff:.1f}kg (需减重)"
                    else:
                        message += f"\n\n📊 距离目标体重还差: {abs(diff):.1f}kg (需增重)"
                
                self.sender.reply(message)
            return
        
        self.sender.reply("❓ 无效的输入,请重新操作")
    
    def view_records(self):
        """查看记录"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无体重记录\n\n💡 发送「体重 65.5」开始记录")
            return
        
        # 按日期排序(最新在前)
        sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
        
        # 显示最近7条
        display_records = sorted_records[:7]
        
        message = f"📊 体重记录 (共{len(data['records'])}条)\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        for i, record in enumerate(display_records):
            year, month, day = record['date'].split('-')
            
            # 计算趋势
            trend = ""
            if i < len(display_records) - 1:
                prev_weight = display_records[i + 1]['weight']
                diff = record['weight'] - prev_weight
                if diff > 0.1:
                    trend = f" ↑ +{diff:.1f}kg"
                elif diff < -0.1:
                    trend = f" ↓ {diff:.1f}kg"
                else:
                    trend = " → 持平"
            
            message += f"🗓️ {int(month)}月{int(day)}日\n"
            message += f"  📊 {record['weight']}kg{trend}\n\n"
        
        # 显示目标信息
        if data.get('target'):
            latest_weight = sorted_records[0]['weight']
            diff = latest_weight - data['target']
            message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            message += f"🎯 目标体重: {data['target']}kg\n"
            if abs(diff) < 0.1:
                message += "✅ 已达成目标!"
            elif diff > 0:
                message += f"📊 还需减重: {diff:.1f}kg"
            else:
                message += f"📊 还需增重: {abs(diff):.1f}kg"
        
        self.sender.reply(message)
    
    def show_detailed_records(self):
        """显示带编号的详细记录"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无体重记录")
            return
        
        # 按日期排序(最新在前)
        sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
        
        message = f"📋 体重详细记录 (共{len(sorted_records)}条)\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        for i, record in enumerate(sorted_records):
            num = i + 1
            message += f"[{num}] {record['date']}  {record['weight']}kg\n"
        
        message += "\n━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "💡 (30秒内) 发送数字编号可快速删除\n"
        message += "例如: 直接发送 3 即可删除第3条\n"
        message += "或使用「修改体重记录 [编号] [新数值]」修改"
        
        self.sender.reply(message)
        
        # 设置 "查看详情" 状态
        self.save_pending_action({'action': 'view_details'})
    
    def delete_record(self, index_str):
        """删除指定记录"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无记录可删除")
            return
        
        try:
            index = int(index_str)
        except ValueError:
            self.sender.reply(f'❌ 无效的编号"{index_str}"\n请使用「体重详细记录」查看有效编号')
            return
        
        # 按日期排序(最新在前)
        sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
        
        if index < 1 or index > len(sorted_records):
            self.sender.reply(f'❌ 无效的编号"{index_str}"\n请使用「体重详细记录」查看有效编号')
            return
        
        # 获取要删除的记录
        target_record = sorted_records[index - 1]
        
        # 请求确认
        prompt = f"🗑️ 确认要删除记录 [{index}]:\n{target_record['date']}  {target_record['weight']}kg 吗？"
        confirmation = self.get_user_confirmation(prompt)
        
        if not confirmation or confirmation in ['q', 'n']:
            self.sender.reply("❌ 已取消删除")
            return
        
        if confirmation == 'y':
            # 从原数组中删除
            for i, r in enumerate(data['records']):
                if r['date'] == target_record['date']:
                    del data['records'][i]
                    break
            
            # 保存更新后的数据
            if not data['records'] and not data.get('target'):
                middleware.bucketDel(BUCKET_NAME, self.user_id)
            else:
                self.save_data(data)
            
            message = f"✅ 已删除记录 [{index}]:\n"
            message += f"{target_record['date']}  {target_record['weight']}kg\n\n"
            message += f"剩余 {len(data['records'])} 条记录"
            self.sender.reply(message)
    
    def modify_record(self, index_str, new_weight_str):
        """修改指定记录"""
        # 验证新体重值
        try:
            new_weight = float(new_weight_str)
            if new_weight <= 0 or new_weight > 500:
                self.sender.reply("❌ 体重数值无效,请输入0-500之间的数字")
                return
        except ValueError:
            self.sender.reply("❌ 体重数值无效,请输入0-500之间的数字")
            return
        
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无记录可修改")
            return
        
        try:
            index = int(index_str)
        except ValueError:
            self.sender.reply(f'❌ 无效的编号"{index_str}"\n请使用「体重详细记录」查看有效编号')
            return
        
        # 按日期排序(最新在前)
        sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
        
        if index < 1 or index > len(sorted_records):
            self.sender.reply(f'❌ 无效的编号"{index_str}"\n请使用「体重详细记录」查看有效编号')
            return
        
        # 获取要修改的记录
        target_record = sorted_records[index - 1]
        
        # 请求确认
        prompt = f"✏️ 确认要修改记录 [{index}]:\n{target_record['date']}\n{target_record['weight']}kg → {new_weight}kg 吗？"
        confirmation = self.get_user_confirmation(prompt)
        
        if not confirmation or confirmation in ['q', 'n']:
            self.sender.reply("❌ 已取消修改")
            return
        
        if confirmation == 'y':
            # 在原数组中找到并修改
            for i, r in enumerate(data['records']):
                if r['date'] == target_record['date']:
                    old_weight = r['weight']
                    data['records'][i]['weight'] = new_weight
                    data['records'][i]['timestamp'] = int(time.time() * 1000)
                    break
            
            self.save_data(data)
            
            diff = new_weight - old_weight
            diff_str = f"+{diff:.1f}" if diff > 0 else f"{diff:.1f}"
            message = f"✅ 已修改记录 [{index}]:\n"
            message += f"{target_record['date']}\n"
            message += f"{old_weight}kg → {new_weight}kg ({diff_str}kg)"
            self.sender.reply(message)
    
    def clear_all_records(self):
        """清空所有记录"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无记录可清空")
            return
        
        # 请求确认
        prompt = f"⚠️ 确定要清空所有 {len(data['records'])} 条体重记录吗？\n\n此操作不可恢复!"
        if data.get('target'):
            prompt += f"\n(目标体重 {data['target']}kg 将被保留)"
        
        confirmation = self.get_user_confirmation(prompt)
        
        if not confirmation or confirmation in ['q', 'n']:
            self.sender.reply("❌ 已取消清空")
            return
        
        if confirmation == 'y':
            # 保留目标体重,只清空记录
            data['records'] = []
            
            if not data.get('target'):
                middleware.bucketDel(BUCKET_NAME, self.user_id)
                self.sender.reply("🗑️ 已清空所有体重记录")
            else:
                self.save_data(data)
                self.sender.reply(f"🗑️ 已清空所有体重记录\n\n🎯 目标体重 {data['target']}kg 已保留")
    
    def show_statistics(self):
        """显示统计信息"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无体重记录")
            return
        
        sorted_records = sorted(data['records'], key=lambda x: x['date'])
        
        weights = [r['weight'] for r in sorted_records]
        max_weight = max(weights)
        min_weight = min(weights)
        avg_weight = sum(weights) / len(weights)
        total_change = sorted_records[-1]['weight'] - sorted_records[0]['weight']
        
        max_record = next(r for r in sorted_records if r['weight'] == max_weight)
        min_record = next(r for r in sorted_records if r['weight'] == min_weight)
        
        message = "📊 体重统计\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        message += f"📈 最高体重: {max_weight}kg\n"
        message += f"   🗓️ {max_record['date']}\n\n"
        message += f"📉 最低体重: {min_weight}kg\n"
        message += f"   🗓️ {min_record['date']}\n\n"
        message += f"📊 平均体重: {avg_weight:.1f}kg\n\n"
        message += "📊 总体变化: "
        if total_change > 0.1:
            message += f"↑ +{total_change:.1f}kg"
        elif total_change < -0.1:
            message += f"↓ {total_change:.1f}kg"
        else:
            message += "→ 基本持平"
        message += f"\n   从 {sorted_records[0]['date']} 到 {sorted_records[-1]['date']}"
        
        if data.get('target'):
            message += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            message += f"🎯 目标体重: {data['target']}kg\n"
            latest_weight = sorted_records[-1]['weight']
            diff = latest_weight - data['target']
            if abs(diff) < 0.1:
                message += "✅ 已达成目标!"
            elif diff > 0:
                message += f"📊 还需减重: {diff:.1f}kg"
            else:
                message += f"📊 还需增重: {abs(diff):.1f}kg"
        
        self.sender.reply(message)
    
    def set_target(self, target_str):
        """设置目标体重"""
        try:
            target = float(target_str)
            if target <= 0 or target > 500:
                self.sender.reply("❌ 目标体重数值无效,请输入0-500之间的数字")
                return
        except ValueError:
            self.sender.reply("❌ 目标体重数值无效,请输入0-500之间的数字")
            return
        
        # 请求确认
        prompt = f"🎯 确认要设置目标体重为: {target}kg 吗？"
        confirmation = self.get_user_confirmation(prompt)
        
        if not confirmation:
            return
        
        if confirmation == "q":
            self.sender.reply("👋 已退出设置流程")
            return
        
        if confirmation == "n":
            self.sender.reply("❌ 已取消设置")
            return
        
        if confirmation == "y":
            data = self.get_data()
            data['target'] = target
            self.save_data(data)
            
            message = f"✅ 已设置目标体重为: {target}kg"
            
            if data['records']:
                sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
                latest_weight = sorted_records[0]['weight']
                diff = latest_weight - target
                
                message += f"\n\n📊 当前体重: {latest_weight}kg\n"
                if abs(diff) < 0.1:
                    message += "🎉 恭喜!已达成目标!"
                elif diff > 0:
                    message += f"📊 还需减重: {diff:.1f}kg"
                else:
                    message += f"📊 还需增重: {abs(diff):.1f}kg"
            
            self.sender.reply(message)
            return
        
        self.sender.reply("❓ 无效的输入,请重新操作")
    
    def show_target_progress(self):
        """显示目标进度"""
        data = self.get_data()
        
        if not data.get('target'):
            self.sender.reply("❌ 尚未设置目标体重\n\n💡 发送「设置目标体重 60」来设定目标")
            return
        
        if not data['records']:
            self.sender.reply(f"🎯 目标体重: {data['target']}kg\n\n📋 暂无体重记录,无法计算进度")
            return
        
        sorted_records = sorted(data['records'], key=lambda x: x['date'], reverse=True)
        latest_weight = sorted_records[0]['weight']
        diff = latest_weight - data['target']
        
        message = "🎯 目标进度\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        message += f"📊 当前体重: {latest_weight}kg\n"
        message += f"🎯 目标体重: {data['target']}kg\n\n"
        
        if abs(diff) < 0.1:
            message += "🎉 恭喜!已达成目标体重!\n\n继续保持健康的生活方式!"
        elif diff > 0:
            message += f"📊 还需减重: {diff:.1f}kg\n"
            progress = (1 - diff / latest_weight) * 100
            message += f"📈 进度: {progress:.1f}%"
        else:
            message += f"📊 还需增重: {abs(diff):.1f}kg\n"
            progress = (1 - abs(diff) / data['target']) * 100
            message += f"📈 进度: {progress:.1f}%"
        
        self.sender.reply(message)
    
    def show_help(self):
        """显示帮助信息"""
        help_text = f"📖 体重记录插件 {VERSION}\n\n"
        help_text += "🔹 功能说明：\n"
        help_text += "本插件帮助您记录和追踪体重变化\n\n"
        help_text += "🔹 命令列表：\n"
        help_text += "• 体重 65.5 - 记录当前体重\n"
        help_text += "• 体重记录 - 查看最近记录\n"
        help_text += "• 体重详细记录 - 查看带编号的完整记录\n"
        help_text += "• 体重统计 - 查看统计信息\n"
        help_text += "• 设置目标体重 60 - 设定目标体重\n"
        help_text += "• 目标进度 - 查看目标进度\n"
        help_text += "• 删除体重记录 [编号] - 删除指定记录\n"
        help_text += "• 修改体重记录 [编号] [新数值] - 修改记录\n"
        help_text += "• 清空体重记录 - 清空所有记录\n"
        help_text += "• 体重帮助 - 显示此帮助信息\n\n"
        help_text += "🔹 确认机制：\n"
        help_text += "记录和设置操作需要确认：\n"
        help_text += "  y - 确认执行\n"
        help_text += "  n - 取消操作\n"
        help_text += "  q - 退出流程\n\n"
        help_text += "💡 提示：查看详细记录后30秒内可直接发送编号快速删除"
        
        self.sender.reply(help_text)
    
    def run(self):
        """主程序入口"""
        try:
            # 1. 优先检查是否存在等待确认的操作
            pending_action = self.get_pending_action()
            
            if pending_action:
                if pending_action['action'] == 'view_details':
                    # 在详情浏览模式下,检查是否输入了数字
                    if re.match(r'^\d+$', self.content):
                        print(f"[体重记录插件] 详情浏览模式下检测到数字: {self.content}，快速删除")
                        self.clear_pending_action()
                        self.delete_record(self.content)
                        return
                    else:
                        # 输入非数字,清除状态并继续
                        self.clear_pending_action()
                        if self.content.lower() in ['q', 'n', '取消', '退出']:
                            self.sender.reply("✅ 已退出详情浏览模式")
                            return
            
            # 2. 常规命令匹配 (注意:具体命令要放在通用命令之前)
            if self.message == "体重帮助":
                self.show_help()
            elif self.message == "体重详细记录":
                self.show_detailed_records()
            elif self.message == "体重记录":
                self.view_records()
            elif self.message == "体重统计":
                self.show_statistics()
            elif self.message == "目标进度":
                self.show_target_progress()
            elif self.message == "清空体重记录":
                self.clear_all_records()
            elif "删除体重记录" in self.message:
                match = re.search(r'删除体重记录\s+(\d+)', self.message)
                if match:
                    self.delete_record(match.group(1))
                else:
                    self.sender.reply("❓ 请输入要删除的记录编号\n使用「体重详细记录」查看编号")
            elif "修改体重记录" in self.message:
                match = re.search(r'修改体重记录\s+(\d+)\s+([\d.]+)', self.message)
                if match:
                    self.modify_record(match.group(1), match.group(2))
                else:
                    self.sender.reply("❓ 指令格式错误\n正确格式: 修改体重记录 [编号] [新数值]\n示例: 修改体重记录 1 65.5")
            elif "设置目标体重" in self.message or "设定目标体重" in self.message:
                match = re.search(r'(?:设置|设定)目标体重\s*([\d.]+)', self.message)
                if match:
                    self.set_target(match.group(1))
                else:
                    self.sender.reply("❓ 请输入目标体重数值 (如: 设置目标体重 60)")
            elif self.message.startswith("体重"):
                # 匹配 "体重 65.5" 格式 (放在最后,避免拦截其他体重相关命令)
                match = re.search(r'体重\s*([\d.]+)', self.message)
                if match:
                    self.record_weight(match.group(1))
                else:
                    self.sender.reply("❓ 未识别的命令\n\n💡 发送「体重帮助」查看使用说明")
            else:
                self.sender.reply("❓ 未识别的命令\n\n💡 发送「体重帮助」查看使用说明")
        
        except Exception as e:
            self.sender.reply(f"❌ 插件执行错误：{e}")


if __name__ == '__main__':
    # 创建插件实例并运行
    plugin = WeightPlugin()
    plugin.run()
