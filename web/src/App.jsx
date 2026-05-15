import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import greenMarker from "./assets/markers/marker-green.png";
import yellowMarker from "./assets/markers/marker-yellow.png";
import redMarker from "./assets/markers/marker-red.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const greenIcon = new L.Icon({
  iconUrl: greenMarker,
  shadowUrl: markerShadow,
  iconRetinaUrl: greenMarker,
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -40],
  shadowSize: [52, 52],
});

const yellowIcon = new L.Icon({
  iconUrl: yellowMarker,
  shadowUrl: markerShadow,
  iconRetinaUrl: yellowMarker,
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -40],
  shadowSize: [52, 52],
});

const redIcon = new L.Icon({
  iconUrl: redMarker,
  shadowUrl: markerShadow,
  iconRetinaUrl: redMarker,
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -40],
  shadowSize: [52, 52],
});

function getMarkerIcon(estado) {
  switch ((estado || "").toUpperCase()) {
    case "OPERACIONAL":
      return greenIcon;
    case "MANTENIMIENTO":
      return yellowIcon;
    case "NO OPERACIONAL":
      return redIcon;
    default:
      return greenIcon;
  }
}

function MapAutoResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const t = setTimeout(() => map.invalidateSize(), 200);

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });

    ro.observe(container);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });

  return null;
}

