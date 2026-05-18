/**
 * MultiplayerAvatars.tsx — Indicadores de usuários online (T3-134).
 */

import React from "react";
import { Users } from "lucide-react";
import { MultiplayerUser } from "../hooks/useMultiplayer";

interface MultiplayerAvatarsProps {
  users: MultiplayerUser[];
}

export const MultiplayerAvatars: React.FC<MultiplayerAvatarsProps> = ({ users }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 glass-premium rounded-full border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-lg">
      <div className="flex -space-x-2 overflow-hidden">
        {users.map((user) => (
          <div
            key={user.id}
            title={user.name}
            className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-900 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white uppercase"
          >
            {user.name.substring(0, 2)}
          </div>
        ))}
        {users.length === 0 && (
          <div className="h-6 w-6 rounded-full ring-2 ring-slate-900 bg-slate-800 flex items-center justify-center text-slate-500">
            <Users className="w-3 h-3" />
          </div>
        )}
      </div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
        {users.length} {users.length === 1 ? "Online" : "Colaboradores"}
      </span>
    </div>
  );
};
