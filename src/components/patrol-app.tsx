import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { HkMap } from "@/components/hk-map";
import { DISTRICTS, HK_BOUNDS, REGIONS, boundsFor, districtOf, type DistrictId } from "@/data/districts";
import { SHOPS } from "@/data/shops";
import { listReports, submitReport } from "@/lib/reports.functions";
import { GROUPS, RANGE_STOPS, clipNote, formatWhen, groupForBrand, inferBrand, placeKey, qtyChipClass, rangeLabel, type GroupId, type Qty, type SoupPin, type SoupReport } from "@/lib/soup";

type Picked = { brand: string; name: string; address: string; lat: number; lng: number; fromList: boolean };
type Focus = { lat: number; lng: number; token: number };

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function cleanName(brand: string, text: string) {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rest = text.replace(new RegExp(`^${escaped}\\s+`, "i"), "").trim();
  return rest || text;
}

function loadDistricts(): DistrictId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("soup-districts");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const known = new Set(DISTRICTS.map((district) => district.id));
    return parsed.filter((id): id is DistrictId => typeof id === "string" && known.has(id as DistrictId));
  } catch {
    return [];
  }
}

function districtSummary(ids: DistrictId[]) {
  if (!ids.length || ids.length === DISTRICTS.length) return "全港";
  for (const region of REGIONS) {
    if (region.districts.length === ids.length && region.districts.every((id) => ids.includes(id))) return region.label;
  }
  if (ids.length === 1) return DISTRICTS.find((district) => district.id === ids[0])?.name ?? "地區";
  return `${ids.length} 區`;
}

function messageOf(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("Failed to")) return error.message;
  return "暫時交唔到，稍後再試";
}

