# [disable:false]
# [rule: ^(性格测试.*|[IE][NS][TF][JP])$]
# [admin: false]
# [price: 0.00]
# [version: 1.2.0]

"""
autMan 插件 - MBTI性格测试

功能：通过16道题测试用户的MBTI性格类型,支持查询性格类型解释
作者：AI Assistant
版本：v1.2.0
日期：2026-01-11

使用说明：
- 性格测试：开始新的性格测试
- 性格测试记录：查看历史测试记录
- 性格测试删除：删除指定的历史记录
- 性格测试帮助：显示帮助信息
- 发送MBTI类型(如INTJ)：查看该性格类型的详细解释
"""

import middleware
import time
import json
from datetime import datetime

# 配置常量
BUCKET_NAME = "personality_test"
VERSION = "v1.2.0"
INPUT_TIMEOUT = 60000  # 60秒超时


# MBTI测试题目 - 每个维度4道题
QUESTIONS = [
    # E/I 维度 (外向/内向)
    {
        "dimension": "EI",
        "question": "在社交场合中，你更倾向于：",
        "options": {
            "A": "主动与他人交谈，享受热闹的氛围",
            "B": "安静观察，与少数人深入交流"
        },
        "scores": {"A": "E", "B": "I"}
    },
    {
        "dimension": "EI",
        "question": "周末你更喜欢：",
        "options": {
            "A": "参加聚会或户外活动",
            "B": "独自在家看书或做自己的事"
        },
        "scores": {"A": "E", "B": "I"}
    },
    {
        "dimension": "EI",
        "question": "工作休息时，你更愿意：",
        "options": {
            "A": "和同事聊天，分享趣事",
            "B": "独自放松，恢复精力"
        },
        "scores": {"A": "E", "B": "I"}
    },
    {
        "dimension": "EI",
        "question": "面对陌生人时，你通常：",
        "options": {
            "A": "主动打招呼，容易建立联系",
            "B": "保持礼貌，但需要时间熟悉"
        },
        "scores": {"A": "E", "B": "I"}
    },
    
    # S/N 维度 (感觉/直觉)
    {
        "dimension": "SN",
        "question": "学习新事物时，你更关注：",
        "options": {
            "A": "具体的事实和细节",
            "B": "整体概念和可能性"
        },
        "scores": {"A": "S", "B": "N"}
    },
    {
        "dimension": "SN",
        "question": "解决问题时，你更依赖：",
        "options": {
            "A": "过往经验和实际操作",
            "B": "创新思维和理论分析"
        },
        "scores": {"A": "S", "B": "N"}
    },
    {
        "dimension": "SN",
        "question": "阅读时，你更喜欢：",
        "options": {
            "A": "实用指南和操作手册",
            "B": "理论探讨和未来展望"
        },
        "scores": {"A": "S", "B": "N"}
    },
    {
        "dimension": "SN",
        "question": "描述事物时，你倾向于：",
        "options": {
            "A": "详细具体，注重细节",
            "B": "概括抽象，强调意义"
        },
        "scores": {"A": "S", "B": "N"}
    },
    
    # T/F 维度 (思考/情感)
    {
        "dimension": "TF",
        "question": "做决定时，你更看重：",
        "options": {
            "A": "逻辑分析和客观标准",
            "B": "人际关系和情感因素"
        },
        "scores": {"A": "T", "B": "F"}
    },
    {
        "dimension": "TF",
        "question": "评价一件事时，你更倾向于：",
        "options": {
            "A": "公正客观，就事论事",
            "B": "考虑他人感受，换位思考"
        },
        "scores": {"A": "T", "B": "F"}
    },
    {
        "dimension": "TF",
        "question": "与人争论时，你更注重：",
        "options": {
            "A": "论据是否充分，逻辑是否严密",
            "B": "对方的感受，维护关系和谐"
        },
        "scores": {"A": "T", "B": "F"}
    },
    {
        "dimension": "TF",
        "question": "批评他人时，你会：",
        "options": {
            "A": "直接指出问题，提出改进建议",
            "B": "委婉表达，照顾对方情绪"
        },
        "scores": {"A": "T", "B": "F"}
    },
    
    # J/P 维度 (判断/感知)
    {
        "dimension": "JP",
        "question": "对待计划，你更喜欢：",
        "options": {
            "A": "提前规划，按部就班执行",
            "B": "保持灵活，随机应变"
        },
        "scores": {"A": "J", "B": "P"}
    },
    {
        "dimension": "JP",
        "question": "工作方式上，你更倾向于：",
        "options": {
            "A": "有条理地完成任务，追求确定性",
            "B": "探索多种可能，保持开放性"
        },
        "scores": {"A": "J", "B": "P"}
    },
    {
        "dimension": "JP",
        "question": "面对截止日期，你通常：",
        "options": {
            "A": "提前完成，避免最后时刻的压力",
            "B": "在压力下工作效率更高"
        },
        "scores": {"A": "J", "B": "P"}
    },
    {
        "dimension": "JP",
        "question": "旅行时，你更喜欢：",
        "options": {
            "A": "详细的行程安排和预订",
            "B": "随性而为，享受未知的惊喜"
        },
        "scores": {"A": "J", "B": "P"}
    }
]


