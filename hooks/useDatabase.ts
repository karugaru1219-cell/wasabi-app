
import { useState, useCallback, useEffect } from 'react';
import { Branch, Employee, ShiftRequest, AttendanceRecord, SystemSettings, ActionLog } from '../types';
import { INITIAL_BRANCHES, INITIAL_EMPLOYEES, SYSTEM_SETTINGS, STORAGE_KEYS } from '../constants';
import { storage } from '../services/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SyncStatus = 'synced' | 'syncing' | 'error';

export const useDatabase = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(SYSTEM_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    
    setBranches(storage.get(STORAGE_KEYS.BRANCHES) || INITIAL_BRANCHES);
    setEmployees(storage.get(STORAGE_KEYS.EMPLOYEES) || INITIAL_EMPLOYEES);
    setShifts(storage.get(STORAGE_KEYS.SHIFTS) || []);
    setAttendance(storage.get(STORAGE_KEYS.ATTENDANCE) || []);
    setLogs(storage.get(STORAGE_KEYS.LOGS) || []);
    setSettings(storage.get(STORAGE_KEYS.SETTINGS) || SYSTEM_SETTINGS);

    // Fix: Using imported isSupabaseConfigured flag because supabase.supabaseUrl is a protected property
    if (isSupabaseConfigured) {
      setSyncStatus('syncing');
      try {
        const [ { data: b }, { data: e }, { data: s }, { data: a }, { data: st }, { data: l } ] = await Promise.all([
          supabase.from('branches').select('*').order('name'),
          supabase.from('employees').select('*').order('name'),
          supabase.from('shifts').select('*'),
          supabase.from('attendance').select('*'),
          supabase.from('settings').select('*').eq('id', 'system').maybeSingle(),
          supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(100)
        ]);

        if (b) { setBranches(b); storage.save(STORAGE_KEYS.BRANCHES, b); }
        if (e) { setEmployees(e); storage.save(STORAGE_KEYS.EMPLOYEES, e); }
        if (s) { setShifts(s); storage.save(STORAGE_KEYS.SHIFTS, s); }
        if (a) { setAttendance(a); storage.save(STORAGE_KEYS.ATTENDANCE, a); }
        if (l) { setLogs(l); storage.save(STORAGE_KEYS.LOGS, l); }
        if (st) {
          const { id, ...cleanSettings } = st;
          setSettings(cleanSettings as SystemSettings);
          storage.save(STORAGE_KEYS.SETTINGS, cleanSettings);
        }
        setSyncStatus('synced');
      } catch (err) {
        setSyncStatus('error');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const sync = async (table: string, payload: any, storageKey: string, setter: (val: any) => void) => {
    setter(payload);
    storage.save(storageKey, payload);
    // Fix: Using imported isSupabaseConfigured flag because supabase.supabaseUrl is a protected property
    if (isSupabaseConfigured) {
      setSyncStatus('syncing');
      try {
        await supabase.from(table).upsert(payload);
        setSyncStatus('synced');
      } catch (err) {
        setSyncStatus('error');
      }
    }
  };

  const logAction = async (action: string, details: string) => {
    const newLog: ActionLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details
    };
    const updatedLogs = [newLog, ...logs].slice(0, 200);
    setLogs(updatedLogs);
    storage.save(STORAGE_KEYS.LOGS, updatedLogs);
    
    // Fix: Using imported isSupabaseConfigured flag because supabase.supabaseUrl is a protected property
    if (isSupabaseConfigured) {
      try {
        await supabase.from('logs').insert(newLog);
      } catch (err) {}
    }
  };

  return {
    branches, employees, shifts, attendance, settings, logs, isLoading, syncStatus,
    actions: {
      updateBranches: (b: Branch[]) => sync('branches', b, STORAGE_KEYS.BRANCHES, setBranches),
      updateEmployees: (e: Employee[]) => sync('employees', e, STORAGE_KEYS.EMPLOYEES, setEmployees),
      updateShifts: (s: ShiftRequest[]) => sync('shifts', s, STORAGE_KEYS.SHIFTS, setShifts),
      updateAttendance: (a: AttendanceRecord[]) => sync('attendance', a, STORAGE_KEYS.ATTENDANCE, setAttendance),
      updateSettings: (s: SystemSettings) => sync('settings', { id: 'system', ...s }, STORAGE_KEYS.SETTINGS, setSettings),
      logAction,
    }
  };
};
