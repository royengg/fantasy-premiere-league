import { useState } from "react";
import type { Player } from "@fantasy-cricket/types";

interface CricketFieldProps {
  players: Player[];
  selectedIds: string[];
  captainId: string;
  viceCaptainId: string;
  onPositionClick?: (index: number) => void;
}

const positions = [
  { x: 50, y: 82, label: "WK", name: "Wicket Keeper" },
  { x: 30, y: 68, label: "SLIP", name: "Slip" },
  { x: 70, y: 68, label: "SLIP", name: "Second Slip" },
  { x: 18, y: 50, label: "POINT", name: "Point" },
  { x: 82, y: 50, label: "GULLY", name: "Gully" },
  { x: 15, y: 32, label: "COVER", name: "Cover" },
  { x: 85, y: 32, label: "MID-OFF", name: "Mid-Off" },
  { x: 50, y: 18, label: "MID-ON", name: "Mid-On" },
  { x: 30, y: 20, label: "FINE", name: "Fine Leg" },
  { x: 70, y: 20, label: "3RD", name: "Third Man" },
  { x: 50, y: 50, label: "BOWL", name: "Bowler" }
];

export function CricketField({ players, selectedIds, captainId, viceCaptainId, onPositionClick }: CricketFieldProps) {
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const selectedPlayers = players.filter(p => selectedIds.includes(p.id));

  const getPlayerAtPosition = (index: number) => selectedPlayers[index];

  const getRoleColor = (role: string) => {
    switch (role) {
      case "WK": return "#3b82f6";
      case "BAT": return "#22c55e";
      case "AR": return "#f97316";
      case "BOWL": return "#a855f7";
      default: return "#71717a";
    }
  };

  const getRoleBg = (role: string) => {
    switch (role) {
      case "WK": return "rgba(59, 130, 246, 0.2)";
      case "BAT": return "rgba(34, 197, 94, 0.2)";
      case "AR": return "rgba(249, 115, 22, 0.2)";
      case "BOWL": return "rgba(168, 85, 247, 0.2)";
      default: return "rgba(113, 113, 122, 0.2)";
    }
  };

  return (
    <div className="relative w-full aspect-square max-w-lg mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <radialGradient id="pitchGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4a574" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#c4956a" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="outfieldGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#166534" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14532d" stopOpacity="0.6" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <ellipse cx="50" cy="50" rx="46" ry="46" fill="url(#outfieldGradient)" stroke="#22c55e" strokeWidth="0.3" strokeOpacity="0.3" />
        
        <ellipse cx="50" cy="50" rx="28" ry="28" fill="none" stroke="#22c55e" strokeWidth="0.2" strokeOpacity="0.4" />
        
        <rect x="43" y="30" width="14" height="40" rx="1" fill="url(#pitchGradient)" stroke="#8b7355" strokeWidth="0.3" strokeOpacity="0.5" />
        
        <rect x="45" y="33" width="10" height="1.5" rx="0.3" fill="#fff" fillOpacity="0.4" />
        <rect x="45" y="65.5" width="10" height="1.5" rx="0.3" fill="#fff" fillOpacity="0.4" />
        
        <g stroke="#fff" strokeWidth="0.4" strokeOpacity="0.5">
          <rect x="46" y="35" width="1" height="4" />
          <rect x="49" y="35" width="1" height="4" />
          <rect x="52" y="35" width="1" height="4" />
          <rect x="46" y="61" width="1" height="4" />
          <rect x="49" y="61" width="1" height="4" />
          <rect x="52" y="61" width="1" height="4" />
        </g>
        
        <circle cx="50" cy="50" r="0.8" fill="#fff" fillOpacity="0.6" />
        
        <rect x="44" y="45" width="12" height="10" fill="none" stroke="#fff" strokeWidth="0.3" strokeOpacity="0.4" rx="0.5" />
        
        {positions.map((pos, index) => {
          const player = getPlayerAtPosition(index);
          const hasPlayer = !!player;
          const isCaptain = player?.id === captainId;
          const isViceCaptain = player?.id === viceCaptainId;
          const isHovered = hoveredPos === index;
          
          return (
            <g 
              key={index}
              onMouseEnter={() => setHoveredPos(index)}
              onMouseLeave={() => setHoveredPos(null)}
              onClick={() => onPositionClick?.(index)}
              style={{ cursor: onPositionClick ? 'pointer' : 'default' }}
            >
              {hasPlayer && (
                <>
                  {(isCaptain || isViceCaptain) && (
                    <g>
                      <circle
                        cx={pos.x}
                        cy={pos.y - 8}
                        r="2.5"
                        fill={isCaptain ? "#eab308" : "#94a3b8"}
                        filter="url(#glow)"
                      />
                      <text
                        x={pos.x}
                        y={pos.y - 7.5}
                        textAnchor="middle"
                        fill="#000"
                        fontSize="2"
                        fontWeight="bold"
                      >
                        {isCaptain ? "C" : "VC"}
                      </text>
                    </g>
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="6"
                    fill={getRoleColor(player.role)}
                    stroke="#fff"
                    strokeWidth="0.5"
                    strokeOpacity="0.9"
                    filter={isHovered ? "url(#glow)" : undefined}
                    style={{ transition: 'r 0.2s' }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 0.8}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="3"
                    fontWeight="bold"
                  >
                    {player.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </text>
                  {isHovered && (
                    <text
                      x={pos.x}
                      y={pos.y + 12}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="2.5"
                      fontWeight="600"
                      opacity="0.9"
                    >
                      {player.name.split(" ").slice(-1)[0]}
                    </text>
                  )}
                </>
              )}
              {!hasPlayer && (
                <>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="5"
                    fill={isHovered ? "rgba(255,255,255,0.05)" : "transparent"}
                    stroke="#fff"
                    strokeWidth="0.3"
                    strokeOpacity={isHovered ? "0.3" : "0.15"}
                    strokeDasharray="2 1.5"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 0.8}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="2.2"
                    fontWeight="500"
                    opacity={isHovered ? "0.5" : "0.25"}
                  >
                    {index + 1}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-3 text-[10px] text-text-muted py-1">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
          <span>WK</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
          <span>BAT</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
          <span>AR</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
          <span>BOWL</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
          <span>C</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
          <span>VC</span>
        </div>
      </div>
    </div>
  );
}