# 16种MBTI性格类型描述
PERSONALITY_TYPES = {
    "INTJ": {
        "name": "建筑师",
        "category": "分析师",
        "traits": [
            "富有想象力和战略性思维",
            "独立自主，追求完美",
            "善于长远规划和系统思考",
            "对知识充满渴望"
        ],
        "careers": "科学家、工程师、战略规划师、系统分析师",
        "famous": "埃隆·马斯克、牛顿、尼采"
    },
    "INTP": {
        "name": "逻辑学家",
        "category": "分析师",
        "traits": [
            "创新思维，热爱理论",
            "好奇心强，追求真理",
            "善于分析复杂问题",
            "独立思考，不随波逐流"
        ],
        "careers": "哲学家、数学家、程序员、研究员",
        "famous": "爱因斯坦、比尔·盖茨、达尔文"
    },
    "ENTJ": {
        "name": "指挥官",
        "category": "分析师",
        "traits": [
            "天生的领导者",
            "果断自信，目标明确",
            "善于组织和管理",
            "追求效率和成就"
        ],
        "careers": "企业高管、律师、创业者、军事指挥官",
        "famous": "史蒂夫·乔布斯、拿破仑、撒切尔夫人"
    },
    "ENTP": {
        "name": "辩论家",
        "category": "分析师",
        "traits": [
            "思维敏捷，善于辩论",
            "创新精神，挑战传统",
            "适应能力强",
            "享受智力挑战"
        ],
        "careers": "发明家、企业家、顾问、演说家",
        "famous": "托马斯·爱迪生、马克·吐温、本杰明·富兰克林"
    },
    "INFJ": {
        "name": "提倡者",
        "category": "外交官",
        "traits": [
            "理想主义，富有洞察力",
            "关心他人，追求意义",
            "坚持原则，内心坚定",
            "善于理解他人情感"
        ],
        "careers": "心理咨询师、作家、教师、社会工作者",
        "famous": "甘地、马丁·路德·金、柏拉图"
    },
    "INFP": {
        "name": "调停者",
        "category": "外交官",
        "traits": [
            "理想主义，富有创造力",
            "真诚善良，追求和谐",
            "重视个人价值观",
            "富有同理心"
        ],
        "careers": "作家、艺术家、心理学家、社会活动家",
        "famous": "莎士比亚、J.R.R.托尔金、梵高"
    },
    "ENFJ": {
        "name": "主人公",
        "category": "外交官",
        "traits": [
            "富有魅力的领导者",
            "善于激励他人",
            "关心社会和他人福祉",
            "沟通能力强"
        ],
        "careers": "教师、政治家、人力资源、培训师",
        "famous": "奥普拉·温弗瑞、奥巴马、马丁·路德·金"
    },
    "ENFP": {
        "name": "竞选者",
        "category": "外交官",
        "traits": [
            "热情洋溢，充满活力",
            "富有创造力和想象力",
            "善于社交，受人欢迎",
            "追求新鲜事物"
        ],
        "careers": "记者、演员、市场营销、创意总监",
        "famous": "罗宾·威廉姆斯、华特·迪士尼、马克·扎克伯格"
    },
    "ISTJ": {
        "name": "物流师",
        "category": "守护者",
        "traits": [
            "务实可靠，注重细节",
            "遵守规则，尽职尽责",
            "组织能力强",
            "重视传统和秩序"
        ],
        "careers": "会计师、审计师、行政管理、军官",
        "famous": "乔治·华盛顿、安吉拉·默克尔、沃伦·巴菲特"
    },
    "ISFJ": {
        "name": "守卫者",
        "category": "守护者",
        "traits": [
            "温暖体贴，乐于助人",
            "细心周到，值得信赖",
            "忠诚可靠",
            "重视和谐稳定"
        ],
        "careers": "护士、教师、社工、图书管理员",
        "famous": "特蕾莎修女、英国女王伊丽莎白二世"
    },
    "ESTJ": {
        "name": "总经理",
        "category": "守护者",
        "traits": [
            "高效务实的管理者",
            "组织能力强",
            "重视规则和秩序",
            "果断负责"
        ],
        "careers": "企业管理、法官、警察、项目经理",
        "famous": "亨利·福特、林登·约翰逊、米歇尔·奥巴马"
    },
    "ESFJ": {
        "name": "执政官",
        "category": "守护者",
        "traits": [
            "热心助人，善于合作",
            "重视和谐关系",
            "组织活动能力强",
            "关心他人需求"
        ],
        "careers": "护士、教师、公关、活动策划",
        "famous": "泰勒·斯威夫特、比尔·克林顿"
    },
    "ISTP": {
        "name": "鉴赏家",
        "category": "探险家",
        "traits": [
            "动手能力强，善于解决问题",
            "冷静理性，适应力强",
            "喜欢探索和实验",
            "独立自主"
        ],
        "careers": "工程师、技师、飞行员、运动员",
        "famous": "克林特·伊斯特伍德、迈克尔·乔丹、布鲁斯·李"
    },
    "ISFP": {
        "name": "探险家",
        "category": "探险家",
        "traits": [
            "艺术气质，审美能力强",
            "温和友善，随和自然",
            "活在当下，享受生活",
            "富有创造力"
        ],
        "careers": "艺术家、设计师、音乐家、摄影师",
        "famous": "迈克尔·杰克逊、莫扎特、玛丽莲·梦露"
    },
    "ESTP": {
        "name": "企业家",
        "category": "探险家",
        "traits": [
            "精力充沛，行动派",
            "善于抓住机会",
            "适应能力强，反应迅速",
            "喜欢冒险和挑战"
        ],
        "careers": "销售、企业家、急救人员、运动员",
        "famous": "唐纳德·特朗普、欧内斯特·海明威、麦当娜"
    },
    "ESFP": {
        "name": "表演者",
        "category": "探险家",
        "traits": [
            "热情开朗，充满活力",
            "善于娱乐他人",
            "活在当下，享受生活",
            "社交能力强"
        ],
        "careers": "演员、主持人、导游、销售",
        "famous": "玛丽莲·梦露、埃尔顿·约翰、杰米·福克斯"
    }
}


