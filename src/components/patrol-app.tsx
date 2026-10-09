import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { HkMap } from "@/components/hk-map";
import { SHOPS } from "@/data/shops";
import { listReports, submitReport } from "@/lib/reports.functions";
import { GROUPS, formatWhen, groupForBrand, inferBrand, placeKey, rangeLabel, type GroupId, type Qty, type SoupPin, type SoupReport } from "@/lib/soup";

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

function messageOf(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("Failed to")) return error.message;
  return "暫時交唔到，稍後再試";
}

export function PatrolApp({ initialReports }: { initialReports: SoupReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [groupId, setGroupId] = useState<GroupId>("park");
  const [qty, setQty] = useState<Qty>("好多");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [when, setWhen] = useState("");
  const [hours, setHours] = useState(24);
  const [status, setStatus] = useState("揀舖，再撳地圖或者拖粒空心釘。");
  const [pending, setPending] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const group = GROUPS.find((item) => item.id === groupId) ?? GROUPS[0];

  useEffect(() => {
    setWhen(nowLocal());
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
      if (!(event.target instanceof Node) || !box.current?.contains(event.target)) setOpen(false);
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
    const cut = Date.now() - hours * 3600 * 1000;
    return reports.filter((row) => new Date(row.at).getTime() >= cut).sort((a, b) => b.at.localeCompare(a.at));
  }, [reports, hours]);

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
        history: top.map((row) => ({ at: formatWhen(row.at), qty: row.qty })),
      });
    }
    return next;
  }, [visible]);

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
      setStatus("請填時間");
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
          at: new Date(when).toISOString(),
        },
      });
      setReports(await listReports());
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
      <header className="border-b-2 border-ink bg-paper">
        <h1 className="sr-only">金寶湯糾察</h1>
        <img src="/og.jpg" alt="金寶湯糾察" className="h-28 w-full object-cover object-center sm:h-36" />
      </header>
      <div className="flex items-center gap-3 px-4 py-2">
        <label htmlFor="range" className="shrink-0 text-sm font-bold">
          範圍 {rangeLabel(hours)}
        </label>
        <input
          id="range"
          type="range"
          min={1}
          max={168}
          value={hours}
          className="min-w-0 flex-1"
          onChange={(event) => setHours(Number(event.target.value))}
        />
        <span className="hidden text-xs text-ink/70 sm:inline">1 小時 – 7 日</span>
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
            時間
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
              className={`min-h-11 flex-1 rounded-xl border-2 border-ink text-sm font-bold ${qty === "好少" ? "bg-soup text-cream" : "bg-cream"}`}
              onClick={() => setQty("好少")}
            >
              好少
            </button>
          </div>
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
              {visible.slice(0, 30).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2 text-left text-sm"
                    onClick={() => setFocus({ lat: row.lat, lng: row.lng, token: Date.now() })}
                  >
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs text-cream ${row.qty === "好多" ? "bg-moss" : "bg-soup"}`}>
                      {row.qty}
                    </span>
                    {row.brand} {row.name}
                    <span className="mt-1 block text-ink/70">{formatWhen(row.at)}</span>
                  </button>
                </li>
              ))}
              {!visible.length ? <li className="rounded-xl border-2 border-ink bg-paper px-3 py-3 text-sm">呢段時間未有報料</li> : null}
            </ul>
        </section>
        <section className="relative order-1 h-96 overflow-hidden rounded-2xl border-2 border-ink shadow-stamp lg:order-2 lg:h-full lg:min-h-0">
          <HkMap pins={pins} focus={focus} draft={picked} onPick={pinAt} />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border-2 border-ink bg-cream px-3 py-2 text-xs shadow-stamp">
            <span className="mr-1 inline-block size-2.5 rounded-full bg-moss" />
            好多
            <span className="mr-1 ml-3 inline-block size-2.5 rounded-full bg-soup" />
            好少
            <div className="mt-1 text-ink/70">地圖：地政總署</div>
          </div>
        </section>
      </div>
    </div>
  );
}
