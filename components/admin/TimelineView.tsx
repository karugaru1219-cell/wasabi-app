
import React, { useMemo } from 'react';
import { AttendanceRecord } from '../../types';
import { useData } from '../../context/DataContext';

interface TimelineViewProps {
  date: string;
  attendance: AttendanceRecord[];
  onUpdate: (empId: string, updates: Partial<AttendanceRecord>) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ date, attendance, onUpdate }) => {
  const { employees, branches } = useData();

  // 表示する時間範囲（08:00 - 24:00）
  const HOURS = useMemo(() => Array.from({ length: 17 }, (_, i) => i + 8), []);

  const getPosition = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const startHour = 8;
    const offset = (h - startHour) * 60 + m;
    return (offset / (HOURS.length * 60)) * 100;
  };

  const getWidth = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return (diff / (HOURS.length * 60)) * 100;
  };

  return (
    <div className="relative border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30">
      {/* タイムラインヘッダー（時間軸） */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="w-24 shrink-0 p-3 border-r border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">Staff</div>
        <div className="flex-1 flex min-w-[600px]">
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center py-3 text-[9px] font-black text-emerald-900/40 border-r border-gray-50 last:border-r-0">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* タイムラインボディ */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-[696px]"> {/* 24(label) + 600(grid) */}
          {employees.map(emp => {
            const record = attendance.find(a => a.employeeId === emp.id);
            const isWorking = record?.isWorking;
            const branch = branches.find(b => b.id === record?.branchId);

            return (
              <div key={emp.id} className="flex border-b border-gray-50 group hover:bg-white transition-colors h-14">
                <div className="w-24 shrink-0 p-3 border-r border-gray-100 bg-white group-hover:bg-emerald-50/30 transition-colors flex flex-col justify-center">
                  <span className="text-[10px] font-black text-emerald-950 truncate leading-tight">{emp.name}</span>
                  <span className="text-[7px] font-bold text-gray-300 uppercase tracking-tighter truncate">{branch?.name || '-'}</span>
                </div>

                <div className="flex-1 relative bg-white/50 group-hover:bg-white transition-colors">
                  {/* グリッドライン */}
                  <div className="absolute inset-0 flex">
                    {HOURS.map(h => (
                      <div key={h} className="flex-1 border-r border-gray-50/50 last:border-r-0"></div>
                    ))}
                  </div>

                  {/* シフトバー */}
                  {isWorking && record.startTime && record.endTime && (
                    <button
                      onClick={() => onUpdate(emp.id, { isWorking: !record.isWorking })}
                      className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-lg shadow-sm flex items-center px-3 border-2 transition-all hover:scale-[1.02] active:scale-95 group/bar ${record.isApproved
                        ? 'bg-emerald-600 border-emerald-700 text-white'
                        : 'bg-lime-400 border-lime-500 text-emerald-900'
                        }`}
                      style={{
                        left: `${getPosition(record.startTime)}%`,
                        width: `${getWidth(record.startTime, record.endTime)}%`,
                        minWidth: '20px'
                      }}
                    >
                      <div className="flex items-center gap-1.5 w-full overflow-hidden">
                        {record.isApproved ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-950/20 animate-pulse"></div>
                        )}
                        <span className="text-[8px] font-black uppercase truncate tracking-tighter">
                          {record.startTime} - {record.endTime}
                        </span>
                      </div>

                      {/* ホバー時のツールチップ風ラベル */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-950 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                        {emp.name} ({branch?.name})
                      </div>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="p-4 bg-white border-t border-gray-100 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-600 rounded"></div>
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Verified</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-lime-400 rounded"></div>
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Pending</span>
        </div>
        <div className="ml-auto text-[8px] font-black text-gray-300 italic">Horizontal scroll for 08:00-24:00</div>
      </div>
    </div>
  );
};
