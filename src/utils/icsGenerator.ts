import type { Cinema } from "@/types/cinema";
import type { Film, Screening } from "@/types/film";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall time → ICS floating datetime YYYYMMDDTHHMMSS */
function toIcsLocal(date: string, hhmm: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const hour = h >= 24 ? h - 24 : h;
  const dayOffset = h >= 24 ? 1 : 0;
  const dt = new Date(y, mo - 1, d + dayOffset, hour, mi || 0, 0);
  return (
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export type IcsItem = {
  screening: Screening;
  film: Film;
  cinema?: Cinema;
};

export function buildIcsCalendar(
  items: IcsItem[],
  calendarName = "CineMap 排片"
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CineMap//Festival Schedule//ZH",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const { screening: s, film, cinema } of items) {
    const uid = `${s.id}@cinemap.local`;
    const summary = `${film.titleZh} · ${cinema?.nameZh ?? ""}`.trim();
    const location = [cinema?.nameZh, s.hall, cinema?.address]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toIcsLocal(s.date, s.start)}`,
      `DTSTART:${toIcsLocal(s.date, s.start)}`,
      `DTEND:${toIcsLocal(s.date, s.end)}`,
      `SUMMARY:${escapeText(summary)}`,
      `LOCATION:${escapeText(location)}`,
      `DESCRIPTION:${escapeText(`${film.titleEn} / ${film.director}`)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(content: string, filename = "cinemap-schedule.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
