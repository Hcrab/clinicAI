
import os
import re
import json
import logging
from typing import Dict, List, Any

from flask import Flask, request, jsonify
import ssl
import json as _json
import urllib.request
import urllib.error
from types import SimpleNamespace
from flask_cors import CORS

# Preconfigure HTTPS certificate handling as early as possible
try:
    import certifi  # type: ignore
    _ca = certifi.where()
    if _ca and os.path.isfile(_ca):
        os.environ.setdefault("REQUESTS_CA_BUNDLE", _ca)
        os.environ.setdefault("SSL_CERT_FILE", _ca)
except Exception:
    # As last resort, disable verification to avoid import-time crashes in requests
    os.environ.setdefault("PYTHONHTTPSVERIFY", "0")

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

app = Flask(__name__)
CORS(app)

# ------------------------------------------------------------------
# 基本配置
# ------------------------------------------------------------------
def _env_debug_info() -> Dict[str, Any]:
    info: Dict[str, Any] = {}
    try:
        import sys, platform
        info["python"] = sys.version.split(" ")[0]
        info["platform"] = platform.platform()
    except Exception:
        pass
    for k in [
        "DEEPSEEK_API_KEY",
        "REQUESTS_CA_BUNDLE",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "PYTHONHTTPSVERIFY",
    ]:
        v = os.environ.get(k)
        if k == "DEEPSEEK_API_KEY" and v:
            v = v[:4] + "***"
        info[k] = v
    try:
        import importlib.metadata as md
        for pkg in ("openai", "requests", "certifi"):
            try:
                info[f"pkg_{pkg}"] = md.version(pkg)
            except Exception:
                info[f"pkg_{pkg}"] = None
    except Exception:
        pass
    ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
    if ca:
        info["ca_path_exists"] = os.path.isfile(ca)
        info["ca_path"] = ca
    return info


def _http_post_json(url: str, payload: dict, headers: dict | None = None, timeout: float = 60.0) -> dict:
    """Minimal JSON POST without importing requests.

    Tries to use a verifying SSL context with a known CA bundle; if that fails,
    falls back to an unverified context to avoid import-time crashes seen in requests.
    """
    data = _json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)

    # Build SSL context
    ctx = None
    try:
        ctx = ssl.create_default_context()
        ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
        if ca and os.path.isfile(ca):
            ctx.load_verify_locations(cafile=ca)
    except Exception:
        try:
            ctx = ssl.create_default_context()
        except Exception:
            ctx = ssl._create_unverified_context()

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            body = resp.read().decode(charset, errors="replace")
            return _json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="replace")
            return {"error": f"HTTP {e.code}", "body": err_body}
        except Exception:
            raise
    except Exception as e:
        raise RuntimeError(f"HTTP POST failed: {e}")


