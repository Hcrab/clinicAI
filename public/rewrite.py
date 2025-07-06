#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os

INPUT = "clinic_data.json"
OUTPUT = "clinic_data_i18n.json"

# 完整的科室四语映射
DEPARTMENT_I18N = {
    "外科":                   {"zh_CN":"外科",             "zh_TW":"外科",             "en":"Surgery",                                       "id":"Bedah"},
    "小儿外科":               {"zh_CN":"小儿外科",         "zh_TW":"小兒外科",         "en":"Pediatric Surgery",                            "id":"Bedah Anak"},
    "普通科":                 {"zh_CN":"普通科",           "zh_TW":"普通科",           "en":"General Practice",                             "id":"Praktik Umum"},
    "肠胃肝脏科":             {"zh_CN":"肠胃肝脏科",       "zh_TW":"腸胃肝臟科",       "en":"Gastroenterology & Hepatology",                 "id":"Gastroenterologi & Hepatologi"},
    "精神科":                 {"zh_CN":"精神科",           "zh_TW":"精神科",           "en":"Psychiatry",                                    "id":"Psikiatri"},
    "临床心理学":             {"zh_CN":"临床心理学",       "zh_TW":"臨床心理學",       "en":"Clinical Psychology",                          "id":"Psikologi Klinis"},
    "内科":                   {"zh_CN":"内科",             "zh_TW":"內科",             "en":"Internal Medicine",                            "id":"Penyakit Dalam"},
    "耳鼻喉科":               {"zh_CN":"耳鼻喉科",         "zh_TW":"耳鼻喉科",         "en":"Otolaryngology",                                "id":"Telinga Hidung Tenggorokan"},
    "家庭医学":               {"zh_CN":"家庭医学",         "zh_TW":"家庭醫學",         "en":"Family Medicine",                              "id":"Kedokteran Keluarga"},
    "放射科":                 {"zh_CN":"放射科",           "zh_TW":"放射科",           "en":"Radiology",                                     "id":"Radiologi"},
    "麻醉科":                 {"zh_CN":"麻醉科",           "zh_TW":"麻醉科",           "en":"Anesthesiology",                                "id":"Anestesiologi"},
    "病理学":                 {"zh_CN":"病理学",           "zh_TW":"病理學",           "en":"Pathology",                                     "id":"Patologi"},
    "眼科":                   {"zh_CN":"眼科",             "zh_TW":"眼科",             "en":"Ophthalmology",                                 "id":"Oftalmologi"},
    "整形外科":               {"zh_CN":"整形外科",         "zh_TW":"整形外科",         "en":"Plastic Surgery",                               "id":"Bedah Plastik"},
    "骨科":                   {"zh_CN":"骨科",             "zh_TW":"骨科",             "en":"Orthopedics",                                   "id":"Ortopedi"},
    "泌尿外科":               {"zh_CN":"泌尿外科",         "zh_TW":"泌尿外科",         "en":"Urology",                                       "id":"Urologi"},
    "临床肿瘤科":             {"zh_CN":"临床肿瘤科",       "zh_TW":"臨床腫瘤科",       "en":"Clinical Oncology",                             "id":"Onkologi Klinis"},
    "血液及血液肿瘤科":       {"zh_CN":"血液及血液肿瘤科", "zh_TW":"血液及血液腫瘤科", "en":"Hematology & Hemato-oncology",                  "id":"Hematologi & Hemato-onkologi"},
    "妇产科":                 {"zh_CN":"妇产科",           "zh_TW":"婦產科",           "en":"Obstetrics & Gynecology",                       "id":"Obstetri & Ginekologi"},
    "内分泌及糖尿科":         {"zh_CN":"内分泌及糖尿科",   "zh_TW":"內分泌及糖尿科",   "en":"Endocrinology & Diabetology",                   "id":"Endokrinologi & Diabetologi"},
    "风湿病科":               {"zh_CN":"风湿病科",         "zh_TW":"風濕病科",         "en":"Rheumatology",                                  "id":"Reumatologi"},
    "神经外科":               {"zh_CN":"神经外科",         "zh_TW":"神經外科",         "en":"Neurosurgery",                                  "id":"Bedah Saraf"},
    "核子医学科":             {"zh_CN":"核子医学科",       "zh_TW":"核子醫學科",       "en":"Nuclear Medicine",                              "id":"Kedokteran Nuklir"},
    "临床微生物及感染学":     {"zh_CN":"临床微生物及感染学","zh_TW":"臨床微生物及感染學","en":"Clinical Microbiology & Infectious Diseases",    "id":"Mikrobiologi Klinis & Penyakit Infeksi"},
    "急症科":                 {"zh_CN":"急症科",           "zh_TW":"急症科",           "en":"Emergency Medicine",                            "id":"Kedokteran Darurat"},
    "儿科":                   {"zh_CN":"儿科",             "zh_TW":"兒科",             "en":"Pediatrics",                                    "id":"Pediatri"},
    "复康科":                 {"zh_CN":"复康科",           "zh_TW":"復康科",           "en":"Rehabilitation",                                 "id":"Rehabilitasi"},
    "脑神经科":               {"zh_CN":"脑神经科",         "zh_TW":"腦神經科",         "en":"Neurology",                                     "id":"Neurologi"},
    "心脏科":                 {"zh_CN":"心脏科",           "zh_TW":"心臟科",           "en":"Cardiology",                                    "id":"Kardiologi"},
    "肾病科":                 {"zh_CN":"肾病科",           "zh_TW":"腎病科",           "en":"Nephrology",                                    "id":"Nefrologi"},
    "呼吸系统科":             {"zh_CN":"呼吸系统科",       "zh_TW":"呼吸系統科",       "en":"Pulmonology",                                   "id":"Pulmonologi"},
    "牙科":                   {"zh_CN":"牙科",             "zh_TW":"牙科",             "en":"Dentistry",                                     "id":"Kedokteran Gigi"},
    "物理治疗":               {"zh_CN":"物理治疗",         "zh_TW":"物理治療",         "en":"Physiotherapy",                                 "id":"Fisioterapi"},
    "免疫及过敏病科":         {"zh_CN":"免疫及过敏病科",   "zh_TW":"免疫及過敏病科",   "en":"Immunology & Allergy",                          "id":"Imunologi & Alergi"},
    "疼痛医学":               {"zh_CN":"疼痛医学",         "zh_TW":"疼痛醫學",         "en":"Pain Medicine",                                 "id":"Ilmu Nyeri"},
    "皮肤及性病科":           {"zh_CN":"皮肤及性病科",     "zh_TW":"皮膚及性病科",     "en":"Dermatology & Venereology",                     "id":"Dermatologi & Venereologi"},
    "老人科":                 {"zh_CN":"老人科",           "zh_TW":"老人科",           "en":"Geriatrics",                                    "id":"Geriatri"},
    "社会医学":               {"zh_CN":"社会医学",         "zh_TW":"社會醫學",         "en":"Social Medicine",                               "id":"Kedokteran Sosial"},
    "中医":                   {"zh_CN":"中医",             "zh_TW":"中醫",             "en":"Traditional Chinese Medicine",                  "id":"Pengobatan Tradisional Tiongkok"},
    "儿童免疫、过敏及传染病科":{"zh_CN":"儿童免疫、过敏及传染病科","zh_TW":"兒童免疫、過敏及傳染病科","en":"Pediatric Immunology, Allergy & Infectious Diseases","id":"Imunologi Anak, Alergi & Penyakit Infeksi"},
    "营养学":                 {"zh_CN":"营养学",           "zh_TW":"營養學",           "en":"Nutrition",                                     "id":"Gizi"},
    "心胸肺外科":             {"zh_CN":"心胸肺外科",       "zh_TW":"心胸肺外科",       "en":"Thoracic Surgery",                              "id":"Bedah Toraks"},
    "内科肿瘤科":             {"zh_CN":"内科肿瘤科",       "zh_TW":"內科腫瘤科",       "en":"Medical Oncology",                              "id":"Onkologi Medis"},
    "妇科肿瘤科":             {"zh_CN":"妇科肿瘤科",       "zh_TW":"婦科腫瘤科",       "en":"Gynecologic Oncology",                          "id":"Onkologi Ginekologi"},
    "解剖病理学":             {"zh_CN":"解剖病理学",       "zh_TW":"解剖病理學",       "en":"Anatomical Pathology",                          "id":"Patologi Anatomi"},
    "感染及传染病科":         {"zh_CN":"感染及传染病科",   "zh_TW":"感染及傳染病科",   "en":"Infectious Diseases",                           "id":"Penyakit Infeksi"},
    "法医病理学":             {"zh_CN":"法医病理学",       "zh_TW":"法醫病理學",       "en":"Forensic Pathology",                            "id":"Patologi Forensik"},
    "生殖医学科":             {"zh_CN":"生殖医学科",       "zh_TW":"生殖醫學科",       "en":"Reproductive Medicine",                         "id":"Kedokteran Reproduksi"},
    "职业医学":               {"zh_CN":"职业医学",         "zh_TW":"職業醫學",         "en":"Occupational Medicine",                        "id":"Kedokteran Kerja"},
    "牙周治疗科":             {"zh_CN":"牙周治疗科",       "zh_TW":"牙周治療科",       "en":"Periodontics",                                  "id":"Periodontia"},
    "修复齿科专科":           {"zh_CN":"修复齿科专科",     "zh_TW":"修復齒科專科",     "en":"Prosthodontics",                                "id":"Prostodonsia"},
    "口腔颌面外科":           {"zh_CN":"口腔颌面外科",     "zh_TW":"口腔顎面外科",     "en":"Oral & Maxillofacial Surgery",                  "id":"Bedah Mulut & Maksilofasial"},
}

