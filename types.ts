
export type UserRole = 'ADMIN' | 'USER';

export interface Branch {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  branchId: string;
  hourlyRate: number;
  password: string;
}

export interface ShiftPeriod {
  year: number;
  month: number;
  part: 1 | 2; // 1: 1-15, 2: 16-end
}

export interface ShiftRequest {
  id: string;
  employeeId: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  isWorking: boolean;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface AttendanceRecord extends ShiftRequest {
  isApproved: boolean;
  bonus: number;
}

export interface ActionLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface SystemSettings {
  defaultStartHour: number;
  defaultEndHour: number;
  globalHourlyRate: number;
  adminPassword: string;
  shiftLockDate: string;
}