class PersonalityTestPlugin:
    def __init__(self):
        """初始化插件"""
        sender_id = middleware.getSenderID()
        self.sender = middleware.Sender(sender_id)
        self.user_id = self.sender.getUserID()
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
        help_text = f"📖 MBTI性格测试插件 {VERSION}\n\n"
        help_text += "🔹 功能说明：\n"
        help_text += "本插件通过16道题帮助您了解自己的MBTI性格类型\n\n"
        help_text += "🔹 命令列表：\n"
        help_text += "• 性格测试 - 开始新的性格测试\n"
        help_text += "• 性格测试记录 - 查看历史测试记录\n"
        help_text += "• 性格测试删除 - 删除指定的历史记录\n"
        help_text += "• 性格测试帮助 - 显示此帮助信息\n"
        help_text += "• 发送MBTI类型(如INTJ) - 查看该性格类型的详细解释\n\n"
        help_text += "🔹 MBTI简介：\n"
        help_text += "MBTI包含4个维度，共16种性格类型：\n"
        help_text += "• E/I - 外向/内向（能量来源）\n"
        help_text += "• S/N - 感觉/直觉（信息获取）\n"
        help_text += "• T/F - 思考/情感（决策方式）\n"
        help_text += "• J/P - 判断/感知（生活方式）\n\n"
        help_text += "💡 提示：测试约需3-5分钟，请根据第一直觉作答"
        
        self.sender.reply(help_text)
    
    def calculate_personality_type(self, answers):
        """
        根据答案计算性格类型
        :param answers: 用户的答案列表
        :return: (性格类型, 各维度得分)
        """
        scores = {
            "E": 0, "I": 0,
            "S": 0, "N": 0,
            "T": 0, "F": 0,
            "J": 0, "P": 0
        }
        
        # 统计各维度得分
        for i, answer in enumerate(answers):
            score_type = QUESTIONS[i]["scores"][answer]
            scores[score_type] += 1
        
        # 确定性格类型
        personality = ""
        personality += "E" if scores["E"] >= scores["I"] else "I"
        personality += "S" if scores["S"] >= scores["N"] else "N"
        personality += "T" if scores["T"] >= scores["F"] else "F"
        personality += "J" if scores["J"] >= scores["P"] else "P"
        
        return personality, scores
    
    def format_test_result(self, personality_type, scores):
        """
        格式化测试结果
        :param personality_type: 性格类型
        :param scores: 各维度得分
        :return: 格式化的结果文本
        """
        info = PERSONALITY_TYPES[personality_type]
        
        result = f"🎯 你的性格类型是：{personality_type}\n"
        result += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        result += f"✨ {info['name']} ({info['category']})\n\n"
        
        result += "🔹 核心特征：\n"
        for trait in info['traits']:
            result += f"• {trait}\n"
        result += "\n"
        
        result += f"🔹 适合职业：\n{info['careers']}\n\n"
        result += f"🔹 代表人物：\n{info['famous']}\n\n"
        
        result += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        result += "📊 维度得分：\n"
        result += f"• 外向(E) {scores['E']} : {scores['I']} 内向(I)\n"
        result += f"• 感觉(S) {scores['S']} : {scores['N']} 直觉(N)\n"
        result += f"• 思考(T) {scores['T']} : {scores['F']} 情感(F)\n"
        result += f"• 判断(J) {scores['J']} : {scores['P']} 感知(P)\n\n"
        result += "💡 发送「性格测试记录」可查看历史测试"
        
        return result
    
    def start_test(self):
        """开始性格测试"""
        # 第一步：获取确认
        confirmation = self.get_user_confirmation("🧠 欢迎参加MBTI性格测试！\n\n本测试包含16道题，每题选择A或B。\n请根据第一直觉作答，无对错之分。\n\n确认开始测试吗？")
        
        if not confirmation:
            return
        
        if confirmation == "q":
            self.sender.reply("👋 已退出测试")
            return
        
        if confirmation == "n":
            self.sender.reply("❌ 已取消测试")
            return
        
        if confirmation != "y":
            self.sender.reply("❓ 无效的输入，已取消测试")
            return
        
        # 开始答题
        answers = []
        
        for i, question in enumerate(QUESTIONS, 1):
            # 显示题目
            question_text = f"📝 第{i}/16题\n\n"
            question_text += f"{question['question']}\n\n"
            question_text += f"A. {question['options']['A']}\n"
            question_text += f"B. {question['options']['B']}\n\n"
            question_text += "请输入 A 或 B（输入 q 退出测试）："
            
            self.sender.reply(question_text)
            
            # 等待用户输入
            user_input = self.sender.listen(INPUT_TIMEOUT)
            
            if user_input is None:
                self.sender.reply("⏱️ 操作超时，测试已取消")
                return
            
            answer = user_input.strip().upper()
            
            if answer == "Q":
                self.sender.reply("👋 已退出测试")
                return
            
            if answer not in ["A", "B"]:
                self.sender.reply("❌ 无效的选项，测试已取消\n\n💡 请输入 A 或 B")
                return
            
            answers.append(answer)
        
        # 计算结果
        personality_type, scores = self.calculate_personality_type(answers)
        
        # 保存记录
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp = self.get_current_timestamp()
        
        record_data = {
            "username": self.username,
            "userid": self.user_id,
            "datetime": current_time,
            "timestamp": timestamp,
            "personality_type": personality_type,
            "scores": scores
        }
        
        records = self.get_user_records()
        records.append(record_data)
        self.save_user_records(records)
        
        # 显示结果
        result_text = self.format_test_result(personality_type, scores)
        self.sender.reply(result_text)
    
    def view_records(self):
        """查看历史记录"""
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无测试记录\n\n💡 发送「性格测试」开始新的测试")
            return
        
        message = f"📊 性格测试记录 (共{len(records)}次)\n"
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        # 显示最近10次记录
        display_records = records[:10]
        
        for i, record in enumerate(display_records, 1):
            time_diff = self.format_time_diff(record['timestamp'])
            personality = record['personality_type']
            info = PERSONALITY_TYPES[personality]
            
            message += f"【{i}】 {record['datetime']}\n"
            message += f"  └─ {personality} - {info['name']} ({time_diff})\n\n"
        
        # 如果记录超过10条，显示提示
        if len(records) > 10:
            hidden_count = len(records) - 10
            message += f"... 还有{hidden_count}条记录未显示\n\n"
        
        # 统计最常见的性格类型
        from collections import Counter
        type_counts = Counter([r['personality_type'] for r in records])
        most_common = type_counts.most_common(1)[0]
        
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        message += "📈 统计信息\n"
        message += f"• 测试次数: {len(records)}次\n"
        message += f"• 最常见类型: {most_common[0]} ({most_common[1]}次)\n\n"
        message += "💡 发送「性格测试删除」可以删除记录"
        
        self.sender.reply(message)
    
    def delete_record(self):
        """删除记录"""
        records = self.get_user_records()
        
        if len(records) == 0:
            self.sender.reply("📭 暂无记录可删除")
            return
        
        # 显示记录列表
        message = f"🗑️ 请选择要删除的记录（共 {len(records)} 条）\n\n"
        
        for i, record in enumerate(records, 1):
            time_diff = self.format_time_diff(record['timestamp'])
            personality = record['personality_type']
            info = PERSONALITY_TYPES[personality]
            message += f"【{i}】 {record['datetime']} - {personality} {info['name']} ({time_diff})\n"
        
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
        personality = selected_record['personality_type']
        info = PERSONALITY_TYPES[personality]
        
        # 二次确认删除
        confirm_message = "⚠️ 确认要删除以下记录吗？\n\n"
        confirm_message += f"📅 {selected_record['datetime']}\n"
        confirm_message += f"🎯 {personality} - {info['name']}\n"
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
            self.sender.reply("✅ 删除成功！\n\n💡 发送「性格测试记录」可查看剩余记录")
            return
        
        # 无效输入
        self.sender.reply("❓ 无效的输入，已取消删除")
    
    def query_personality_type(self, personality_type):
        """
        查询指定性格类型的详细信息
        :param personality_type: MBTI性格类型(如INTJ)
        """
        # 转换为大写
        personality_type = personality_type.upper()
        
        # 验证是否为有效的MBTI类型
        if personality_type not in PERSONALITY_TYPES:
            self.sender.reply(f"❌ 无效的性格类型：{personality_type}\n\n💡 有效的MBTI类型包括：\nINTJ, INTP, ENTJ, ENTP,\nINFJ, INFP, ENFJ, ENFP,\nISTJ, ISFJ, ESTJ, ESFJ,\nISTP, ISFP, ESTP, ESFP")
            return
        
        # 获取性格类型信息
        info = PERSONALITY_TYPES[personality_type]
        
        # 格式化输出
        result = f"🎯 性格类型：{personality_type}\n"
        result += f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        result += f"✨ {info['name']} ({info['category']})\n\n"
        
        result += "🔹 核心特征：\n"
        for trait in info['traits']:
            result += f"• {trait}\n"
        result += "\n"
        
        result += f"🔹 适合职业：\n{info['careers']}\n\n"
        result += f"🔹 代表人物：\n{info['famous']}\n\n"
        
        result += "━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        result += "💡 发送「性格测试」开始测试你的性格类型"
        
        self.sender.reply(result)
    
    def run(self):
        """主程序入口"""
        try:
            # 路由到对应功能
            if self.message == "性格测试帮助":
                self.show_help()
            elif self.message == "性格测试记录":
                self.view_records()
            elif self.message == "性格测试删除":
                self.delete_record()
            elif self.message == "性格测试":
                self.start_test()
            else:
                # 检查是否为MBTI类型查询(4个字母,符合MBTI格式)
                msg_upper = self.message.upper()
                if (len(msg_upper) == 4 and 
                    msg_upper[0] in ['I', 'E'] and 
                    msg_upper[1] in ['N', 'S'] and 
                    msg_upper[2] in ['T', 'F'] and 
                    msg_upper[3] in ['J', 'P']):
                    self.query_personality_type(msg_upper)
                else:
                    # 未匹配到命令，显示帮助
                    self.sender.reply("❓ 未识别的命令\n\n💡 发送「性格测试帮助」查看使用说明")
        
        except Exception as e:
            self.sender.reply(f"❌ 插件执行错误：{e}")


if __name__ == '__main__':
    # 创建插件实例并运行
    plugin = PersonalityTestPlugin()
    plugin.run()
