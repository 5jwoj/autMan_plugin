# [disable:false]
# [rule: ^体重(.*)$]
# [admin: false]
# [price: 0.00]
# [version: v2.1.3]

"""
autMan 插件 - 体重记录

功能: 体重记录、趋势分析、目标管理
作者: AI Assistant
版本: v2.1.3
日期: 2026-01-12

使用说明:
- 体重 [数值]: 记录当前体重 (如: 体重 65.5)
- 体重记录: 查看最近记录
- 体重统计: 查看统计信息
- 设置目标体重 [数值]: 设定目标体重
- 目标进度: 查看目标进度
- 体重帮助: 显示帮助
"""

import middleware
import time
import json
import re
import os
import tempfile
from datetime import datetime
import matplotlib
matplotlib.use('Agg')  # 使用非GUI后端
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.font_manager import FontProperties

# 配置常量
BUCKET_NAME = "weight_tracker"
VERSION = "v2.1.3"
INPUT_TIMEOUT = 60000  # 60秒超时


class WeightPlugin:
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
        self.username = self.user_id
        self.message = self.sender.getMessage().strip()
    
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
    
    
    def generate_weight_chart(self, data):
        """生成体重曲线图"""
        try:
            if not data['records']:
                return None
            
            # 按日期排序
            sorted_records = sorted(data['records'], key=lambda x: x['date'])
            
            # 提取日期和体重数据
            dates = [datetime.strptime(r['date'], '%Y-%m-%d') for r in sorted_records]
            weights = [r['weight'] for r in sorted_records]
            
            # 禁用所有matplotlib警告
            import warnings
            warnings.filterwarnings('ignore')
            
            # 使用默认字体,避免中文字体问题
            plt.rcParams['font.family'] = 'DejaVu Sans'
            plt.rcParams['axes.unicode_minus'] = False
            
            # 创建图表
            fig, ax = plt.subplots(figsize=(12, 6))
            
            # 绘制曲线
            ax.plot(dates, weights, marker='o', linestyle='-', linewidth=2, 
                   markersize=8, color='#4A90E2', label='Weight Trend')
            
            # 如果有目标体重,绘制目标线
            if data.get('target'):
                ax.axhline(y=data['target'], color='#E74C3C', linestyle='--', 
                          linewidth=2, label=f'Target: {data["target"]}kg')
            
            # 设置标题和标签(使用英文避免字体问题)
            ax.set_title('Weight Tracking Chart', fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('Date', fontsize=12)
            ax.set_ylabel('Weight (kg)', fontsize=12)
            
            # 格式化x轴日期
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax.xaxis.set_major_locator(mdates.AutoDateLocator())
            plt.xticks(rotation=45)
            
            # 添加网格
            ax.grid(True, linestyle='--', alpha=0.3)
            
            # 添加图例
            ax.legend(loc='best', fontsize=10)
            
            # 在每个数据点上标注数值
            for i, (date, weight) in enumerate(zip(dates, weights)):
                ax.annotate(f'{weight}kg', 
                           xy=(date, weight),
                           xytext=(0, 10),
                           textcoords='offset points',
                           ha='center',
                           fontsize=9,
                           bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.3))
            
            # 调整布局
            plt.tight_layout()
            
            # 保存到临时文件
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            plt.savefig(temp_file.name, dpi=150, bbox_inches='tight')
            plt.close()
            
            return temp_file.name
            
        except Exception as e:
            print(f"[生成图表失败] {e}")
            return None
    
    def view_records(self):
        """查看记录"""
        data = self.get_data()
        
        if not data['records']:
            self.sender.reply("📋 暂无体重记录\n\n💡 发送「体重 65.5」开始记录")
            return
        
        # 生成曲线图
        chart_path = self.generate_weight_chart(data)
        
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
        
        # 发送文字消息
        self.sender.reply(message)
        
        # 如果图表生成成功,发送图片
        if chart_path:
            try:
                print(f"[图表路径] {chart_path}")
                print(f"[文件是否存在] {os.path.exists(chart_path)}")
                if os.path.exists(chart_path):
                    print(f"[文件大小] {os.path.getsize(chart_path)} bytes")
                
                # 使用sendImage发送图片
                self.sender.sendImage(f"file://{chart_path}")
                print("[图表发送成功]")
                
                # 清理临时文件
                try:
                    os.unlink(chart_path)
                    print("[临时文件已清理]")
                except Exception as cleanup_err:
                    print(f"[清理临时文件失败] {cleanup_err}")
                    
            except Exception as e:
                import traceback
                error_detail = traceback.format_exc()
                print(f"[发送图表失败] {e}")
                print(f"[错误详情] {error_detail}")
                # 不显示技术错误,只提示用户图表功能暂时不可用
                self.sender.reply("📊 图表已生成但发送失败,数据记录正常")
    
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
        help_text += "• 体重记录 - 查看最近记录(含曲线图)\n"
        help_text += "• 体重统计 - 查看统计信息\n"
        help_text += "• 设置目标体重 60 - 设定目标体重\n"
        help_text += "• 目标进度 - 查看目标进度\n"
        help_text += "• 体重帮助 - 显示此帮助信息\n\n"
        help_text += "🔹 确认机制：\n"
        help_text += "记录和设置操作需要确认：\n"
        help_text += "  y - 确认执行\n"
        help_text += "  n - 取消操作\n"
        help_text += "  q - 退出流程\n\n"
        help_text += "💡 提示：记录会包含时间信息，方便您追踪健康状况"
        
        self.sender.reply(help_text)
    
    def run(self):
        """主程序入口"""
        try:
            # 路由到对应功能
            if self.message == "体重帮助":
                self.show_help()
            elif self.message == "体重记录":
                self.view_records()
            elif self.message == "体重统计":
                self.show_statistics()
            elif self.message == "目标进度":
                self.show_target_progress()
            elif "设置目标体重" in self.message or "设定目标体重" in self.message:
                match = re.search(r'(?:设置|设定)目标体重\s*([\d.]+)', self.message)
                if match:
                    self.set_target(match.group(1))
                else:
                    self.sender.reply("❓ 请输入目标体重数值 (如: 设置目标体重 60)")
            elif self.message.startswith("体重"):
                # 匹配 "体重 65.5" 格式
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
