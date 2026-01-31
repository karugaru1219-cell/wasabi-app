
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
    // 確定時に isApproved を一括でセット
    const finalAttendance = localAttendance.map(a => a.date === selectedDate ? { ...a, isApproved: true } : a);
    actions.updateAttendance(finalAttendance);
    actions.logAction('DAILY_SYNC', `Attendance records verified and locked for ${selectedDate}.`);
    alert('SUCCESS: Daily Operations Verified & Synced!');
  };

  const handleSyncMaster = () => {
    actions.updateEmployees(localEmployees);
    actions.updateBranches(localBranches);
    actions.updateSettings(localSettings);
    actions.logAction('MASTER_SYNC', `Master Registry and Settings synchronized.`);
    alert('SUCCESS: Master Registry Updated!');
  };

  const payrollSummary = useMemo(() => {
    const staffStats = employees.map(emp => {
      const records = attendance.filter(a => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && a.isWorking &&
          (d.getMonth() + 1) === summaryMonth && d.getFullYear() === summaryYear;
      }).sort((a, b) => a.date.localeCompare(b.date));

      const totalHours = records.reduce((acc, r) => acc + calculateHoursPrecise(r.startTime, r.endTime), 0);
      const totalBonus = records.reduce((acc, r) => acc + (r.bonus || 0), 0);
      const basePay = Math.round(totalHours * settings.globalHourlyRate);
      return {
        id: emp.id,
        name: emp.name,
        hours: totalHours,
        basePay,
        bonus: totalBonus,
        total: basePay + totalBonus,
        records
      };
    });
    const companyTotal = staffStats.reduce((acc, s) => acc + s.total, 0);
    const companyHours = staffStats.reduce((acc, s) => acc + s.hours, 0);
    return { staffStats, companyTotal, companyHours };
  }, [employees, attendance, summaryMonth, summaryYear, settings.globalHourlyRate]);

  const activeStatement = useMemo(() => {
    if (!selectedStatementEmployee) return null;
    return payrollSummary.staffStats.find(s => s.id === selectedStatementEmployee);
  }, [selectedStatementEmployee, payrollSummary]);

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
                    <div key={record.employeeId} className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${record.isApproved ? 'border-emerald-600' : record.isWorking ? 'border-lime-500 bg-lime-50/10 shadow-lg' : 'border-gray-50 opacity-50'}`}>
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-950 text-xl tracking-tight leading-none">{emp?.name}</span>
                            {record.isApproved && (
                              <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Verified</span>
                            )}
                          </div>
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
                    COMMIT & VERIFY OPERATIONS
                  </button>
                </div>
              </>
            ) : <div className="text-center p-20 text-gray-300 font-black uppercase text-xs">Calendar mode restricted in DAILY view. Use Calendar Tab.</div>}
          </div>
        </div>
      )}

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
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Total Liability</p>
                  <p className="text-3xl sm:text-5xl font-black tracking-tighter truncate leading-tight">
                    {payrollSummary.companyTotal.toLocaleString()} <span className="text-xl">UZS</span>
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lime-400 text-[10px] font-black uppercase mb-2 tracking-widest">Worked Hours</p>
                  <p className="text-3xl sm:text-5xl font-black tracking-tighter truncate leading-tight">
                    {payrollSummary.companyHours.toFixed(1)}<span className="text-xl ml-1">h</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* ... Payroll staff list modal and components ... */}
        </div>
      )}

      {activeTab === 'MASTER' && (
        <div className="space-y-8 animate-in fade-in pb-20">
          {/* Registry section remain same */}
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
    </div>
  );
};

export default AdminView;
