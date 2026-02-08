
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

  // ローカルでの編集用ステート
  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);

  // 外部（DB）のデータが更新されたらローカルステートに同期
  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);

  const calculateHoursPrecise = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let startTotal = sH + sM / 60;
    let endTotal = eH + eM / 60;
    if (endTotal < startTotal) endTotal += 24; // 深夜跨ぎ対応
    const diff = endTotal - startTotal;
    return diff > 0 ? diff : 0;
  };

  const getAttendanceForDate = (date: string) => {
    return employees.map(emp => {
      // 1. ローカルの編集中の値があれば優先
      const existing = localAttendance.find(a => a.employeeId === emp.id && a.date === date);
      if (existing) return existing;

      // 2. なければシフト希望から初期値を生成
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
    // 重要: 既存の全勤怠データ（ステート）をベースにする
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

    // 全データを含んだ配列を送信（消失を防ぐ）
    actions.updateAttendance(finalPayload);
    actions.logAction('DAILY_VERIFY', `Verified range: ${visibleDates[0]} to ${visibleDates[visibleDates.length - 1]}`);
    alert('SUCCESS: Records verified and synchronized to staff devices.');
  };

  const handleSyncMaster = () => {
    actions.updateEmployees(employees);
    actions.updateSettings(settings);
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
          <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 w-full sm:w-auto text-center sm:text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase block tracking-[0.2em]">Operations Reference</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-3xl font-black text-emerald-950 outline-none bg-transparent tracking-tighter w-full sm:w-auto" />
              </div>
              <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
                {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>{m}</button>
                ))}
              </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl self-center sm:self-end">
              <button
                onClick={() => setDisplayType('LIST')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${displayType === 'LIST' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-400'}`}
              >
                LIST
              </button>
              <button
                onClick={() => setDisplayType('VISUAL')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${displayType === 'VISUAL' ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-400'}`}
              >
                TIMELINE
              </button>
            </div>
          </div>

          {displayType === 'VISUAL' ? (
            <div className="space-y-10">
              {visibleDates.map(date => (
                <div key={date} className="space-y-4 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-2">
                    <h4 className="text-lg font-black text-emerald-950">{date}</h4>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Visual Shift Map</span>
                  </div>
                  <TimelineView
                    date={date}
                    attendance={getAttendanceForDate(date)}
                    onUpdate={(empId, updates) => handleUpdateRecordLocal(date, empId, updates)}
                  />
                </div>
              ))}
            </div>
          ) : (
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
                        const emp = employees.find(e => e.id === record.employeeId);
                        return (
                          <div key={record.employeeId} className={`bg-white p-5 rounded-[2.5rem] border-2 transition-all ${record.isApproved ? 'border-emerald-600 shadow-sm' : record.isWorking ? 'border-lime-500 bg-lime-50/5 shadow-md' : 'border-gray-50 opacity-50'}`}>
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-emerald-950 text-xl tracking-tight leading-none">{emp?.name}</span>
                                  {record.isApproved && <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Verified</span>}
                                </div>
                                <span className="text-[10px] font-black text-lime-600 uppercase mt-1 tracking-widest">{branches.find(b => b.id === record.branchId)?.name || 'NO BRANCH'}</span>
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
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
          {/* Payroll View logic remains similar but uses the fixed calculation logic */}
          <div className="bg-emerald-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10 text-center sm:text-left">
              <h2 className="text-2xl font-black tracking-[0.2em] mb-10">FINANCE</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2">Total Liability</p>
                  <p className="text-4xl font-black">{payrollSummary.companyTotal.toLocaleString()} UZS</p>
                </div>
                <div>
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2">Worked Hours</p>
                  <p className="text-4xl font-black">{payrollSummary.companyHours.toFixed(1)}h</p>
                </div>
              </div>
            </div>
          </div>
          {/* Detailed list rendering... */}
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
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase">Hourly Rate</label>
                      <input type="number" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black" defaultValue={emp.hourlyRate} onBlur={(e) => actions.updateEmployees(employees.map(p => p.id === emp.id ? { ...p, hourlyRate: Number(e.target.value) } : p))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase">Access Key</label>
                      <input type="text" className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black" defaultValue={emp.password} onBlur={(e) => actions.updateEmployees(employees.map(p => p.id === emp.id ? { ...p, password: e.target.value } : p))} />
                    </div>
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
