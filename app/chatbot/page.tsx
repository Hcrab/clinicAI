"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./Chatbot.module.css";

/*──────────────────────────  Constants  ──────────────────────────*/
const CHAT_HISTORY_KEY = "chatHistory";
const CHAT_HISTORY_TIMESTAMP_KEY = "chatHistoryTimestamp";
const SESSION_DURATION = 30 * 60 * 1000; // 30 min

/*──────────────  UI text  ─────────────*/
const UI_TEXT = {
  zh_CN: {
    selectLang: "界面语言：",
    inputPlaceholder: "输入您的回答…",
    yes: "是",
    no: "否",
    else: "其他",
    thinking: "思考中…",
    home: "首页",
    clearChat: "清空聊天",
    regenerate: "重新生成回复",
    map: "地图",
    showDebug: "显示调试",
    hideDebug: "隐藏调试",
    confirmSummary: "请确认摘要",
    approvalYes: "看起来不错",
    approvalNo: "重新生成",
    speechNotSupported: "不支持语音识别",
    conf: "置信度：",
  },
  zh_TW: {
    selectLang: "介面語言：",
    inputPlaceholder: "輸入您的回答…",
    yes: "是",
    no: "否",
    else: "其他",
    thinking: "思考中…",
    home: "主頁",
    clearChat: "清空聊天",
    regenerate: "重新生成回覆",
    map: "地圖",
    showDebug: "顯示調試",
    hideDebug: "隱藏調試",
    confirmSummary: "請確認摘要",
    approvalYes: "看起來不錯",
    approvalNo: "重新生成",
    speechNotSupported: "不支援語音識別",
    conf: "置信度：",
  },
  en: {
    selectLang: "Language:",
    inputPlaceholder: "Type your answer…",
    yes: "YES",
    no: "NO",
    else: "ELSE",
    thinking: "Thinking…",
    home: "Home",
    clearChat: "Clear Chat",
    regenerate: "Regenerate Response",
    map: "Map",
    showDebug: "Show Debug",
    hideDebug: "Hide Debug",
    confirmSummary: "Please confirm the summary",
    approvalYes: "Looks Good",
    approvalNo: "Ask Again",
    speechNotSupported: "Speech not supported",
    conf: "Confidence: ",
  },
  id: {
    selectLang: "Bahasa antarmuka:",
    inputPlaceholder: "Ketik jawaban Anda…",
    yes: "Ya",
    no: "Tidak",
    else: "Lainnya",
    thinking: "Memikirkan…",
    home: "Beranda",
    clearChat: "Bersihkan Obrolan",
    regenerate: "Regenerasi Balasan",
    map: "Peta",
    showDebug: "Tampilkan Debug",
    hideDebug: "Sembunyikan Debug",
    confirmSummary: "Harap konfirmasi ringkasan",
    approvalYes: "Terlihat Bagus",
    approvalNo: "Minta Lagi",
    speechNotSupported: "Pengenalan suara tidak didukung",
    conf: "Keyakinan: ",
  },
} as const;
type Locale = keyof typeof UI_TEXT;

/*──────────────  Types  ─────────────*/
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  hidden_analysis?: string;
}

interface BackendResponse {
  confidence_level?: number;
  needsApproval?: boolean;
  plain_summary?: string;
  next_question?: string;
  hidden_analysis?: string;
  done?: boolean;
  medical_summary?: string;
  recommended_specialties?: string[];
}

