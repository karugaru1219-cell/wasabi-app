
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

  // Local state for Master edits
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

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
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

  const attendanceForDate = useMemo(() => getAttendanceForDate(selectedDate), [selectedDate, localEmployees, shifts, localAttendance, localSettings, localBranches]);

  const handleUpdateRecordLocal = (date: string, empId: string, updates: Partial<AttendanceRecord>) => {
    const current = getAttendanceForDate(date).find(r => r.employeeId === empId);
    if (!current) return;

    const newRecord = { ...current, ...updates };
    const newAttendance = [...localAttendance];
    const idx = newAttendance.findIndex(orig => orig.id === newRecord.id);
    if (idx > -1) newAttendance[idx] = newRecord;
    else newAttendance.push(newRecord);

    setLocalAttendance(newAttendance);
  };

  const handleSyncDaily = () => {
    actions.updateAttendance(localAttendance);
    actions.logAction('DAILY_SYNC', `Attendance records synchronized for ${selectedDate}.`);
    alert('SUCCESS: Daily Operations Synchronized!');
  };

  const handleSyncMaster = () => {
    actions.updateEmployees(localEmployees);
    actions.updateBranches(localBranches);
    actions.updateSettings(localSettings);
    actions.logAction('MASTER_SYNC', `Master Registry and Settings synchronized.`);
    alert('SUCCESS: Master Registry Updated!');
  };

  const weeklyDates = useMemo(() => {
    const dates = [];
    const base = new Date(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(base.getFullYear(), base.getMonth(), diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      dates.push(formatDate(d));
    }
    return dates;
  }, [selectedDate]);

  const monthlyDates = useMemo(() => {
    const dates = [];
    const base = new Date(selectedDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      dates.push(formatDate(d));
    }
    return dates;
  }, [selectedDate]);

  const payrollSummary = useMemo(() => {
    const staffStats = employees.map(emp => {
      const records = attendance.filter(a => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && a.isWorking &&
          (d.getMonth() + 1) === summaryMonth && d.getFullYear() === summaryYear;
      });
      const totalHours = records.reduce((acc, r) => acc + calculateHoursPrecise(r.startTime, r.endTime), 0);
      const totalBonus = records.reduce((acc, r) => acc + (r.bonus || 0), 0);
      const basePay = Math.round(totalHours * settings.globalHourlyRate);
      return { id: emp.id, name: emp.name, hours: totalHours, basePay, bonus: totalBonus, total: basePay + totalBonus };
    });
    const companyTotal = staffStats.reduce((acc, s) => acc + s.total, 0);
    const companyHours = staffStats.reduce((acc, s) => acc + s.hours, 0);
    return { staffStats, companyTotal, companyHours };
  }, [employees, attendance, summaryMonth, summaryYear, settings.globalHourlyRate]);

  const renderDayList = (datesArray: string[], title: string) => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-lime-100 p-4 rounded-3xl border border-lime-200 flex justify-between items-center mb-2 text-[11px] font-black uppercase tracking-widest text-lime-800">
        <span>{title}</span>
        <span className="text-[9px] opacity-70">{datesArray[0]} - {datesArray[datesArray.length - 1]}</span>
      </div>
      {datesArray.map(date => {
        const dayAttendance = getAttendanceForDate(date).filter(r => r.isWorking);
        const d = new Date(date);
        const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
        const isToday = date === formatDate(new Date());

        return (
          <div key={date} className={`bg-white rounded-[2.5rem] border-2 transition-all ${isToday ? 'border-lime-500 shadow-xl ring-8 ring-lime-50' : 'border-gray-50 opacity-90'}`}>
            <div className={`p-6 flex justify-between items-center ${isToday ? 'bg-emerald-950 text-white rounded-t-[2.3rem]' : 'border-b border-gray-50'}`}>
              <div className="flex items-center gap-4">
                <span className={`w-12 h-12 flex items-center justify-center rounded-2xl font-black text-sm ${isToday ? 'bg-lime-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{dayName.slice(0, 1)}</span>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest block opacity-50 ${isToday ? 'text-lime-400' : ''}`}>{dayName}</span>
                  <span className="text-xl font-black tracking-tighter">{date}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black">{dayAttendance.length}</span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {dayAttendance.length === 0 ? (
                <div className="p-4 text-center text-gray-200 text-[9px] font-black uppercase tracking-widest">No staff scheduled</div>
              ) : (
                dayAttendance.map(record => {
                  const emp = localEmployees.find(e => e.id === record.employeeId);
                  const branch = localBranches.find(b => b.id === record.branchId);
                  return (
                    <div key={record.id} className="p-4 flex justify-between items-center group bg-gray-50/30 hover:bg-lime-50 rounded-2xl transition-all">
                      <div className="space-y-0.5">
                        <p className="font-black text-emerald-950 text-sm">{emp?.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-white uppercase bg-emerald-600 px-1.5 py-0.5 rounded tracking-widest">{branch?.name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{record.startTime} - {record.endTime}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setSelectedDate(date); setViewMode('DAY'); setActiveTab('DAILY'); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-300 hover:text-emerald-500 transition-all shadow-sm"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32">
      <nav className="flex bg-gray-100 p-1.5 rounded-[1.5rem] shadow-inner overflow-x-auto no-scrollbar scroll-smooth">
        {(['DAILY', 'CALENDAR', 'PAYROLL', 'MASTER', 'LOGS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-none px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-emerald-950 shadow-xl scale-[1.02]' : 'text-gray-400'}`}
          >
            {tab === 'DAILY' ? 'Operations' : tab === 'CALENDAR' ? 'Calendar' : tab === 'PAYROLL' ? 'Finance' : tab === 'MASTER' ? 'Hub' : 'Logs'}
          </button>
        ))}
      </nav>

      {activeTab === 'DAILY' && (
        <div className="space-y-4">
          <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-[10px] font-black text-gray-400 uppercase block tracking-[0.2em]">Operational Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-3xl font-black text-emerald-950 outline-none bg-transparent tracking-tighter w-full sm:w-auto" />
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner">
              {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {viewMode === 'DAY' ? (
              <>
                {attendanceForDate.map(record => {
                  const emp = localEmployees.find(e => e.id === record.employeeId);
                  return (
                    <div key={record.employeeId} className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${record.isWorking ? 'border-lime-500 bg-lime-50/10 shadow-lg' : 'border-gray-50 opacity-50'}`}>
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex flex-col">
                          <span className="font-black text-emerald-950 text-xl tracking-tight leading-none">{emp?.name}</span>
                          <span className="text-[10px] font-black text-lime-600 uppercase mt-1.5 tracking-widest">{localBranches.find(b => b.id === record.branchId)?.name || 'UNASSIGNED'}</span>
                        </div>
                        <button onClick={() => handleUpdateRecordLocal(selectedDate, record.employeeId, { isWorking: !record.isWorking })} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${record.isWorking ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                          {record.isWorking ? 'ON-DUTY' : 'OFF-DUTY'}
                        </button>
                      </div>
                      {record.isWorking && (
                        <div className="space-y-4 pt-5 border-t border-gray-100/50">
                          <div className="grid grid-cols-2 gap-4">
                            <input type="time" value={record.startTime} onChange={(e) => handleUpdateRecordLocal(selectedDate, record.employeeId, { startTime: e.target.value })} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black outline-none" />
                            <input type="time" value={record.endTime} onChange={(e) => handleUpdateRecordLocal(selectedDate, record.employeeId, { endTime: e.target.value })} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black outline-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <select value={record.branchId} onChange={(e) => handleUpdateRecordLocal(selectedDate, record.employeeId, { branchId: e.target.value })} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs font-black outline-none">
                              {localBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <input type="number" placeholder="Incentive" value={record.bonus || ''} onChange={(e) => handleUpdateRecordLocal(selectedDate, record.employeeId, { bonus: Number(e.target.value) })} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
                  <button
                    onClick={handleSyncDaily}
                    className="w-full bg-lime-500 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-lime-600 border-b-4 border-lime-700"
                  >
                    COMMIT DAILY OPERATIONS
                  </button>
                </div>
              </>
            ) : viewMode === 'WEEK' ? renderDayList(weeklyDates, "Weekly Overview") : renderDayList(monthlyDates, "Monthly Overview")}
          </div>
        </div>
      )}

      {activeTab === 'CALENDAR' && (
        <CalendarGrid
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setViewMode('DAY'); setActiveTab('DAILY'); }}
        />
      )}

      {activeTab === 'PAYROLL' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-emerald-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black tracking-tight uppercase tracking-[0.2em]">WASABI FINANCE</h2>
                <div className="flex gap-2">
                  <select value={summaryYear} onChange={(e) => setSummaryYear(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-black">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-black outline-none text-black">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Total Liability</p>
                  <p className="text-5xl font-black tracking-tighter">{payrollSummary.companyTotal.toLocaleString()} <span className="text-xl">UZS</span></p>
                </div>
                <div className="text-right">
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Worked Hours</p>
                  <p className="text-5xl font-black tracking-tighter">{payrollSummary.companyHours.toFixed(1)}<span className="text-xl ml-1">h</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
            {payrollSummary.staffStats.map(s => (
              <div key={s.id} className="p-7 flex justify-between items-center hover:bg-gray-50/50 transition-all">
                <div>
                  <p className="font-black text-emerald-950 text-xl tracking-tighter">{s.name}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">{s.hours.toFixed(2)}h • {settings.globalHourlyRate.toLocaleString()} UZS</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-950 text-2xl tracking-tighter">{s.total.toLocaleString()} <span className="text-xs">UZS</span></p>
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
                  <input className="bg-transparent font-black text-2xl tracking-tighter outline-none" value={emp.name} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, name: e.target.value } : p))} />
                  <button onClick={() => setLocalEmployees(localEmployees.filter(p => p.id !== emp.id))} className="text-red-400 p-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg></button>
                </div>
                <div className="relative">
                  <input type="text" title="Access Key" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm font-black outline-none tracking-widest text-emerald-900" value={emp.password} onChange={(e) => setLocalEmployees(localEmployees.map(p => p.id === emp.id ? { ...p, password: e.target.value } : p))} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-200 uppercase pointer-events-none">Secret Key</div>
                </div>
              </div>
            ))}
            <button onClick={() => setLocalEmployees([...localEmployees, { id: crypto.randomUUID(), name: 'NEW TALENT', branchId: localBranches[0]?.id || '', hourlyRate: localSettings.globalHourlyRate, password: 'olma' }])} className="w-full border-4 border-dashed border-gray-100 py-6 rounded-[2rem] text-gray-300 font-black hover:bg-gray-50 transition-all">+ Add New Member</button>
          </section>

          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Operational Sites</h3>
            {localBranches.map(branch => (
              <div key={branch.id} className="flex gap-3 items-center">
                <input className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-black outline-none" value={branch.name} onChange={(e) => setLocalBranches(localBranches.map(b => b.id === branch.id ? { ...b, name: e.target.value } : b))} />
                <button onClick={() => setLocalBranches(localBranches.filter(b => b.id !== branch.id))} className="p-3 text-red-300"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg></button>
              </div>
            ))}
            <button onClick={() => setLocalBranches([...localBranches, { id: crypto.randomUUID(), name: 'NEW SITE' }])} className="w-full bg-emerald-50 text-emerald-700 py-4 rounded-[1.5rem] font-black text-xs shadow-sm">+ Deploy New Site</button>
          </section>

          <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl space-y-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-950">Global Parameters</h3>
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Global Hourly Rate (UZS)</label>
                <input type="number" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-black text-xl outline-none" value={localSettings.globalHourlyRate} onChange={(e) => setLocalSettings({ ...localSettings, globalHourlyRate: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Administrative Master Key</label>
                <input type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-black outline-none" value={localSettings.adminPassword} onChange={(e) => setLocalSettings({ ...localSettings, adminPassword: e.target.value })} />
              </div>
            </div>
          </section>

          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-2xl mx-auto">
            <button
              onClick={handleSyncMaster}
              className="w-full bg-emerald-950 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-black border-b-4 border-emerald-700"
            >
              UPDATE MASTER REGISTRY
            </button>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && <ActionLogList />}
    </div>
  );
};

export default AdminView;
