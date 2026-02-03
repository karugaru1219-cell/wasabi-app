
import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceRecord, Employee, Branch, SystemSettings } from '../types';
import { useData } from '../context/DataContext';
import { CalendarGrid } from './admin/CalendarGrid';
import { ActionLogList } from './admin/ActionLogList';

const AdminView: React.FC = () => {
  const { branches, employees, shifts, attendance, settings, actions } = useData();
  const [activeTab, setActiveTab] = useState<'DAILY' | 'CALENDAR' | 'PAYROLL' | 'MASTER' | 'LOGS'>('DAILY');
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [selectedStatementEmployee, setSelectedStatementEmployee] = useState<string | null>(null);

  const [localEmployees, setLocalEmployees] = useState<Employee[]>([]);
  const [localBranches, setLocalBranches] = useState<Branch[]>([]);
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    setLocalEmployees(employees);
    setLocalBranches(branches);
    setLocalSettings(settings);
    setLocalAttendance(attendance);
  }, [employees, branches, settings, attendance]);

  const calculateHoursPrecise = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const diff = (eH * 60 + eM) - (sH * 60 + sM);
    return diff > 0 ? diff / 60 : 0;
  };

  const getAttendanceForDate = (date: string) => {
    return localEmployees.map(emp => {
      const existing = localAttendance.find(a => a.employeeId === emp.id && a.date === date);
      if (existing) return existing;

      const shift = shifts.find(s => s.employeeId === emp.id && s.date === date);
      return {
        id: `${emp.id}-${date}`,
        employeeId: emp.id,
        branchId: shift ? shift.branchId : (localBranches[0]?.id || ''),
        date: date,
        isWorking: shift ? shift.isWorking : false,
        startTime: shift ? shift.startTime : `${localSettings.defaultStartHour.toString().padStart(2, '0')}:00`,
        endTime: shift ? shift.endTime : `${localSettings.defaultEndHour.toString().padStart(2, '0')}:00`,
        isApproved: false,
        bonus: 0
      } as AttendanceRecord;
    });
  };

  const visibleDates = useMemo(() => {
    const base = new Date(selectedDate);
    if (viewMode === 'DAY') return [selectedDate];

    const dates: string[] = [];
    if (viewMode === 'WEEK') {
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(base.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (viewMode === 'MONTH') {
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      for (let i = 1; i <= last.getDate(); i++) {
        const d = new Date(base.getFullYear(), base.getMonth(), i);
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    return dates;
  }, [selectedDate, viewMode]);

  const handleUpdateRecordLocal = (date: string, empId: string, updates: Partial<AttendanceRecord>) => {
    const newAttendance = [...localAttendance];
    const idx = newAttendance.findIndex(orig => orig.employeeId === empId && orig.date === date);

    if (idx > -1) {
      newAttendance[idx] = { ...newAttendance[idx], ...updates };
    } else {
      const current = getAttendanceForDate(date).find(r => r.employeeId === empId);
      if (current) newAttendance.push({ ...current, ...updates });
    }
    setLocalAttendance(newAttendance);
  };

  const handleSyncDaily = () => {
    let finalBatch = [...localAttendance];
    visibleDates.forEach(date => {
      const dailyRecords = getAttendanceForDate(date).map(a => ({ ...a, isApproved: true }));
      dailyRecords.forEach(rec => {
        const idx = finalBatch.findIndex(orig => orig.employeeId === rec.employeeId && orig.date === rec.date);
        if (idx > -1) finalBatch[idx] = rec;
        else finalBatch.push(rec);
      });
    });

    actions.updateAttendance(finalBatch);
    actions.logAction('DAILY_VERIFY', `Verified range: ${visibleDates[0]} to ${visibleDates[visibleDates.length - 1]}`);
    alert('SUCCESS: Records verified and locked for employees.');
  };

  const handleSyncMaster = () => {
    actions.updateEmployees(localEmployees);
    actions.updateSettings(localSettings);
    actions.logAction('MASTER_SYNC', `Master Registry updated.`);
    alert('SUCCESS: Master Settings Updated!');
  };

  const payrollSummary = useMemo(() => {
    const staffStats = employees.map(emp => {
      const records = attendance.filter(a => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && a.isWorking && a.isApproved &&
          (d.getMonth() + 1) === summaryMonth && d.getFullYear() === summaryYear;
      }).sort((a, b) => a.date.localeCompare(b.date));

      const rateToUse = emp.hourlyRate || settings.globalHourlyRate;
      const totalHours = records.reduce((acc, r) => acc + calculateHoursPrecise(r.startTime, r.endTime), 0);
      const totalBonus = records.reduce((acc, r) => acc + (r.bonus || 0), 0);
      const basePay = Math.round(totalHours * rateToUse);

      return {
        id: emp.id,
        name: emp.name,
        rate: rateToUse,
        hours: totalHours,
        basePay,
        bonus: totalBonus,
        total: basePay + totalBonus,
        records
      };
    });
    return {
      staffStats,
      companyTotal: staffStats.reduce((acc, s) => acc + s.total, 0),
      companyHours: staffStats.reduce((acc, s) => acc + s.hours, 0)
    };
  }, [employees, attendance, summaryMonth, summaryYear, settings.globalHourlyRate]);

  const activeStatement = useMemo(() => {
    if (!selectedStatementEmployee) return null;
    return payrollSummary.staffStats.find(s => s.id === selectedStatementEmployee);
  }, [selectedStatementEmployee, payrollSummary]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32">
      <nav className="flex bg-gray-100 p-1.5 rounded-[1.5rem] shadow-inner overflow-x-auto no-scrollbar">
        {(['DAILY', 'CALENDAR', 'PAYROLL', 'MASTER', 'LOGS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-none px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-emerald-950 shadow-xl' : 'text-gray-400'}`}
          >
            {tab === 'DAILY' ? 'Operations' : tab === 'CALENDAR' ? 'Calendar' : tab === 'PAYROLL' ? 'Finance' : tab === 'MASTER' ? 'Hub' : 'Logs'}
          </button>
        ))}
      </nav>

      {activeTab === 'DAILY' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-[10px] font-black text-gray-400 uppercase block tracking-[0.2em]">Reference Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-3xl font-black text-emerald-950 outline-none bg-transparent tracking-tighter w-full sm:w-auto" />
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
              {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="space-y-10">
            {visibleDates.map(date => {
              const dailyRecords = getAttendanceForDate(date);
              const d = new Date(date);
              const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-3 px-4">
                    <span className={`text-xs font-black tracking-widest ${isWeekend ? 'text-red-400' : 'text-gray-300'}`}>{dayName}</span>
                    <h4 className="text-lg font-black text-emerald-950">{date}</h4>
                  </div>

                  <div className="grid gap-3">
                    {dailyRecords.map(record => {
                      const emp = localEmployees.find(e => e.id === record.employeeId);
                      return (
                        <div key={record.employeeId} className={`bg-white p-5 rounded-[2.5rem] border-2 transition-all ${record.isApproved ? 'border-emerald-600 shadow-sm' : record.isWorking ? 'border-lime-500 bg-lime-50/5 shadow-md' : 'border-gray-50 opacity-50'}`}>
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-emerald-950 text-xl tracking-tight leading-none">{emp?.name}</span>
                                {record.isApproved && <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Verified</span>}
                              </div>
                              <span className="text-[10px] font-black text-lime-600 uppercase mt-1 tracking-widest">{localBranches.find(b => b.id === record.branchId)?.name || 'NO BRANCH'}</span>
                            </div>
                            <button
                              onClick={() => handleUpdateRecordLocal(date, record.employeeId, { isWorking: !record.isWorking })}
                              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${record.isWorking ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                            >
                              {record.isWorking ? 'ON-DUTY' : 'OFF'}
                            </button>
                          </div>
                          {record.isWorking && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase">Start</label>
                                <input type="time" value={record.startTime} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { startTime: e.target.value })} className="w-full bg-gray-50 rounded-xl px-2 py-2 text-[11px] font-black" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase">End</label>
                                <input type="time" value={record.endTime} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { endTime: e.target.value })} className="w-full bg-gray-50 rounded-xl px-2 py-2 text-[11px] font-black" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase">Branch</label>
                                <select value={record.branchId} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { branchId: e.target.value })} className="w-full bg-gray-50 rounded-xl px-2 py-2 text-[11px] font-black">
                                  {localBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase">Bonus</label>
                                <input type="number" placeholder="Bonus" value={record.bonus || ''} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { bonus: Number(e.target.value) })} className="w-full bg-gray-50 rounded-xl px-2 py-2 text-[11px] font-black" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
            <button onClick={handleSyncDaily} className="w-full bg-lime-500 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all border-b-4 border-lime-700">COMMIT & LOCK ALL VISIBLE</button>
          </div>
        </div>
      )}

      {activeTab === 'CALENDAR' && (
        <CalendarGrid selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setViewMode('DAY'); setActiveTab('DAILY'); }} />
      )}

      {activeTab === 'PAYROLL' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-emerald-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black tracking-tight uppercase tracking-[0.2em]">FINANCE</h2>
                <div className="flex gap-2">
                  <select value={summaryYear} onChange={(e) => setSummaryYear(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-white">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-white">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Total Liability</p>
                  <p className="text-4xl sm:text-5xl font-black tracking-tighter truncate leading-none">{payrollSummary.companyTotal.toLocaleString()} <span className="text-xl">UZS</span></p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Worked Hours</p>
                  <p className="text-4xl sm:text-5xl font-black tracking-tighter leading-none">{payrollSummary.companyHours.toFixed(1)}<span className="text-xl ml-1">h</span></p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
            {payrollSummary.staffStats.map(s => (
              <div key={s.id} className="p-7 flex justify-between items-center hover:bg-gray-50/50 transition-all">
                <div className="flex-1">
                  <p className="font-black text-emerald-950 text-xl tracking-tighter">{s.name}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">{s.hours.toFixed(2)}h • {s.rate.toLocaleString()} UZS/h</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <p className="font-black text-emerald-950 text-2xl tracking-tighter truncate max-w-[120px]">{s.total.toLocaleString()} <span className="text-xs">UZS</span></p>
                  <button onClick={() => setSelectedStatementEmployee(s.id)} className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl hover:bg-emerald-100 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {activeStatement && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 bg-emerald-950 text-white flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter uppercase">Pay Statement</h3>
                    <p className="text-[10px] font-bold text-lime-400 tracking-[0.3em] uppercase">{activeStatement.name} / {summaryYear}-{String(summaryMonth).padStart(2, '0')}</p>
                  </div>
                  <button onClick={() => setSelectedStatementEmployee(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-8 overflow-y-auto no-scrollbar flex-1 space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-gray-50 rounded-[2rem]">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Hours</p>
                      <p className="text-2xl font-black text-emerald-950">{activeStatement.hours.toFixed(2)}h</p>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-[2rem]">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Bonuses</p>
                      <p className="text-2xl font-black text-emerald-950">{activeStatement.bonus.toLocaleString()} <span className="text-[10px]">UZS</span></p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] pl-1">Earnings Breakdown</h4>
                    <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400">
                          <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Hrs</th><th className="px-6 py-4 text-right">Pay (inc. bonus)</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {activeStatement.records.map(r => {
                            const h = calculateHoursPrecise(r.startTime, r.endTime);
                            const pay = Math.round(h * activeStatement.rate) + (r.bonus || 0);
                            return (
                              <tr key={r.id} className="text-[12px] font-black text-emerald-950">
                                <td className="px-6 py-4">{r.date.split('-')[2]}</td>
                                <td className="px-6 py-4">{h.toFixed(1)}</td>
                                <td className="px-6 py-4 text-right">{pay.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
                  <div className="flex justify-between items-end mb-6">
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.5em]">Net Payout</p>
                    <p className="text-4xl font-black tracking-tighter text-emerald-950">{activeStatement.total.toLocaleString()} <span className="text-lg">UZS</span></p>
                  </div>
                  <button onClick={() => setSelectedStatementEmployee(null)} className="w-full bg-emerald-950 text-white font-black py-5 rounded-[2rem] text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">Close Statement</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'MASTER' && (
        <div className="space-y-8 animate-in fade-in pb-20">
          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Staff Registry</h3>
            <div className="grid gap-4">
              {localEmployees.map(emp => (
                <div key={emp.id} className="p-6 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-5 shadow-inner">
                  <div className="flex justify-between items-center">
                    <input className="bg-transparent font-black text-2xl text-emerald-950 tracking-tighter outline-none w-2/3" value={emp.name} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, name: e.target.value } : p))} />
                    <button onClick={() => setLocalEmployees(localEmployees.filter(p => p.id !== emp.id))} className="text-red-400 p-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">Hourly Rate</label>
                      <input type="number" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black outline-none tracking-widest" value={emp.hourlyRate || ''} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, hourlyRate: Number(e.target.value) } : p))} placeholder={localSettings.globalHourlyRate.toString()} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">Key</label>
                      <input type="text" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black outline-none tracking-widest" value={emp.password} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, password: e.target.value } : p))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setLocalEmployees([...localEmployees, { id: crypto.randomUUID(), name: 'New Name', branchId: branches[0]?.id || '', hourlyRate: localSettings.globalHourlyRate, password: 'olma' }])} className="w-full border-4 border-dashed border-gray-100 py-6 rounded-[2.5rem] text-gray-300 font-black hover:bg-gray-50 transition-all">+ ADD NEW TEAM MEMBER</button>
          </section>

          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Global Defaults</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Default Hourly Rate (UZS)</label>
                <input type="number" className="w-full bg-gray-50 rounded-2xl px-6 py-4 font-black text-xl outline-none" value={localSettings.globalHourlyRate} onChange={(e) => setLocalSettings({ ...localSettings, globalHourlyRate: Number(e.target.value) })} />
              </div>
            </div>
          </section>

          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
            <button onClick={handleSyncMaster} className="w-full bg-emerald-950 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all border-b-4 border-black">SYNC MASTER REGISTRY</button>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && <ActionLogList />}
    </div>
  );
};

export default AdminView;
