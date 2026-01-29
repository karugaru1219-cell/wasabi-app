
import React, { createContext, useContext } from 'react';
import { useDatabase, SyncStatus } from '../hooks/useDatabase';
import { useAuth } from '../hooks/useAuth';
import { Branch, Employee, ShiftRequest, AttendanceRecord, SystemSettings, UserRole, ActionLog } from '../types';

interface DataContextType {
  branches: Branch[];
  employees: Employee[];
  shifts: ShiftRequest[];
  attendance: AttendanceRecord[];
  logs: ActionLog[];
  settings: SystemSettings;
  isLoading: boolean;
  syncStatus: SyncStatus;
  role: UserRole | null;
  currentEmployee: Employee | null;
  actions: ReturnType<typeof useDatabase>['actions'] & {
    login: ReturnType<typeof useAuth>['login'];
    logout: ReturnType<typeof useAuth>['logout'];
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useDatabase();
  const auth = useAuth(db.employees);

  const value: DataContextType = {
    ...db,
    ...auth,
    actions: {
      ...db.actions,
      login: auth.login,
      logout: auth.logout,
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
