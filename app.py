
import os
import re
import json
import logging
from typing import Dict, List, Any

import openai
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

app = Flask(__name__)
CORS(app)

# ------------------------------------------------------------------
# 基本配置
# ------------------------------------------------------------------
openai.api_key = os.getenv("DEEPSEEK_API_KEY", "")
openai.api_base = "https://api.deepseek.com"

CONFIDENCE_THRESHOLD = 75
DEPARTMENT_LIST = """
外科、小儿外科、普通科、肠胃肝脏科、精神科、临床心理学、内科、耳鼻喉科、家庭医学、放射科、麻醉科、病理学、眼科、整形外科、骨科、泌尿外科、临床肿瘤科、血液及血液肿瘤科、妇产科、内分泌及糖尿科、风湿病科、神经外科、核子医学科、临床微生物及感染学、急症科、儿科、复康科、脑神经科、心脏科、肾病科、呼吸系统科、牙科、物理治疗、免疫及过敏病科、疼痛医学、皮肤及性病科、老人科、社会医学、中医、儿童免疫、过敏及传染病科、营养学、心胸肺外科、内科肿瘤科、妇科肿瘤科、解剖病理学、感染及传染病科、法医病理学、生殖医学科、职业医学、牙周治疗科、修复齿科专科、口腔颌面外科
"""


LANG_MAP: Dict[str, str] = {
    "zhCN": "简体中文",
    "zhTW": "繁體中文",
    "en": "English",
    "id":"Bahasa indonesia"
}

# ------------------------------------------------------------------
# 工具
# ------------------------------------------------------------------


def safe_json_load(text: str) -> dict:
    """
    從 LLM 輸出中提取第一段 {...} JSON 字符串並解析。
    如解析失敗則丟出異常，供上層捕獲。
    """
    cleaned = text.strip().lstrip("```").rstrip("```").strip()
    match = re.search(r"\{.*\}", cleaned, re.S)
    if not match:
        raise ValueError(f"LLM did not return JSON: {text[:120]}...")
    return json.loads(match.group(0))


def build_prompts(lang: str) -> Dict[str, str]:
    """動態構造三個 prompt，根據語言插入指示"""
    lang_label = LANG_MAP.get(lang, "简体中文")

    analysis_prompt = (
        f"You are a professional medical analysis AI.\n"
        f"Your task:\n1. Evaluate confidence level of the user's symptom, higher confidence level means higher belief of what is causing the symptom the user is experiencing(0‑100)\n"
        f"2. Generate **one** concise follow‑up question that only asks one thing (yes/no if possible).\n"
        f"Respond **in {lang_label}**，you must respond in that language! you mush responed in that language!.\n\n"
        f"Output JSON:\n{{\n  \"analysis_text\": \"...\",\n"
        f"  \"confidence_level\": number,\n  \"next_question\": \"...\"\n}}"
    )

    plain_prompt = (
        f"You are a medical summarization AI. Given the conversation history, produce a "
        f"**patient‑friendly summary**. Respond **in {lang_label}** you must respond in that language1!!!!!!.\n\n"
        f"Output JSON:\n{{\n  \"plain_summary\": \"...\"\n}}"
    )

    professional_prompt = (
        f"You are a professional doctor, generate  medical of the user summaries based on chatlog Generate:\n"
        f"1. medical_summary (professional)\n"
        f"2. plain_summary (patient‑friendly)\n"
        f"3. recommended_specialties (1‑3 from list, total confidence = 100)\n\n"
        f"Department list:\n{DEPARTMENT_LIST}\n\n"
        f"Respond **in {lang_label}**.\n\n"
        f"Output JSON:\n{{\n  \"medical_summary\": \"...\",\n"
        f"  \"plain_summary\": \"...\",\n"
        f"  \"recommended_specialties\": [{{\"科目\":\"...\", \"置信度\": number}}]\n}}"
    )

    return {"analysis": analysis_prompt, "plain": plain_prompt, "professional": professional_prompt}


def chat_complete(messages: List[dict], **kwargs) -> Any:
    return openai.ChatCompletion.create(
        model="deepseek-chat",
        messages=messages,
        stream=False,
        **kwargs
    )


# ------------------------------------------------------------------
# 核心邏輯
# ------------------------------------------------------------------


def generate_plain_summary(history: List[dict], prompt: str) -> dict:
    try:
        resp = chat_complete([{"role": "system", "content": prompt}] + history)
        return safe_json_load(resp.choices[0].message.content)
    except Exception as e:
        return {"plain_summary": "生成簡易總結失敗", "error": str(e)}


