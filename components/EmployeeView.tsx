
import React, { useState, useMemo, useEffect } from 'react';
import { ShiftRequest, ShiftPeriod, AttendanceRecord } from '../types';
import { TIME_OPTIONS } from '../constants';
import { useData } from '../context/DataContext';

const EmployeeView: React.FC = () => {
  const { currentEmployee, shifts, attendance, settings, branches, employees, actions } = useData();
  const [activeTab, setActiveTab] = useState<'SHIFT' | 'PAYROLL' | 'SETTINGS'>('SHIFT');
  const [tempPassword, setTempPassword] = useState('');

  const today = new Date();
  // シフト申請用期間
  const [period, setPeriod] = useState<ShiftPeriod>({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    part: today.getDate() <= 15 ? 1 : 2
  });

  // 給料明細用期間（申請期間とは別に独立して遡れるようにする）
  const [payrollYear, setPayrollYear] = useState(today.getFullYear());
  const [payrollMonth, setPayrollMonth] = useState(today.getMonth() + 1);

  const calculateHoursPrecise = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let startTotal = sH + sM / 60;
    let endTotal = eH + eM / 60;
    if (endTotal < startTotal) endTotal += 24;
    const total = endTotal - startTotal;
    return total > 0 ? total : 0;
  };

  const generateDates = (p: ShiftPeriod) => {
    const dates: string[] = [];
    const startDay = p.part === 1 ? 1 : 16;
    const endDay = p.part === 1 ? 15 : new Date(p.year, p.month, 0).getDate();
    for (let d = startDay; d <= endDay; d++) {
      dates.push(`${p.year}-${String(p.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
  };

  const currentPeriodDates = useMemo(() => generateDates(period), [period]);

  const [localShifts, setLocalShifts] = useState<Record<string, Partial<ShiftRequest>>>({});

  // データマージロジック
  useEffect(() => {
    const merged: Record<string, Partial<ShiftRequest>> = {};
    // 1. シフト希望
    shifts.filter(s => s.employeeId === currentEmployee?.id).forEach(s => {
      merged[s.date] = s;
    });
    // 2. 確定済み実績で上書き
    attendance.filter(a => a.employeeId === currentEmployee?.id && a.isApproved).forEach(a => {
      merged[a.date] = { ...a };
    });
    setLocalShifts(merged);
    if (currentEmployee) setTempPassword(currentEmployee.password);
  }, [shifts, attendance, currentEmployee]);

  const isDateApprovedByAdmin = (date: string) => {
    return attendance.some(a => a.employeeId === currentEmployee?.id && a.date === date && a.isApproved);
  };

  const handleQuickAction = (date: string, action: 'FULL' | 'OFF') => {
    if (isDateApprovedByAdmin(date)) return;
    setLocalShifts(prev => ({
      ...prev,
      [date]: action === 'OFF' ? { ...prev[date], isWorking: false, date } : {
        ...prev[date],
        isWorking: true,
        date,
        branchId: prev[date]?.branchId || currentEmployee?.branchId || branches[0]?.id || '',
        startTime: prev[date]?.startTime || `${settings.defaultStartHour.toString().padStart(2, '0')}:00`,
        endTime: prev[date]?.endTime || `${settings.defaultEndHour.toString().padStart(2, '0')}:00`,
      }
    }));
  };

  const handleFieldChange = (date: string, field: keyof ShiftRequest, value: any) => {
    if (isDateApprovedByAdmin(date)) return;
    setLocalShifts(prev => ({ ...prev, [date]: { ...prev[date], [field]: value, date } }));
  };

  const handleSaveShifts = () => {
    if (!currentEmployee) return;
    const currentPeriodShifts: ShiftRequest[] = currentPeriodDates.map(date => {
      const s = localShifts[date];
      if (isDateApprovedByAdmin(date)) {
        return shifts.find(orig => orig.employeeId === currentEmployee.id && orig.date === date) || null;
      }
      if (s && s.date) {
        return {
          id: s.id || crypto.randomUUID(),
          employeeId: currentEmployee.id,
          branchId: s.branchId || currentEmployee.branchId || branches[0]?.id || '',
          date: s.date,
          isWorking: !!s.isWorking,
          startTime: s.startTime || `${settings.defaultStartHour.toString().padStart(2, '0')}:00`,
          endTime: s.endTime || `${settings.defaultEndHour.toString().padStart(2, '0')}:00`,
        } as ShiftRequest;
      }
      return null;
    }).filter(Boolean) as ShiftRequest[];

    const otherPeopleShifts = shifts.filter(s => s.employeeId !== currentEmployee.id);
    const myOtherPeriodShifts = shifts.filter(s => s.employeeId === currentEmployee.id && !currentPeriodDates.includes(s.date));
    actions.updateShifts([...otherPeopleShifts, ...myOtherPeriodShifts, ...currentPeriodShifts]);
    alert('SUCCESS: Shift Requests Updated!');
  };

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const d = new Date(a.date);
      return a.employeeId === currentEmployee?.id && a.isApproved &&
        (d.getMonth() + 1) === payrollMonth && d.getFullYear() === payrollYear;
    }).sort((a, b) => a.date.localeCompare(b.date)); // 日付順ソート
  }, [attendance, payrollMonth, payrollYear, currentEmployee]);

  const payrollData = useMemo(() => {
    const rateToUse = currentEmployee?.hourlyRate || settings.globalHourlyRate;
    const totalHours = filteredAttendance.reduce((acc, curr) => acc + calculateHoursPrecise(curr.startTime, curr.endTime), 0);
    const totalBonus = filteredAttendance.reduce((acc, curr) => acc + (curr.bonus || 0), 0);
    const totalPay = Math.round(totalHours * rateToUse) + totalBonus;
    return { totalHours, totalBonus, totalPay, rate: rateToUse };
  }, [filteredAttendance, settings.globalHourlyRate, currentEmployee]);

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24">
      <nav className="flex bg-gray-100 p-1.5 rounded-[1.5rem] shadow-inner">
        {(['SHIFT', 'PAYROLL', 'SETTINGS'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-emerald-950 shadow-xl' : 'text-gray-400'}`}>
            {tab === 'SHIFT' ? 'Requests' : tab === 'PAYROLL' ? 'Earnings' : 'Profile'}
          </button>
        ))}
      </nav>

      {activeTab === 'SHIFT' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-emerald-950 rounded-[2.5rem] p-7 text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-lime-400 uppercase tracking-widest mb-1 opacity-80">Shift Submission</p>
              <h3 className="text-2xl font-black tracking-tighter">{period.year}/{period.month} <span className="text-lime-500 ml-1">{period.part === 1 ? 'Part 1' : 'Part 2'}</span></h3>
            </div>
            <div className="flex gap-2 relative z-10">
              <button onClick={() => setPeriod(p => p.part === 2 ? { ...p, part: 1 } : { year: p.month === 1 ? p.year - 1 : p.year, month: p.month === 1 ? 12 : p.month - 1, part: 2 })} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl transition-all text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg></button>
              <button onClick={() => setPeriod(p => p.part === 1 ? { ...p, part: 2 } : { year: p.month === 12 ? p.year + 1 : p.year, month: p.month === 12 ? 1 : p.month + 1, part: 1 })} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl transition-all text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg></button>
            </div>
          </div>

          <div className="grid gap-3">
            {currentPeriodDates.map(date => {
              const data = localShifts[date] || {};
              const isWorking = !!data.isWorking;
              const isApproved = isDateApprovedByAdmin(date);
              const d = new Date(date);
              const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];

              return (
                <div key={date} className={`bg-white p-6 rounded-[2rem] border-2 transition-all duration-300 ${isApproved ? 'border-emerald-600 bg-emerald-50/10 shadow-sm' : isWorking ? 'border-lime-500 bg-lime-50/10 shadow-lg' : 'border-gray-50 opacity-80'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black tracking-widest ${d.getDay() === 0 || d.getDay() === 6 ? 'text-red-400' : 'text-gray-300'}`}>{dayName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-emerald-950 leading-none">{d.getDate()}</span>
                        {isApproved && <span className="flex items-center gap-1 bg-emerald-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>Confirmed</span>}
                      </div>
                    </div>
                    {!isApproved && (
                      <div className="flex bg-gray-50 p-1 rounded-2xl shadow-inner">
                        <button onClick={() => handleQuickAction(date, 'OFF')} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${!isWorking ? 'bg-white text-emerald-950 shadow-sm' : 'text-gray-300'}`}>OFF</button>
                        <button onClick={() => handleQuickAction(date, 'FULL')} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${isWorking ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-300'}`}>WORK</button>
                      </div>
                    )}
                  </div>
                  {isWorking && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Start Time</label>
                          <select disabled={isApproved} value={data.startTime} onChange={(e) => handleFieldChange(date, 'startTime', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-3 py-3 text-sm font-black text-emerald-950">
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">End Time</label>
                          <select disabled={isApproved} value={data.endTime} onChange={(e) => handleFieldChange(date, 'endTime', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-3 py-3 text-sm font-black text-emerald-950">
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {branches.map(b => (
                          <button key={b.id} disabled={isApproved} onClick={() => handleFieldChange(date, 'branchId', b.id)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${data.branchId === b.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-lg mx-auto">
            <button onClick={handleSaveShifts} className="w-full bg-lime-500 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all border-b-4 border-lime-700">UPDATE SHIFT REQUESTS</button>
          </div>
        </div>
      )}

      {activeTab === 'PAYROLL' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-10 border border-gray-50 text-center shadow-2xl relative overflow-hidden">
            <div className="flex justify-center gap-2 mb-6">
              <select value={payrollYear} onChange={(e) => setPayrollYear(Number(e.target.value))} className="bg-gray-100 rounded-xl px-4 py-2 text-[10px] font-black outline-none">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={payrollMonth} onChange={(e) => setPayrollMonth(Number(e.target.value))} className="bg-gray-100 rounded-xl px-4 py-2 text-[10px] font-black outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>
            <p className="text-[11px] font-black text-lime-500 uppercase tracking-[0.4em] mb-4">Monthly Confirmed Earnings</p>
            <h2 className="text-5xl font-black text-emerald-950 tracking-tighter mb-8">
              {payrollData.totalPay.toLocaleString()} <span className="text-2xl">UZS</span>
            </h2>
            <div className="grid grid-cols-2 gap-8 py-8 border-t border-gray-50">
              <div><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Total Hours</p><p className="font-black text-emerald-900 text-2xl">{payrollData.totalHours.toFixed(2)}h</p></div>
              <div className="border-l border-gray-50"><p className="text-[10px] font-black text-gray-300 uppercase mb-1">Rate</p><p className="font-black text-lime-600 text-xl">{payrollData.rate.toLocaleString()}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50/50 flex justify-between items-center"><h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Chronological Log</h3></div>
            {filteredAttendance.length === 0 ? (
              <div className="p-16 text-center text-gray-200 text-[10px] font-black uppercase tracking-widest italic">No data for this period</div>
            ) : (
              filteredAttendance.map(a => (
                <div key={a.id} className="p-6 flex justify-between items-center hover:bg-emerald-50/50 transition-all">
                  <div className="flex flex-col">
                    <span className="font-black text-emerald-950 text-sm">{a.date.split('-')[2]} / {a.date.split('-')[1]}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{a.startTime} → {a.endTime}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-950 text-lg">{(Math.round(calculateHoursPrecise(a.startTime, a.endTime) * payrollData.rate) + (a.bonus || 0)).toLocaleString()}</span>
                    <span className="text-[10px] ml-1 text-gray-400 uppercase tracking-tighter">UZS</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div className="p-10 bg-white rounded-[3rem] text-center space-y-8 animate-in fade-in">
          <div className="w-20 h-20 bg-lime-100 text-lime-600 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner">🥬</div>
          <h2 className="text-2xl font-black text-emerald-950">{currentEmployee?.name}</h2>
          <div className="space-y-4">
            <input type="text" className="w-full bg-gray-50 border-2 border-transparent focus:border-lime-400 rounded-2xl px-6 py-4 font-black text-emerald-950 outline-none text-center shadow-inner" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
            <button onClick={() => { actions.updateEmployees(employees.map(e => e.id === currentEmployee?.id ? { ...e, password: tempPassword } : e)); alert('Key Updated'); }} className="w-full bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all">UPDATE ACCESS KEY</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeView;
