'use client';

import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Table, Radio, InputNumber, Button, Tooltip, Modal, Tag, App, Skeleton } from 'antd';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import Navbar from '../../components/Navbar';
import { PiArrowCounterClockwiseBold } from 'react-icons/pi';
import { BsMoonStarsFill, BsSunriseFill, BsSunFill } from 'react-icons/bs';

interface CareLevelOption {
  admission_shift_care_level_id: number;
  name: string;
}

interface ShiftSummaryItem {
  admission_change_shift_type_id: number;
  shift_name: string;
  weight: string;
  count_remain: string;
  count_new_patient: string;
  count_get_ward_patient: string;
  count_discharge: string;
  count_transfer_out: string;
  count_refer: string;
  count_dead: string;
  care_normal: string;
  care_o2: string;
  care_hfnc: string;
  care_vent_cs: string;
  severity_1: string;
  severity_2: string;
  severity_3: string;
  severity_4: string;
  severity_5: string;
}

interface PatientInfo {
  admission_list_id: number | string;
  hn: string;
  an: string;
  name: string;
  age: number;
  ward: string;
  wardName: string;
  bed: string;
  admitDate: string;
  admitDateTimeIso: string;
  spcltyName: string;
  doctorName: string;
}

const getCurrentShift = (): string => {
  const h = dayjs().hour();
  if (h < 8) return 'night';
  if (h < 16) return 'morning';
  return 'afternoon';
};

const shiftBg: Record<string, string> = {
  night: '#e0e7ff',
  morning: '#dcfce7',
  afternoon: '#fef3c7',
};

// สีแต่ละระดับ — index ตาม admission_shift_care_level_id (1-based)
const careLevelStyles = [
  { bg: '#dcfce7', text: '#14532d', fte: 0.25 },
  { bg: '#e0f2fe', text: '#0c4a6e', fte: 0.5  },
  { bg: '#ffedd5', text: '#7c2d12', fte: 1.0  },
  { bg: '#fee2e2', text: '#7f1d1d', fte: 1.5  },
];

const movementConfig = [
  { key: 'newAdmit',    label: 'รับใหม่',  bg: '#ccfbf1', text: '#134e4a' },
  { key: 'transferIn',  label: 'รับย้าย',  bg: '#ede9fe', text: '#4c1d95' },
  { key: 'discharge',   label: 'จำหน่าย',  bg: '#ecfccb', text: '#365314' },
  { key: 'death',       label: 'ตาย',       bg: '#e2e8f0', text: '#1e293b' },
  { key: 'transferOut', label: 'ย้ายออก',  bg: '#fef3c7', text: '#78350f' },
];

const levelColors: Record<number, string> = {
  1: '#16a34a',
  2: '#ca8a04',
  3: '#ea580c',
  4: '#dc2626',
  5: '#9333ea',
};

const LevelCell = ({ value, onLevelChange, disabled }: { value?: number | null; onLevelChange?: (level: number | null) => void; disabled?: boolean }) => {
  const bg = value ? levelColors[value] : undefined;
  return (
    <div className="flex justify-center">
      <InputNumber
        min={1}
        max={5}
        size="small"
        value={value ?? null}
        onChange={onLevelChange}
        disabled={disabled}
        style={{ width: 54, backgroundColor: bg, borderColor: bg }}
        className={value ? '[&_input]:text-white! [&_input]:font-bold! [&_input]:bg-transparent!' : ''}
      />
    </div>
  );
};

// Previous shift config: which shift + which date to pull from
const prevShiftConfig: Record<string, { shiftKey: string; label: string; prevDay: boolean }> = {
  night:     { shiftKey: 'afternoon', label: 'บ่าย',  prevDay: true  },
  morning:   { shiftKey: 'night',     label: 'ดึก',   prevDay: false },
  afternoon: { shiftKey: 'morning',   label: 'เช้า',  prevDay: false },
};

