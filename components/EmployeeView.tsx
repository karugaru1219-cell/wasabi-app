
import React, { useState, useMemo, useEffect } from 'react';
import { ShiftRequest, ShiftPeriod, AttendanceRecord } from '../types';
import { TIME_OPTIONS } from '../constants';
import { useData } from '../context/DataContext';

const EmployeeView: React.FC = () => {
  const { currentEmployee, shifts, attendance, settings, branches, employees, actions } = useData();
  const [activeTab, setActiveTab] = useState<'SHIFT' | 'PAYROLL' | 'SETTINGS'>('SHIFT');
  const [tempPassword, setTempPassword] = useState('');

  const today = new Date();
  const [period, setPeriod] = useState<ShiftPeriod>({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    part: today.getDate() <= 15 ? 1 : 2
  });

  const calculateHoursPrecise = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const total = (eH + eM / 60) - (sH + sM / 60);
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

  const [localShifts, setLocalShifts] = useState<Record<string, Partial<ShiftRequest>>>(() => {
    const initial: Record<string, Partial<ShiftRequest>> = {};
    shifts.filter(s => s.employeeId === currentEmployee?.id).forEach(s => { initial[s.date] = s; });
    return initial;
  });

  useEffect(() => {
    const initial: Record<string, Partial<ShiftRequest>> = {};
    shifts.filter(s => s.employeeId === currentEmployee?.id).forEach(s => { initial[s.date] = s; });
    setLocalShifts(initial);
    if (currentEmployee) setTempPassword(currentEmployee.password);
  }, [shifts, currentEmployee]);

  const isDateApprovedByAdmin = (date: string) => {
    return attendance.some(a => a.employeeId === currentEmployee?.id && a.date === date && a.isApproved);
  };

  const handleQuickAction = (date: string, action: 'FULL' | 'OFF') => {
    if (isDateApprovedByAdmin(date)) return;
    setLocalShifts(prev => ({
      ...prev,
      [date]: action === 'OFF' ? {
        ...prev[date],
        isWorking: false
      } : {
        ...prev[date],
        isWorking: true,
        branchId: prev[date]?.branchId || currentEmployee?.branchId || branches[0]?.id || '',
        startTime: `${settings.defaultStartHour.toString().padStart(2, '0')}:00`,
        endTime: `${settings.defaultEndHour.toString().padStart(2, '0')}:00`,
      }
    }));
  };

  const handleFieldChange = (date: string, field: keyof ShiftRequest, value: any) => {
    if (isDateApprovedByAdmin(date)) return;
    setLocalShifts(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
  };

  const handleSaveShifts = () => {
    if (!currentEmployee) return;
    const myNewShifts: ShiftRequest[] = currentPeriodDates
      .map(date => {
        const s = localShifts[date];
        if (isDateApprovedByAdmin(date)) return null;

        return {
          id: s?.id || crypto.randomUUID(),
          employeeId: currentEmployee.id,
          branchId: s?.branchId || currentEmployee.branchId || branches[0]?.id || '',
          date,
          isWorking: !!s?.isWorking,
          startTime: s?.startTime || `${settings.defaultStartHour.toString().padStart(2, '0')}:00`,
          endTime: s?.endTime || `${settings.defaultEndHour.toString().padStart(2, '0')}:00`,
        } as ShiftRequest;
      }).filter(Boolean) as ShiftRequest[];

    // 他の人のシフト + 自分が今回更新した（かつロックされていない）シフト + 自分が以前登録してロックされているシフトを合体
    const approvedShifts = shifts.filter(s => s.employeeId === currentEmployee.id && isDateApprovedByAdmin(s.date));
    const otherShifts = shifts.filter(s => s.employeeId !== currentEmployee.id);

    actions.updateShifts([...otherShifts, ...approvedShifts, ...myNewShifts]);
    alert('SUCCESS: Shifts Synchronized!');
  };

  const handleSaveProfile = () => {
    if (!currentEmployee) return;
    const updatedEmployees = employees.map(emp =>
      emp.id === currentEmployee.id ? { ...emp, password: tempPassword } : emp
    );
    actions.updateEmployees(updatedEmployees);
    actions.logAction('PROFILE_UPDATE', `${currentEmployee.name} updated their password.`);
    alert('SUCCESS: Profile Security Updated!');
  };

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const d = new Date(a.date);
      return a.employeeId === currentEmployee?.id && d.getMonth() + 1 === period.month && d.getFullYear() === period.year;
    });
  }, [attendance, period, currentEmployee]);

  const payrollData = useMemo(() => {
    const totalHours = filteredAttendance.reduce((acc, curr) => {
      if (!curr.isWorking) return acc;
      return acc + calculateHoursPrecise(curr.startTime, curr.endTime);
    }, 0);
    const totalBonus = filteredAttendance.reduce((acc, curr) => acc + (curr.bonus || 0), 0);
    const totalPay = Math.round(totalHours * settings.globalHourlyRate) + totalBonus;
    return { totalHours, totalBonus, totalPay };
  }, [filteredAttendance, settings.globalHourlyRate]);

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24">
      <nav className="flex bg-gray-100 p-1.5 rounded-[1.5rem] shadow-inner">
        {(['SHIFT', 'PAYROLL', 'SETTINGS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-emerald-950 shadow-xl' : 'text-gray-400'}`}
          >
            {tab === 'SHIFT' ? 'Requests' : tab === 'PAYROLL' ? 'Earnings' : 'Profile'}
          </button>
        ))}
      </nav>

      {activeTab === 'SHIFT' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-emerald-950 rounded-[2.5rem] p-7 text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-lime-400 uppercase tracking-widest mb-1 opacity-80">Scheduling Engine</p>
              <h3 className="text-2xl font-black tracking-tighter">{period.year}/{period.month} <span className="text-lime-500 ml-1">{period.part === 1 ? 'Part 1' : 'Part 2'}</span></h3>
            </div>
            <div className="flex gap-2 relative z-10">
              <button onClick={() => setPeriod(p => p.part === 2 ? { ...p, part: 1 } : { year: p.month === 1 ? p.year - 1 : p.year, month: p.month === 1 ? 12 : p.month - 1, part: 2 })} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl hover:bg-white/20 active:scale-90 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button onClick={() => setPeriod(p => p.part === 1 ? { ...p, part: 2 } : { year: p.month === 12 ? p.year + 1 : p.year, month: p.month === 12 ? 1 : p.month + 1, part: 1 })} className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl hover:bg-white/20 active:scale-90 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {currentPeriodDates.map(date => {
              const data = localShifts[date];
              const isWorking = !!data?.isWorking;
              const isApproved = isDateApprovedByAdmin(date);
              const d = new Date(date);
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              const dayName = dayNames[d.getDay()];

              return (
                <div key={date} className={`bg-white p-6 rounded-[2rem] border-2 transition-all duration-300 ${isApproved ? 'border-emerald-600 bg-emerald-50/5 opacity-80' : isWorking ? 'border-lime-500 bg-lime-50/10 shadow-lg scale-[1.01]' : 'border-gray-50'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black tracking-widest ${d.getDay() === 0 || d.getDay() === 6 ? 'text-red-400' : 'text-gray-300'}`}>{dayName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-emerald-950 leading-none">{d.getDate()}</span>
                        {isApproved && (
                          <span className="flex items-center gap-1 bg-emerald-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                            Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {!isApproved && (
                      <div className="flex bg-gray-50 p-1 rounded-2xl shadow-inner">
                        <button
                          onClick={() => handleQuickAction(date, 'OFF')}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${!isWorking ? 'bg-white text-gray-400 shadow-sm' : 'text-gray-300'}`}
                        >
                          OFF
                        </button>
                        <button
                          onClick={() => handleQuickAction(date, 'FULL')}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isWorking ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-300'}`}
                        >
                          WORK
                        </button>
                      </div>
                    )}
                  </div>

                  {isWorking && (
                    <div className="space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">Start Time</label>
                          <select
                            disabled={isApproved}
                            value={data.startTime}
                            onChange={(e) => handleFieldChange(date, 'startTime', e.target.value)}
                            className={`w-full bg-white border border-gray-100 rounded-2xl px-3 py-3 text-sm font-black text-emerald-900 outline-none shadow-sm ${isApproved ? 'opacity-50 cursor-not-allowed' : 'focus:border-lime-300'}`}
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">End Time</label>
                          <select
                            disabled={isApproved}
                            value={data.endTime}
                            onChange={(e) => handleFieldChange(date, 'endTime', e.target.value)}
                            className={`w-full bg-white border border-gray-100 rounded-2xl px-3 py-3 text-sm font-black text-emerald-900 outline-none shadow-sm ${isApproved ? 'opacity-50 cursor-not-allowed' : 'focus:border-lime-300'}`}
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest pl-1">Branch Preference</label>
                        <div className="flex gap-2">
                          {branches.map(b => (
                            <button
                              key={b.id}
                              disabled={isApproved}
                              onClick={() => handleFieldChange(date, 'branchId', b.id)}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${data.branchId === b.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400'} ${isApproved && data.branchId !== b.id ? 'hidden' : ''}`}
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="fixed bottom-6 left-6 right-6 z-40 max-w-lg mx-auto">
            <button
              onClick={handleSaveShifts}
              className="w-full bg-lime-500 text-white font-black py-5 rounded-[2.5rem] text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all hover:bg-lime-600 border-b-4 border-lime-700"
            >
              UPDATE SHIFT REQUESTS
            </button>
          </div>
        </div>
      )}

      {activeTab === 'PAYROLL' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-12 border border-gray-50 text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-9xl group-hover:scale-110 transition-transform">💰</div>
            <p className="text-[11px] font-black text-lime-500 uppercase tracking-[0.4em] mb-4 relative z-10">Verified Earnings</p>
            <h2 className="text-4xl sm:text-6xl font-black text-emerald-950 tracking-tighter relative z-10 mb-8 overflow-hidden text-ellipsis">
              {payrollData.totalPay.toLocaleString()} <span className="text-2xl">UZS</span>
            </h2>
            <div className="grid grid-cols-2 gap-8 relative z-10 py-8 border-t border-gray-50">
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Total Hours</p>
                <p className="font-black text-emerald-900 text-2xl">{payrollData.totalHours.toFixed(2)}<span className="text-sm opacity-30 ml-1">h</span></p>
              </div>
              <div className="text-center border-l border-gray-50">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Incentives</p>
                <p className="font-black text-lime-600 text-2xl">{payrollData.totalBonus.toLocaleString()} <span className="text-xs">UZS</span></p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-emerald-950 uppercase tracking-[0.2em]">Verified History</h3>
              <div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {filteredAttendance.length === 0 ? (
                <div className="p-16 text-center text-gray-300 text-[11px] font-black uppercase tracking-widest italic opacity-50">No data found</div>
              ) : (
                filteredAttendance.map(a => (
                  <div key={a.id} className="p-6 flex justify-between items-center hover:bg-emerald-50/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-black text-emerald-950 text-sm">{a.date}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{a.startTime} → {a.endTime}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-emerald-950 text-lg">{(Math.round(calculateHoursPrecise(a.startTime, a.endTime) * settings.globalHourlyRate) + (a.bonus || 0)).toLocaleString()}</span>
                      <span className="text-[10px] ml-1 text-gray-400 uppercase">UZS</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* ... SETTINGS tab content remain same as previous version ... */}
    </div>
  );
};

export default EmployeeView;
