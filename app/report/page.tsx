// Report.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import languages from "../locales/i18n";
import styles from "./Report.module.css";
/* 引入科室四语映射文件（与本文件同目录） */
import specI18n from "./department_i18n.json";

export default function ReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [targetLang, setTargetLang] = useState("en");          // default language
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());

  const lang = languages[targetLang];                          // UI 文本

  /* ----------------  读取 sessionStorage ---------------- */
  useEffect(() => {
    const stored = sessionStorage.getItem("finalReport");
    if (stored) {
      const data = JSON.parse(stored);
      setReportData(data);
      // 初始化选中所有部门（原始 key 为 data.recommendedSpecialties[].科目）
      const initial = new Set((data.recommendedSpecialties || []).map((s: any) => s.科目));
      setSelectedDepartments(initial);
    }
  }, []);

  /* ----------------  翻译按钮 ---------------- */
  const handleTranslate = async () => {
    if (!reportData) return;
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const resp = await fetch(`${backend}/api/translate_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medical_summary:         reportData.medicalSummary,
          plain_summary:           reportData.plainSummary,
          recommended_specialties: reportData.recommendedSpecialties,
          targetLang
        })
      });
      if (!resp.ok) throw new Error("翻译接口返回错误");

      const data = await resp.json();
      if (data.error) return alert("翻译失败: " + data.error);

      const updated = {
        ...reportData,
        medicalSummary:         data.medical_summary,
        plainSummary:           data.plain_summary,
        recommendedSpecialties: data.recommended_specialties
      };
      setReportData(updated);
      sessionStorage.setItem("finalReport", JSON.stringify(updated));

      // 更新选中列表
      const newSet = new Set((data.recommended_specialties || []).map((s: any) => s.科目));
      setSelectedDepartments(newSet);
    } catch (err: any) {
      alert("翻译失败: " + err.message);
    }
  };

  /* ----------------  切换选中部门 ---------------- */
  const toggleDepartment = (dep: string) => {
    setSelectedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(dep)) next.delete(dep);
      else next.add(dep);
      return next;
    });
  };

  /* ----------------  跳转地图 ---------------- */
  const goToMap = () => {
    const deps = Array.from(selectedDepartments);
    if (!deps.length) return alert(lang.noDepartmentsSelected || "请选择至少一个部门。");
    router.push(`/map?departments=${encodeURIComponent(deps.join(","))}`);
  };

  /* ----------------  Loading 占位 ---------------- */
  if (!reportData) return <div>Loading report…</div>;

  /* ----------------  决定使用哪个语言字段——Malay(ms) 对应 JSON 里的 id ---------------- */
  const deptLangKey = targetLang === "ms" ? "id" : (targetLang as keyof typeof specI18n[string]);

  /* ----------------  UI ---------------- */
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{lang.title}</h1>

      {/* 语言切换 & 翻译按钮 */}
      <div style={{ marginBottom: 10 }}>
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          <option value="en">English</option>
          <option value="zh_CN">简体中文</option>
          <option value="zh_TW">繁体中文</option>
          <option value="ms">Bahasa Melayu</option>
        </select>
        <button onClick={handleTranslate} className={styles.downloadBtn}>
          {lang.translateButton}
        </button>
      </div>

      {/* 选项卡 */}
      <div className={styles.tabs}>
        <button onClick={() => setActiveTab(0)} className={activeTab === 0 ? styles.activeTab : ""}>
          {lang.plainReport}
        </button>
        <button onClick={() => setActiveTab(1)} className={activeTab === 1 ? styles.activeTab : ""}>
          {lang.medicalReport}
        </button>
        <button onClick={() => setActiveTab(2)} className={activeTab === 2 ? styles.activeTab : ""}>
          {lang.recommendedSpecialties}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 0 && (
          <section className={styles.reportSection}>
            <h2>{lang.plainReport}</h2>
            <p>{reportData.plainSummary}</p>
          </section>
        )}
        {activeTab === 1 && (
          <section className={styles.reportSection}>
            <h2>{lang.medicalReport}</h2>
            <p>{reportData.medicalSummary}</p>
          </section>
        )}
        {activeTab === 2 && (
          <section className={styles.reportSection}>
            <h2>{lang.recommendedSpecialties}</h2>
            <ul>
              {reportData.recommendedSpecialties.map((item: any, i: number) => (
                <li key={i} className={styles.departmentItem}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedDepartments.has(item.科目)}
                      onChange={() => toggleDepartment(item.科目)}
                    />
                    <span style={{ marginLeft: 8 }}>
                      {/* 用映射 JSON 中的翻译，否则回退到原文 */}
                      {specI18n[item.科目]?.[deptLangKey] || item.科目} – {item.置信度}%
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* 下载 / 地图按钮 */}
      <div className={styles.downloadSection}>
        <button className={styles.downloadBtn}>{lang.downloadButton}</button>
        <button className={styles.mapButton} onClick={goToMap}>
          {lang.mapButton}
        </button>
      </div>
    </div>
  );
}
