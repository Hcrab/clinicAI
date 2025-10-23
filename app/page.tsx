

"use client";


import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const LOCALES = ["zh_CN", "zh_TW", "en", "id"] as const;
  type Locale = typeof LOCALES[number];
  const [lang, setLang] = useState<Locale>("en");
  const [langModalOpen, setLangModalOpen] = useState(false);
  const LOCALE_LABELS: Record<Locale, string> = {
    zh_CN: "简体中文",
    zh_TW: "繁體中文",
    en: "English",
    id: "Bahasa Indonesia",
  };

  const T = useMemo(() => ({
    zh_CN: {
      title: "欢迎使用 ClinicAI!",
      sub: "一站式的医疗健康助手",
      chatbot: "问诊聊天",
      chatbotDesc: "与智能助手对话，获得就医建议。",
      map: "世界地图",
      mapDesc: "使用地图探索附近医疗设施。",
      goChatbot: "进入 Chatbot",
      goMap: "进入地图",
      langLabel: "界面语言：",
    },
    zh_TW: {
      title: "歡迎使用 ClinicAI!",
      sub: "一站式醫療健康助理",
      chatbot: "問診聊天",
      chatbotDesc: "與智慧助理對話，取得就醫建議。",
      map: "世界地圖",
      mapDesc: "使用地圖探索附近醫療設施。",
      goChatbot: "前往 Chatbot",
      goMap: "前往地圖",
      langLabel: "介面語言：",
    },
    en: {
      title: "Welcome to ClinicAI!",
      sub: "Your one‑stop healthcare assistant.",
      chatbot: "Chatbot",
      chatbotDesc: "Interact with the assistant for care guidance.",
      map: "World Map",
      mapDesc: "Use the map and discover nearby facilities.",
      goChatbot: "Go to Chatbot",
      goMap: "Go to Map",
      langLabel: "Language:",
    },
    id: {
      title: "Selamat datang di ClinicAI!",
      sub: "Asisten kesehatan serba ada Anda.",
      chatbot: "Chatbot",
      chatbotDesc: "Berinteraksi untuk panduan perawatan.",
      map: "Peta Dunia",
      mapDesc: "Gunakan peta dan temukan fasilitas terdekat.",
      goChatbot: "Buka Chatbot",
      goMap: "Buka Peta",
      langLabel: "Bahasa:",
    },
  } as const)[lang], [lang]);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && sessionStorage.getItem("uiLang")) as Locale | null;
    if (saved && (LOCALES as readonly string[]).includes(saved)) setLang(saved);
  }, []);

  const setLangAndPersist = (l: Locale) => {
    setLang(l);
    if (typeof window !== "undefined") sessionStorage.setItem("uiLang", l);
  };

  const hrefChat = `/chatbot?lang=${lang}`;
  const hrefMap = `/map?lang=${lang}`;
  return (
    <div className="home-container">
      <div className="header">
        <button className="langBtn" onClick={() => setLangModalOpen(true)}>
          🌐 {LOCALE_LABELS[lang]}
        </button>
        <h1>{T.title}</h1>
        <p className="subheading">{T.sub}</p>
      </div>

      <div className="feature-blocks">
        <div className="feature-card">
          <h2 className="feature-title">{T.chatbot}</h2>
          <p className="feature-description">{T.chatbotDesc}</p>
          <Link href={hrefChat} className="button">
            {T.goChatbot}
          </Link>
        </div>

        <div className="feature-card">
          <h2 className="feature-title">{T.map}</h2>
          <p className="feature-description">{T.mapDesc}</p>
          <Link href={hrefMap} className="button">
            {T.goMap}
          </Link>
        </div>
      </div>

      {/* Inline styles kept for simplicity; feel free to move into CSS Module. */}
      <style jsx>{`
        .home-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          width: 100%;
          padding: 20px;
          background: #f0f8ff;
          font-family: Arial, sans-serif;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .langBtn {
          background: #ffffff;
          border: 1px solid #e6eef5;
          color: #2b6e7f;
          border-radius: 10px;
          padding: 8px 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
          cursor: pointer;
          margin-bottom: 10px;
        }
        .langBtn:hover { background: #f7fbff; }
        .header h1 {
          font-size: 2.5rem;
          color: #479eb4;
        }
        .subheading {
          font-size: 1.2rem;
          color: #6fc3f7;
        }

        .feature-blocks {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: center;
        }

        .feature-card {
          background: #fff;
          border-radius: 10px;
          padding: 20px;
          width: 300px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-10px);
        }

        .feature-title {
          font-size: 1.5rem;
          color: #479eb4;
          margin-bottom: 10px;
        }
        .feature-description {
          font-size: 1rem;
          color: #6c757d;
          margin-bottom: 20px;
        }

        .button {
          display: inline-block;
          padding: 12px 20px;
          background: #6fc3f7;
          color: #fff;
          border-radius: 5px;
          text-decoration: none;
          transition: background 0.3s ease;
        }
        .button:hover {
          background: #479eb4;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header h1 {
            font-size: 2rem;
          }
          .feature-card {
            width: 100%;
          }
          .feature-title {
            font-size: 1.3rem;
          }
        }

        /* Modal */
        .modalMask {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
        }
        .modalCard {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          width: 90%;
          max-width: 360px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.18);
        }
        .modalTitle { margin: 0 0 12px; color: #2b6e7f; font-size: 1.1rem; }
        .modalOptions { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 10px; }
        .opt {
          padding: 10px 12px;
          border: 1px solid #e6eef5;
          border-radius: 10px;
          cursor: pointer;
          background: #f8fcff;
        }
        .opt:hover { background: #eef7ff; }
        .modalClose { width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid #e6eef5; background: #fff; cursor: pointer; }
      `}</style>
      {langModalOpen && (
        <div className="modalMask" onClick={() => setLangModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3 className="modalTitle">{T.langLabel}</h3>
            <div className="modalOptions">
              {LOCALES.map((l) => (
                <div
                  key={l}
                  className="opt"
                  onClick={() => { setLangAndPersist(l as Locale); setLangModalOpen(false); }}
                >
                  {LOCALE_LABELS[l as Locale]}
                </div>
              ))}
            </div>
            <button className="modalClose" onClick={() => setLangModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
