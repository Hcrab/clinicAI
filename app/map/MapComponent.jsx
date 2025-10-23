// clinical/app/map/MapComponent.jsx
"use client";

import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";          // ★ 新增
import MarkerClusterGroup from "react-leaflet-markercluster"; // ★ 新增

/* ─────────── 默认图标修复 ─────────── */
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

/* ─────────── 自动适应视野组件 ─────────── */
function MapUpdater({ clinics }) {
  const map = useMap();
  useEffect(() => {
    if (clinics.length) {
      const bounds = L.latLngBounds(
        clinics.map((c) => [c.latitude, c.longitude])
      );
      map.fitBounds(bounds);
    }
  }, [clinics, map]);
  return null;
}

/* ─────────── 主组件 ─────────── */
export default function MapComponent() {
  const [allClinics, setAllClinics] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [filteredClinics, setFilteredClinics] = useState([]);

  /* 载入诊所数据（public/clinic_data.json） */
  useEffect(() => {
    fetch("/clinic_data.json")
      .then((res) => {
        if (!res.ok) throw new Error("数据加载失败");
        return res.json();
      })
      .then((data) => {
        const clean = data
          .map((c) => ({
            ...c,
            latitude: parseFloat(c.latitude),
            longitude: parseFloat(c.longitude),
          }))
          .filter((c) =>
            Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
          );
        setAllClinics(clean);
      })
      .catch((e) => console.error("载入数据出错：", e));
  }, []);

  /* 根据科目实时筛选 */
  useEffect(() => {
    if (!selectedSpecialty) {
      setFilteredClinics([]);
      return;
    }
    setFilteredClinics(
      allClinics.filter((c) =>
        c.doctors.some((d) => d.specialty === selectedSpecialty)
      )
    );
  }, [selectedSpecialty, allClinics]);

  /* 提取唯一科目列表 */
  const specialtyList = [
    ...new Set(
      allClinics.flatMap((c) => c.doctors.map((d) => d.specialty))
    ),
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <h1>诊所地图筛选</h1>

      {/* ────── 筛选控件 ────── */}
      <div style={{ marginBottom: 10 }}>
        <label htmlFor="specialty-select" style={{ marginRight: 8 }}>
          选择科目：
        </label>
        <select
          id="specialty-select"
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
        >
          <option value="">-- 不显示任何诊所 --</option>
          {specialtyList.map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>
      </div>

      {/* ────── 地图 ────── */}
      <MapContainer
        center={[22.3193, 114.1694]}
        zoom={11}
        style={{ height: 500, width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* ★★★★★ 聚合容器 ★★★★★ */}
        <MarkerClusterGroup
          chunkedLoading
          disableClusteringAtZoom={16}
        >
          {filteredClinics.map((c) => (
            <Marker
              key={c.clinic_id}
              position={[c.latitude, c.longitude]}
            >
              <Popup>
                <strong>{c.name}</strong>
                <br />
                地址: {c.address}
                <br />
                电话: {c.phone}
                <br />
                <em>科目:</em>{" "}
                {c.doctors.map((d) => d.specialty).join("、")}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* 自适应地图范围 */}
        <MapUpdater clinics={filteredClinics} />
      </MapContainer>
    </div>
  );
}
