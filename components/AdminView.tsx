
import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceRecord, Employee, Branch, SystemSettings } from '../types';
import { useData } from '../context/DataContext';
import { CalendarGrid } from './admin/CalendarGrid';
import { ActionLogList } from './admin/ActionLogList';
import { TimelineView } from './admin/TimelineView';

const AdminView: React.FC = () => {
  const { branches, employees, shifts, attendance, settings, actions } = useData();
  const [activeTab, setActiveTab] = useState<'DAILY' | 'CALENDAR' | 'PAYROLL' | 'MASTER' | 'LOGS'>('DAILY');
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [displayType, setDisplayType] = useState<'LIST' | 'VISUAL'>('VISUAL');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [selectedStatementEmployee, setSelectedStatementEmployee] = useState<string | null>(null);

  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);

  const calculateHoursPrecise = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let startTotal = sH + sM / 60;
    let endTotal = eH + eM / 60;
    if (endTotal < startTotal) endTotal += 24;
    const diff = endTotal - startTotal;
    return diff > 0 ? diff : 0;
  };

  const getAttendanceForDate = (date: string) => {
    return employees.map(emp => {
      const existing = localAttendance.find(a => a.employeeId === emp.id && a.date === date);
      if (existing) return existing;

      const shift = shifts.find(s => s.employeeId === emp.id && s.date === date);
      return {
        id: `${emp.id}-${date}`,
        employeeId: emp.id,
        branchId: shift ? shift.branchId : (branches.find(b => b.id === emp.branchId)?.id || branches[0]?.id || ''),
        date: date,
        isWorking: shift ? shift.isWorking : false,
        startTime: shift ? shift.startTime : `${settings.defaultStartHour.toString().padStart(2, '0')}:00`,
        endTime: shift ? shift.endTime : `${settings.defaultEndHour.toString().padStart(2, '0')}:00`,
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
    setLocalAttendance(prev => {
      const idx = prev.findIndex(a => a.employeeId === empId && a.date === date);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updates };
        return next;
      } else {
        const current = getAttendanceForDate(date).find(r => r.employeeId === empId);
        return [...prev, { ...current, ...updates } as AttendanceRecord];
      }
    });
  };

  const handleSyncDaily = () => {
    let finalPayload = [...attendance];
    visibleDates.forEach(date => {
      const dailyRecords = getAttendanceForDate(date);
      dailyRecords.forEach(rec => {
        const toSave = { ...rec, isApproved: true };
        const existingIdx = finalPayload.findIndex(p => p.employeeId === toSave.employeeId && p.date === toSave.date);
        if (existingIdx > -1) {
          finalPayload[existingIdx] = toSave;
        } else {
          finalPayload.push(toSave);
        }
      });
    });
    actions.updateAttendance(finalPayload);
    actions.logAction('DAILY_VERIFY', `COMMIT: Branch/Bonus sync for ${visibleDates.length} days.`);
    alert('SUCCESS: Attendance verified and Branch/Bonus updated.');
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
    }).sort((a, b) => b.total - a.total);

    return { staffStats, companyTotal: staffStats.reduce((acc, s) => acc + s.total, 0), companyHours: staffStats.reduce((acc, s) => acc + s.hours, 0) };
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
          <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 w-full sm:w-auto text-center sm:text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase block tracking-[0.2em]">Reference Date</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-3xl font-black text-emerald-950 outline-none bg-transparent tracking-tighter w-full sm:w-auto" />
              </div>
              <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
                {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>{m}</button>
                ))}
              </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl self-center sm:self-end">
              <button onClick={() => setDisplayType('LIST')} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${displayType === 'LIST' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-400'}`}>LIST</button>
              <button onClick={() => setDisplayType('VISUAL')} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${displayType === 'VISUAL' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-400'}`}>TIMELINE</button>
            </div>
          </div>

          {displayType === 'VISUAL' ? (
            <div className="space-y-10">
              {visibleDates.map(date => (
                <div key={date} className="space-y-4 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-2">
                    <h4 className="text-lg font-black text-emerald-950">{date}</h4>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Visual Map</span>
                  </div>
                  <TimelineView date={date} attendance={getAttendanceForDate(date)} onUpdate={(empId, updates) => handleUpdateRecordLocal(date, empId, updates)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {visibleDates.map(date => (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-3 px-4">
                    <h4 className="text-lg font-black text-emerald-950">{date}</h4>
                  </div>
                  <div className="grid gap-3">
                    {getAttendanceForDate(date).map(record => {
                      const emp = employees.find(e => e.id === record.employeeId);
                      return (
                        <div key={record.employeeId} className={`bg-white p-5 rounded-[2rem] border-2 transition-all ${record.isApproved ? 'border-emerald-600 shadow-sm' : record.isWorking ? 'border-lime-500 bg-lime-50/5 shadow-md' : 'border-gray-50 opacity-50'}`}>
                          <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-emerald-950 text-xl">{emp?.name}</span>
                            <button onClick={() => handleUpdateRecordLocal(date, record.employeeId, { isWorking: !record.isWorking })} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${record.isWorking ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{record.isWorking ? 'WORKING' : 'OFF'}</button>
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
                                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-gray-400 uppercase">Bonus</label>
                                <input type="number" value={record.bonus || ''} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { bonus: Number(e.target.value) })} placeholder="0" className="w-full bg-gray-50 rounded-xl px-2 py-2 text-[11px] font-black" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-black tracking-[0.2em] mb-4">FINANCE OVERVIEW</h2>
                <div className="grid grid-cols-2 gap-8">
                  <div><p className="text-lime-400 text-[10px] font-black uppercase">Total Cost</p><p className="text-3xl font-black">{payrollSummary.companyTotal.toLocaleString()} UZS</p></div>
                  <div><p className="text-lime-400 text-[10px] font-black uppercase">Total Hrs</p><p className="text-3xl font-black">{payrollSummary.companyHours.toFixed(1)}h</p></div>
                </div>
              </div>
              <div className="flex gap-2">
                <select value={summaryYear} onChange={(e) => setSummaryYear(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-white">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-white">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
            {payrollSummary.staffStats.map(s => (
              <div key={s.id} className="p-7 flex justify-between items-center hover:bg-gray-50/50 transition-all">
                <div>
                  <p className="font-black text-emerald-950 text-xl tracking-tighter">{s.name}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase">{s.hours.toFixed(2)}h • {s.rate.toLocaleString()} UZS/h</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <p className="font-black text-emerald-950 text-2xl tracking-tighter">{s.total.toLocaleString()} <span className="text-xs">UZS</span></p>
                  <button onClick={() => setSelectedStatementEmployee(s.id)} className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl hover:bg-emerald-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg></button>
                </div>
              </div>
            ))}
          </div>

          {activeStatement && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-8 bg-emerald-950 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-2xl font-black tracking-tighter uppercase">{activeStatement.name}'s Statement</h3>
                  <button onClick={() => setSelectedStatementEmployee(null)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                </div>
                <div className="p-8 overflow-y-auto no-scrollbar flex-1 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-gray-50 rounded-[2rem]"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Worked Hrs</p><p className="text-2xl font-black text-emerald-950">{activeStatement.hours.toFixed(2)}h</p></div>
                    <div className="p-5 bg-gray-50 rounded-[2rem]"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Bonuses</p><p className="text-2xl font-black text-emerald-950">{activeStatement.bonus.toLocaleString()} UZS</p></div>
                  </div>
                  <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Hrs</th><th className="px-6 py-4 text-right">Earning</th></tr></thead>
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
                <div className="p-8 bg-gray-50 border-t border-gray-100 shrink-0 flex justify-between items-center">
                  <p className="text-4xl font-black text-emerald-950">{activeStatement.total.toLocaleString()} <span className="text-lg">UZS</span></p>
                  <button onClick={() => setSelectedStatementEmployee(null)} className="bg-emerald-950 text-white font-black px-8 py-4 rounded-[1.5rem] text-[10px] uppercase tracking-widest">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'MASTER' && (
        <div className="space-y-8 pb-20">
          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Staff Registry</h3>
            <div className="grid gap-4">
              {employees.map(emp => (
                <div key={emp.id} className="p-6 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-2xl text-emerald-950 tracking-tighter">{emp.name}</span>
                    <button onClick={() => actions.removeEmployee(emp.id, employees.filter(e => e.id !== emp.id))} className="text-red-400 p-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[8px] font-black text-gray-400 uppercase">Rate</label><input type="number" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black" defaultValue={emp.hourlyRate} onBlur={(e) => actions.updateEmployees(employees.map(p => p.id === emp.id ? { ...p, hourlyRate: Number(e.target.value) } : p))} /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-gray-400 uppercase">Key</label><input type="text" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black" defaultValue={emp.password} onBlur={(e) => actions.updateEmployees(employees.map(p => p.id === emp.id ? { ...p, password: e.target.value } : p))} /></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => actions.updateEmployees([...employees, { id: crypto.randomUUID(), name: 'New Staff', branchId: branches[0]?.id || '', hourlyRate: settings.globalHourlyRate, password: 'olma' }])} className="w-full border-4 border-dashed border-gray-100 py-6 rounded-[2.5rem] text-gray-300 font-black">+ ADD NEW TEAM MEMBER</button>
          </section>
        </div>
      )}

      {activeTab === 'LOGS' && <ActionLogList />}
    </div>
  );
};

export default AdminView;
