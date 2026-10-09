import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { loadLandsStyle } from "@/lib/lands-style";
import type { SoupPin } from "@/lib/soup";
import { qtyPinClass } from "@/lib/soup";
import "maplibre-gl/dist/maplibre-gl.css";

type Focus = { lat: number; lng: number; token: number };
type Spot = { lat: number; lng: number };
type Cluster =
  | { kind: "pin"; pin: SoupPin }
  | { kind: "group"; lat: number; lng: number; pins: SoupPin[] };

const CLUSTER_PX = 56;

function esc(value: string) {
  const amp = String.fromCharCode(38);
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === amp) return `${amp}amp;`;
    if (ch === "<") return `${amp}lt;`;
    if (ch === ">") return `${amp}gt;`;
    if (ch === '"') return `${amp}quot;`;
    return `${amp}#39;`;
  });
}

function clusterTone(pins: SoupPin[]) {
  const none = pins.filter((pin) => pin.qty === "冇晒").length;
  const few = pins.filter((pin) => pin.qty === "好少").length;
  const many = pins.length - none - few;
  if (none >= few && none >= many) return "is-none";
  if (few >= many) return "is-few";
  return "is-many";
}

function clusterPins(map: MlMap, pins: SoupPin[], grouped: boolean): Cluster[] {
  if (!grouped) return pins.map((pin) => ({ kind: "pin", pin }));
  const points = pins.map((pin) => {
    const projected = map.project([pin.lng, pin.lat]);
    return { pin, x: projected.x, y: projected.y };
  });
  const parent = points.map((_, index) => index);
  const find = (index: number) => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]] ?? cursor;
      cursor = parent[cursor] ?? cursor;
    }
    return cursor;
  };
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const left = points[i];
      const right = points[j];
      if (!left || !right) continue;
      const dx = left.x - right.x;
      const dy = left.y - right.y;
      if (dx * dx + dy * dy <= CLUSTER_PX * CLUSTER_PX) parent[find(j)] = find(i);
    }
  }
  const buckets = new Map<number, SoupPin[]>();
  points.forEach((point, index) => {
    const root = find(index);
    const bucket = buckets.get(root);
    if (bucket) bucket.push(point.pin);
    else buckets.set(root, [point.pin]);
  });
  const clusters: Cluster[] = [];
  for (const group of buckets.values()) {
    if (group.length < 2) {
      const pin = group[0];
      if (pin) clusters.push({ kind: "pin", pin });
      continue;
    }
    const lat = group.reduce((sum, pin) => sum + pin.lat, 0) / group.length;
    const lng = group.reduce((sum, pin) => sum + pin.lng, 0) / group.length;
    clusters.push({ kind: "group", lat, lng, pins: group });
  }
  return clusters;
}