def analysis_ai_decide_next_step(
        full_history: List[dict],
        lang: str = "zhCN",
        approval: bool | None = None,
        refusal_times: int = 0
) -> Dict[str, Any]:
    """
    根据对话历史、审批状态与拒绝次数决定后续动作。
    - full_history: 聊天记录（用户+AI）
    - lang: 多语言支持
    - approval: None=未确认 / True=同意 / False=拒绝
    - refusal_times: 已累计的拒绝次数（由上层逻辑透传）
    """
    prompts = build_prompts(lang)
    skip_analysis = len(full_history) > 7
    

    # ——— 阶段 1：分析 ——— #
    if not skip_analysis:
        try:
            stage1 = chat_complete(
                [{"role": "system", "content": prompts["analysis"]}] + full_history
            )
            s1 = safe_json_load(stage1.choices[0].message.content)
        except Exception as e:
            return {"error": f"分析階段錯誤：{e}"}
    else:
        # 跳过分析阶段，直接给一个足够高的置信度
        s1 = {
            "analysis_text": "",
            "confidence_level": CONFIDENCE_THRESHOLD,
            "next_question": ""
        }

    result: Dict[str, Any] = {
        "hidden_analysis": s1.get("analysis_text", ""),
        "confidence_level": s1.get("confidence_level", 0),
        "next_question": s1.get("next_question", ""),
        "done": False,
        "plain_summary": "",
        "medical_summary": "",
        "recommended_specialties": [],
        "needsApproval": False,
        "refusal_times": refusal_times     # 回传当前拒绝次数
    }

    # ——— 阶段 2：总结 ——— #
    if result["confidence_level"] >= CONFIDENCE_THRESHOLD:
        # ❶ 尚未确认 —— 生成简易总结，请求用户批准
        if approval is None:
            ps = generate_plain_summary(full_history, prompts["plain"])
            result.update({
                "plain_summary": ps.get("plain_summary", "生成简易总结失败"),
                "needsApproval": True
            })

        # ❷ 用户同意 —— 生成专业总结
        elif approval is True:
            try:
                prof = chat_complete(
                    [{"role": "system", "content": prompts["professional"]}] + full_history
                )
                pdata = safe_json_load(prof.choices[0].message.content)
            except Exception:
                pdata = {"medical_summary": "生成失败", "plain_summary": "生成失败",
                         "recommended_specialties": []}

            result.update({
                "medical_summary": pdata.get("medical_summary", ""),
                "plain_summary": pdata.get("plain_summary", ""),
                "recommended_specialties": pdata.get("recommended_specialties", []),
                "done": True,
                "needsApproval": False,
                "next_question": ""
            })

        # ❸ 用户拒绝 —— 触发 5 + 5 重试逻辑
        else:  # approval is False
            refusal_times += 1
            result["refusal_times"] = refusal_times

            if refusal_times <= 10:
                # 前 10 次拒绝仍尝试再次确认
                result.update({
                    "needsApproval": True,
                    # 可以自定义提示语；此处重用原 next_question 或 prompts["approval"]
                    "next_question": prompts.get("approval", "请再次确认您是否同意生成完整报告？")
                })
            else:
                # 超过 10 次，视为彻底拒绝
                result["confidence_level"] = 0
                result["needsApproval"] = False

    return result

# ------------------------------------------------------------------
# Flask 路由
# ------------------------------------------------------------------


@app.route("/api/conversation", methods=["POST"])
def api_conversation():
    data = request.get_json() or {}
    history = data.get("history", [])
    lang = data.get("lang", "zhCN")
    approval = data.get("approval")  # True / False / None

    answer = analysis_ai_decide_next_step(history, lang, approval)
    if "error" in answer:
        return jsonify({"error": answer["error"]}), 500
    return jsonify(answer)


@app.route("/api/translate_report", methods=["POST"])
def api_translate():
    data = request.get_json() or {}
    target = data.get("targetLang", "en")

    to_trans = (
        f"medical_summary:\n{data.get('medical_summary','')}\n\n"
        f"plain_summary:\n{data.get('plain_summary','')}"
    )
    prompt = (
        f"You are a medical translator. Translate the text to "
        f"{LANG_MAP.get(target, 'English')} in the same medical style.\n\n"
        f"Output JSON:\n{{\n  \"medical_summary_translated\": \"...\",\n"
        f"  \"plain_summary_translated\": \"...\"\n}}"
    )

    try:
        resp = chat_complete(
            [{"role": "system", "content": prompt},
             {"role": "user", "content": to_trans}]
        )
        out = safe_json_load(resp.choices[0].message.content)
        return jsonify({
            "medical_summary": out.get("medical_summary_translated", ""),
            "plain_summary": out.get("plain_summary_translated", ""),
            "recommended_specialties": data.get("recommended_specialties", [])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------
# 主程式
# ------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
