
import { Branch, Employee, SystemSettings } from './types';

export const INITIAL_BRANCHES: Branch[] = [
  { id: 'b1', name: 'ibn sino' },
  { id: 'b2', name: 'seoul mun' },
];

const NAMES = [
  'Okubo', 'Madina', 'Yuko', 'Yulika', 'Shinya', 
  'Kentaro', 'Sakuto', 'Toya', 'Ryousuke', 'Imasen'
];

export const INITIAL_EMPLOYEES: Employee[] = NAMES.map((name, i) => ({
  id: `e${i + 1}`,
  name,
  branchId: i % 2 === 0 ? 'b1' : 'b2',
  hourlyRate: 15000,
  password: 'olma'
}));

export const SYSTEM_SETTINGS: SystemSettings = {
  defaultStartHour: 13,
  defaultEndHour: 22,
  globalHourlyRate: 15000,
  adminPassword: '0306',
  shiftLockDate: new Date().toISOString().split('T')[0],
};

export const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

export const STORAGE_KEYS = {
  BRANCHES: 'wasabi_branches_v5',
  EMPLOYEES: 'wasabi_employees_v5',
  SHIFTS: 'wasabi_shifts_v5',
  ATTENDANCE: 'wasabi_attendance_v5',
  SETTINGS: 'wasabi_settings_v5',
  AUTH: 'wasabi_auth_state_v5',
  LOGS: 'wasabi_logs_v5'
};