export function PatrolApp({ initialReports }: { initialReports: SoupReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [groupId, setGroupId] = useState<GroupId>("park");
  const [qty, setQty] = useState<Qty>("好多");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(1440);
  const [shown, setShown] = useState<Record<Qty, boolean>>({ 好多: true, 好少: true, 冇晒: true });
  const [mapGroups, setMapGroups] = useState<Record<GroupId, boolean>>({ park: true, well: true, other: true });
  const [cluster, setCluster] = useState(true);
  const [districts, setDistricts] = useState<DistrictId[]>([]);
  const [areaOpen, setAreaOpen] = useState(false);
  const [frame, setFrame] = useState<{ west: number; south: number; east: number; north: number; token: number } | null>(null);
  const [status, setStatus] = useState("揀舖，再撳地圖或者拖粒空心釘。");
  const [pending, setPending] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const areaBox = useRef<HTMLDivElement>(null);
  const mapFrame = useRef<HTMLElement>(null);
  const group = GROUPS.find((item) => item.id === groupId) ?? GROUPS[0];

  useEffect(() => {
    const saved = loadDistricts();
    if (!saved.length) return;
    setDistricts(saved);
    const bounds = boundsFor(saved);
    if (bounds) setFrame({ ...bounds, token: Date.now() });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void listReports()
        .then(setReports)
        .catch(() => undefined);
    }, 45000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (box.current?.contains(target) || areaBox.current?.contains(target)) return;
      setOpen(false);
      setAreaOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  const matches = useMemo(() => {
    if (group.id === "other") return [];
    const brands = group.brands as readonly string[];
    const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return SHOPS.filter((shop) => {
      if (!brands.includes(shop.brand)) return false;
      if (!parts.length) return true;
      const hay = `${shop.brand}${shop.name}${shop.address}`.toLowerCase();
      return parts.every((part) => hay.includes(part));
    }).slice(0, 12);
  }, [group, query]);

  const visible = useMemo(() => {
    const cut = Date.now() - minutes * 60 * 1000;
    return reports
      .filter((row) => new Date(row.at).getTime() >= cut && mapGroups[groupForBrand(row.brand).id] && shown[row.qty])
      .filter((row) => !districts.length || districts.includes(districtOf(row.lat, row.lng) as DistrictId))
      .sort((a, b) => b.at.localeCompare(a.at) || b.filedAt.localeCompare(a.filedAt));
  }, [reports, minutes, mapGroups, districts, shown]);

  const pins = useMemo(() => {
    const groups = new Map<string, SoupReport[]>();
    for (const row of visible) {
      const key = placeKey(row);
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }
    const next: SoupPin[] = [];
    for (const [key, bucket] of groups) {
      const top = bucket.slice(0, 5);
      const latest = top[0];
      if (!latest) continue;
      next.push({
        key,
        lat: latest.lat,
        lng: latest.lng,
        brand: latest.brand,
        name: latest.name,
        address: latest.address,
        qty: latest.qty,
        history: top.map((row) => ({ at: formatWhen(row.at), filedAt: formatWhen(row.filedAt), qty: row.qty, note: row.note })),
      });
    }
    return next;
  }, [visible]);

  function chooseDistricts(next: DistrictId[]) {
    const known = new Set(DISTRICTS.map((district) => district.id));
    const clean = next.filter((id) => known.has(id));
    setDistricts(clean);
    window.localStorage.setItem("soup-districts", JSON.stringify(clean));
    const bounds = clean.length ? boundsFor(clean) : HK_BOUNDS;
    if (bounds) setFrame({ ...bounds, token: Date.now() });
  }

  function jumpTo(row: SoupReport) {
    setFocus({ lat: row.lat, lng: row.lng, token: Date.now() });
    mapFrame.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function chooseGroup(next: GroupId) {
    setGroupId(next);
    const brands = (GROUPS.find((item) => item.id === next)?.brands ?? []) as readonly string[];
    setPicked((current) => (current && brands.includes(current.brand) ? current : null));
    setOpen(true);
  }

  function chooseShop(shop: (typeof SHOPS)[number]) {
    const next = {
      brand: shop.brand,
      name: shop.name,
      address: shop.address || shop.name,
      lat: shop.lat,
      lng: shop.lng,
      fromList: true,
    };
    setGroupId(groupForBrand(shop.brand).id);
    setPicked(next);
    setQuery(`${shop.brand} ${shop.name}`);
    setOpen(false);
    setFocus({ lat: shop.lat, lng: shop.lng, token: Date.now() });
    setStatus(`已選：${shop.brand} ${shop.name}。可再撳地圖或拖粒釘改位置。`);
  }

  function pinAt(lat: number, lng: number) {
    const text = query.trim();
    const listed = picked?.fromList && text === `${picked.brand} ${picked.name}`;
    if (listed && picked) {
      setPicked({ ...picked, lat, lng });
      setStatus(`已釘：${picked.brand} ${picked.name}`);
      return;
    }
    if (!text) {
      setStatus("先打店舖名，再撳地圖放低粒釘");
      return;
    }
    const brand = inferBrand(groupId, text);
    const name = cleanName(brand, text);
    setPicked({ brand, name, address: name, lat, lng, fromList: false });
    setOpen(false);
    setStatus(`已釘：${brand} ${name}`);
  }

  async function refresh() {
    try {
      setReports(await listReports());
    } catch (error) {
      setStatus(messageOf(error));
    }
  }

  async function onSubmit() {
    if (!picked) {
      setStatus("先揀舖，或者打店名後撳地圖放低粒釘");
      return;
    }
    if (!when) {
      setStatus("請填目擊時間");
      return;
    }
    setPending(true);
    try {
      await submitReport({
        data: {
          brand: picked.brand,
          name: picked.name,
          address: picked.address,
          lat: picked.lat,
          lng: picked.lng,
          qty,
          note,
          at: new Date(when).toISOString(),
        },
      });
      setReports(await listReports());
      setNote("");
      setWhen("");
      setFocus({ lat: picked.lat, lng: picked.lng, token: Date.now() });
      setStatus("已記錄。每個舖只留最新 5 條。");
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-cream text-ink lg:flex lg:h-dvh lg:flex-col">
      <header className="flex justify-center border-b-2 border-ink bg-paper">
        <h1 className="sr-only">金寶湯糾察</h1>
        <img src="/og.jpg" alt="金寶湯糾察" className="block h-auto max-h-[42vh] w-auto max-w-full" />
      </header>
      <p className="border-b-2 border-ink px-4 py-2 text-xs leading-relaxed text-ink/80">
        非官方數據，地圖根據公開資料並綜合各方網上消息及匿名回報，只求希望有心人尋獲小狗，如有問題請多多包涵 - Gary.TC
        <span className="mt-1 block">
          詳情請參考
          <a
            href="https://www.facebook.com/share/1MCNJTc3h6/?mibextid=wwXIfr"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline underline-offset-2"
          >
            金寶湯官方 Facebook
          </a>
          。官方地址（非即時更新）：
          <a
            href="https://docs.google.com/document/d/1utbUxE3w15LOii3FxsbG2Q34GuGM6keUolN_V07po4I/edit?usp=sharing"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline underline-offset-2"
          >
            【金寶湯｜線條小狗 4罐禮品裝】分店列表
          </a>
        </span>
      </p>
      <div className="flex items-center gap-3 px-4 py-2">
        <label htmlFor="range" className="shrink-0 text-sm font-bold">
          範圍 {rangeLabel(minutes)}
        </label>
        <input
          id="range"
          type="range"
          min={0}
          max={RANGE_STOPS.length - 1}
          step={1}
          value={Math.max(0, RANGE_STOPS.indexOf(minutes as (typeof RANGE_STOPS)[number]))}
          className="min-w-0 flex-1"
          onChange={(event) => setMinutes(RANGE_STOPS[Number(event.target.value)] ?? 1440)}
        />
        <span className="hidden text-xs text-ink/70 sm:inline">10 分鐘 – 7 日</span>
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper" onClick={() => void refresh()} aria-label="重新載入">
          <RefreshCw className="size-4" />
        </button>
        <a
          href="https://github.com/rayony/Maltese-Monitor"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm font-bold underline underline-offset-2"
        >
          GitHub
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
        {(
          [
            ["park", "百佳"],
            ["well", "惠康"],
            ["other", "其他"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 text-sm font-bold">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={mapGroups[id]}
              onChange={() => setMapGroups((current) => ({ ...current, [id]: !current[id] }))}
            />
            {label}
          </label>
        ))}
        <div ref={areaBox} className="relative basis-full">
          <button
            type="button"
            aria-expanded={areaOpen}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-ink bg-cream px-3 text-left text-sm font-bold"
            onClick={() => setAreaOpen((current) => !current)}
          >
            地區 · {districtSummary(districts)}
            <span aria-hidden="true">{areaOpen ? "▴" : "▾"}</span>
          </button>
          {areaOpen ? (
            <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border-2 border-ink bg-cream p-2 shadow-stamp">
              <button type="button" className="min-h-11 w-full rounded-lg px-2 text-left text-sm font-bold" onClick={() => chooseDistricts([])}>
                全港
              </button>
              {REGIONS.map((region) => {
                const on = region.districts.every((id) => districts.includes(id));
                return (
                  <div key={region.id} className="mt-1">
                    <label className="flex min-h-11 items-center gap-2 px-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        className="size-4 accent-ink"
                        checked={on}
                        onChange={() =>
                          chooseDistricts(
                            on
                              ? districts.filter((id) => !region.districts.includes(id))
                              : [...new Set([...districts, ...region.districts])],
                          )
                        }
                      />
                      {region.label}
                    </label>
                    {region.districts.map((id) => {
                      const district = DISTRICTS.find((item) => item.id === id);
                      if (!district) return null;
                      return (
                        <label key={id} className="flex min-h-11 items-center gap-2 px-6 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-ink"
                            checked={districts.includes(id)}
                            onChange={() =>
                              chooseDistricts(districts.includes(id) ? districts.filter((item) => item !== id) : [...districts, id])
                            }
                          />
                          {district.name}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        {(
          [
            ["好多", "多貨", "bg-moss"],
            ["好少", "少量", "bg-yolk"],
            ["冇晒", "無貨", "bg-soup"],
          ] as const
        ).map(([qty, label, dot]) => (
          <label key={qty} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-cream px-3 text-sm font-bold">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={shown[qty]}
              onChange={() => setShown((current) => ({ ...current, [qty]: !current[qty] }))}
            />
            <span className={`size-2.5 rounded-full ${dot}`} />
            {label}
          </label>
        ))}
        <label className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 text-sm font-bold">
          <input type="checkbox" className="size-4 accent-ink" checked={cluster} onChange={() => setCluster((current) => !current)} />
          {cluster ? "合併附近釘" : "每點獨立"}
        </label>
      </div>
      <div className="flex flex-col gap-3 px-3 pb-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <section className="order-2 rounded-2xl border-2 border-ink bg-cream p-4 shadow-stamp lg:order-1 lg:overflow-y-auto">
          <p className="text-sm font-bold">品牌</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={groupId === item.id}
                className={`min-h-11 rounded-full border-2 border-ink px-3 text-sm ${groupId === item.id ? "bg-ink text-cream" : "bg-cream"}`}
                onClick={() => chooseGroup(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label htmlFor="shop" className="mt-4 block text-sm font-bold">
            店舖
          </label>
          <div ref={box} className="relative mt-2">
            <input
              id="shop"
              value={query}
              placeholder="例如：黃埔、Fusion 太古"
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3 text-base"
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {open ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border-2 border-ink bg-cream">
                {matches.length ? (
                  matches.map((shop) => (
                    <button
                      key={`${shop.brand}-${shop.name}-${shop.address}`}
                      type="button"
                      className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-paper"
                      onClick={() => chooseShop(shop)}
                    >
                      <span className="font-bold">
                        {shop.brand} · {shop.name}
                      </span>
                      <span className="block text-ink/70">{shop.address}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-ink/70">冇清單結果。打店名，然後撳地圖放低粒釘。</p>
                )}
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-ink/75">{status}</p>

          <label htmlFor="when" className="mt-4 block text-sm font-bold">
            目擊時間
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-ink bg-cream px-3 text-base"
            />
            <button type="button" className="min-h-11 rounded-xl border-2 border-ink bg-paper px-3 text-sm" onClick={() => setWhen(nowLocal())}>
              而家
            </button>
          </div>

          <p className="mt-4 text-sm font-bold">數量</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              aria-pressed={qty === "好多"}
              className={`min-h-11 flex-1 rounded-xl border-2 border-ink text-sm font-bold ${qty === "好多" ? "bg-moss text-cream" : "bg-cream"}`}
              onClick={() => setQty("好多")}
            >
              好多
            </button>
            <button
              type="button"
              aria-pressed={qty === "好少"}
              className={`min-h-11 flex-1 rounded-xl border-2 border-ink text-sm font-bold ${qty === "好少" ? "bg-yolk text-ink" : "bg-cream"}`}
              onClick={() => setQty("好少")}
            >
              好少
            </button>
            <button
              type="button"
              aria-pressed={qty === "冇晒"}
              className={`min-h-11 flex-1 rounded-xl border-2 border-ink text-sm font-bold ${qty === "冇晒" ? "bg-soup text-cream" : "bg-cream"}`}
              onClick={() => setQty("冇晒")}
            >
              冇晒
            </button>
          </div>
          <label htmlFor="note" className="mt-4 flex items-baseline justify-between text-sm font-bold">
            留言
            <span className="font-normal text-ink/60">{[...note].length}/50</span>
          </label>
          <input
            id="note"
            value={note}
            maxLength={50}
            placeholder="可講幾多件，或其他（可留空）"
            onChange={(event) => setNote(clipNote(event.target.value))}
            className="mt-2 min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-3 text-base"
          />
          <button
            type="button"
            disabled={pending}
            className="mt-4 min-h-12 w-full rounded-2xl border-2 border-ink bg-ink text-base font-bold text-cream disabled:opacity-60"
            onClick={() => void onSubmit()}
          >
            {pending ? "處理緊…" : "報料"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-ink/70">公開報料，唔使登入。每個舖只留最新 5 條。位置靠你自己撳地圖或者拖粒釘。</p>

          <ul className="mt-4 space-y-2 border-t-2 border-dashed border-ink pt-3">
              {visible.filter((row) => shown[row.qty]).slice(0, 30).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2 text-left text-sm"
                    onClick={() => jumpTo(row)}
                  >
                    <span className="font-bold">
                      {row.brand} {row.name}
                    </span>
                    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${qtyChipClass(row.qty)}`}>{row.qty}</span>
                    {row.note ? <span className="mt-1 block">{row.note}</span> : null}
                    <span className="mt-1 block text-xs font-bold">目擊 {formatWhen(row.at)}</span>
                    <span className="block text-[11px] text-ink/60">報料 {formatWhen(row.filedAt)}</span>
                  </button>
                </li>
              ))}
              {!visible.filter((row) => shown[row.qty]).length ? <li className="rounded-xl border-2 border-ink bg-paper px-3 py-3 text-sm">呢個篩選未有報料</li> : null}
            </ul>
        </section>
        <section ref={mapFrame} className="relative order-1 h-96 overflow-hidden rounded-2xl border-2 border-ink shadow-stamp lg:order-2 lg:h-full lg:min-h-0">
          <HkMap pins={pins} focus={focus} draft={picked} onPick={pinAt} cluster={cluster} frame={frame} />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border-2 border-ink bg-cream px-3 py-2 text-xs shadow-stamp">
            <span className="mr-1 inline-block size-2.5 rounded-full bg-moss" />
            好多
            <span className="mr-1 ml-3 inline-block size-2.5 rounded-full bg-yolk" />
            好少
            <span className="mr-1 ml-3 inline-block size-2.5 rounded-full bg-soup" />
            冇晒
            <div className="mt-1 text-ink/70">地圖由地政總署提供</div>
          </div>
        </section>
      </div>
    </div>
  );
}