export default function Chatbot() {
  const router = useRouter();

  /*──────────────  State  ─────────────*/
  const [lang, setLang] = useState<Locale>("zh_CN");
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [analysisDebug, setAnalysisDebug] = useState("");
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [pendingPlainSummary, setPendingPlainSummary] = useState("");
  const [showOtherResponse, setShowOtherResponse] = useState(false);
  const text = UI_TEXT[lang];

  /*──────────────  Restore / persist chat  ─────────────*/
  useEffect(() => {
    const ts = sessionStorage.getItem(CHAT_HISTORY_TIMESTAMP_KEY);
    if (ts && Date.now() - Number(ts) < SESSION_DURATION) {
      const h = sessionStorage.getItem(CHAT_HISTORY_KEY);
      if (h) setMessages(JSON.parse(h));
    } else {
      sessionStorage.removeItem(CHAT_HISTORY_KEY);
      sessionStorage.removeItem(CHAT_HISTORY_TIMESTAMP_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    sessionStorage.setItem(CHAT_HISTORY_TIMESTAMP_KEY, Date.now().toString());
  }, [messages]);

  /*──────────────  Helpers  ─────────────*/
  const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const typeText = (textToType: string, hidden?: string) => {
    const messageId = generateId();
    let current = "";
    let i = 0;
    const timer = setInterval(() => {
      current += textToType[i];
      setMessages((prev) => {
        const next = [...prev];
        if (next.length === 0 || next[next.length - 1].role !== "assistant") {
          next.push({ id: messageId, role: "assistant", content: current, hidden_analysis: hidden });
        } else {
          next[next.length - 1].content = current;
        }
        return next;
      });
      i += 1;
      if (i >= textToType.length) clearInterval(timer);
    }, 35);
  };

  const sendToBackend = async (
    history: Message[],
    approval: boolean | null = null
  ): Promise<BackendResponse | null> => {
    setIsLoading(true);
    try {
      const resp = await fetch("http://34.171.117.210:5000/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, approval, lang, debug: debugMode }),
      });
      if (!resp.ok) throw new Error("Network response was not ok");
      return (await resp.json()) as BackendResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "assistant", content: `Error: ${msg}` },
      ]);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /*──────────────  Submit  ─────────────*/
  const handleSubmit = async (evt?: FormEvent, overrideInput?: string) => {
    evt?.preventDefault();
    const inputText = (overrideInput ?? userInput).trim();
    if (!inputText) return;

    const userMsg: Message = { id: generateId(), role: "user", content: inputText };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setUserInput("");
    setShowOtherResponse(false);

    const data = await sendToBackend(newHistory);
    if (!data) return;

    setConfidence(data.confidence_level ?? 0);

    if (data.needsApproval) {
      setPendingPlainSummary(data.plain_summary ?? "");
      setApprovalModalOpen(true);
    } else if (data.next_question) {
      typeText(data.next_question, data.hidden_analysis);
    }

    if (debugMode) {
      setAnalysisDebug(data.hidden_analysis ?? "");
    }
  };

  /*──────────────  Regenerate  ─────────────*/
  const regenerateResponse = async () => {
    // 找到上一次 assistant 的索引
    const lastAI = messages.map((m) => m.role).lastIndexOf("assistant");
    if (lastAI < 0) return;
    const history = messages.slice(0, lastAI);
    setMessages(history);

    const data = await sendToBackend(history);
    if (!data) return;

    setConfidence(data.confidence_level ?? 0);

    if (data.needsApproval) {
      setPendingPlainSummary(data.plain_summary ?? "");
      setApprovalModalOpen(true);
    } else if (data.next_question) {
      typeText(data.next_question, data.hidden_analysis);
    }

    if (debugMode) {
      setAnalysisDebug(data.hidden_analysis ?? "");
    }
  };

  /*──────────────  Approval  ─────────────*/
  const handleApproval = async (approved: boolean) => {
    setApprovalModalOpen(false);
    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: pendingPlainSummary,
    };
    const history = [...messages, assistantMsg];

    const data = await sendToBackend(history, approved);
    if (!data) return;

    if (approved && data.done) {
      const finalReport = {
        medicalSummary: data.medical_summary,
        plainSummary: data.plain_summary,
        recommendedSpecialties: data.recommended_specialties,
      };
      sessionStorage.setItem("finalReport", JSON.stringify(finalReport));
      router.push("/report");
    } else if (data.next_question) {
      typeText(data.next_question, data.hidden_analysis);
    }
    setPendingPlainSummary("");
  };

  /*──────────────  Quick reply  ─────────────*/
  const quickReply = (value: string) => handleSubmit(undefined, value);

  /*──────────────  Utils  ─────────────*/
  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(CHAT_HISTORY_KEY);
    sessionStorage.removeItem(CHAT_HISTORY_TIMESTAMP_KEY);
  };

  /*──────────────────────────  Render  ──────────────────────────*/
  return (
    <div className={styles.container}>
      {/* Language switch */}
      <div className={styles.langSwitch}>
        <label>
          {text.selectLang}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Locale)}
          >
            <option value="zh_CN">简体中文</option>
            <option value="zh_TW">繁體中文</option>
            <option value="en">English</option>
            <option value="id">Bahasa Indonesia</option>
          </select>
        </label>
      </div>

      {/* Chat window */}
      <div className={styles.chatWindow}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubble} ${
              m.role === "user" ? styles.userBubble : styles.botBubble
            }`}
          >
            {m.content}
            {debugMode && m.hidden_analysis && (
              <pre className={styles.debugBox}>{m.hidden_analysis}</pre>
            )}
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.bubble} ${styles.botBubble}`}>
            {text.thinking}
          </div>
        )}
      </div>

      {/* Debug panel */}
      {debugMode && (
        <div className={styles.debugPanel}>
          <p>
            {text.conf}
            {(confidence * 100).toFixed(1)}%
          </p>
          {analysisDebug && <pre className={styles.debugBox}>{analysisDebug}</pre>}
        </div>
      )}

      {/* Quick replies */}
      <div className={styles.quickRow}>
        <button onClick={() => quickReply(text.yes)} className={styles.quickBtn}>
          {text.yes}
        </button>
        <button onClick={() => quickReply(text.no)} className={styles.quickBtn}>
          {text.no}
        </button>
        <button
          onClick={() => setShowOtherResponse(true)}
          className={styles.quickBtn}
        >
          {text.else}
        </button>
      </div>

      {/* User input */}
      {showOtherResponse && (
        <form onSubmit={(e) => handleSubmit(e)} className={styles.inputRow}>
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={text.inputPlaceholder}
          />
          <button type="submit" disabled={isLoading}>
            Send
          </button>
        </form>
      )}

      {/* Footer buttons */}
      <div className={styles.actionRow}>
        <button onClick={() => router.push("/")} className={styles.helperBtn}>
          {text.home}
        </button>
        <button onClick={clearChat} className={styles.helperBtn}>
          {text.clearChat}
        </button>
        <button onClick={regenerateResponse} className={styles.helperBtn}>
          {text.regenerate}
        </button>
        <button onClick={() => router.push("/map")} className={styles.helperBtn}>
          {text.map}
        </button>
        <button
          onClick={() => setDebugMode((v) => !v)}
          className={styles.helperBtn}
        >
          {debugMode ? text.hideDebug : text.showDebug}
        </button>
      </div>

      {/* Approval modal */}
      {approvalModalOpen && (
        <div className={styles.modalMask}>
          <div className={styles.modalCard}>
            <h3>{text.confirmSummary}</h3>
            <p>{pendingPlainSummary}</p>
            <div className={styles.modalBtns}>
              <button onClick={() => handleApproval(true)}>
                {text.approvalYes}
              </button>
              <button onClick={() => handleApproval(false)}>
                {text.approvalNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
