// map.tsx
"use client";
/* eslint-disable @typescript-eslint/no-require-imports */

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import dynamic from "next/dynamic";
// 只在浏览器端加载聚合组件，SSR 阶段不会执行 → 不会再报 window/exports 未定义
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster").then((m) => m.default),
  { ssr: false }
);

import NextDynamic from "next/dynamic";
  
import {
  Suspense,
  useEffect,
  useState,
  useMemo,
  Fragment,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./Map.module.css";

/* 部门四语翻译字典 */
import specI18n from "./department_i18n.json";

/* Leaflet 类型 */
import type { LeafletEvent } from "leaflet";

/* ────── 动态导入 MapInner ────── */
const MapComponent = NextDynamic(
  () => Promise.resolve(MapInner),
  { ssr: false }
);

export default function MapPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
      <MapComponent />
    </Suspense>
  );
}

/* ────── 类型定义 ────── */
interface Doctor {
  name: string;
  specialty: string;
  languages: string[];
  languages_i18n?: Record<string, string>[];
  _langMap?: Record<string, Record<string, string>>;
}

interface Clinic {
  clinic_id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  doctors: Doctor[];
}

/* ────── 主组件 ────── */
function MapInner() {
  /* 延迟加载 Leaflet / React-Leaflet 以绕过 SSR */
  const L = require("leaflet") as typeof import("leaflet");
  const {
    MapContainer,
    TileLayer,
    Marker,
    useMap,
  } = require("react-leaflet") as typeof import("react-leaflet");
  // 解决 “window / exports is not defined” 在 SSR 阶段被执行的问题
  // 放在 function MapInner() 内、最前面的那几行工具 require 之后          // 服务端渲染时给个空占位组件

  const router = useRouter();
  const searchParams = useSearchParams();

  /* ─────────── Leaflet 默认图标修复 ─────────── */
  const defaultIcon = new L.Icon({
    iconUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  L.Marker.prototype.options.icon = defaultIcon;

  const userIcon = new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    iconRetinaUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  /* ─────────── State ─────────── */
  const [allClinics, setAllClinics] = useState<Clinic[]>([]);
  const [allSpecs, setAllSpecs] = useState<string[]>([]);
  const [allLangs, setAllLangs] = useState<string[]>([]);
  const [globalSpecMap] = useState<Record<
    string,
    Record<string, string>
  >>(specI18n);
  const [globalLangMap, setGlobalLangMap] = useState<
    Record<string, Record<string, string>>
  >({});

  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

  /* 默认以北角作为初始位置 */
  const [userLocation, setUserLocation] = useState<[number, number]>([
    22.2935, 114.2,
  ]);
  const [manualMode, setManualMode] = useState(false);
  const [radius, setRadius] = useState(5);

  const [selectedClinic, setSelectedClinic] =
    useState<Clinic | null>(null);
  const [modalFont, setModalFont] = useState(15);
  const [viewMode, setViewMode] =
    useState<"map" | "list">("map");
  const [filterOpen, setFilterOpen] = useState(false);

  const [tagModalType, setTagModalType] = useState<
    "spec" | "lang" | null
  >(null);
  const [tempTags, setTempTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  /* ─────────── UI 语言切换 ─────────── */
  const LOCALES = ["zh_CN", "zh_TW", "en", "id"] as const;
  type Locale = typeof LOCALES[number];
  const LOCALE_LABELS: Record<Locale, string> = {
    zh_CN: "简体中文",
    zh_TW: "繁體中文",
    en: "English",
    id: "Bahasa Indonesia",
  };
  const [lang, setLang] = useState<Locale>("zh_CN");
  const [langModalOpen, setLangModalOpen] = useState(false);

  const T = {
    zh_CN: {
      filters: "筛选条件",
      specialties: "科室",
      languages: "语言",
      maxDist: "最大距离 (km)",
      locate: "定位中…",
      drag: "拖动绿色图钉设置位置",
      back: "← 返回 Chatbot",
      viewList: "列表",
      viewMap: "地图",
      noResult: "未找到符合条件的诊所",
      doctors: "医生",
      addr: "地址",
      phone: "电话",
      font: "字体：",
    },
    zh_TW: {
      filters: "篩選條件",
      specialties: "科別",
      languages: "語言",
      maxDist: "最大距離 (km)",
      locate: "定位中…",
      drag: "拖動綠色圖釘設定位置",
      back: "← 返回 Chatbot",
      viewList: "列表",
      viewMap: "地圖",
      noResult: "未找到符合條件的診所",
      doctors: "醫生",
      addr: "地址",
      phone: "電話",
      font: "字體：",
    },
    en: {
      filters: "Filters",
      specialties: "Specialties",
      languages: "Languages",
      maxDist: "Max distance (km)",
      locate: "Detecting…",
      drag: "Drag green pin to set your location",
      back: "← Back",
      viewList: "List",
      viewMap: "Map",
      noResult: "No clinic found",
      doctors: "Doctors",
      addr: "Address",
      phone: "Phone",
      font: "Font:",
    },
    id: {
      filters: "Filter",
      specialties: "Spesialisasi",
      languages: "Bahasa",
      maxDist: "Jarak maks (km)",
      locate: "Mendeteksi…",
      drag: "Seret pin hijau untuk lokasi",
      back: "← Kembali",
      viewList: "Daftar",
      viewMap: "Peta",
      noResult: "Tidak ada klinik ditemukan",
      doctors: "Dokter",
      addr: "Alamat",
      phone: "Telepon",
      font: "Ukuran:",
    },
  }[lang];

  /* ─────────── 数据加载 ─────────── */
  useEffect(() => {
    fetch("/clinic_data_i18n.json")
      .then(res => res.json())
      .then((data: Clinic[]) => {
        const clinics: Clinic[] = [];
        const specSet = new Set<string>();
        const langDict: Record<string, Record<string, string>> = {};

        data.forEach(cRaw => {
          /* 坐标校验 */
          const lat = parseFloat(
            String((cRaw as any).latitude)
          );
          const lon = parseFloat(
            String((cRaw as any).longitude)
          );
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            console.warn(
              "忽略坐标无效诊所:",
              cRaw.name
            );
            return;
          }

          const c: Clinic = {
            ...cRaw,
            latitude: lat,
            longitude: lon,
          };

          /* 收集科室 / 语言 */
          c.doctors.forEach(d => {
            specSet.add(d.specialty);
            if (
              Array.isArray(d.languages) &&
              Array.isArray(d.languages_i18n)
            ) {
              d._langMap = {};
              d.languages.forEach((orig, i) => {
                const mapping =
                  d.languages_i18n?.[i];
                if (mapping) {
                  d._langMap![orig] = mapping;
                  langDict[orig] = mapping;
                }
              });
            }
          });

          clinics.push(c);
        });

        setAllClinics(clinics);
        setAllSpecs([...specSet].sort());
        setAllLangs(Object.keys(langDict).sort());
        setGlobalLangMap(langDict);
      })
      .catch(console.error);
  }, []);

  /* ─────────── Geolocation ─────────── */
  useEffect(() => {
    if (!navigator.geolocation)
      return setManualMode(true);
    navigator.geolocation.getCurrentPosition(
      pos =>
        setUserLocation([
          pos.coords.latitude,
          pos.coords.longitude,
        ]),
      () => setManualMode(true)
    );
  }, []);

  /* ─────────── 预选科目 ─────────── */
  useEffect(() => {
    const deps = searchParams.get(
      "departments"
    );
    if (deps) {
      setSelectedSpecs(
        deps.split(",").filter(Boolean)
      );
      setFilterOpen(true);
    }
  }, [searchParams]);

  /* ─────────── 语言反查 ─────────── */
  const selectedLangKeys = useMemo(() => {
    return selectedLangs.map(trans => {
      const orig = Object.keys(
        globalLangMap
      ).find(
        k => globalLangMap[k][lang] === trans
      );
      return orig ?? trans;
    });
  }, [selectedLangs, globalLangMap, lang]);

  /* ─────────── 距离计算 ─────────── */
  const getDist = (
    la1: number,
    lo1: number,
    la2: number,
    lo2: number
  ) => {
    const R = 6371;
    const dLat =
      ((la2 - la1) * Math.PI) / 180;
    const dLng =
      ((lo2 - lo1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((la1 * Math.PI) / 180) *
        Math.cos((la2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return (
      R *
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      )
    );
  };

  /* ─────────── 过滤诊所 ─────────── */
  const filtered = useMemo(() => {
    return allClinics.filter(c => {
      if (
        selectedSpecs.length &&
        !c.doctors.some(d =>
          selectedSpecs.includes(d.specialty)
        )
      )
        return false;
      if (
        selectedLangKeys.length &&
        !c.doctors.some(d =>
          d.languages.some(l =>
            selectedLangKeys.includes(l)
          )
        )
      )
        return false;
      if (
        userLocation &&
        getDist(
          userLocation[0],
          userLocation[1],
          c.latitude,
          c.longitude
        ) > radius
      )
        return false;
      return true;
    });
  }, [
    allClinics,
    selectedSpecs,
    selectedLangKeys,
    userLocation,
    radius,
  ]);

  /* ─────────── 自动 FitBounds ─────────── */
  const FitBounds: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      if (filtered.length) {
        map.fitBounds(
          L.latLngBounds(
            filtered.map(c => [
              c.latitude,
              c.longitude,
            ])
          ),
          { padding: [40, 40] }
        );
      }
    }, [filtered]);
    return null;
  };

  /* ─────────── Modal helpers ─────────── */
  const openTagModal = (
    type: "spec" | "lang"
  ) => {
    setTagModalType(type);
    setTempTags(
      type === "spec"
        ? [...selectedSpecs]
        : [...selectedLangs]
    );
    setSearchTerm("");
  };
  const confirmTagModal = () => {
    if (tagModalType === "spec")
      setSelectedSpecs(tempTags);
    else setSelectedLangs(tempTags);
    setTagModalType(null);
  };

  /* ─────────── Render ─────────── */
  return (
    <Fragment>
      {/* 顶部栏 */}
      <header
        className={`${styles.topbar} ${
          filterOpen ? styles.open : ""
        }`}
      >
        <button
          className={styles.back}
          onClick={() => router.push("/chatbot")}
        >
          {T.back}
        </button>
        <button
          className={styles.toggleFilter}
          onClick={() =>
            setFilterOpen(o => !o)
          }
        >
          {T.filters}
        </button>
        <button
          className={styles.langBtn}
          onClick={() =>
            setLangModalOpen(true)
          }
        >
          🌐 {LOCALE_LABELS[lang]}
        </button>
        <div className={styles.viewSwitch}>
          <button
            className={
              viewMode === "map"
                ? styles.active
                : ""
            }
            onClick={() =>
              setViewMode("map")
            }
          >
            {T.viewMap}
          </button>
          <button
            className={
              viewMode === "list"
                ? styles.active
                : ""
            }
            onClick={() =>
              setViewMode("list")
            }
          >
            {T.viewList}
          </button>
        </div>
      </header>

      {/* 过滤面板 */}
      {filterOpen && (
        <section
          className={styles.filterPanel}
        >
          <h4>{T.specialties}</h4>
          <div className={styles.tagList}>
            {selectedSpecs.map(s => (
              <span
                key={s}
                className={styles.tag}
              >
                {globalSpecMap[s]?.[lang] ||
                  s}
              </span>
            ))}
          </div>
          <button
            className={styles.helperBtn}
            onClick={() =>
              openTagModal("spec")
            }
          >
            {T.specialties}
          </button>

          <h4
            style={{ marginTop: 12 }}
          >
            {T.languages}
          </h4>
          <div className={styles.tagList}>
            {selectedLangs.map(l => (
              <span
                key={l}
                className={styles.tag}
              >
                {globalLangMap[l]?.[lang] ||
                  l}
              </span>
            ))}
          </div>
          <button
            className={styles.helperBtn}
            onClick={() =>
              openTagModal("lang")
            }
          >
            {T.languages}
          </button>

          <h4
            style={{ marginTop: 12 }}
          >
            {T.maxDist}
          </h4>
          <input
            type="range"
            min="1"
            max="30"
            value={radius}
            onChange={evt =>
              setRadius(+evt.target.value)
            }
          />
          <span> {radius} km</span>
        </section>
      )}

      {/* 地图 / 列表 */}
      {viewMode === "map" ? (
        <main className={styles.mapPane}>
          <MapContainer
            center={userLocation}
            zoom={14}
            style={{
              height: "100%",
              width: "100%",
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />

            {/* 手动定位的绿色图钉 */}
            {manualMode && (
              <Marker
                icon={userIcon}
                position={userLocation}
                draggable
                eventHandlers={{
                  dragend: evt => {
                    const {
                      lat,
                      lng,
                    } = (
                      evt as LeafletEvent
                    ).target.getLatLng();
                    setUserLocation([
                      lat,
                      lng,
                    ]);
                  },
                }}
              />
            )}

            {/* ★★★★★ 聚合容器 ★★★★★ */}
            <MarkerClusterGroup
              chunkedLoading
              disableClusteringAtZoom={16}
            >
              {filtered.map(c => (
                <Marker
                  key={c.clinic_id}
                  position={[
                    c.latitude,
                    c.longitude,
                  ]}
                  eventHandlers={{
                    click: () =>
                      setSelectedClinic(c),
                  }}
                />
              ))}
            </MarkerClusterGroup>

            <FitBounds />
          </MapContainer>
        </main>
      ) : (
        <main className={styles.listPane}>
          {filtered.length === 0 && (
            <p
              className={styles.noResult}
            >
              {T.noResult}
            </p>
          )}
          {filtered.map(c => (
            <div
              key={c.clinic_id}
              className={styles.card}
              onClick={() =>
                setSelectedClinic(c)
              }
            >
              <h3>{c.name}</h3>
              <p>
                <strong>
                  {T.addr}
                </strong>{" "}
                {c.address}
              </p>
              <p>
                <strong>
                  {T.phone}
                </strong>{" "}
                {c.phone}
              </p>
            </div>
          ))}
        </main>
      )}

      {/* Tag / 语言选择 Modal */}
      {(tagModalType || langModalOpen) && (
        <div
          className={styles.selectorModalMask}
          onClick={() =>
            tagModalType
              ? setTagModalType(null)
              : setLangModalOpen(false)
          }
        >
          <div
            className={styles.modalCard}
            onClick={evt =>
              evt.stopPropagation()
            }
          >
            {tagModalType && (
              <Fragment>
                <h3>
                  {tagModalType === "spec"
                    ? T.specialties
                    : T.languages}
                </h3>
                <input
                  className={
                    styles.modalSearch
                  }
                  placeholder="搜索..."
                  value={searchTerm}
                  onChange={evt =>
                    setSearchTerm(
                      evt.target.value
                    )
                  }
                />
                <div
                  className={
                    styles.modalOptions
                  }
                >
                  {(tagModalType ===
                  "spec"
                    ? allSpecs
                    : allLangs)
                    .filter(s =>
                      s
                        .toLowerCase()
                        .includes(
                          searchTerm.toLowerCase()
                        )
                    )
                    .map(s => {
                      const checked =
                        tempTags.includes(
                          s
                        );
                      return (
                        <label
                          key={s}
                          className={
                            styles.label
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setTempTags(
                                prev =>
                                  prev.includes(
                                    s
                                  )
                                    ? prev.filter(
                                        x =>
                                          x !==
                                          s
                                      )
                                    : [
                                        ...prev,
                                        s,
                                      ]
                              )
                            }
                          />{" "}
                          {tagModalType ===
                          "spec"
                            ? globalSpecMap[
                                s
                              ]?.[lang] ||
                              s
                            : globalLangMap[
                                s
                              ]?.[lang] ||
                              s}
                        </label>
                      );
                    })}
                </div>
                <div
                  className={
                    styles.modalBtns
                  }
                >
                  <button
                    onClick={confirmTagModal}
                  >
                    确认
                  </button>
                  <button
                    onClick={() =>
                      setTagModalType(
                        null
                      )
                    }
                  >
                    取消
                  </button>
                </div>
              </Fragment>
            )}

            {langModalOpen && (
              <Fragment>
                <h3>{T.languages}</h3>
                <div
                  className={
                    styles.modalOptions
                  }
                >
                  {LOCALES.map(l => (
                    <div
                      key={l}
                      className={`${styles.label} ${
                        l === lang
                          ? styles.langActive
                          : ""
                      }`}
                      onClick={() => {
                        setLang(l);
                        setLangModalOpen(
                          false
                        );
                      }}
                    >
                      {
                        LOCALE_LABELS[
                          l
                        ]
                      }
                    </div>
                  ))}
                </div>
                <div
                  className={
                    styles.modalBtns
                  }
                >
                  <button
                    onClick={() =>
                      setLangModalOpen(
                        false
                      )
                    }
                  >
                    关闭
                  </button>
                </div>
              </Fragment>
            )}
          </div>
        </div>
      )}

      {/* 诊所详情 Modal */}
      {selectedClinic && (
        <div
          className={
            styles.clinicModalMask
          }
          onClick={() =>
            setSelectedClinic(null)
          }
        >
          <div
            className={styles.modalCard}
            onClick={evt =>
              evt.stopPropagation()
            }
          >
            <button
              className={styles.close}
              onClick={() =>
                setSelectedClinic(null)
              }
            >
              ×
            </button>
            <h2
              style={{
                fontSize: modalFont,
              }}
            >
              {selectedClinic.name}
            </h2>
            <p
              style={{
                fontSize: modalFont,
              }}
            >
              <strong>
                {T.addr}
              </strong>{" "}
              {selectedClinic.address}
            </p>
            <p
              style={{
                fontSize: modalFont,
              }}
            >
              <strong>
                {T.phone}
              </strong>{" "}
              {selectedClinic.phone}
            </p>
            <h3
              style={{
                fontSize: modalFont,
              }}
            >
              {T.doctors}
            </h3>
            <ul
              style={{
                fontSize: modalFont,
              }}
            >
              {selectedClinic.doctors.map(
                (d, i) => (
                  <li key={i}>
                    <strong>
                      {d.name}
                    </strong>{" "}
                    –{" "}
                    {globalSpecMap[
                      d.specialty
                    ]?.[lang] ||
                      d.specialty}{" "}
                    –{" "}
                    {d.languages
                      .map(
                        o =>
                          globalLangMap[
                            o
                          ]?.[lang] ||
                          o
                      )
                      .join(", ")}
                  </li>
                )
              )}
            </ul>
            <label
              style={{
                display: "block",
                marginTop: 12,
              }}
            >
              {T.font}
              <input
                type="range"
                min={12}
                max={22}
                value={modalFont}
                onChange={evt =>
                  setModalFont(
                    +evt.target.value
                  )
                }
              />
            </label>
          </div>
        </div>
      )}
    </Fragment>
  );
}
