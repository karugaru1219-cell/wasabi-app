
import React from 'react';
import { UserRole } from '../types';
import { useData } from '../context/DataContext';
import { SyncIndicator } from './SyncIndicator';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  employeeName?: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, employeeName, onLogout }) => {
  const { syncStatus } = useData();

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfcfa]">
      <header className="bg-white border-b border-lime-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm ${role === 'ADMIN' ? 'bg-emerald-600' : 'bg-lime-500'}`}>
              <span className="text-lg">W</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="font-black text-lg leading-none text-emerald-950 tracking-tighter">WASABI MONEY</span>
                <SyncIndicator status={syncStatus} />
              </div>
              <span className="text-[9px] font-bold text-lime-600 uppercase tracking-widest">Efficiency Redefined</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-lime-600 font-bold uppercase tracking-wider">
                {role === 'ADMIN' ? 'ADMIN MASTER' : 'STAFF MEMBER'}
              </p>
              <p className="text-sm font-black text-emerald-900">
                {employeeName || 'WASABI ADMIN'}
              </p>
            </div>
            <button 
              onClick={onLogout}
              className="bg-lime-50 text-lime-700 hover:bg-red-50 hover:text-red-500 transition-all p-2.5 rounded-xl border border-lime-100"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="bg-white border-t border-lime-50 py-6 text-center">
        <p className="text-[10px] font-bold text-lime-300 uppercase tracking-[0.2em] mb-1">Wasabi Smart Management System</p>
        <p className="text-[9px] text-gray-400">Powered by WASABI MONEY &copy; 2024</p>
      </footer>
    </div>
  );
};
