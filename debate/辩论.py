#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# [disable: false]
# [rule: ^(开始辩论|辩论帮助|结束辩论)$]
# [admin: true]
# [price: 0.00]
# [version: 1.0.0]

"""
autMan 插件 - 辩论助手

功能：管理员控制机器人与群友进行辩论
作者：Antigravity
版本：v1.0.0
日期：2026-01-21

使用说明：
- 开始辩论：管理员发起辩论，指定对手和立场
- 结束辩论：管理员结束当前辩论
- 辩论帮助：显示帮助信息
"""

import middleware
import time
import json
from datetime import datetime

# 配置常量
BUCKET_NAME = "debate_sessions"
VERSION = "v1.0.0"
INPUT_TIMEOUT = 60000  # 60秒超时

# 辩论主题库
DEBATE_TOPICS = [
    "人工智能会取代人类的工作吗？",
    "远程办公比办公室工作更有效率吗？",
    "社交媒体对社会的影响是利大于弊吗？",
    "电动汽车是未来交通的最佳选择吗？",
    "在线教育能够完全替代传统教育吗？",
    "加密货币会成为未来的主流货币吗？",
    "短视频对年轻人的影响是积极的吗？",
    "996工作制是否应该被禁止？",
    "外卖行业的发展利大于弊吗？",
    "游戏应该被视为一种正式的体育运动吗？"
]