export default function App() {
  const [radios, setRadios] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const [tempPosition, setTempPosition] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [clusterRadios, setClusterRadios] = useState([]);

  const [newRadioPos, setNewRadioPos] = useState(null);
  const [formData, setFormData] = useState({
    marca: "",
    modelo: "",
    serie: "",
    estado: "OPERACIONAL",
    ubicacion_texto: "",
    observaciones: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/radios")
      .then((r) => r.json())
      .then(setRadios)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) {
      setPhotos([]);
      return;
    }

    fetch(`http://localhost:3001/radios/${selected.id}/fotos`)
      .then((r) => r.json())
      .then(setPhotos)
      .catch(console.error);
  }, [selected]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [selected]);

  useEffect(() => {
    if (currentPhotoIndex >= photos.length) {
      setCurrentPhotoIndex(0);
    }
  }, [photos, currentPhotoIndex]);

  useEffect(() => {
    if (!selected) return;

    const stillVisible =
      statusFilter === "TODOS" ||
      (selected.estado || "").toUpperCase() === statusFilter;

    if (!stillVisible) {
      setSelected(null);
      setEditMode(false);
      setDragMode(false);
      setTempPosition(null);
    }
  }, [statusFilter, selected]);

  const centerSV = [13.7942, -88.8965];

  const filteredRadios = radios.filter((r) => {
    const matchesStatus =
      statusFilter === "TODOS" ||
      (r.estado || "").toUpperCase() === statusFilter;

    const text =
      `${r.marca || ""} ${r.modelo || ""} ${r.serie || ""} ${r.ubicacion_texto || ""}`.toLowerCase();

    const matchesSearch = text.includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: filteredRadios.length,
    operacional: filteredRadios.filter(
      (r) => (r.estado || "").toUpperCase() === "OPERACIONAL"
    ).length,
    mantenimiento: filteredRadios.filter(
      (r) => (r.estado || "").toUpperCase() === "MANTENIMIENTO"
    ).length,
    noOperacional: filteredRadios.filter(
      (r) => (r.estado || "").toUpperCase() === "NO OPERACIONAL"
    ).length,
  };

  function createClusterCustomIcon(cluster) {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();

    let operacional = 0;
    let mantenimiento = 0;
    let noOperacional = 0;

    markers.forEach((marker) => {
      const status = (marker.options.radioStatus || "").toUpperCase();

      if (status === "OPERACIONAL") operacional++;
      else if (status === "MANTENIMIENTO") mantenimiento++;
      else if (status === "NO OPERACIONAL") noOperacional++;
    });

    let clusterClass = "cluster-operacional";

    if (noOperacional >= mantenimiento && noOperacional >= operacional) {
      clusterClass = "cluster-no-operacional";
    } else if (mantenimiento >= operacional && mantenimiento >= noOperacional) {
      clusterClass = "cluster-mantenimiento";
    }

    let sizeClass = "cluster-small";
    if (count >= 10 && count < 30) sizeClass = "cluster-medium";
    if (count >= 30) sizeClass = "cluster-large";

    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `custom-marker-cluster ${clusterClass} ${sizeClass}`,
      iconSize: L.point(44, 44, true),
    });
  }

  async function getFirstPhotoMap(radioList) {
    const entries = await Promise.all(
      radioList.map(async (radio) => {
        try {
          const response = await fetch(
            `http://localhost:3001/radios/${radio.id}/fotos`
          );
          const photos = await response.json();

          if (Array.isArray(photos) && photos.length > 0) {
            return [radio.id, `http://localhost:3001/uploads/${photos[0].filename}`];
          }

          return [radio.id, null];
        } catch {
          return [radio.id, null];
        }
      })
    );

    return Object.fromEntries(entries);
  }

  async function handleGenerateOfficialReport() {
  const reportDate = new Date().toLocaleDateString("es-SV", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  const photoMap = await getFirstPhotoMap(filteredRadios);

  const html = `
    <html>
      <head>
        <title>Reporte Oficial de Radios</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 20mm;
          }

          body {
            font-family: Arial, sans-serif;
            color: #111;
            margin: 0;
            padding: 0;
          }

          .page {
            width: 100%;
            position: relative;
            padding: 10px 0;
          }

          .center {
            text-align: center;
          }

          .top-note {
            font-size: 14px;
            margin-bottom: 14px;
          }

          .institution {
            font-weight: bold;
            font-size: 18px;
            line-height: 1.3;
            margin-bottom: 18px;
          }

          .date {
            text-align: right;
            margin-bottom: 22px;
            font-size: 15px;
          }

          .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 15px;
          }

          .meta td {
            padding: 2px 0;
            vertical-align: top;
          }

          .meta .label {
            width: 90px;
            font-weight: bold;
          }

          .meta .colon {
            width: 18px;
          }

          .paragraph {
            text-align: justify;
            line-height: 1.7;
            font-size: 16px;
            margin-bottom: 26px;
          }

          .watermark {
            position: fixed;
            top: 42%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 220px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.08);
            z-index: -1;
            user-select: none;
          }

          table.inventory {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 20px;
          }

          table.inventory th,
          table.inventory td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            vertical-align: middle;
          }

          table.inventory th {
            font-weight: bold;
            background: #f2f2f2;
          }

          .photo-box {
            width: 95px;
            height: 75px;
            border: 1px solid #999;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #666;
            overflow: hidden;
            background: #fff;
          }

          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .signature-block {
            margin-top: 60px;
            text-align: center;
            font-size: 15px;
          }

          .footer-note {
            margin-top: 50px;
            font-size: 10px;
            text-align: justify;
          }

          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 14px;
            font-size: 14px;
            cursor: pointer;
          }

          .signature-area {
            position: relative;
            margin-top: 80px;
            text-align: center;
            font-size: 13px;
            min-height: 220px;
          }

          .signature-img {
            width: auto;
            height: auto;
            position: sticky;
          }

          .stamp-img {
            width: 120px;
            height: auto;
            position: absolute;
            left: 50%;
            top: 25px;
            transform: translateX(-105%);
            opacity: 0.85;
            z-index: 1;
          }

          .signature-name {
            margin-top: -40px;
            font-weight: bold;
          }

          .signature-title {
            font-size: 12px;
            font-weight: bold;
          }

          @media print {
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">Imprimir / Guardar PDF</button>

        <div class="watermark">09</div>

        <div class="page">
          <div class="center top-note">CONFIDENCIAL</div>

          <div class="center institution">
            MARINA NACIONAL DE EL SALVADOR<br />
            SERVICIO DE GUARDACOSTAS<br />
            MENSAJE
          </div>

          <div class="date">San Salvador, ${reportDate}.</div>

          <table class="meta">
            <tr>
              <td class="label">PARA</td>
              <td class="colon">:</td>
              <td>CMTE. EN JEFE DE LA MARINA NACIONAL.</td>
            </tr>
            <tr>
              <td class="label">DE</td>
              <td class="colon">:</td>
              <td>CMTE. DEL SERVICIO DE GUARDACOSTAS.</td>
            </tr>
            <tr>
              <td class="label">CÓDIGO</td>
              <td class="colon">:</td>
              <td>IBA. 220.</td>
            </tr>
            <tr>
              <td class="label">ASUNTO</td>
              <td class="colon">:</td>
              <td>REMITIENDO.</td>
            </tr>
          </table>

          <div class="paragraph">
            <b>No. 068/ICO/SGC.</b>
            Detalle situacional ... Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec
          </div>

          <table class="inventory">
            <thead>
              <tr>
                <th>N°</th>
                <th>RADIO</th>
                <th>MARCA</th>
                <th>MODELO</th>
                <th>SERIE</th>
                <th>UBICACIÓN</th>
                <th>SITUACIÓN</th>
                <th>FOTOGRAFÍA</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRadios
                .map((r, i) => {
                  const photoUrl = photoMap[r.id];

                  return `
                    <tr>
                      <td>${String(i + 1).padStart(2, "0")}</td>
                      <td>${r.marca || ""}</td>
                      <td>${r.marca || ""}</td>
                      <td>${r.modelo || ""}</td>
                      <td>${r.serie || ""}</td>
                      <td>${r.ubicacion_texto || "-"}</td>
                      <td>${r.estado || "-"}</td>
                      <td>
                        <div class="photo-box">
                          ${
                            photoUrl
                              ? `<img src="${photoUrl}" class= "photo-img" alt="Foto del radio" />`
                              : `Sin foto`
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

          <div class="signature-area">
            <div style="text-align:left;"><b>TRANSMÍTASE:</b></div>

            <img class="signature-img" src="/report-assets/FirmaCmteSGC.png" />

            <div class="signature-name">NOMBRE DEL COMANDANTE</div>
            <div class="signature-title">GRADO Y ARMA</div>
            <div class="signature-title">COMANDANTE DE UNIDAD MILITAR</div>
          </div>

          <div class="footer-note">
            <b>NOTA CONFIDENCIAL:</b> La información contenida en este mensaje es de uso
            oficial y confidencial, destinada únicamente para fines institucionales.
          </div>
        </div>
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("El navegador bloqueó la ventana emergente. Permite popups para continuar.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
}

  async function handleSaveRadio() {
    setError("");

    if (!newRadioPos) {
      setError("Primero selecciona la ubicación del radio en el mapa.");
      return;
    }

    if (!formData.marca || !formData.modelo || !formData.serie) {
      setError("Marca, modelo y serie son campos obligatorios.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData,
        lat: newRadioPos.lat,
        lng: newRadioPos.lng,
      };

      const response = await fetch("http://localhost:3001/radios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Error al guardar el radio.");
        return;
      }

      setRadios((prev) => [result, ...prev]);
      setSelected(result);
      setEditMode(false);
      setNewRadioPos(null);

      setFormData({
        marca: "",
        modelo: "",
        serie: "",
        estado: "OPERACIONAL",
        ubicacion_texto: "",
        observaciones: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRadio() {
    if (!selected) return;

    setError("");

    if (!formData.marca || !formData.modelo || !formData.serie) {
      setError("Marca, modelo y serie son campos obligatorios.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `http://localhost:3001/radios/${selected.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formData,
            lat: selected.lat,
            lng: selected.lng,
          }),
        }
      );

      const updated = await response.json();

      if (!response.ok) {
        setError(updated.error || "Error al actualizar el radio.");
        return;
      }

      setRadios((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );

      setSelected(updated);
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditRadio() {
    if (!selected) return;

    setFormData({
      marca: selected.marca || "",
      modelo: selected.modelo || "",
      serie: selected.serie || "",
      estado: selected.estado || "OPERACIONAL",
      ubicacion_texto: selected.ubicacion_texto || "",
      observaciones: selected.observaciones || "",
    });

    setEditMode(true);
    setNewRadioPos(null);
    setError("");
  }

  function cancelNewRadio() {
    setNewRadioPos(null);
    setError("");
    setFormData({
      marca: "",
      modelo: "",
      serie: "",
      estado: "OPERACIONAL",
      ubicacion_texto: "",
      observaciones: "",
    });
  }

  function cancelEdit() {
    setEditMode(false);
    setError("");
  }

  async function handleSaveDraggedPosition() {
    if (!selected || !tempPosition) return;

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `http://localhost:3001/radios/${selected.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            marca: selected.marca,
            modelo: selected.modelo,
            serie: selected.serie,
            estado: selected.estado,
            ubicacion_texto: selected.ubicacion_texto,
            observaciones: selected.observaciones,
            lat: tempPosition.lat,
            lng: tempPosition.lng,
          }),
        }
      );

      const updated = await response.json();

      if (!response.ok) {
        setError(updated.error || "Error al guardar la nueva ubicación.");
        return;
      }

      setRadios((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      setSelected(updated);
      setDragMode(false);
      setTempPosition(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto() {
    if (!selected || !photoFile) return;

    try {
      setUploadingPhoto(true);
      setError("");

      const form = new FormData();
      form.append("foto", photoFile);

      const response = await fetch(
        `http://localhost:3001/radios/${selected.id}/fotos`,
        {
          method: "POST",
          body: form,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Error al subir la foto.");
        return;
      }

      const refresh = await fetch(
        `http://localhost:3001/radios/${selected.id}/fotos`
      );
      const data = await refresh.json();
      setPhotos(data);
      setPhotoFile(null);
      setCurrentPhotoIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeleteRadio() {
    if (!selected) return;

    const confirmed = window.confirm(
      `¿Segur@ que deseas eliminar el radio "${selected.marca} ${selected.modelo}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const response = await fetch(
        `http://localhost:3001/radios/${selected.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Error al eliminar el radio.");
        return;
      }

      setRadios((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setEditMode(false);
      setDragMode(false);
      setTempPosition(null);
      setPhotos([]);
      setPhotoFile(null);
      setClusterRadios([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function showPrevPhoto() {
    if (photos.length === 0) return;
    setCurrentPhotoIndex((prev) =>
      prev === 0 ? photos.length - 1 : prev - 1
    );
  }

  function showNextPhoto() {
    if (photos.length === 0) return;
    setCurrentPhotoIndex((prev) =>
      prev === photos.length - 1 ? 0 : prev + 1
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MapContainer
          center={centerSV}
          zoom={9}
          style={{ height: "100%", width: "100%" }}
        >
          <MapAutoResize />

          <MapClickHandler
            onMapClick={(latlng) => {
              setNewRadioPos(latlng);
              setSelected(null);
              setClusterRadios([]);
              setEditMode(false);
              setDragMode(false);
              setTempPosition(null);
              setError("");
              setFormData({
                marca: "",
                modelo: "",
                serie: "",
                estado: "OPERACIONAL",
                ubicacion_texto: "",
                observaciones: "",
              });
            }}
          />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
            eventHandlers={{
              clusterclick: (e) => {
                const childMarkers = e.layer.getAllChildMarkers();

                const radiosInCluster = childMarkers
                  .map((marker) => marker.options.radioData)
                  .filter(Boolean);

                setClusterRadios(radiosInCluster);
                setSelected(null);
                setNewRadioPos(null);
                setEditMode(false);
                setDragMode(false);
                setTempPosition(null);
                setError("");
              },
            }}
          >
            {filteredRadios.map((r) => (
              <Marker
                key={r.id}
                position={[
                  selected?.id === r.id && tempPosition ? tempPosition.lat : r.lat,
                  selected?.id === r.id && tempPosition ? tempPosition.lng : r.lng,
                ]}
                icon={getMarkerIcon(r.estado)}
                radioStatus={r.estado}
                radioData={r}
                draggable={selected?.id === r.id && dragMode}
                eventHandlers={{
                  click: () => {
                    setSelected(r);
                    setClusterRadios([]);
                    setNewRadioPos(null);
                    setEditMode(false);
                    setDragMode(false);
                    setTempPosition(null);
                    setError("");
                  },
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    setTempPosition(pos);
                  },
                }}
              >
                <Popup>
                  <b>
                    {r.marca} {r.modelo}
                  </b>
                  <br />
                  Serie: {r.serie}
                  <br />
                  Estado: {r.estado}
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {newRadioPos && (
            <Marker
              position={[newRadioPos.lat, newRadioPos.lng]}
              icon={getMarkerIcon(formData.estado)}
            >
              <Popup>Nuevo radio aquí</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <aside
        style={{
          width: 380,
          padding: 16,
          borderLeft: "1px solid #333",
          overflow: "auto",
          background: "#1f1f1f",
          color: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Ficha</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            Filtrar por estado
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: 10, width: "100%" }}
          >
            <option value="TODOS">TODOS</option>
            <option value="OPERACIONAL">OPERACIONAL</option>
            <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            <option value="NO OPERACIONAL">NO OPERACIONAL</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            Buscar
          </label>

          <input
            type="text"
            placeholder="Marca, modelo, serie o ubicación"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 16, display: "grid", gap: 10 }}>
          <button
            onClick={handleGenerateOfficialReport}
            style={{
              width: "100%",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Generar reporte oficial
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div
              style={{
                background: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#bbb" }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total}</div>
            </div>

            <div
              style={{
                background: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#bbb" }}>Operacionales</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>
                {stats.operacional}
              </div>
            </div>

            <div
              style={{
                background: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#bbb" }}>Mantenimiento</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>
                {stats.mantenimiento}
              </div>
            </div>

            <div
              style={{
                background: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#bbb" }}>No operacionales</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>
                {stats.noOperacional}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16, fontSize: 14, color: "#bbb" }}>
          Mostrando {filteredRadios.length} de {radios.length} radios
        </div>

        <div style={{ marginBottom: 16, fontSize: 14 }}>
          <div>🟢 Operacional</div>
          <div>🟡 Mantenimiento</div>
          <div>🔴 No operacional</div>
        </div>

        {!selected && !newRadioPos && !editMode && clusterRadios.length === 0 && (
          <p>
            Haz clic en un punto del mapa para registrar un radio o selecciona uno
            existente.
          </p>
        )}

        {clusterRadios.length > 0 && !selected && !editMode && !newRadioPos && (
          <div style={{ marginBottom: 24 }}>
            <h3>Radios en este grupo</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {clusterRadios.map((radio) => {
                const status = (radio.estado || "").toUpperCase();

                const statusColor =
                  status === "OPERACIONAL"
                    ? "#22c55e"
                    : status === "MANTENIMIENTO"
                    ? "#f59e0b"
                    : "#ef4444";

                return (
                  <button
                    key={radio.id}
                    onClick={() => {
                      setSelected(radio);
                      setClusterRadios([]);
                      setError("");
                    }}
                    style={{
                      textAlign: "left",
                      padding: 0,
                      background: "#2a2a2a",
                      color: "#fff",
                      border: "1px solid #444",
                      borderRadius: 10,
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex" }}>
                      <div
                        style={{
                          width: 8,
                          background: statusColor,
                          flexShrink: 0,
                        }}
                      />

                      <div style={{ padding: 12, flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>
                          {radio.marca} {radio.modelo}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 14 }}>
                          Serie: {radio.serie}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 14, color: statusColor }}>
                          {radio.estado}
                        </div>

                        <div style={{ marginTop: 6, color: "#bbb", fontSize: 13 }}>
                          {radio.ubicacion_texto || "Sin ubicación"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected && !editMode && (
          <div style={{ marginBottom: 24 }}>
            <p><b>Marca:</b> {selected.marca}</p>
            <p><b>Modelo:</b> {selected.modelo}</p>
            <p><b>Serie:</b> {selected.serie}</p>
            <p><b>Estado:</b> {selected.estado}</p>
            <p><b>Ubicación:</b> {selected.ubicacion_texto ?? "-"}</p>
            <p><b>Coordenadas:</b> {selected.lat}, {selected.lng}</p>
            <p><b>Observaciones:</b> {selected.observaciones ?? "-"}</p>

            {dragMode && tempPosition && (
              <p>
                <b>Nueva posición:</b> {tempPosition.lat.toFixed(6)},{" "}
                {tempPosition.lng.toFixed(6)}
              </p>
            )}

            {error && (
              <div style={{ color: "#ff6b6b", fontSize: 14, marginTop: 10 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                onClick={startEditRadio}
                style={{ padding: "10px 14px", cursor: "pointer" }}
              >
                Editar radio
              </button>

              <button
                onClick={handleDeleteRadio}
                disabled={deleting}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  background: "#b91c1c",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                {deleting ? "Eliminando..." : "Eliminar radio"}
              </button>

              {!dragMode ? (
                <button
                  onClick={() => {
                    setDragMode(true);
                    setTempPosition({ lat: selected.lat, lng: selected.lng });
                    setError("");
                  }}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  Mover ubicación
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveDraggedPosition}
                    disabled={saving}
                    style={{ padding: "10px 14px", cursor: "pointer" }}
                  >
                    {saving ? "Guardando..." : "Guardar nueva ubicación"}
                  </button>

                  <button
                    onClick={() => {
                      setDragMode(false);
                      setTempPosition(null);
                      setError("");
                    }}
                    style={{ padding: "10px 14px", cursor: "pointer" }}
                  >
                    Cancelar movimiento
                  </button>
                </>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>Fotos</h3>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={handleUploadPhoto}
                  disabled={!photoFile || uploadingPhoto}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  {uploadingPhoto ? "Subiendo..." : "Subir foto"}
                </button>
              </div>

              {photos.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      position: "relative",
                      border: "1px solid #333",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#111",
                    }}
                  >
                    <img
                      src={`http://localhost:3001/uploads/${photos[currentPhotoIndex].filename}`}
                      alt={photos[currentPhotoIndex].original_name || "Foto del radio"}
                      style={{
                        width: "100%",
                        maxHeight: 260,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={showPrevPhoto}
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: 10,
                            transform: "translateY(-50%)",
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          ◀
                        </button>

                        <button
                          onClick={showNextPhoto}
                          style={{
                            position: "absolute",
                            top: "50%",
                            right: 10,
                            transform: "translateY(-50%)",
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          ▶
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13, color: "#bbb" }}>
                    Foto {currentPhotoIndex + 1} de {photos.length}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      overflowX: "auto",
                      paddingBottom: 4,
                    }}
                  >
                    {photos.map((p, index) => (
                      <img
                        key={p.id}
                        src={`http://localhost:3001/uploads/${p.filename}`}
                        alt={p.original_name || "Miniatura"}
                        onClick={() => setCurrentPhotoIndex(index)}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: 8,
                          border:
                            index === currentPhotoIndex
                              ? "2px solid #60a5fa"
                              : "1px solid #444",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: 16, color: "#bbb" }}>
                  Este radio aún no tiene fotos. Sube una para visualizarla aquí.
                </p>
              )}
            </div>
          </div>
        )}

        {newRadioPos && (
          <div>
            <h3>Registrar nuevo radio</h3>

            <p>
              <b>Lat:</b> {newRadioPos.lat.toFixed(6)}
              <br />
              <b>Lng:</b> {newRadioPos.lng.toFixed(6)}
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={formData.marca}
                onChange={(e) =>
                  setFormData({ ...formData, marca: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione marca</option>
                <option value="KENWOOD">KENWOOD</option>
                <option value="JOHNSON">JOHNSON</option>
                <option value="MOTOROLA">MOTOROLA</option>
              </select>
              
              <select
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione modelo</option>
                <option value="VP-900">VP-900</option>
                <option value="VP-5330-F5">VP-5330-F5</option>
                <option value="VP-5330-F6">VP-5330-F6</option>
                <option value="VP-5530-F6">VP-5530-F6</option>
                <option value="XTS-2500-III">XTS-2500-III</option>
                <option value="XTS-3000-I">XTS-3000-I</option>
              </select>

              <input
                placeholder="Serie"
                value={formData.serie}
                onChange={(e) =>
                  setFormData({ ...formData, serie: e.target.value })
                }
                style={{ padding: 10 }}
              />

              <select
                value={formData.estado}
                onChange={(e) =>
                  setFormData({ ...formData, estado: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="OPERACIONAL">OPERACIONAL</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="NO OPERACIONAL">NO OPERACIONAL</option>
              </select>

              <select
                value={formData.ubicacion_texto}
                onChange={(e) =>
                  setFormData({ ...formData, ubicacion_texto: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione ubicación</option>
                <option value="SEDE CENTRAL">SEDE CENTRAL</option>
                <option value="CAPITANÍA DE PUERTO ACAJUTLA">CAPITANÍA DE PUERTO ACAJUTLA</option>
                <option value="CAPITANÍA DE PUERTO LA LIBERTAD">CAPITANÍA DE PUERTO LA LIBERTAD</option>
                <option value="CAPITANÍA DE PUERTO EL TRIUNFO">CAPITANÍA DE PUERTO EL TRIUNFO</option>
                <option value="CAPITANÍA DE PUERTO LA CONCORDIA">CAPITANÍA DE PUERTO LA CONCORDIA</option>
                <option value="CAPITANÍA DE PUERTO LA UNIÓN">CAPITANÍA DE PUERTO LA UNIÓN</option>
                <option value="DESTACAMENTO NAVAL LAGO DE GÜIJA">DESTACAMENTO NAVAL LAGO DE GÜIJA</option>
                <option value="DESTACAMENTO NAVAL LAGO DE COATEPEQUE">DESTACAMENTO NAVAL LAGO DE COATEPEQUE</option>
                <option value="DESTACAMENTO NAVAL LAGO DE ILOPANGO">DESTACAMENTO NAVAL LAGO DE ILOPANGO</option>
                <option value="DESTACAMENTO NAVAL LAGO DE SUCHITLÁN">DESTACAMENTO NAVAL LAGO DE SUCHITLÁN</option>
              </select>

              <textarea
                placeholder="Observaciones"
                value={formData.observaciones}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    observaciones: e.target.value,
                  })
                }
                rows={4}
                style={{ padding: 10 }}
              />

              {error && (
                <div style={{ color: "#ff6b6b", fontSize: 14 }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleSaveRadio}
                  disabled={saving}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  {saving ? "Guardando..." : "Guardar radio"}
                </button>

                <button
                  onClick={cancelNewRadio}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {selected && editMode && (
          <div>
            <h3>Editar radio</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={formData.marca}
                onChange={(e) =>
                  setFormData({ ...formData, marca: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione marca</option>
                <option value="KENWOOD">KENWOOD</option>
                <option value="JOHNSON">JOHNSON</option>
                <option value="MOTOROLA">MOTOROLA</option>
              </select>

              <select
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione modelo</option>
                <option value="XTS-2500-III">XTS-2500-III</option>
                <option value="XTS-3000-I">XTS-3000-I</option>
                <option value="VP-5530-F6">VP-5530-F6</option>
                <option value="VP-900">VP-900</option>
              </select>

              <input
                value={formData.serie}
                onChange={(e) =>
                  setFormData({ ...formData, serie: e.target.value })
                }
                placeholder="Serie"
                style={{ padding: 10 }}
              />

              <select
                value={formData.estado}
                onChange={(e) =>
                  setFormData({ ...formData, estado: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="OPERACIONAL">OPERACIONAL</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="NO OPERACIONAL">NO OPERACIONAL</option>
              </select>

              <select
                value={formData.ubicacion_texto}
                onChange={(e) =>
                  setFormData({ ...formData, ubicacion_texto: e.target.value })
                }
                style={{ padding: 10 }}
              >
                <option value="">Seleccione ubicación</option>
                <option value="SEDE CENTRAL">SEDE CENTRAL</option>
                <option value="CAPITANÍA DE PUERTO ACAJUTLA">CAPITANÍA DE PUERTO ACAJUTLA</option>
                <option value="CAPITANÍA DE PUERTO LA LIBERTAD">CAPITANÍA DE PUERTO LA LIBERTAD</option>
                <option value="CAPITANÍA DE PUERTO EL TRIUNFO">CAPITANÍA DE PUERTO EL TRIUNFO</option>
                <option value="CAPITANÍA DE PUERTO LA CONCORDIA">CAPITANÍA DE PUERTO LA CONCORDIA</option>
                <option value="CAPITANÍA DE PUERTO LA UNIÓN">CAPITANÍA DE PUERTO LA UNIÓN</option>
                <option value="DESTACAMENTO NAVAL LAGO DE GÜIJA">DESTACAMENTO NAVAL LAGO DE GÜIJA</option>
                <option value="DESTACAMENTO NAVAL LAGO DE COATEPEQUE">DESTACAMENTO NAVAL LAGO DE COATEPEQUE</option>
                <option value="DESTACAMENTO NAVAL LAGO DE ILOPANGO">DESTACAMENTO NAVAL LAGO DE ILOPANGO</option>
                <option value="DESTACAMENTO NAVAL LAGO DE SUCHITLÁN">DESTACAMENTO NAVAL LAGO DE SUCHITLÁN</option>
              </select>

              <textarea
                value={formData.observaciones}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    observaciones: e.target.value,
                  })
                }
                placeholder="Observaciones"
                rows={4}
                style={{ padding: 10 }}
              />

              {error && (
                <div style={{ color: "#ff6b6b", fontSize: 14 }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleUpdateRadio}
                  disabled={saving}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  onClick={cancelEdit}
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}