def _build_http_deepseek_client():
    """Return a tiny client shim compatible with chat_complete() access pattern.

    Provides: client.chat.completions.create(...)
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    base_url = "https://api.deepseek.com"

    class _Completions:
        def create(self, *, model: str, messages: list, max_tokens: int | None = None, stream: bool = False, response_format: dict | None = None, **kwargs):
            if stream:
                raise NotImplementedError("stream=True not supported in HTTP fallback")
            payload = {
                "model": model,
                "messages": messages,
            }
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens
            # response_format may not be supported by DeepSeek; pass through if provided
            if response_format:
                payload["response_format"] = response_format
            payload.update({k: v for k, v in kwargs.items() if v is not None})

            headers = {
                "Authorization": f"Bearer {api_key}",
            }
            out = _http_post_json(f"{base_url}/v1/chat/completions", payload, headers=headers)
            # Normalize to SDK-like object with attribute access first, then dict fallback works too
            try:
                return SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content=out["choices"][0]["message"]["content"]))]
                )
            except Exception:
                return out

    class _Chat:
        def __init__(self):
            self.completions = _Completions()

    return SimpleNamespace(chat=_Chat())


def init_openai_client():
    """Initialize DeepSeek client. Prefer new SDK; fallback to legacy if present.

    Always calls DeepSeek; never mock.
    Adds SSL fallbacks to survive missing CA bundles.
    """
    # Prefer certifi bundle if available
    try:
        import certifi  # type: ignore
        ca = certifi.where()
        if ca and os.path.isfile(ca):
            os.environ.setdefault("REQUESTS_CA_BUNDLE", ca)
            os.environ.setdefault("SSL_CERT_FILE", ca)
    except Exception:
        pass

    # Try new SDK
    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(
            api_key=os.environ.get('DEEPSEEK_API_KEY'),
            base_url="https://api.deepseek.com",
        )
        logging.info("[deepseek] Using new OpenAI SDK. env=%s", _env_debug_info())
        return client
    except FileNotFoundError:
        # Missing CA bundle at import-time — last-resort: disable HTTPS verify
        os.environ["PYTHONHTTPSVERIFY"] = "0"
        logging.warning("[deepseek] FileNotFoundError on import; set PYTHONHTTPSVERIFY=0 and retry. env=%s", _env_debug_info())
        try:
            from openai import OpenAI  # type: ignore
            client = OpenAI(
                api_key=os.environ.get('DEEPSEEK_API_KEY'),
                base_url="https://api.deepseek.com",
            )
            return client
        except Exception:
            logging.info("[deepseek] Falling back to HTTP client after import failure.")
            return _build_http_deepseek_client()
    except Exception:
        # Fallback to legacy SDK if available
        try:
            import openai  # type: ignore
            openai.api_key = os.environ.get('DEEPSEEK_API_KEY', '')
            openai.api_base = "https://api.deepseek.com"
            logging.info("[deepseek] Using legacy openai SDK. env=%s", _env_debug_info())
            return openai
        except Exception as e:
            logging.warning("[deepseek] Legacy SDK import failed (%s); using HTTP fallback.", e)
            return _build_http_deepseek_client()

CONFIDENCE_THRESHOLD = 75
DEPARTMENT_LIST = """
外科、小儿外科、普通科、肠胃肝脏科、精神科、临床心理学、内科、耳鼻喉科、家庭医学、放射科、麻醉科、病理学、眼科、整形外科、骨科、泌尿外科、临床肿瘤科、血液及血液肿瘤科、妇产科、内分泌及糖尿科、风湿病科、神经外科、核子医学科、临床微生物及感染学、急症科、儿科、复康科、脑神经科、心脏科、肾病科、呼吸系统科、牙科、物理治疗、免疫及过敏病科、疼痛医学、皮肤及性病科、老人科、社会医学、中医、儿童免疫、过敏及传染病科、营养学、心胸肺外科、内科肿瘤科、妇科肿瘤科、解剖病理学、感染及传染病科、法医病理学、生殖医学科、职业医学、牙周治疗科、修复齿科专科、口腔颌面外科
"""


LANG_MAP: Dict[str, str] = {
    # Frontend may send either snake_case or camelCase variants
    "zh_CN": "简体中文",
    "zh_TW": "繁體中文",
    "zhCN": "简体中文",
    "zhTW": "繁體中文",
    "en": "English",
    "id": "Bahasa Indonesia",
    "ms": "Bahasa Melayu",  # accept Malay code if provided
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
        f"Your task:\n1. Evaluate confidence level of the user's symptom (0-100).\n"
        f"2. Generate one concise follow-up question (yes/no if possible).\n"
        f"Respond in {lang_label}.\n\n"
        f"Return only a json object, strictly valid JSON.\n"
        f"Example (json):\n{{\n  \"analysis_text\": \"...\",\n  \"confidence_level\": 75,\n  \"next_question\": \"...\"\n}}"
    )

    plain_prompt = (
        f"You are a medical summarization AI. Given the conversation history, produce a patient‑friendly summary.\n"
        f"Respond in {lang_label}.\n\n"
        f"Return only a json object, strictly valid JSON.\n"
        f"Example (json):\n{{\n  \"plain_summary\": \"...\"\n}}"
    )

    professional_prompt = (
        f"You are a professional doctor. Based on the chat history, generate:\n"
        f"1) medical_summary (professional)\n2) plain_summary (patient‑friendly)\n3) recommended_specialties (1‑3 from list, total confidence = 100)\n\n"
        f"Department list:\n{DEPARTMENT_LIST}\n\n"
        f"Respond in {lang_label}.\n\n"
        f"Return only a json object, strictly valid JSON.\n"
        f"Example (json):\n{{\n  \"medical_summary\": \"...\",\n  \"plain_summary\": \"...\",\n  \"recommended_specialties\": [{{\"科目\": \"...\", \"置信度\": 60}}]\n}}"
    )

    return {"analysis": analysis_prompt, "plain": plain_prompt, "professional": professional_prompt}


def chat_complete(messages: List[dict], max_tokens: int = 2048, **kwargs) -> Any:
    client = init_openai_client()
    try:
        # New SDK path
        return client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
            stream=False,
            **kwargs,
        )
    except AttributeError:
        # Legacy SDK path
        return client.ChatCompletion.create(
            model="deepseek-chat",
            messages=messages,
            stream=False,
            **kwargs,
        )


# ------------------------------------------------------------------
# 核心邏輯
# ------------------------------------------------------------------


def generate_plain_summary(history: List[dict], prompt: str) -> dict:
    try:
        resp = chat_complete([{"role": "system", "content": prompt}] + history, max_tokens=2048)
        try:
            content = resp.choices[0].message.content
        except Exception:
            content = resp["choices"][0]["message"]["content"]
        return safe_json_load(content)
    except Exception as e:
        logging.exception("[deepseek] Plain summary stage failed. env=%s", _env_debug_info())
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
                [{"role": "system", "content": prompts["analysis"]}] + full_history,
                max_tokens=2048,
            )
            try:
                content = stage1.choices[0].message.content
            except Exception:
                content = stage1["choices"][0]["message"]["content"]
            s1 = safe_json_load(content)
        except Exception as e:
            logging.exception("[deepseek] Analysis stage failed. env=%s", _env_debug_info())
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

    try:
        answer = analysis_ai_decide_next_step(history, lang, approval)
        if "error" in answer:
            logging.error("/api/conversation error: %s", answer["error"])
            return jsonify({
                "error": answer["error"],
                "hint": "Check DEEPSEEK_API_KEY, outbound network, and SSL certificates"
            }), 502
        return jsonify(answer)
    except Exception as e:
        logging.exception("/api/conversation unexpected error")
        return jsonify({"error": str(e)}), 500


@app.route("/api/translate_report", methods=["POST"])
def api_translate():
    data = request.get_json() or {}
    target = data.get("targetLang", "en")

    to_trans = (
        f"medical_summary:\n{data.get('medical_summary','')}\n\n"
        f"plain_summary:\n{data.get('plain_summary','')}"
    )
    prompt = (
        f"You are a medical translator. Translate the text to {LANG_MAP.get(target, 'English')} in the same medical style.\n\n"
        f"Return only a json object, strictly valid JSON.\n"
        f"Example (json):\n{{\n  \"medical_summary_translated\": \"...\",\n  \"plain_summary_translated\": \"...\"\n}}"
    )

    try:
        resp = chat_complete(
            [{"role": "system", "content": prompt},
             {"role": "user", "content": to_trans}],
            max_tokens=2048,
        )
        try:
            content = resp.choices[0].message.content
        except Exception:
            content = resp["choices"][0]["message"]["content"]
        out = safe_json_load(content)
        return jsonify({
            "medical_summary": out.get("medical_summary_translated", ""),
            "plain_summary": out.get("plain_summary_translated", ""),
            "recommended_specialties": data.get("recommended_specialties", [])
        })
    except Exception as e:
        logging.exception("[deepseek] translate_report failed. env=%s", _env_debug_info())
        return jsonify({"error": str(e), "env": _env_debug_info()}), 500


# ------------------------------------------------------------------
# 主程式
# ------------------------------------------------------------------

@app.route("/healthz", methods=["GET"])  # simple health endpoint
def healthz():
    return jsonify({"ok": True}), 200

@app.route("/api/_diag", methods=["GET"])  # diagnostics endpoint
def api_diag():
    try:
        info = _env_debug_info()
        info["ok"] = True
        return jsonify(info), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    app.run(host=host, port=port, debug=True)
