
import { useState, useEffect } from 'react';
import { UserRole, Employee } from '../types';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../constants';

export const useAuth = (employees: Employee[]) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const savedAuth = storage.get(STORAGE_KEYS.AUTH);
    if (savedAuth && employees.length > 0) {
      setRole(savedAuth.role);
      const latestEmp = employees.find(emp => emp.id === savedAuth.employee?.id);
      setCurrentEmployee(latestEmp || savedAuth.employee);
    }
  }, [employees]);

  const login = (newRole: UserRole, employee: Employee | null) => {
    setRole(newRole);
    setCurrentEmployee(employee);
    storage.save(STORAGE_KEYS.AUTH, { role: newRole, employee });
  };

  const logout = () => {
    setRole(null);
    setCurrentEmployee(null);
    storage.remove(STORAGE_KEYS.AUTH);
  };

  return { role, currentEmployee, login, logout };
};
