
import React from 'react';
import { SyncStatus } from '../hooks/useDatabase';

export const SyncIndicator: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const config = {
    synced: { color: 'text-lime-500', icon: 'M5 13l4 4L19 7', label: 'Synced', pulse: false },
    syncing: { color: 'text-yellow-500', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: 'Syncing', pulse: true },
    error: { color: 'text-red-500', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', label: 'Offline', pulse: false }
  };

  const current = config[status];

  return (
    <div className={`flex items-center space-x-1 ${current.color} transition-all duration-500`}>
      <svg className={`w-3.5 h-3.5 ${current.pulse ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
      </svg>
      <span className="text-[9px] font-black uppercase tracking-widest">{current.label}</span>
    </div>
  );
};
