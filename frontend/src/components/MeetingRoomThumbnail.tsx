import type { MeetingRoomOut } from "../api/types";

interface MeetingRoomThumbnailProps {
  room: MeetingRoomOut;
  className?: string;
  width?: number | string;
  height?: number | string;
  isAvailable?: boolean;
}

/**
 * Kompakte SVG-Grundriss-Grafik für einen Meetingraum.
 * Zeigt maßstäblich die Raumgrenzen, Tür, Präsentationswand (Screen)
 * sowie die jeweilige Bestuhlung (Konferenztisch, U-Form, Kino, etc.).
 */
export function MeetingRoomThumbnail({
  room,
  className = "",
  width = "100%",
  height = 110,
  isAvailable,
}: MeetingRoomThumbnailProps) {
  const cap = room.capacity || 10;
  const seating = (room.seating_layout || "boardroom").toLowerCase();

  // SVG-Koordinatenraum: 240 x 140
  const w = 240;
  const h = 140;
  const cx = w / 2;
  const cy = h / 2 + 8;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`rounded-lg select-none ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={`Grundriss-Vorschau: ${room.name}`}
    >
      {/* Raumfläche & Wände */}
      <rect
        x={3}
        y={3}
        width={w - 6}
        height={h - 6}
        rx={6}
        fill="#f8fafc"
        stroke="#64748b"
        strokeWidth={2}
      />

      {/* Dezentes Innen-Raster für Plan-Anmutung */}
      <line x1={3} y1={h / 2} x2={w - 3} y2={h / 2} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="4,4" />
      <line x1={cx} y1={3} x2={cx} y2={h - 3} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="4,4" />

      {/* Zimmertür oben links */}
      <g>
        <rect x={12} y={1} width={28} height={4} fill="#d8b878" stroke="#8b6c36" strokeWidth={1} rx={1} />
        <path d="M 12 5 A 28 28 0 0 1 40 5" fill="none" stroke="#b45309" strokeWidth={1} strokeDasharray="2,2" />
        <text x={26} y={14} fontSize={6.5} fill="#78716c" textAnchor="middle">Tür</text>
      </g>

      {/* Fenster oben rechts */}
      <g>
        <rect x={w - 44} y={1} width={34} height={4} fill="#9fd6ea" stroke="#4189a4" strokeWidth={1} rx={1} />
        <text x={w - 27} y={14} fontSize={6.5} fill="#4189a4" textAnchor="middle">Fenster</text>
      </g>

      {/* 85" Konferenz-Screen / Präsentationswand an der Stirnseite */}
      <g>
        <rect x={cx - 36} y={3} width={72} height={5} rx={1.5} fill="#1e293b" stroke="#0f172a" strokeWidth={1} />
        <text x={cx} y={15} fontSize={7} fontWeight="bold" textAnchor="middle" fill="#475569">
          📺 SCREEN / WHITEBOARD
        </text>
      </g>

      {/* Bestuhlungs-Möblierung */}
      {seating === "u_shape" ? (
        <g>
          {/* U-Tisch links */}
          <rect x={cx - 65} y={30} width={18} height={70} rx={2} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
          {/* U-Tisch Kopf/unten */}
          <rect x={cx - 65} y={84} width={130} height={18} rx={2} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
          {/* U-Tisch rechts */}
          <rect x={cx + 47} y={30} width={18} height={70} rx={2} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
          {/* Stühle U-Form außen */}
          {Array.from({ length: Math.min(4, Math.ceil(cap / 3)) }).map((_, i) => (
            <circle key={`u-l-${i}`} cx={cx - 74} cy={40 + i * 14} r={4.5} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.min(4, Math.ceil(cap / 3)) }).map((_, i) => (
            <circle key={`u-r-${i}`} cx={cx + 74} cy={40 + i * 14} r={4.5} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.min(5, cap) }).map((_, i) => (
            <circle key={`u-b-${i}`} cx={cx - 40 + i * 20} cy={110} r={4.5} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
          ))}
          <text x={cx} y={60} fontSize={8} fontWeight="bold" fill="#475569" textAnchor="middle">
            U-Form
          </text>
        </g>
      ) : seating === "cinema" || seating === "theater" ? (
        <g>
          {/* Kinobestuhlung: 3 Stuhlreihen */}
          {Array.from({ length: 3 }).map((_, row) => (
            <g key={`cin-row-${row}`}>
              {Array.from({ length: Math.min(8, Math.ceil(cap / 3)) }).map((_, col) => {
                const chairX = cx - ((Math.min(8, Math.ceil(cap / 3)) - 1) * 14) / 2 + col * 14;
                const chairY = 40 + row * 22;
                return (
                  <rect
                    key={`cin-${row}-${col}`}
                    x={chairX - 4.5}
                    y={chairY - 4.5}
                    width={9}
                    height={9}
                    rx={2}
                    fill="#3b82f6"
                    stroke="#1d4ed8"
                    strokeWidth={1}
                  />
                );
              })}
            </g>
          ))}
          <text x={cx} y={110} fontSize={8} fontWeight="bold" fill="#475569" textAnchor="middle">
            Kino / Theater
          </text>
        </g>
      ) : seating === "classroom" || seating === "parliament" ? (
        <g>
          {/* 2 Tischreihen mit Stühlen */}
          {[0, 1].map((r) => {
            const ty = 40 + r * 34;
            return (
              <g key={`cr-${r}`}>
                <rect x={cx - 65} y={ty} width={130} height={16} rx={2} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
                {Array.from({ length: Math.min(6, Math.ceil(cap / 2)) }).map((_, c) => (
                  <circle
                    key={`cr-ch-${r}-${c}`}
                    cx={cx - 50 + c * 20}
                    cy={ty + 23}
                    r={4.5}
                    fill="#3b82f6"
                    stroke="#1d4ed8"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
          <text x={cx} y={112} fontSize={8} fontWeight="bold" fill="#475569" textAnchor="middle">
            Schulung / Seminar
          </text>
        </g>
      ) : (
        /* Standard: Konferenztisch (Boardroom) */
        <g>
          {/* Konferenztisch mit abgerundeten Ecken */}
          <rect
            x={cx - 58}
            y={cy - 20}
            width={116}
            height={40}
            rx={10}
            fill="#e2e8f0"
            stroke="#475569"
            strokeWidth={1.5}
          />
          {/* Konferenz-Kamera / Mikrofon-Puck in Tischmitte */}
          <circle cx={cx} cy={cy} r={4.5} fill="#0f172a" opacity={0.6} />
          <text x={cx} y={cy + 13} fontSize={7} fontWeight="bold" fill="#64748b" textAnchor="middle">
            KONFERENZ
          </text>

          {/* Stühle oben */}
          {Array.from({ length: Math.min(6, Math.max(1, Math.floor((cap - 2) / 2))) }).map((_, i) => {
            const count = Math.min(6, Math.max(1, Math.floor((cap - 2) / 2)));
            const step = 90 / (count + 1);
            const chairX = cx - 45 + (i + 1) * step;
            return (
              <rect
                key={`ch-top-${i}`}
                x={chairX - 5}
                y={cy - 31}
                width={10}
                height={8}
                rx={2}
                fill="#3b82f6"
                stroke="#1d4ed8"
                strokeWidth={1}
              />
            );
          })}

          {/* Stühle unten */}
          {Array.from({ length: Math.min(6, Math.max(1, Math.floor((cap - 2) / 2))) }).map((_, i) => {
            const count = Math.min(6, Math.max(1, Math.floor((cap - 2) / 2)));
            const step = 90 / (count + 1);
            const chairX = cx - 45 + (i + 1) * step;
            return (
              <rect
                key={`ch-bot-${i}`}
                x={chairX - 5}
                y={cy + 23}
                width={10}
                height={8}
                rx={2}
                fill="#3b82f6"
                stroke="#1d4ed8"
                strokeWidth={1}
              />
            );
          })}

          {/* Stirnsitz links */}
          <rect
            x={cx - 71}
            y={cy - 4}
            width={8}
            height={9}
            rx={2}
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth={1}
          />

          {/* Stirnsitz rechts */}
          <rect
            x={cx + 63}
            y={cy - 4}
            width={8}
            height={9}
            rx={2}
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth={1}
          />
        </g>
      )}

      {/* Kapazitäts-Badge links unten */}
      <g>
        <rect x={8} y={h - 22} width={58} height={15} rx={3} fill="#e0e7ff" stroke="#c7d2fe" strokeWidth={1} />
        <text x={37} y={h - 11} fontSize={8} fontWeight="bold" fill="#3730a3" textAnchor="middle">
          👥 {cap} Pers.
        </text>
      </g>

      {/* Verfügbarkeits-Status rechts unten */}
      {isAvailable !== undefined && (
        <g>
          <rect
            x={w - (isAvailable ? 48 : 54)}
            y={h - 22}
            width={isAvailable ? 40 : 46}
            height={15}
            rx={3}
            fill={isAvailable ? "#dcfce7" : "#fee2e2"}
            stroke={isAvailable ? "#86efac" : "#fca5a5"}
            strokeWidth={1}
          />
          <text
            x={w - (isAvailable ? 28 : 31)}
            y={h - 11}
            fontSize={8}
            fontWeight="bold"
            fill={isAvailable ? "#166534" : "#991b1b"}
            textAnchor="middle"
          >
            {isAvailable ? "● FREI" : "● BELEGT"}
          </text>
        </g>
      )}
    </svg>
  );
}
