import React from "react";
import { PapelBadge } from "../AdminPagePrimitives";

interface UsuarioAdmin { userId: string; papel: string }
interface EstatisticasPapel { distribuicao: Record<string, number> }

export function renderUsuarios(d: unknown): React.ReactNode {
  const ud = d as { total: number; usuarios: UsuarioAdmin[] } | undefined;
  if (!ud) return null;
  if (ud.total === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum usuário cadastrado.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{ud.total} usuário(s)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
              <th className="pb-2 pr-4">Usuário</th>
              <th className="pb-2">Papel</th>
            </tr>
          </thead>
          <tbody>
            {ud.usuarios.map((u) => (
              <tr key={u.userId} className="border-t border-slate-200/50 dark:border-slate-700/50">
                <td className="py-1.5 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">{u.userId}</td>
                <td className="py-1.5"><PapelBadge papel={u.papel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function renderPapeis(d: unknown): React.ReactNode {
  const pd = d as EstatisticasPapel | undefined;
  if (!pd) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(pd.distribuicao).map(([p, count]) => (
        <div key={p} className="flex items-center justify-between p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/40">
          <PapelBadge papel={p} />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{count}</span>
        </div>
      ))}
    </div>
  );
}