# 语言映射保持不变
LANGUAGE_I18N = {
    "上海话":     {"zh_CN":"上海话",    "zh_TW":"上海話",    "en":"Shanghainese",    "id":"Bahasa Shanghai"},
    "印尼语":     {"zh_CN":"印尼语",    "zh_TW":"印尼語",    "en":"Indonesian",      "id":"Bahasa Indonesia"},
    "台湾话":     {"zh_CN":"台湾话",    "zh_TW":"台灣話",    "en":"Taiwanese",       "id":"Bahasa Taiwan"},
    "客家话":     {"zh_CN":"客家话",    "zh_TW":"客家話",    "en":"Hakka",           "id":"Bahasa Hakka"},
    "广东话":     {"zh_CN":"广东话",    "zh_TW":"廣東話",    "en":"Cantonese",       "id":"Bahasa Kanton"},
    "德语":       {"zh_CN":"德语",      "zh_TW":"德語",      "en":"German",          "id":"Bahasa Jerman"},
    "日语":       {"zh_CN":"日语",      "zh_TW":"日語",      "en":"Japanese",        "id":"Bahasa Jepang"},
    "普通话":     {"zh_CN":"普通话",    "zh_TW":"普通話",    "en":"Mandarin",        "id":"Bahasa Mandarin"},
    "法语":       {"zh_CN":"法语",      "zh_TW":"法語",      "en":"French",          "id":"Bahasa Prancis"},
    "泰语":       {"zh_CN":"泰语",      "zh_TW":"泰語",      "en":"Thai",            "id":"Bahasa Thailand"},
    "潮州话":     {"zh_CN":"潮州话",    "zh_TW":"潮州話",    "en":"Teochew",         "id":"Bahasa Teochew"},
    "福州话":     {"zh_CN":"福州话",    "zh_TW":"福州話",    "en":"Fuzhounese",      "id":"Bahasa Fuzhou"},
    "福建话":     {"zh_CN":"福建话",    "zh_TW":"福建話",    "en":"Hokkien",         "id":"Bahasa Hokkien"},
    "福建话(厦门)": {"zh_CN":"福建话(厦门)","zh_TW":"福建話(廈門)","en":"Xiamen Hokkien",  "id":"Hokkien Xiamen"},
    "福建话(闽南)": {"zh_CN":"福建话(闽南)","zh_TW":"福建話(閩南)","en":"Minnan Hokkien",  "id":"Hokkien Minnan"},
    "英语":       {"zh_CN":"英语",      "zh_TW":"英語",      "en":"English",         "id":"Bahasa Inggris"},
}

def main():
    if not os.path.isfile(INPUT):
        raise FileNotFoundError(f"找不到文件：{INPUT}")

    with open(INPUT, "r", encoding="utf-8") as f:
        clinics = json.load(f)

    for clinic in clinics:
        for doc in clinic.get("doctors", []):
            spec = doc.get("specialty", "").strip()
            # 填充科室 i18n
            doc["specialty_i18n"] = DEPARTMENT_I18N.get(
                spec,
                {"zh_CN": spec, "zh_TW": spec, "en": spec, "id": spec}
            )
            # 填充语言 i18n
            langs = doc.get("languages", [])
            doc["languages_i18n"] = [
                LANGUAGE_I18N.get(
                    l.strip(),
                    {"zh_CN": l, "zh_TW": l, "en": l, "id": l}
                )
                for l in langs if l.strip()
            ]

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(clinics, f, ensure_ascii=False, indent=2)

    print(f"已生成多语言文件：{OUTPUT}")

if __name__ == "__main__":
    main()
