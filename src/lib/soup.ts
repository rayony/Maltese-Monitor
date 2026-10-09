export const GROUPS = [
  { id: "park", label: "百佳 & Taste & Fusion", brands: ["百佳", "Taste", "Fusion"] },
  { id: "well", label: "惠康 & Market Place", brands: ["惠康", "Market Place"] },
  { id: "other", label: "其他", brands: ["其他"] },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];
export type Qty = "好多" | "好少";

export type SoupReport = {
  id: string;
  brand: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  qty: Qty;
  at: string;
};

export type SoupPin = {
  key: string;
  lat: number;
  lng: number;
  brand: string;
  name: string;
  address: string;
  qty: Qty;
  history: { at: string; qty: Qty }[];
};

export function groupForBrand(brand: string) {
  return GROUPS.find((group) => (group.brands as readonly string[]).includes(brand)) ?? GROUPS[2];
}

export function inferBrand(groupId: GroupId, text: string) {
  const group = GROUPS.find((item) => item.id === groupId) ?? GROUPS[0];
  const lower = text.toLowerCase();
  const hit = group.brands.find((brand) => brand !== "其他" && lower.includes(brand.toLowerCase()));
  return hit ?? group.brands[0];
}

export function placeKey(r: Pick<SoupReport, "brand" | "name" | "address">) {
  return `${r.brand}|${r.name}|${r.address}`.replace(/\s+/g, "");
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hourCycle: "h23",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(pick("day"))}/${Number(pick("month"))} ${pick("hour")}:${pick("minute")}`;
}

export function rangeLabel(hours: number) {
  if (hours < 48) return `${hours} 小時`;
  return `${Math.round(hours / 24)} 日`;
}
