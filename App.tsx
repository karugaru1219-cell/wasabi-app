
import React from 'react';
import { DataProvider, useData } from './context/DataContext';
import AuthScreen from './components/Auth';
import EmployeeView from './components/EmployeeView';
import AdminView from './components/AdminView';
import { Layout } from './components/Layout';
import { isSupabaseConfigured } from './lib/supabase';

const AppContent: React.FC = () => {
  const { role, currentEmployee, isLoading, actions, syncStatus } = useData();

  // 1. 環境設定エラー時の診断画面
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#050a0a] flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🚨</div>
            <h1 className="text-xl font-black text-red-400 uppercase tracking-tighter">Database Connection Error</h1>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest leading-relaxed">
              Vercelの環境設定（Environment Variables）が未完了です。
            </p>
          </div>

          <div className="bg-black/50 p-6 rounded-2xl border border-white/5 space-y-4 mb-8">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Settings:</h2>
            <ul className="text-[11px] text-slate-300 space-y-2 list-disc ml-4 font-bold">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
            <p className="text-[9px] text-yellow-500/80 font-bold leading-relaxed">
              ※ VercelのSettingsで追加した後、必ず「Redeploy」を実行してください。
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all"
          >
            設定完了後にリロード
          </button>
        </div>
      </div>
    );
  }

  // 2. ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-black text-emerald-950 tracking-tighter uppercase">WASABI MONEY</h1>
        <p className="text-[9px] font-black text-lime-500 mt-2 animate-pulse uppercase tracking-[0.2em]">Synchronizing Realtime Core...</p>
      </div>
    );
  }

  // 3. メイン画面
  return (
    <div className="relative min-h-screen">
      {!role ? (
        <AuthScreen />
      ) : (
        <Layout role={role} employeeName={currentEmployee?.name} onLogout={actions.logout}>
          {role === 'USER' ? <EmployeeView /> : <AdminView />}
        </Layout>
      )}

      {/* 右下の状態バッジ */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
        <div className="bg-emerald-950 text-white opacity-40 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-lime-400"></div>
          {`SQL_SYNC: ${syncStatus}`}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <DataProvider>
    <AppContent />
  </DataProvider>
);

export default App;