class DebatePlugin:
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
        self.group_id = self.sender.getGroupID()
        self.imtype = self.sender.getImtype()
        self.message = self.sender.getMessage().strip()
        
        # 检查是否在群聊中
        self.is_group = bool(self.group_id)
        
    def get_session_key(self):
        """获取会话键（群聊ID或用户ID）"""
        return self.group_id if self.is_group else self.user_id
    
    def get_debate_session(self):
        """获取当前辩论会话"""
        session_key = self.get_session_key()
        try:
            data = middleware.bucketGet(BUCKET_NAME, session_key)
            if not data or data == '':
                return None
            return json.loads(data)
        except Exception as e:
            return None
    
    def save_debate_session(self, session_data):
        """保存辩论会话"""
        session_key = self.get_session_key()
        try:
            data = json.dumps(session_data, ensure_ascii=False)
            middleware.bucketSet(BUCKET_NAME, session_key, data)
        except Exception as e:
            self.sender.reply(f"❌ 保存会话失败：{e}")
    
    def clear_debate_session(self):
        """清除辩论会话"""
        session_key = self.get_session_key()
        middleware.bucketSet(BUCKET_NAME, session_key, "")
    
    def show_help(self):
        """显示帮助信息"""
        help_text = f"📖 辩论助手插件 {VERSION}\n\n"
        help_text += "🔹 功能说明：\n"
        help_text += "本插件允许管理员控制机器人与群友进行辩论\n\n"
        help_text += "🔹 命令列表：\n"
        help_text += "• 开始辩论 - 发起新的辩论（仅管理员）\n"
        help_text += "• 结束辩论 - 结束当前辩论（仅管理员）\n"
        help_text += "• 辩论帮助 - 显示此帮助信息\n\n"
        help_text += "🔹 使用流程：\n"
        help_text += "1. 管理员发送「开始辩论」\n"
        help_text += "2. 选择机器人立场（正方/反方）\n"
        help_text += "3. 指定对手（@某人或输入用户ID）\n"
        help_text += "4. 选择或输入辩论主题\n"
        help_text += "5. 开始辩论，对手发言时机器人自动回应\n"
        help_text += "6. 管理员发送「结束辩论」终止\n\n"
        help_text += "💡 提示：辩论过程中，机器人会根据立场自动生成观点"
        
        self.sender.reply(help_text)
    
    def start_debate(self):
        """开始辩论流程"""
        # 检查是否在群聊中
        if not self.is_group:
            self.sender.reply("⚠️ 辩论功能仅支持群聊使用")
            return
        
        # 检查是否已有进行中的辩论
        existing_session = self.get_debate_session()
        if existing_session and existing_session.get('status') == 'active':
            self.sender.reply("⚠️ 当前已有辩论进行中\n\n发送「结束辩论」可终止当前辩论")
            return
        
        # 第一步：选择机器人立场
        self.sender.reply("🎯 开始辩论设置\n\n请选择机器人的立场：\n\n1️⃣ 正方\n2️⃣ 反方\n\n请回复数字 1 或 2（输入 q 取消）")
        
        stance_input = self.sender.listen(INPUT_TIMEOUT)
        if stance_input is None:
            self.sender.reply("⏱️ 操作超时，已取消")
            return
        
        stance_input = stance_input.strip().lower()
        if stance_input == 'q':
            self.sender.reply("❌ 已取消辩论设置")
            return
        
        if stance_input not in ['1', '2']:
            self.sender.reply("❌ 无效的选择，已取消")
            return
        
        bot_stance = "正方" if stance_input == '1' else "反方"
        opponent_stance = "反方" if stance_input == '1' else "正方"
        
        # 第二步：指定对手
        self.sender.reply(f"✅ 机器人立场：{bot_stance}\n\n请指定辩论对手：\n\n💡 提示：\n• 可以 @某人\n• 或直接输入对方的用户ID\n\n输入 q 取消")
        
        opponent_input = self.sender.listen(INPUT_TIMEOUT)
        if opponent_input is None:
            self.sender.reply("⏱️ 操作超时，已取消")
            return
        
        opponent_input = opponent_input.strip()
        if opponent_input.lower() == 'q':
            self.sender.reply("❌ 已取消辩论设置")
            return
        
        # 解析对手ID（简化处理，实际可能需要更复杂的@解析）
        opponent_id = opponent_input
        
        # 第三步：选择辩论主题
        topic_list = "📋 请选择辩论主题：\n\n"
        for i, topic in enumerate(DEBATE_TOPICS, 1):
            topic_list += f"{i}. {topic}\n"
        topic_list += f"\n0️⃣ 自定义主题\n\n请回复数字（输入 q 取消）"
        
        self.sender.reply(topic_list)
        
        topic_input = self.sender.listen(INPUT_TIMEOUT)
        if topic_input is None:
            self.sender.reply("⏱️ 操作超时，已取消")
            return
        
        topic_input = topic_input.strip()
        if topic_input.lower() == 'q':
            self.sender.reply("❌ 已取消辩论设置")
            return
        
        # 确定主题
        debate_topic = ""
        if topic_input == '0':
            self.sender.reply("请输入自定义辩论主题：")
            custom_topic = self.sender.listen(INPUT_TIMEOUT)
            if custom_topic is None:
                self.sender.reply("⏱️ 操作超时，已取消")
                return
            debate_topic = custom_topic.strip()
        else:
            try:
                topic_index = int(topic_input) - 1
                if 0 <= topic_index < len(DEBATE_TOPICS):
                    debate_topic = DEBATE_TOPICS[topic_index]
                else:
                    self.sender.reply("❌ 无效的主题编号，已取消")
                    return
            except ValueError:
                self.sender.reply("❌ 无效的输入，已取消")
                return
        
        # 创建辩论会话
        session_data = {
            'status': 'active',
            'topic': debate_topic,
            'bot_stance': bot_stance,
            'opponent_stance': opponent_stance,
            'opponent_id': opponent_id,
            'admin_id': self.user_id,
            'start_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'round': 0,
            'history': []
        }
        
        self.save_debate_session(session_data)
        
        # 发送辩论开始通知
        start_msg = f"🎭 辩论正式开始！\n\n"
        start_msg += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        start_msg += f"📌 辩题：{debate_topic}\n\n"
        start_msg += f"🤖 机器人（{bot_stance}）\n"
        start_msg += f"👤 对手：{opponent_id}（{opponent_stance}）\n"
        start_msg += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        start_msg += f"💡 {opponent_stance}请先发表观点，机器人将自动回应"
        
        self.sender.reply(start_msg)
    
    def end_debate(self):
        """结束辩论"""
        session = self.get_debate_session()
        
        if not session or session.get('status') != 'active':
            self.sender.reply("⚠️ 当前没有进行中的辩论")
            return
        
        # 生成辩论总结
        summary = f"🏁 辩论已结束\n\n"
        summary += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        summary += f"📌 辩题：{session['topic']}\n"
        summary += f"🤖 机器人立场：{session['bot_stance']}\n"
        summary += f"👤 对手立场：{session['opponent_stance']}\n"
        summary += f"⏱️ 开始时间：{session['start_time']}\n"
        summary += f"🔄 辩论轮次：{session['round']} 轮\n"
        summary += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        summary += "感谢参与！"
        
        self.clear_debate_session()
        self.sender.reply(summary)
    
    def generate_debate_response(self, session, opponent_message):
        """生成辩论回复"""
        topic = session['topic']
        bot_stance = session['bot_stance']
        round_num = session['round'] + 1
        
        # 构建辩论上下文
        context = f"辩论主题：{topic}\n"
        context += f"我的立场：{bot_stance}\n"
        context += f"当前轮次：第{round_num}轮\n"
        context += f"对方观点：{opponent_message}\n\n"
        
        # 使用 AI 生成回复
        prompt = f"{context}请作为{bot_stance}，针对对方的观点进行有力的反驳或论证。要求：\n"
        prompt += "1. 观点明确，逻辑清晰\n"
        prompt += "2. 提供具体的论据和例子\n"
        prompt += "3. 语气专业但不失礼貌\n"
        prompt += "4. 控制在150字以内\n"
        prompt += "5. 不要重复对方的话，直接给出你的观点"
        
        try:
            # 调用 AI 生成回复
            response = middleware.aiReplyStream(prompt)
            
            if response:
                # 格式化回复
                formatted_response = f"🤖 {bot_stance}观点（第{round_num}轮）：\n\n{response}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━"
                return formatted_response
            else:
                return None
        except Exception as e:
            return None
    
    def handle_debate_message(self, message):
        """处理辩论中的消息"""
        session = self.get_debate_session()
        
        # 检查是否有活跃的辩论
        if not session or session.get('status') != 'active':
            return False
        
        # 检查是否是对手发言
        if self.user_id != session['opponent_id']:
            return False
        
        # 生成回复
        response = self.generate_debate_response(session, message)
        
        if response:
            # 更新会话
            session['round'] += 1
            session['history'].append({
                'round': session['round'],
                'opponent': message,
                'bot': response,
                'time': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            self.save_debate_session(session)
            
            # 发送回复
            self.sender.reply(response)
            return True
        else:
            self.sender.reply("❌ 生成回复失败，请稍后重试")
            return True
    
    def run(self):
        """主程序入口"""
        try:
            # 路由到对应功能
            if self.message == "辩论帮助":
                self.show_help()
            elif self.message == "开始辩论":
                self.start_debate()
            elif self.message == "结束辩论":
                self.end_debate()
            else:
                # 检查是否是辩论中的消息
                if not self.handle_debate_message(self.message):
                    # 未匹配到命令
                    pass
        
        except Exception as e:
            self.sender.reply(f"❌ 插件执行错误：{e}")


# 主程序入口
if __name__ == "__main__":
    plugin = DebatePlugin()
    plugin.run()