function DailyRoutineContent() {
  const { notification } = App.useApp();
  const [selectedWard, setSelectedWard] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [wards, setWards] = useState<{ label: string; value: string }[]>([]);
  const [wardList, setWardList] = useState<{ his_code: string; general: number; crisis: number }[]>([]);
  const wardConfig = wardList.find(w => String(w.his_code) === String(selectedWard)) ?? { general: 0, crisis: 0 };
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [careLevels, setCareLevels] = useState<CareLevelOption[]>([]);
  // key: `${admission_list_id}_${shiftKey}` → admission_shift_care_level_id (string)
  const [radioSelections, setRadioSelections] = useState<Record<string, string>>({});
  // key: `${admission_list_id}_${shiftKey}` → level score
  const [levelScores, setLevelScores] = useState<Record<string, number | null>>({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  // key กำลัง save อยู่
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  // summary card data keyed by shiftKey (night/morning/afternoon)
  const [shiftSummary, setShiftSummary] = useState<Record<string, ShiftSummaryItem>>({});

  const shiftIdToKey: Record<number, string> = { 1: 'night', 2: 'morning', 3: 'afternoon' };

  const getMovements = (shiftKey: string): Record<string, number> => {
    const s = shiftSummary[shiftKey];
    if (!s) return { newAdmit: 0, transferIn: 0, discharge: 0, death: 0, transferOut: 0 };
    return {
      newAdmit:    Number(s.count_new_patient),
      transferIn:  Number(s.count_get_ward_patient),
      discharge:   Number(s.count_discharge),
      death:       Number(s.count_dead),
      transferOut: Number(s.count_transfer_out),
    };
  };

  // Modal state
  const [modalTargetShift, setModalTargetShift] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // shiftKey → shift_type_id
  const shiftKeyToId: Record<string, number> = { night: 1, morning: 2, afternoon: 3 };

  const getToken = () =>
    document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

  const buildPayload = (record: PatientInfo, shiftKey: string, careLevelId: number, level: number | null) => ({
    admission_list_id: record.admission_list_id,
    admission_shift_care_level_id: careLevelId,
    shift_type_id: shiftKeyToId[shiftKey],
    date: selectedDate.format('YYYY-MM-DD'),
    hn: record.hn,
    an: record.an,
    level,
  });

  const fetchShiftSummary = async (ward?: string, date?: string) => {
    const w = ward ?? selectedWard;
    const d = date ?? selectedDate.format('YYYY-MM-DD');
    if (!w) return;
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      const res = await axios.post('/api/v1/patient-shift-daily-records-summary', {
        ward: w,
        date: d,
      }, { headers });
      const list: ShiftSummaryItem[] = res.data?.data || [];
      const map: Record<string, ShiftSummaryItem> = {};
      list.forEach(item => {
        const key = shiftIdToKey[item.admission_change_shift_type_id];
        if (key) map[key] = item;
      });
      setShiftSummary(map);
    } catch (e) {
      console.error('Error fetching shift summary:', e);
    }
  };

  const postRecord = async (payload: ReturnType<typeof buildPayload>) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    try {
      await axios.post('/api/v1/admission-shift-daily-records', payload, { headers });
      notification.success({ title: 'บันทึกสำเร็จ', duration: 2 });
      fetchShiftSummary();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        console.error('Error saving record:', e.response?.status, e.response?.data);
        notification.error({ title: 'บันทึกไม่สำเร็จ', description: e.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง', duration: 3 });
      } else {
        console.error('Error saving record:', e);
        notification.error({ title: 'บันทึกไม่สำเร็จ', duration: 3 });
      }
    }
  };

  const setRadio = async (record: PatientInfo, shiftKey: string, levelId: number) => {
    const stateKey = `${record.admission_list_id}_${shiftKey}`;
    setRadioSelections(prev => ({ ...prev, [stateKey]: String(levelId) }));
    setSavingKeys(prev => new Set([...prev, stateKey]));
    await postRecord(buildPayload(record, shiftKey, levelId, levelScores[stateKey] ?? null));
    setSavingKeys(prev => { const s = new Set(prev); s.delete(stateKey); return s; });
  };

  const saveLevel = async (record: PatientInfo, shiftKey: string, level: number | null) => {
    if (level === null) return;
    const stateKey = `${record.admission_list_id}_${shiftKey}`;
    setLevelScores(prev => ({ ...prev, [stateKey]: level }));
    const careLevelId = Number(radioSelections[stateKey] ?? 0);
    await postRecord(buildPayload(record, shiftKey, careLevelId, level));
  };

  const openPrevShiftModal = (targetShiftKey: string) => {
    setModalTargetShift(targetShiftKey);
    setModalOpen(true);
  };

  const handleModalConfirm = async () => {
    if (!modalTargetShift) return;
    const { shiftKey: srcShiftKey, prevDay } = prevShiftConfig[modalTargetShift];

    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    const sourceDate = prevDay
      ? selectedDate.subtract(1, 'day').format('YYYY-MM-DD')
      : selectedDate.format('YYYY-MM-DD');

    const body = {
      ward: selectedWard,
      target_date: selectedDate.format('YYYY-MM-DD'),
      target_shift_type_id: shiftKeyToId[modalTargetShift],
      source_date: sourceDate,
      source_shift_type_id: shiftKeyToId[srcShiftKey],
    };

    try {
      await axios.post('/api/v1/patient-shift-daily-records/copy-previous', body, { headers });
      // โหลดข้อมูลใหม่หลัง copy สำเร็จ
      const res = await axios.post('/api/v1/patient-shift-daily-records', {
        ward: selectedWard,
        date: selectedDate.format('YYYY-MM-DD'),
      }, { headers });
      const records: {
        admission_list_id: number;
        night_care_level: number | null; night_severity_level: number | null;
        morning_care_level: number | null; morning_severity_level: number | null;
        evening_care_level: number | null; evening_severity_level: number | null;
      }[] = Array.isArray(res.data) ? res.data : res.data.data || [];

      const newRadios: Record<string, string> = {};
      const newLevels: Record<string, number | null> = {};
      records.forEach(r => {
        const id = r.admission_list_id;
        if (r.night_care_level)     newRadios[`${id}_night`]     = String(r.night_care_level);
        if (r.morning_care_level)   newRadios[`${id}_morning`]   = String(r.morning_care_level);
        if (r.evening_care_level)   newRadios[`${id}_afternoon`] = String(r.evening_care_level);
        if (r.night_severity_level   != null) newLevels[`${id}_night`]     = r.night_severity_level;
        if (r.morning_severity_level != null) newLevels[`${id}_morning`]   = r.morning_severity_level;
        if (r.evening_severity_level != null) newLevels[`${id}_afternoon`] = r.evening_severity_level;
      });
      setRadioSelections(newRadios);
      setLevelScores(newLevels);
      fetchShiftSummary();
      notification.success({ title: 'ดึงข้อมูลเวรก่อนหน้าสำเร็จ', duration: 2 });
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        console.error('Error copying records:', e.response?.status, e.response?.data);
        notification.error({ title: 'เกิดข้อผิดพลาด', description: e.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง', duration: 3 });
      }
    }

    setModalOpen(false);
  };

  const getPrevShiftDate = (targetShift: string) => {
    const cfg = prevShiftConfig[targetShift];
    if (!cfg) return { date: selectedDate, label: '' };
    const date = cfg.prevDay ? selectedDate.subtract(1, 'day') : selectedDate;
    return { date, label: cfg.label };
  };

  const getPatientsWithData = (targetShift: string): (PatientInfo & { radioValue: string })[] => {
    const { shiftKey: srcKey } = prevShiftConfig[targetShift] ?? {};
    if (!srcKey) return [];
    return patients
      .filter(p => radioSelections[`${p.admission_list_id}_${srcKey}`])
      .map(p => ({ ...p, radioValue: radioSelections[`${p.admission_list_id}_${srcKey}`] }));
  };

  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const res = await axios.get('/api/v1/wardsV1', { headers: { Authorization: `Bearer ${token}` } });
        const list = Array.isArray(res.data) ? res.data : res.data.data || [];
        const options = list.map((w: { ward_name: string; his_code: string }) => ({ label: w.ward_name, value: w.his_code }));
        setWards(options);
        setWardList(list.map((w: { his_code: string; general: string; crisis: string }) => ({
          his_code: w.his_code,
          general: parseFloat(w.general) || 0,
          crisis: parseFloat(w.crisis) || 0,
        })));
        // ไม่ set ค่าเริ่มต้น ให้ user เลือกเอง
      } catch (e) {
        console.error('Error fetching wards:', e);
      }
    };
    const fetchCareLevels = async () => {
      try {
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get('/api/v1/admission-shift-care-levels', { headers });
        const data: CareLevelOption[] = Array.isArray(res.data) ? res.data : res.data.data || [];
        setCareLevels(data);
      } catch (e) {
        console.error('Error fetching care levels:', e);
      }
    };
    fetchWards();
    fetchCareLevels();
  }, []);

  useEffect(() => {
    // เคลียร์ค่าเก่าก่อน fetch ใหม่
    setShiftSummary({});
    setRadioSelections({});
    setLevelScores({});
    setPatients([]);

    if (!selectedWard) return;
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const res = await axios.get(`/api/v1/patients-register-by-ward/${selectedWard}`, { headers });
        const list = Array.isArray(res.data) ? res.data : res.data.data || [];
        setPatients(list);
      } catch (e) {
        console.error('Error fetching patients:', e);
      } finally {
        setLoadingPatients(false);
      }
    };

    const fetchExistingRecords = async () => {
      setLoadingRecords(true);
      try {
        const res = await axios.post('/api/v1/patient-shift-daily-records', {
          ward: selectedWard,
          date: selectedDate.format('YYYY-MM-DD'),
        }, { headers: { ...headers, 'Content-Type': 'application/json' } });

        const records: {
          admission_list_id: number;
          night_care_level: number | null;
          night_severity_level: number | null;
          morning_care_level: number | null;
          morning_severity_level: number | null;
          evening_care_level: number | null;
          evening_severity_level: number | null;
        }[] = Array.isArray(res.data) ? res.data : res.data.data || [];

        const newRadios: Record<string, string> = {};
        const newLevels: Record<string, number | null> = {};

        records.forEach(r => {
          const id = r.admission_list_id;
          if (r.night_care_level)     newRadios[`${id}_night`]     = String(r.night_care_level);
          if (r.morning_care_level)   newRadios[`${id}_morning`]   = String(r.morning_care_level);
          if (r.evening_care_level)   newRadios[`${id}_afternoon`] = String(r.evening_care_level);
          if (r.night_severity_level != null)   newLevels[`${id}_night`]     = r.night_severity_level;
          if (r.morning_severity_level != null) newLevels[`${id}_morning`]   = r.morning_severity_level;
          if (r.evening_severity_level != null) newLevels[`${id}_afternoon`] = r.evening_severity_level;
        });

        setRadioSelections(newRadios);
        setLevelScores(newLevels);
      } catch (e) {
        console.error('Error fetching existing records:', e);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchPatients();
    fetchExistingRecords();
    fetchShiftSummary(selectedWard, selectedDate.format('YYYY-MM-DD'));
  }, [selectedWard, selectedDate]);

  const currentShift = getCurrentShift();

  const countByLevel = (shiftKey: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    careLevels.forEach(l => { counts[String(l.admission_shift_care_level_id)] = 0; });
    patients.forEach(p => {
      const val = radioSelections[`${p.admission_list_id}_${shiftKey}`];
      if (val && val in counts) counts[val]++;
    });
    return counts;
  };

  const calcFte = (counts: Record<string, number>, weight: number) => {
    let sum = 0;
    careLevels.forEach(l => {
      const id = l.admission_shift_care_level_id;
      const count = counts[String(id)] ?? 0;
      const multiplier = id === 4 ? wardConfig.crisis : wardConfig.general;
      sum += count * multiplier;
    });
    return Math.ceil((sum * weight / 100 / 7) * 100) / 100;
  };

  const dateLabel = selectedDate.format('D/M/YYYY');

  // ตรวจสอบว่า selectedDate อยู่ก่อนวัน admit ของผู้ป่วยหรือไม่
  // admitDate จาก API เป็น ค.ศ. format "DD/MM/YYYY" — split แปลงเป็น YYYY-MM-DD ก่อน parse
  const isBeforeAdmit = (record: PatientInfo): boolean => {
    if (!record.admitDate) return false;
    const [dd, mm, yyyy] = record.admitDate.split('/');
    const admitDay = dayjs(`${yyyy}-${mm}-${dd}`).startOf('day');
    return selectedDate.startOf('day').isBefore(admitDay);
  };

  const shiftChildren = (shiftKey: string, cellBg: string) => {
    const dCell = () => ({ style: { backgroundColor: cellBg } });
    const radioCols = careLevels.map((level) => {
      const levelId = level.admission_shift_care_level_id;
      return {
        title: <span className="text-white">{level.name}</span>,
        key: `level_${levelId}_${shiftKey}`,
        align: 'center' as const,
        width: 70,
        onCell: dCell,
        render: (_: unknown, record: PatientInfo) => {
          const stateKey = `${record.admission_list_id}_${shiftKey}`;
          if (loadingRecords) return <Skeleton.Button active size="small" style={{ width: 20, minWidth: 20, height: 20 }} />;
          const beforeAdmit = isBeforeAdmit(record);
          return (
            <div className="flex justify-center">
              <Radio
                checked={radioSelections[stateKey] === String(levelId)}
                onChange={() => setRadio(record, shiftKey, levelId)}
                disabled={savingKeys.has(stateKey) || beforeAdmit}
              />
            </div>
          );
        },
      };
    });
    return [
      ...radioCols,
      {
        title: 'Level',
        key: `level_score_${shiftKey}`,
        align: 'center' as const,
        width: 70,
        onCell: dCell,
        render: (_: unknown, record: PatientInfo) => {
          if (loadingRecords) return <Skeleton.Input active size="small" style={{ width: 54, height: 24 }} />;
          return (
            <LevelCell
              value={levelScores[`${record.admission_list_id}_${shiftKey}`]}
              onLevelChange={(level) => saveLevel(record, shiftKey, level)}
              disabled={isBeforeAdmit(record)}
            />
          );
        },
      },
    ];
  };

  const shiftLabelMap: Record<string, string> = { night: 'ดึก', morning: 'เช้า', afternoon: 'บ่าย' };
  const shiftIconMap: Record<string, React.ReactNode> = {
    night:     <BsMoonStarsFill className="text-indigo-400" />,
    morning:   <BsSunriseFill   className="text-orange-400" />,
    afternoon: <BsSunFill       className="text-yellow-400" />,
  };

  const columns: ColumnsType<PatientInfo> = [
    {
      title: 'ลำดับ',
      key: 'index',
      align: 'center',
      width: 60,
      fixed: 'left',
      render: (_: unknown, __: PatientInfo, index: number) => index + 1,
    },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 90, align: 'center' },
    {
      title: 'ชื่อ-นามสกุล', key: 'name', width: 180, fixed: 'left',
      render: (_: unknown, record: PatientInfo) => {
        const [dd, mm, yyyy] = (record.admitDate ?? '').split('/');
        const isNewToday = record.admitDate && dayjs(`${yyyy}-${mm}-${dd}`).isSame(selectedDate, 'day');
        return (
          <span className="flex items-center gap-1">
            {record.name}
            {isNewToday && (
              <span className="text-[10px] font-bold bg-green-500 text-white px-1 rounded-full leading-tight">รับใหม่</span>
            )}
          </span>
        );
      },
    },
    { title: 'เตียง', dataIndex: 'bed', key: 'bed', width: 70, align: 'center' },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <BsMoonStarsFill className="text-indigo-300" />
          <span className="font-bold text-white">ดึก {dateLabel}</span>
          <Tooltip title="ดึงข้อมูลเวรก่อนหน้า 1 เวร">
            <Button size="small" icon={<PiArrowCounterClockwiseBold />}
              onClick={() => openPrevShiftModal('night')}
              className="border-white/40 text-white bg-white/10 hover:bg-white/20 flex items-center" />
          </Tooltip>
        </div>
      ),
      children: shiftChildren('night', '#ede9fe'),
    },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <BsSunriseFill className="text-orange-300" />
          <span className="font-bold text-white">เช้า {dateLabel}</span>
          <Tooltip title="ดึงข้อมูลเวรก่อนหน้า 1 เวร">
            <Button size="small" icon={<PiArrowCounterClockwiseBold />}
              onClick={() => openPrevShiftModal('morning')}
              className="border-white/40 text-white bg-white/10 hover:bg-white/20 flex items-center" />
          </Tooltip>
        </div>
      ),
      children: shiftChildren('morning', '#fefce8'),
    },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <BsSunFill className="text-yellow-300" />
          <span className="font-bold text-white">บ่าย {dateLabel}</span>
          <Tooltip title="ดึงข้อมูลเวรก่อนหน้า 1 เวร">
            <Button size="small" icon={<PiArrowCounterClockwiseBold />}
              onClick={() => openPrevShiftModal('afternoon')}
              className="border-white/40 text-white bg-white/10 hover:bg-white/20 flex items-center" />
          </Tooltip>
        </div>
      ),
      children: shiftChildren('afternoon', '#fed7aa'),
    },
  ];

  // Modal computed values
  const modalPrevInfo = modalTargetShift ? getPrevShiftDate(modalTargetShift) : null;
  const modalPatients = modalTargetShift ? getPatientsWithData(modalTargetShift) : [];

  const modalColumns: ColumnsType<PatientInfo & { radioValue: string }> = [
    {
      title: 'ลำดับ', key: 'index', align: 'center', width: 60,
      render: (_: unknown, __: unknown, i: number) => i + 1,
    },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100, align: 'center' },
    { title: 'ชื่อ-นามสกุล', dataIndex: 'name', key: 'name' },
    { title: 'เตียง', dataIndex: 'bed', key: 'bed', width: 70, align: 'center' },
    {
      title: 'ข้อมูลที่บันทึก',
      dataIndex: 'radioValue',
      key: 'radioValue',
      align: 'center',
      width: 160,
      render: (val: string) => {
        const level = careLevels.find(l => String(l.admission_shift_care_level_id) === val);
        const idx = level ? careLevels.indexOf(level) : 0;
        const tagColors = ['green', 'blue', 'orange', 'red'];
        return <Tag color={tagColors[idx] ?? 'default'}>{level?.name ?? val}</Tag>;
      },
    },
  ];

  return (
    <div className="p-4">
      <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-[#006b5f] m-0">Daily Routine</h2>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-gray-600 text-sm">หอผู้ป่วย:</span>
              <Select value={selectedWard} onChange={setSelectedWard} style={{ width: 180 }}
                placeholder="เลือกหอผู้ป่วย" options={wards} />
              <span className="text-gray-600 text-sm">วันที่:</span>
              <DatePicker value={selectedDate} onChange={(date) => date && setSelectedDate(date)}
                format="DD/MM/YYYY" allowClear={false} />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['night', 'morning', 'afternoon'] as const).map(shiftKey => {
              const s = shiftSummary[shiftKey];
              const careKeys = ['care_normal', 'care_o2', 'care_hfnc', 'care_vent_cs'] as const;
              const counts = s
                ? Object.fromEntries(
                    careLevels.map((l, i) => [String(l.admission_shift_care_level_id), Number(s[careKeys[i]] ?? 0)])
                  )
                : countByLevel(shiftKey);
              const weight = s ? Number(s.weight ?? 0) : 0;
              const fte = calcFte(counts, weight);
              const isActive = shiftKey === currentShift;
              const shiftLabel = shiftLabelMap[shiftKey];
              return (
                <div
                  key={shiftKey}
                  style={{ background: isActive ? shiftBg[shiftKey] : '#f8fafc', borderColor: isActive ? '#006b5f' : '#e2e8f0' }}
                  className="flex flex-wrap gap-1 items-center px-2 py-1 rounded-xl border transition-all"
                >
                  {careLevels.map((level, i) => {
                    const style = careLevelStyles[i] ?? careLevelStyles[careLevelStyles.length - 1];
                    const id = String(level.admission_shift_care_level_id);
                    return (
                      <div key={id} style={{ background: style.bg, color: style.text }}
                        className="flex flex-col items-center px-1.5 py-0.5 rounded-md min-w-9">
                        <span className="text-[10px] font-medium leading-none text-center">{level.name}</span>
                        <span className="text-sm font-bold leading-tight">{counts[id] ?? 0}</span>
                      </div>
                    );
                  })}
                  {movementConfig.map(({ key, label, bg, text }) => (
                    <React.Fragment key={key}>
                      <div style={{ background: bg, color: text }}
                        className="flex flex-col items-center rounded-md px-1.5 py-0.5 w-9">
                        <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
                        <span className="text-sm font-bold leading-tight">{getMovements(shiftKey)[key]}</span>
                      </div>
                      {key === 'transferIn' && (
                        <div className="flex flex-col items-center px-1.5 py-0.5 rounded-md w-9"
                          style={{ background: '#e0f2fe', color: '#0c4a6e' }}>
                          <span className="text-[10px] font-medium leading-none">คงอยู่</span>
                          <span className="text-sm font-bold leading-tight">{s ? Number(s.count_remain) : 0}</span>
                        </div>
                      )}
                      {key === 'death' && (
                        <div className="flex flex-col items-center px-1.5 py-0.5 rounded-md w-9"
                          style={{ background: '#f1f5f9', color: '#475569' }}>
                          <span className="text-[10px] font-medium leading-none">Refer</span>
                          <span className="text-sm font-bold leading-tight">{s ? Number(s.count_refer) : 0}</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {([1, 2, 3, 4, 5] as const).map(n => (
                    <div key={n} className="flex flex-col items-center px-1.5 py-0.5 rounded-md w-9"
                      style={{ background: levelColors[n] + '22', color: levelColors[n] }}>
                      <span className="text-[10px] font-medium leading-none">Lv{n}</span>
                      <span className="text-sm font-bold leading-tight">{s ? Number(s[`severity_${n}`]) : 0}</span>
                    </div>
                  ))}
                  <div className="w-px h-7 bg-gray-200 shrink-0" />
                  <div className="flex flex-col items-center px-1.5 py-0.5 rounded-md w-9"
                    style={{ background: '#d1fae5', color: '#064e3b' }}>
                    <span className="text-[10px] font-medium leading-none">FTE</span>
                    <span className="text-sm font-bold leading-tight">{fte.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col items-center px-1.5 py-0.5 rounded-md w-9"
                    style={{ background: '#fce7f3', color: '#831843' }}>
                    <span className="text-[10px] font-medium leading-none">Product</span>
                    <span className="text-sm font-bold leading-tight">—</span>
                  </div>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {isActive && (
                      <span className="text-[7px] bg-[#006b5f] text-white px-1 rounded-full leading-tight">เวรนี้</span>
                    )}
                    <span className="text-base">{shiftIconMap[shiftKey]}</span>
                    <span className={`text-sm font-bold ${isActive ? 'text-[#006b5f]' : 'text-gray-400'}`}>{shiftLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Table
            columns={columns}
            dataSource={patients}
            rowKey="admission_list_id"
            loading={loadingPatients}
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={false}
            bordered
            className="
              [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
              [&_.ant-table-thead_.ant-table-cell]:text-white!
              [&_.ant-table-thead_.ant-table-cell]:font-semibold!
              [&_.ant-table-thead_.ant-table-cell]:text-center!
            "
          />
      </Card>

      {/* Modal: ดึงข้อมูลเวรก่อนหน้า */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleModalConfirm}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
        okButtonProps={{ style: { backgroundColor: '#006b5f', borderColor: '#006b5f' } }}
        title={<span className="text-[#006b5f] font-semibold">ดึงข้อมูลเวรก่อนหน้า</span>}
        width={640}
      >
        {modalTargetShift && modalPrevInfo && (
          <div className="space-y-3">
            <p className="text-gray-700">
              คุณต้องการใช้ข้อมูลเดียวกันกับ{' '}
              <span className="font-semibold text-[#006b5f]">
                วันที่ {modalPrevInfo.date.format('D/M/YYYY')} เวร {modalPrevInfo.label}
              </span>{' '}
              มาใช้กับเวร{' '}
              <span className="font-semibold text-[#006b5f]">
                {shiftLabelMap[modalTargetShift]} {selectedDate.format('D/M/YYYY')}
              </span>{' '}
              ใช่หรือไม่?
            </p>
            {modalPatients.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">
                ไม่มีข้อมูลผู้ป่วยที่บันทึกในเวรดังกล่าว
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  พบข้อมูลผู้ป่วยที่บันทึกไว้ <span className="font-semibold">{modalPatients.length}</span> ราย
                </p>
                <Table
                  columns={modalColumns}
                  dataSource={modalPatients}
                  rowKey="admission_list_id"
                  size="small"
                  pagination={false}
                  bordered
                  className="
                    [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                    [&_.ant-table-thead_.ant-table-cell]:text-white!
                    [&_.ant-table-thead_.ant-table-cell]:text-center!
                  "
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function DailyRoutinePage() {
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <App>
        <DailyRoutineContent />
      </App>
    </div>
  );
}
