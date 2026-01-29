
import React from 'react';
import { useData } from '../../context/DataContext';

interface CalendarGridProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ selectedDate, onSelectDate }) => {
  const { shifts, employees } = useData();
  const date = new Date(selectedDate);
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // Sun=0
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < mondayOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getDayStaff = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts.filter(s => s.date === dStr && s.isWorking);
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
      <div className="p-6 bg-emerald-950 text-white flex justify-between items-center">
        <h3 className="text-sm font-black uppercase tracking-widest">
          {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)}
        </h3>
        <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Mon - Sun Cycle</span>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-50 bg-gray-50/50">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
          <div key={d} className="py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-50">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="bg-white h-24 sm:h-32 opacity-20"></div>;
          const staff = getDayStaff(day);
          const isSelected = day === date.getDate();
          
          return (
            <button 
              key={day} 
              onClick={() => onSelectDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
              className={`bg-white h-24 sm:h-32 p-1.5 sm:p-2 text-left transition-all hover:z-10 hover:shadow-2xl hover:scale-[1.02] flex flex-col ${isSelected ? 'ring-2 ring-lime-500 z-10' : ''}`}
            >
              <span className={`text-[10px] font-black mb-1 w-5 h-5 flex items-center justify-center rounded-md ${isSelected ? 'bg-lime-500 text-white' : 'text-gray-400'}`}>{day}</span>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5">
                {staff.map(s => {
                  const emp = employees.find(e => e.id === s.employeeId);
                  return (
                    <div key={s.id} className="bg-emerald-50 text-emerald-700 text-[8px] sm:text-[9px] px-1 py-0.5 rounded font-black truncate border border-emerald-100/50">
                      {emp?.name.charAt(0)}: {s.startTime.split(':')[0]}h
                    </div>
                  );
                })}
              </div>
              {staff.length > 0 && (
                <div className="mt-auto pt-1 text-[8px] font-black text-lime-600 uppercase tracking-tighter">
                  {staff.length} Active
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