export function HkMap({
  pins,
  focus,
  draft,
  onPick,
  cluster,
}: {
  pins: SoupPin[];
  focus: Focus | null;
  draft: Spot | null;
  onPick: (lat: number, lng: number) => void;
  cluster: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const draftMarker = useRef<Marker | null>(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const clusterRef = useRef(cluster);
  clusterRef.current = cluster;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let map: MlMap | null = null;
    let observe: ResizeObserver | null = null;

    void (async () => {
      try {
        const [{ Map, setWorkerUrl }, worker] = await Promise.all([
          import("maplibre-gl"),
          import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
        ]);
        if (dead) return;
        setWorkerUrl(worker.default);
        const style = await loadLandsStyle();
        if (dead || !host.current) return;
        map = new Map({
          container: host.current,
          style,
          center: [114.17, 22.33],
          zoom: 10.6,
          minZoom: 9,
          maxZoom: 16,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
          maxBounds: [
            [113.75, 22.05],
            [114.5, 22.62],
          ],
          localIdeographFontFamily: '"PingFang HK", "WenQuanYi Zen Hei", "Noto Sans TC", sans-serif',
        });
        mapRef.current = map;
        map.on("load", () => {
          if (!dead) setReady(true);
        });
        map.on("click", (event) => {
          const target = event.originalEvent.target;
          if (target instanceof Element && target.closest(".soup-pin, .soup-cluster")) return;
          onPickRef.current(event.lngLat.lat, event.lngLat.lng);
        });
        map.getCanvas().style.cursor = "crosshair";
        observe = new ResizeObserver(() => map?.resize());
        observe.observe(host.current);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "未知錯誤";
        if (!dead) setProblem(`地圖暫時載入唔到（${detail}）。報料清單仍然用得。`);
      }
    })();

    return () => {
      dead = true;
      setReady(false);
      observe?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      draftMarker.current?.remove();
      draftMarker.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    const draw = async () => {
      const { Marker, Popup, LngLatBounds } = await import("maplibre-gl");
      if (cancelled || mapRef.current !== map) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = clusterPins(map, pinsRef.current, clusterRef.current).map((item) => {
        if (item.kind === "pin") {
          const pin = item.pin;
          const button = document.createElement("button");
          button.type = "button";
          button.className = `soup-pin ${qtyPinClass(pin.qty)}`;
          button.setAttribute("aria-label", `${pin.brand} ${pin.name} ${pin.qty}`);
          const lines = pin.history
            .map((row) => `${esc(row.at)} 目擊 · ${esc(row.filedAt)} 報 · ${esc(row.qty)}${row.note ? ` · ${esc(row.note)}` : ""}`)
            .join("<br>");
          const popup = new Popup({ offset: 14, closeButton: false, className: "soup-popup", maxWidth: "240px" }).setHTML(
            `<strong>${esc(pin.brand)} ${esc(pin.name)}</strong><div>${esc(pin.address)}</div><div>${lines}</div>`,
          );
          return new Marker({ element: button, anchor: "center" }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = `soup-cluster ${clusterTone(item.pins)}`;
        button.textContent = String(item.pins.length);
        button.setAttribute("aria-label", `附近 ${item.pins.length} 個舖`);
        const lines = item.pins
          .slice(0, 8)
          .map((pin) => {
            const extra = pin.history[0]?.note ? ` · ${esc(pin.history[0].note)}` : "";
            return `${esc(pin.brand)} ${esc(pin.name)} · ${esc(pin.qty)}${extra}`;
          })
          .join("<br>");
        const more = item.pins.length > 8 ? `<div>仲有 ${item.pins.length - 8} 個</div>` : "";
        const popup = new Popup({ offset: 16, closeButton: false, className: "soup-popup", maxWidth: "260px" }).setHTML(
          `<strong>附近 ${item.pins.length} 個</strong><div>${lines}</div>${more}`,
        );
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (map.getZoom() >= 15.2) return;
          const bounds = new LngLatBounds();
          item.pins.forEach((pin) => bounds.extend([pin.lng, pin.lat]));
          map.fitBounds(bounds, { padding: 72, maxZoom: 16, duration: 450 });
        });
        return new Marker({ element: button, anchor: "center" }).setLngLat([item.lng, item.lat]).setPopup(popup).addTo(map);
      });
    };

    const onMove = () => {
      void draw();
    };
    map.on("moveend", onMove);
    void draw();
    return () => {
      cancelled = true;
      map.off("moveend", onMove);
    };
  }, [pins, ready, cluster]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled || mapRef.current !== map) return;
      if (!draft) {
        draftMarker.current?.remove();
        draftMarker.current = null;
        return;
      }
      if (!draftMarker.current) {
        const mark = document.createElement("div");
        mark.className = "soup-pin is-draft";
        mark.title = "拖呢粒釘，或者再撳地圖";
        const marker = new Marker({ element: mark, anchor: "center", draggable: true })
          .setLngLat([draft.lng, draft.lat])
          .addTo(map);
        marker.on("dragend", () => {
          const next = marker.getLngLat();
          onPickRef.current(next.lat, next.lng);
        });
        draftMarker.current = marker;
      } else {
        draftMarker.current.setLngLat([draft.lng, draft.lat]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, ready]);

  useEffect(() => {
    if (!ready || !focus || !mapRef.current) return;
    mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, essential: true });
  }, [focus, ready]);

  return (
    <div className="relative h-full min-h-80 bg-paper">
      <div ref={host} className="h-full w-full" />
      {problem ? (
        <p className="absolute inset-x-4 top-4 rounded-xl border-2 border-ink bg-cream px-3 py-2 text-sm">{problem}</p>
      ) : null}
    </div>
  );
}
