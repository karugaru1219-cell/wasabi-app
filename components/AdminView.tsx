
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

  // 表示モードに応じた日付範囲の生成
  const visibleDates = useMemo(() => {
    const base = new Date(selectedDate);
    if (viewMode === 'DAY') return [selectedDate];

    const dates: string[] = [];
    if (viewMode === 'WEEK') {
      const day = base.getDay(); // 0: Sun, 1: Mon...
      const diff = base.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を起点
      const monday = new Date(base.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (viewMode === 'MONTH') {
      const first = new Date(base.getFullYear(), base.getMonth(), 1);
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
    // 表示されている全日付の実績を確定
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
    actions.logAction('DAILY_VERIFY_BATCH', `Verified attendance records for range: ${visibleDates[0]} to ${visibleDates[visibleDates.length - 1]}`);
    alert('SUCCESS: All visible operations have been verified and locked!');
  };

  const handleSyncMaster = () => {
    actions.updateEmployees(localEmployees);
    actions.updateBranches(localBranches);
    actions.updateSettings(localSettings);
    actions.logAction('MASTER_SYNC', `Master Registry and Global settings updated.`);
    alert('SUCCESS: Master Settings Updated!');
  };

  const payrollSummary = useMemo(() => {
    const staffStats = employees.map(emp => {
      const records = attendance.filter(a => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && a.isWorking && a.isApproved &&
          (d.getMonth() + 1) === summaryMonth && d.getFullYear() === summaryYear;
      }).sort((a, b) => a.date.localeCompare(b.date));

      const totalHours = records.reduce((acc, r) => acc + calculateHoursPrecise(r.startTime, r.endTime), 0);
      const totalBonus = records.reduce((acc, r) => acc + (r.bonus || 0), 0);
      const basePay = Math.round(totalHours * settings.globalHourlyRate);
      return { id: emp.id, name: emp.name, hours: totalHours, basePay, bonus: totalBonus, total: basePay + totalBonus, records };
    });
    return { staffStats, companyTotal: staffStats.reduce((acc, s) => acc + s.total, 0), companyHours: staffStats.reduce((acc, s) => acc + s.hours, 0) };
  }, [employees, attendance, summaryMonth, summaryYear, settings.globalHourlyRate]);

  const activeStatement = useMemo(() => selectedStatementEmployee ? payrollSummary.staffStats.find(s => s.id === selectedStatementEmployee) : null, [selectedStatementEmployee, payrollSummary]);

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
              <label className="text-[10px] font-black text-gray-400 uppercase block tracking-[0.2em]">Operations Reference</label>
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
              const isDayFullyApproved = dailyRecords.every(r => !r.isWorking || r.isApproved);
              const d = new Date(date);
              const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <div key={date} className="space-y-4">
                  <div className="flex items-center gap-3 px-4">
                    <span className={`text-xs font-black tracking-widest ${isWeekend ? 'text-red-400' : 'text-gray-300'}`}>{dayName}</span>
                    <h4 className="text-lg font-black text-emerald-950">{date}</h4>
                    {isDayFullyApproved && (
                      <span className="flex items-center gap-1 bg-emerald-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Verified</span>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {dailyRecords.map(record => {
                      const emp = localEmployees.find(e => e.id === record.employeeId);
                      return (
                        <div key={record.employeeId} className={`bg-white p-5 rounded-[2rem] border-2 transition-all ${record.isApproved ? 'border-emerald-600/30 bg-emerald-50/10' : record.isWorking ? 'border-lime-500 bg-lime-50/5 shadow-md' : 'border-gray-50 opacity-50'}`}>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="font-black text-emerald-950 text-lg tracking-tight">{emp?.name}</span>
                              <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{localBranches.find(b => b.id === record.branchId)?.name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {record.isWorking && !record.isApproved && (
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                  <input type="time" value={record.startTime} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { startTime: e.target.value })} className="bg-transparent text-[11px] font-black outline-none px-2" />
                                  <span className="text-gray-300">→</span>
                                  <input type="time" value={record.endTime} onChange={(e) => handleUpdateRecordLocal(date, record.employeeId, { endTime: e.target.value })} className="bg-transparent text-[11px] font-black outline-none px-2" />
                                </div>
                              )}
                              <button
                                onClick={() => handleUpdateRecordLocal(date, record.employeeId, { isWorking: !record.isWorking })}
                                disabled={record.isApproved}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${record.isApproved ? 'bg-emerald-600 text-white opacity-40' : record.isWorking ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                              >
                                {record.isWorking ? 'WORKING' : 'OFF'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
            <button
              onClick={handleSyncDaily}
              className="w-full bg-lime-500 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-lime-600 border-b-4 border-lime-700"
            >
              COMMIT & LOCK {viewMode} OPERATIONS
            </button>
          </div>
        </div>
      )}

      {activeTab === 'CALENDAR' && (
        <CalendarGrid selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setViewMode('DAY'); setActiveTab('DAILY'); }} />
      )}

      {/* PAYROLL, MASTER, LOGS tabs remain unchanged as per request */}
      {activeTab === 'PAYROLL' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-emerald-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black tracking-tight uppercase tracking-[0.2em]">WASABI FINANCE</h2>
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
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Verified Liability</p>
                  <p className="text-4xl sm:text-5xl font-black tracking-tighter break-all leading-none">{payrollSummary.companyTotal.toLocaleString()} <span className="text-xl">UZS</span></p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Total Hours</p>
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
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">{s.hours.toFixed(2)}h • {settings.globalHourlyRate.toLocaleString()} UZS/h</p>
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
        </div>
      )}
      {activeTab === 'MASTER' && (
        <div className="space-y-8 animate-in fade-in pb-20">
          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Staff Registry</h3>
            {localEmployees.map(emp => (
              <div key={emp.id} className="p-6 bg-gray-50 rounded-[2rem] space-y-4 border border-gray-100">
                <div className="flex justify-between items-center">
                  <input className="bg-transparent font-black text-2xl text-emerald-950 tracking-tighter outline-none" value={emp.name} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, name: e.target.value } : p))} />
                  <button onClick={() => setLocalEmployees(localEmployees.filter(p => p.id !== emp.id))} className="text-red-400 p-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg></button>
                </div>
                <div className="relative">
                  <input type="text" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-black outline-none tracking-widest text-emerald-900" value={emp.password} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, password: e.target.value } : p))} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-200 uppercase pointer-events-none">Key</div>
                </div>
              </div>
            ))}
            <button onClick={() => setLocalEmployees([...localEmployees, { id: crypto.randomUUID(), name: 'NEW TALENT', branchId: localBranches[0]?.id || '', hourlyRate: localSettings.globalHourlyRate, password: 'olma' }])} className="w-full border-4 border-dashed border-gray-100 py-6 rounded-[2rem] text-gray-300 font-black hover:bg-gray-50 transition-all">+ Add Member</button>
          </section>
          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
            <button onClick={handleSyncMaster} className="w-full bg-emerald-950 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-black border-b-4 border-emerald-700">UPDATE MASTER REGISTRY</button>
          </div>
        </div>
      )}
      {activeTab === 'LOGS' && <ActionLogList />}
    </div>
  );
};

export default AdminView;
