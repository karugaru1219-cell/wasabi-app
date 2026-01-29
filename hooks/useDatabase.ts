
import { useState, useCallback, useEffect, useRef } from 'react';
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

  const isInitialLoaded = useRef(false);

  // 全データの読み込み（Supabaseから最新を取得）
  const loadAllData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);

    // 1. ローカルストレージから即座に復旧（オフラインファースト）
    if (!isInitialLoaded.current) {
      setBranches(storage.get(STORAGE_KEYS.BRANCHES) || INITIAL_BRANCHES);
      setEmployees(storage.get(STORAGE_KEYS.EMPLOYEES) || INITIAL_EMPLOYEES);
      setShifts(storage.get(STORAGE_KEYS.SHIFTS) || []);
      setAttendance(storage.get(STORAGE_KEYS.ATTENDANCE) || []);
      setLogs(storage.get(STORAGE_KEYS.LOGS) || []);
      setSettings(storage.get(STORAGE_KEYS.SETTINGS) || SYSTEM_SETTINGS);
      isInitialLoaded.current = true;
    }

    // 2. Supabaseから最新データを取得
    if (isSupabaseConfigured) {
      setSyncStatus('syncing');
      try {
        const [
          { data: b }, { data: e }, { data: s }, { data: a }, { data: st }, { data: l }
        ] = await Promise.all([
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
        console.log("🔄 Database synced with Supabase");
      } catch (err) {
        console.error("❌ Sync failed:", err);
        setSyncStatus('error');
      }
    }
    if (showLoading) setIsLoading(false);
  }, []);

  // 初回ロード
  useEffect(() => { loadAllData(true); }, [loadAllData]);

  // 【最重要：リアルタイム購読】
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    console.log("📡 Realtime listening started...");

    // 全てのテーブルの変更（INSERT/UPDATE/DELETE）を監視
    const channel = supabase
      .channel('db-realtime-v1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('⚡️ Database Change Detected:', payload.table);
          // 変更があった瞬間にバックグラウンドで再読み込みを実行
          loadAllData(false);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAllData]);

  const syncUpdate = async (table: string, payload: any, storageKey: string, setter: (val: any) => void) => {
    setter(payload);
    storage.save(storageKey, payload);

    if (isSupabaseConfigured) {
      setSyncStatus('syncing');
      try {
        const { error } = await supabase.from(table).upsert(payload);
        if (error) throw error;
        setSyncStatus('synced');
      } catch (err) {
        console.error(`Error on ${table}:`, err);
        setSyncStatus('error');
      }
    }
  };

  const syncRemove = async (table: string, id: string, payload: any, storageKey: string, setter: (val: any) => void) => {
    setter(payload);
    storage.save(storageKey, payload);

    if (isSupabaseConfigured) {
      setSyncStatus('syncing');
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
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

    if (isSupabaseConfigured) {
      try {
        await supabase.from('logs').insert(newLog);
      } catch (err) { }
    }
  };

  return {
    branches, employees, shifts, attendance, settings, logs, isLoading, syncStatus,
    actions: {
      updateBranches: (b: Branch[]) => syncUpdate('branches', b, STORAGE_KEYS.BRANCHES, setBranches),
      removeBranch: (id: string, b: Branch[]) => syncRemove('branches', id, b, STORAGE_KEYS.BRANCHES, setBranches),
      updateEmployees: (e: Employee[]) => syncUpdate('employees', e, STORAGE_KEYS.EMPLOYEES, setEmployees),
      removeEmployee: (id: string, e: Employee[]) => syncRemove('employees', id, e, STORAGE_KEYS.EMPLOYEES, setEmployees),
      updateShifts: (s: ShiftRequest[]) => syncUpdate('shifts', s, STORAGE_KEYS.SHIFTS, setShifts),
      updateAttendance: (a: AttendanceRecord[]) => syncUpdate('attendance', a, STORAGE_KEYS.ATTENDANCE, setAttendance),
      updateSettings: (s: SystemSettings) => syncUpdate('settings', { id: 'system', ...s }, STORAGE_KEYS.SETTINGS, setSettings),
      logAction,
    }
  };
};
