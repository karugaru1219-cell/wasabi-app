
import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const AuthScreen: React.FC = () => {
  const { employees, settings, actions } = useData();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeePasswordInput, setEmployeePasswordInput] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [error, setError] = useState('');

  const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));

  const handleUserLogin = () => {
    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (employee) {
      if (employee.password === employeePasswordInput) {
        actions.login('USER', employee);
      } else {
        setError('Invalid access key.');
        setEmployeePasswordInput('');
      }
    }
  };

  const handleAdminAuth = () => {
    if (adminPasswordInput === settings.adminPassword) {
      actions.login('ADMIN', null);
    } else {
      setError('Unauthorized access key.');
      setAdminPasswordInput('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white animate-in fade-in duration-500">
      <div className="w-full max-w-xs space-y-12">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce duration-1000">🥬</div>
          <h1 className="text-4xl font-black text-emerald-950 tracking-tighter mb-1">WASABI MONEY</h1>
          <p className="text-[11px] font-black text-lime-600 uppercase tracking-[0.5em]">Scheduling OS 3.4.1</p>
        </div>

        <div className="space-y-6">
          {!showAdminLogin ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="relative group">
                  <select
                    className="w-full bg-gray-50 border-2 border-transparent border-gray-100 focus:border-lime-400 rounded-[1.5rem] px-6 py-5 font-black text-emerald-950 outline-none appearance-none transition-all shadow-inner"
                    value={selectedEmployeeId}
                    onChange={(e) => { setSelectedEmployeeId(e.target.value); setError(''); setEmployeePasswordInput(''); }}
                  >
                    <option value="">Select Identity...</option>
                    {sortedEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-hover:opacity-100 transition-opacity">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                </div>

                {selectedEmployeeId && (
                  <input
                    type="password"
                    placeholder="Enter Secret Key"
                    className="w-full bg-gray-50 border-2 border-transparent border-gray-100 focus:border-lime-400 rounded-[1.5rem] px-6 py-5 font-black text-emerald-950 outline-none text-center animate-in slide-in-from-top-2 duration-300 shadow-inner"
                    value={employeePasswordInput}
                    onChange={(e) => { setEmployeePasswordInput(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUserLogin()}
                  />
                )}
              </div>

              {error && <p className="text-[11px] font-black text-red-500 text-center uppercase tracking-widest animate-pulse">{error}</p>}

              <button
                onClick={handleUserLogin}
                disabled={!selectedEmployeeId || !employeePasswordInput}
                className="w-full bg-lime-500 disabled:bg-gray-100 disabled:opacity-50 text-white font-black py-5 rounded-[1.5rem] text-sm tracking-[0.2em] transition-all active:scale-95 shadow-xl hover:bg-lime-600 border-b-4 border-lime-700"
              >
                AUTHORIZE ACCESS
              </button>

              <button
                onClick={() => setShowAdminLogin(true)}
                className="w-full text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] hover:text-emerald-500 transition-colors"
              >
                Switch to Admin Mode
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <input
                type="password"
                placeholder="ADMIN MASTER KEY"
                className="w-full bg-emerald-50 border-2 border-transparent border-emerald-100 focus:border-emerald-500 rounded-[1.5rem] px-6 py-5 font-black text-emerald-950 outline-none text-center shadow-inner"
                value={adminPasswordInput}
                onChange={(e) => { setAdminPasswordInput(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminAuth()}
                autoFocus
              />
              {error && <p className="text-[11px] font-black text-red-500 text-center uppercase tracking-widest animate-pulse">{error}</p>}
              <button onClick={handleAdminAuth} className="w-full bg-emerald-950 text-white font-black py-5 rounded-[1.5rem] text-sm tracking-[0.2em] shadow-xl border-b-4 border-black">AUTHENTICATE MASTER</button>
              <button onClick={() => setShowAdminLogin(false)} className="w-full text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] hover:text-lime-500 transition-colors">Staff Terminal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
