
import React from 'react';
import { useData } from '../../context/DataContext';

export const ActionLogList: React.FC = () => {
  const { logs } = useData();

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 text-emerald-950">Security Audit Logs</h3>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-gray-300 text-[10px] font-black uppercase tracking-widest italic">No activity recorded</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-emerald-950 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">{log.action}</span>
                    <span className="text-[9px] text-gray-400 font-bold">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-900 leading-tight">{log.details}</p>
                </div>
                <div className="text-[8px] font-black text-gray-300 uppercase tracking-tighter">ID: {log.id.slice(0, 8)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
