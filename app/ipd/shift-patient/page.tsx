'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Select, 
  DatePicker, 
  Radio, 
  Input, 
  Button, 
  message,
  Divider,
  Tag,
  Table,
  Drawer,
  Tabs,
  AutoComplete,
  Slider,
  Collapse,
  Timeline
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import axios from 'axios';
import { 
  PiUserBold, 
  PiHouseBold, 
  PiCalendarCheckBold,
  PiArrowRightBold,
  PiXBold,
  PiMagnifyingGlassBold,
  PiClockBold
} from 'react-icons/pi';
import { MdOutlineSummarize } from 'react-icons/md';

dayjs.locale('th');

const { TextArea } = Input;

interface PatientInfo {
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

interface ShiftType {
  admission_change_shift_type_id: number;
  shift_name: string;
}

interface SeverityLevel {
  severity_level_id: number;
  severity_level_name: string;
}

interface Ward {
  ward: string;
  name: string;
}

// ─── Prefix/Suffix constants ───────────────────────────────────────────────
const PREFIX_SEARCH = <PiMagnifyingGlassBold className="text-gray-400" />;
const PREFIX_BP     = <span className="text-[11px] w-8 inline-block text-gray-500">BP</span>;
const PREFIX_PR     = <span className="text-[11px] w-8 inline-block text-gray-500">PR</span>;
const SUFFIX_BPM    = <span className="text-[10px] text-gray-400">bpm</span>;
const PREFIX_RR     = <span className="text-[11px] w-8 inline-block text-gray-500">RR</span>;
const SUFFIX_MIN    = <span className="text-[10px] text-gray-400">/min</span>;
const PREFIX_TEMP   = <span className="text-[11px] w-8 inline-block text-gray-500">Temp</span>;
const SUFFIX_C      = <span className="text-[10px] text-gray-400">°C</span>;
const PREFIX_SPO2   = <span className="text-[11px] w-8 inline-block text-gray-500">SpO2</span>;
const SUFFIX_PERCENT= <span className="text-[10px] text-gray-400">%</span>;
const PREFIX_IV     = <span className="text-[10px] w-12 inline-block text-gray-500">IV Fluid</span>;
const PREFIX_TUBE   = <span className="text-[10px] w-12 inline-block text-gray-500">Tube</span>;
const PREFIX_ORAL   = <span className="text-[10px] w-12 inline-block text-gray-500">Oral</span>;
const SUFFIX_ML     = <span className="text-[10px] text-gray-400">ml</span>;
const PREFIX_URINE  = <span className="text-[10px] w-10 inline-block text-gray-500">Urine</span>;
const PREFIX_FECES  = <span className="text-[10px] w-10 inline-block text-gray-500">Feces</span>;
const PREFIX_DRAIN  = <span className="text-[10px] w-10 inline-block text-gray-500">Drain</span>;

// ─── Types ─────────────────────────────────────────────────────────────────
interface WoundEntry {
  id: number;
  location: string;
  type: string;
  size: string;
  exudate: string;
  odor: string;
  note: string;
}

interface MedEntry {
  id: number;
  name: string;
  dose: string;
  route: string;
  time: string;
  given: boolean;
  note: string;
}

interface CarePlanEntry {
  id: number;
  diagnosis: string;
  goal: string;
  action: string;
  evaluation: string;
  status: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────
const now = dayjs();

const mockPatients: PatientInfo[] = [
  { hn: '66000001', an: '67000001', name: 'นายสมชาย รักดี',          age: 45, ward: '02', wardName: 'ศัลยกรรมชาย',            bed: '01', admitDate: now.subtract(4,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(4,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'ศัลยกรรม',       doctorName: 'นพ. สมชาย ใจดี'     },
  { hn: '66000002', an: '67000002', name: 'นายวิชัย ใจกล้า',          age: 50, ward: '02', wardName: 'ศัลยกรรมชาย',            bed: '02', admitDate: now.subtract(1,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(1,'day').subtract(4,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'ศัลยกรรม',       doctorName: 'พญ. หญิง สมบูรณ์'  },
  { hn: '66000003', an: '67000003', name: 'นางสาวสมหญิง จริงใจ',      age: 32, ward: '03', wardName: 'ศัลยกรรมหญิง',           bed: '01', admitDate: now.subtract(7,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(7,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'ศัลยกรรม',       doctorName: 'นพ. ประสิทธิ์ เก่งกาจ' },
  { hn: '66000004', an: '67000004', name: 'นายประสิทธิ์ คิดรอบคอบ',   age: 62, ward: '04', wardName: 'ศัลยกรรมกระดูก',          bed: '05', admitDate: now.subtract(10,'day').format('DD/MM/YYYY'), admitDateTimeIso: now.subtract(10,'day').format('YYYY-MM-DDTHH:mm:00'),           spcltyName: 'ศัลยกรรมกระดูก', doctorName: 'นพ. สมชาย ใจดี'     },
  { hn: '66000005', an: '67000005', name: 'นางวันดี มีสุข',            age: 28, ward: '22', wardName: 'หอผู้ป่วยอายุรกรรม 1',     bed: '03', admitDate: now.subtract(2,'hour').format('DD/MM/YYYY'), admitDateTimeIso: now.subtract(2,'hour').format('YYYY-MM-DDTHH:mm:00'),           spcltyName: 'อายุรกรรม',      doctorName: 'พญ. สุดา งามเลิศ'   },
  { hn: '66000006', an: '67000006', name: 'ด.ช.มานะ อดทน',            age:  8, ward: '06', wardName: 'กุมารเวชกรรม',           bed: '12', admitDate: now.subtract(2,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(2,'day').add(1,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'กุมารเวชกรรม',  doctorName: 'นพ. วีระ ใจดี'      },
  { hn: '66000007', an: '67000007', name: 'ด.ญ.ปิติ ยินดี',            age:  5, ward: '06', wardName: 'กุมารเวชกรรม',           bed: '14', admitDate: now.subtract(5,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(5,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'กุมารเวชกรรม',  doctorName: 'นพ. วีระ ใจดี'      },
  { hn: '66000008', an: '67000008', name: 'นายทรงพล เกียรติยศ',        age: 75, ward: '16', wardName: 'หอผู้ป่วยหนัก 1(MICU1)',   bed: '02', admitDate: now.subtract(3,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(3,'day').subtract(6,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'อายุรกรรม',      doctorName: 'นพ. เอกชัย นำชัย'   },
  { hn: '66000009', an: '67000009', name: 'นางสมร ทรัพย์มาก',          age: 68, ward: '01', wardName: 'หอผู้ป่วยหนัก 2(MICU2)',   bed: '04', admitDate: now.subtract(6,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(6,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'อายุรกรรม',      doctorName: 'นพ. เอกชัย นำชัย'   },
  { hn: '66000010', an: '67000010', name: 'นางมาลี สีสวย',             age: 41, ward: '08', wardName: 'ห้องคลอด',               bed: '08', admitDate: now.subtract(8,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(8,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'สูตินารีเวชกรรม', doctorName: 'พญ. นารี งามตา'     },
  { hn: '66000011', an: '67000011', name: 'น.ส.ใจดี รักสงบ',           age: 25, ward: '09', wardName: 'หลังคลอด',               bed: '09', admitDate: now.subtract(1,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(1,'day').subtract(1,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'สูตินารีเวชกรรม', doctorName: 'พญ. นารี งามตา'     },
  { hn: '66000012', an: '67000012', name: 'นายพิชัย สู้ชีวิต',         age: 55, ward: '33', wardName: 'หอผู้ป่วยหนัก 3(SICU)',   bed: '05', admitDate: now.subtract(0,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(4,'hour').format('YYYY-MM-DDTHH:mm:00'),           spcltyName: 'ศัลยกรรม',       doctorName: 'นพ. สมชาย ใจดี'     },
  { hn: '66000013', an: '67000013', name: 'นายสุนทร พรหมจรรย์',        age: 39, ward: '00', wardName: 'หอผู้ป่วยอายุรกรรม 2',     bed: '11', admitDate: now.subtract(4,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(4,'day').add(2,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'อายุรกรรม',      doctorName: 'นพ. สมชาย ใจดี'     },
  { hn: '66000014', an: '67000014', name: 'นางจินตนา พาขวัญ',          age: 48, ward: '14', wardName: 'พิเศษ ชั้น 4',            bed: '07', admitDate: now.subtract(2,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(2,'day').subtract(8,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'อายุรกรรม',      doctorName: 'พญ. สุดา งามเลิศ'   },
  { hn: '66000015', an: '67000015', name: 'น.ส.วิภาดา น่ารัก',         age: 22, ward: '15', wardName: 'พิเศษ ชั้น 5',            bed: '06', admitDate: now.subtract(3,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(3,'day').format('YYYY-MM-DDTHH:mm:00'),            spcltyName: 'ศัลยกรรม',       doctorName: 'นพ. ประสิทธิ์ เก่งกาจ' },
  { hn: '66000016', an: '67000016', name: 'นายเกรียงไกร ชัยชนะ',       age: 58, ward: '25', wardName: 'พิเศษ VIP ชั้น 5',        bed: '10', admitDate: now.subtract(5,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(5,'day').subtract(3,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'ศัลยกรรม',       doctorName: 'นพ. สมชาย ใจดี'     },
  { hn: '66000017', an: '67000017', name: 'ด.ช.นพดล คนเก่ง',           age:  0, ward: '07', wardName: 'ทารกแรกเกิด ( nursery)',   bed: '15', admitDate: now.subtract(2,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(2,'day').add(5,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'กุมารเวชกรรม',  doctorName: 'นพ. วีระ ใจดี'      },
  { hn: '66000018', an: '67000018', name: 'นางสมบูรณ์ พูนสุข',         age: 72, ward: '30', wardName: 'Sub ICU Med',            bed: '12', admitDate: now.subtract(1,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(1,'day').subtract(12,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'อายุรกรรม',     doctorName: 'พญ. สุดา งามเลิศ'   },
  { hn: '66000019', an: '67000019', name: 'น.ส.รัตนา น่าชม',           age: 29, ward: '34', wardName: 'หอผู้ป่วยเฟื่องฟ้า',         bed: '10', admitDate: now.subtract(0,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(6,'hour').format('YYYY-MM-DDTHH:mm:00'),           spcltyName: 'สูตินารีเวชกรรม', doctorName: 'พญ. นารี งามตา'     },
  { hn: '66000020', an: '67000020', name: 'นายบุญส่ง ทรงธรรม',         age: 80, ward: '37', wardName: 'Home Ward',              bed: '05', admitDate: now.subtract(7,'day').format('DD/MM/YYYY'),  admitDateTimeIso: now.subtract(7,'day').subtract(2,'hour').format('YYYY-MM-DDTHH:mm:00'), spcltyName: 'อายุรกรรม',      doctorName: 'นพ. เอกชัย นำชัย'   },
];

const mockHistoryRecords = [
  {
    id: 1,
    date: dayjs().subtract(0, 'day').format('DD/MM/YYYY'),
    shiftName: 'เช้า',
    recorder: 'พยบ. สมใจ ดีเสมอ',
    severityLevel: 3,
    isVentilator: false,
    vitals: { bp: '120/80', pr: '82', rr: '20', temp: '36.8', o2: '98' },
    gcs: { e: 4, v: 5, m: 6, total: 15 },
    isbar: {
      s: 'ผู้ป่วยมีไข้ต่ำๆ บ่นปวดแผลผ่าตัดบริเวณหน้าท้อง',
      b: 'Post-op Appendectomy วันที่ 2',
      a: 'V/S ปกติ ยกเว้น Temp 37.8°C, Pain score 4/10',
      r: 'Observe V/S ทุก 4 ชม., ให้ยาแก้ปวดตามแผนการรักษา'
    },
    focus: {
      f: 'ปวดแผลผ่าตัด',
      d: 'ผู้ป่วยนิ่วหน้า บ่นปวดแผล Pain score 4',
      a: 'ให้ยา Paracetamol 500mg 1 tab oral',
      r: 'หลังให้ยา 30 นาที อาการปวดทุเลาลง Pain score 2'
    }
  },
  {
    id: 2,
    date: dayjs().subtract(1, 'day').format('DD/MM/YYYY'),
    shiftName: 'ดึก',
    recorder: 'พยบ. สมใจ ดีเสมอ',
    severityLevel: 3,
    isVentilator: false,
    vitals: { bp: '110/70', pr: '78', rr: '18', temp: '37.0', o2: '99' },
    gcs: { e: 4, v: 5, m: 6, total: 15 },
    isbar: {
      s: 'ผู้ป่วยนอนหลับพักผ่อนได้ดี',
      b: 'Post-op Appendectomy วันที่ 1',
      a: 'V/S ปกติ แผลผ่าตัดไม่มี bleeding ซึม',
      r: 'ติดตามอาการต่อเนื่อง'
    },
    focus: {
      f: 'พักผ่อน',
      d: 'ผู้ป่วยหลับตาพักผ่อน ไม่มีอาการกระสับกระส่าย',
      a: 'จัดสิ่งแวดล้อมให้สงบ ลดการรบกวน',
      r: 'ผู้ป่วยสามารถนอนหลับได้ต่อเนื่องตลอดเวร'
    }
  }
];

const severityLevels: SeverityLevel[] = [
  { severity_level_id: 1, severity_level_name: 'ผู้ป่วยทั่วไป / อาการดี' },
  { severity_level_id: 2, severity_level_name: 'ผู้ป่วยต้องช่วยเหลือบางส่วน' },
  { severity_level_id: 3, severity_level_name: 'ผู้ป่วยมีอาการปานกลาง' },
  { severity_level_id: 4, severity_level_name: 'ผู้ป่วยอาการหนัก ต้องการดูแลพิเศษ' },
  { severity_level_id: 5, severity_level_name: 'ผู้ป่วยวิกฤติ (Critical)' },
];

const focusHistoryOptions = [
  { value: 'มีไข้สูง' },
  { value: 'ปวดแผลผ่าตัด' },
  { value: 'เสี่ยงต่อการพลัดตกหกล้ม' },
  { value: 'หายใจหอบเหนื่อย' },
  { value: 'พักผ่อนไม่เพียงพอ' },
];

const getShiftIdFromTime = (date: dayjs.Dayjs) => {
  const h = date.hour();
  if (h >= 8 && h < 16) return 2;
  if (h >= 16) return 3;
  return 1;
};

// ─── Reset helper ───────────────────────────────────────────────────────────
const defaultFormState = () => ({
  severityLevelId: undefined as number | undefined,
  isVentilator: false,
  vsBp: '', vsPr: '', vsRr: '', vsTemp: '', vsO2: '',
  ioInFluid: '', ioInTube: '', ioInOral: '',
  ioOutUrine: '', ioOutFeces: '', ioOutDrain: '',
  painScore: 0,
  fallRisk: 'low',
  pressureSore: 'low',
  levelOfCare: 'self',
  safetyPrecautions: [] as string[],
  gcsEye: 4, gcsVerbal: 5, gcsMotor: 6,
  wounds: [] as WoundEntry[],
  isbarSituation: '', isbarBackground: '', isbarAssessment: '', isbarRecommendation: '',
  focusChartFocus: '', focusChartData: '', focusChartAction: '', focusChartResponse: '',
  medications: [] as MedEntry[],
  carePlans: [] as CarePlanEntry[],
});

// ═══════════════════════════════════════════════════════════════════════════
export default function ShiftPatientPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen]       = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [searchText, setSearchText]           = useState('');
  const [isSubmitting, setIsSubmitting]       = useState(false);

  const [wards, setWards]                     = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard]       = useState<string | undefined>();

  // Shift meta
  const [recordDate, setRecordDate]   = useState<dayjs.Dayjs>(dayjs());
  const [recordShift, setRecordShift] = useState<number>(1);

  // Form fields
  const [severityLevelId, setSeverityLevelId]   = useState<number | undefined>();
  const [isVentilator, setIsVentilator]         = useState(false);
  const [vsBp, setVsBp]     = useState('');
  const [vsPr, setVsPr]     = useState('');
  const [vsRr, setVsRr]     = useState('');
  const [vsTemp, setVsTemp] = useState('');
  const [vsO2, setVsO2]     = useState('');
  const [ioInFluid, setIoInFluid]   = useState('');
  const [ioInTube, setIoInTube]     = useState('');
  const [ioInOral, setIoInOral]     = useState('');
  const [ioOutUrine, setIoOutUrine] = useState('');
  const [ioOutFeces, setIoOutFeces] = useState('');
  const [ioOutDrain, setIoOutDrain] = useState('');
  const [painScore, setPainScore]         = useState(0);
  const [fallRisk, setFallRisk]           = useState('low');
  const [pressureSore, setPressureSore]   = useState('low');
  const [levelOfCare, setLevelOfCare]     = useState('self');
  const [safetyPrecautions, setSafetyPrecautions] = useState<string[]>([]);

  // GCS
  const [gcsEye, setGcsEye]       = useState(4);
  const [gcsVerbal, setGcsVerbal] = useState(5);
  const [gcsMotor, setGcsMotor]   = useState(6);

  // Wound / Drainage
  const [wounds, setWounds] = useState<WoundEntry[]>([]);

  // ISBAR
  const [isbarSituation, setIsbarSituation]         = useState('');
  const [isbarBackground, setIsbarBackground]       = useState('');
  const [isbarAssessment, setIsbarAssessment]       = useState('');
  const [isbarRecommendation, setIsbarRecommendation] = useState('');

  // Focus Charting
  const [focusChartFocus, setFocusChartFocus]       = useState('');
  const [focusChartData, setFocusChartData]         = useState('');
  const [focusChartAction, setFocusChartAction]     = useState('');
  const [focusChartResponse, setFocusChartResponse] = useState('');

  // Medication
  const [medications, setMedications] = useState<MedEntry[]>([]);

  // Care Plan
  const [carePlans, setCarePlans] = useState<CarePlanEntry[]>([]);

  // ── Fetch Wards ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;

        const response = await axios.get('/api/v1/wards', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data) {
          const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
          setWards(wardList);
          
          if (wardList.length > 0) {
             setSelectedWard(String(wardList[0].ward));
          }
        }
      } catch (error) {
        console.error("Error fetching wards:", error);
      }
    };
    fetchWards();
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────
  const gcsTotal = gcsEye + gcsVerbal + gcsMotor;
  const gcsLevel =
    gcsTotal >= 13 ? { label: 'Mild / ปกติ',       color: 'text-green-600  bg-green-50  border-green-200'  } :
    gcsTotal >=  9 ? { label: 'Moderate / ปานกลาง', color: 'text-orange-600 bg-orange-50 border-orange-200' } :
                     { label: 'Severe / รุนแรง',    color: 'text-red-600    bg-red-50    border-red-200'    };

  // ── Reset ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSeverityLevelId(undefined); setIsVentilator(false);
    setVsBp(''); setVsPr(''); setVsRr(''); setVsTemp(''); setVsO2('');
    setIoInFluid(''); setIoInTube(''); setIoInOral('');
    setIoOutUrine(''); setIoOutFeces(''); setIoOutDrain('');
    setPainScore(0); setFallRisk('low'); setPressureSore('low');
    setLevelOfCare('self'); setSafetyPrecautions([]);
    setGcsEye(4); setGcsVerbal(5); setGcsMotor(6); setWounds([]);
    setIsbarSituation(''); setIsbarBackground(''); setIsbarAssessment(''); setIsbarRecommendation('');
    setFocusChartFocus(''); setFocusChartData(''); setFocusChartAction(''); setFocusChartResponse('');
    setMedications([]); setCarePlans([]);
  };

  // ── Wound helpers ─────────────────────────────────────────────────────
  const addWound    = () => setWounds(p => [...p, { id: Date.now(), location: '', type: 'surgical', size: '', exudate: 'none', odor: 'none', note: '' }]);
  const removeWound = (id: number) => setWounds(p => p.filter(w => w.id !== id));
  const updateWound = (id: number, field: string, value: string) =>
    setWounds(p => p.map(w => w.id === id ? { ...w, [field]: value } : w));

  // ── Medication helpers ────────────────────────────────────────────────
  const addMed    = () => setMedications(p => [...p, { id: Date.now(), name: '', dose: '', route: 'oral', time: dayjs().format('HH:mm'), given: false, note: '' }]);
  const removeMed = (id: number) => setMedications(p => p.filter(m => m.id !== id));
  const updateMed = (id: number, field: string, value: any) =>
    setMedications(p => p.map(m => m.id === id ? { ...m, [field]: value } : m));

  // ── Care Plan helpers ─────────────────────────────────────────────────
  const addCarePlan    = () => setCarePlans(p => [...p, { id: Date.now(), diagnosis: '', goal: '', action: '', evaluation: '', status: 'active' }]);
  const removeCarePlan = (id: number) => setCarePlans(p => p.filter(c => c.id !== id));
  const updateCarePlan = (id: number, field: string, value: string) =>
    setCarePlans(p => p.map(c => c.id === id ? { ...c, [field]: value } : c));

  // ── Submit / Cancel ───────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!selectedPatient) { message.warning('กรุณาเลือกผู้ป่วย'); return; }
    if (!severityLevelId) { message.warning('กรุณาเลือกระดับความรุนแรง'); return; }
    setIsSubmitting(true);
    setTimeout(() => {
      message.success(`บันทึกข้อมูลวันที่ ${recordDate.format('DD/MM/YYYY')} สำเร็จ`);
      setIsSubmitting(false);
      setSelectedPatient(null);
      resetForm();
      setIsDrawerOpen(false);
    }, 1000);
  };

  const handleCancel = () => {
    setSelectedPatient(null);
    resetForm();
    setIsDrawerOpen(false);
  };

  // ── Table ─────────────────────────────────────────────────────────────
  const filteredPatients = mockPatients.filter(p => {
    const matchWard = selectedWard ? p.ward === selectedWard : true;
    const matchSearch = p.name.includes(searchText) || p.hn.includes(searchText) || p.an.includes(searchText);
    return matchWard && matchSearch;
  });

  const columns: ColumnsType<PatientInfo> = [
    { title: 'HN',  dataIndex: 'hn',  key: 'hn',  width: 100 },
    { title: 'AN',  dataIndex: 'an',  key: 'an',  width: 100 },
    { title: 'ชื่อ-สกุล', dataIndex: 'name', key: 'name',
      render: (text) => <span className="font-semibold text-[#006b5f]">{text}</span> },
    { title: 'อายุ',         dataIndex: 'age',       key: 'age',       width: 70,  align: 'center' },
    { title: 'หอผู้ป่วย',    dataIndex: 'wardName',  key: 'wardName',  width: 150 },
    { title: 'เตียง',        dataIndex: 'bed',       key: 'bed',       width: 80,  align: 'center' },
    { title: 'แผนกการรักษา', dataIndex: 'spcltyName',key: 'spcltyName',width: 120 },
    { title: 'วันที่ Admit',  dataIndex: 'admitDate', key: 'admitDate', width: 120 },
    { title: 'แพทย์เจ้าของไข้', dataIndex: 'doctorName', key: 'doctorName' },
    {
      title: 'วันนอน', key: 'los', width: 80, align: 'center',
      render: (_, record) => {
        const hours = dayjs().diff(dayjs(record.admitDateTimeIso), 'hour');
        return <span suppressHydrationWarning>{hours >= 0 ? `${Math.floor(hours / 24) + (hours % 24 >= 6 ? 1 : 0)} วัน` : '0 วัน'}</span>;
      }
    },
    {
      title: 'Ventilator', key: 'ventilator', width: 100, align: 'center',
      render: (_: any, record: PatientInfo) => {
        const shifts = ['ด','ช','บ'];
        const hnHash = record.hn.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
        const hoursSinceAdmit = dayjs().diff(dayjs(record.admitDateTimeIso), 'hour');
        const shiftsCount = Math.min(21, Math.max(0, Math.ceil(hoursSinceAdmit / 8)));
        const startIndex  = 21 - shiftsCount;
        const items: { date: string; shiftName: string; isRecorded: boolean; isUsed: boolean }[] = [];
        let ai = 0;
        for (let d = 6; d >= 0; d--) {
          for (let s = 0; s < 3; s++) {
            const isRecorded = ai >= startIndex;
            items.push({ date: dayjs().subtract(d,'day').format('DD/MM'), shiftName: shifts[s], isRecorded, isUsed: isRecorded ? ((hnHash + ai) % 5 === 0) : false });
            ai++;
          }
        }
        return (
          <div className="flex justify-center items-center h-full">
            <div className="grid grid-rows-3 grid-flow-col gap-0.75">
              {items.map((item, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-xs cursor-help transition-all ${!item.isRecorded ? 'bg-slate-100 border border-slate-200 opacity-50' : item.isUsed ? 'bg-orange-500 hover:bg-orange-600 shadow-sm' : 'bg-slate-300 hover:bg-slate-400'}`}
                  title={`วันที่ ${item.date} เวร${item.shiftName}: ${!item.isRecorded ? 'ยังไม่เข้ารับการรักษา' : item.isUsed ? 'ใส่' : 'ไม่ใส่'}เครื่องช่วยหายใจ`} suppressHydrationWarning />
              ))}
            </div>
          </div>
        );
      }
    },
    {
      title: 'ระดับความรุนแรง', key: 'trend_7_days', width: 150, align: 'center',
      render: (_: any, record: PatientInfo) => {
        const hnHash = record.hn.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
        const hoursSinceAdmit = dayjs().diff(dayjs(record.admitDateTimeIso), 'hour');
        const shiftsCount = Math.min(21, Math.max(0, Math.ceil(hoursSinceAdmit / 8)));
        const startIndex  = 21 - shiftsCount;
        const shifts = ['ด','ช','บ'];
        const levelColors: Record<number,string> = {
          1:'bg-green-500 hover:bg-green-600 shadow-sm', 2:'bg-yellow-500 hover:bg-yellow-600 shadow-sm',
          3:'bg-orange-500 hover:bg-orange-600 shadow-sm', 4:'bg-red-500 hover:bg-red-600 shadow-sm', 5:'bg-purple-500 hover:bg-purple-600 shadow-sm',
        };
        const items: { date: string; shiftName: string; isRecorded: boolean; val: number }[] = [];
        let ai = 0;
        for (let d = 6; d >= 0; d--) {
          for (let s = 0; s < 3; s++) {
            const isRecorded = ai >= startIndex;
            items.push({ date: dayjs().subtract(d,'day').format('DD/MM'), shiftName: shifts[s], isRecorded, val: isRecorded ? ((hnHash + ai) % 5) + 1 : 0 });
            ai++;
          }
        }
        return (
          <div className="flex justify-center items-center h-full">
            <div className="grid grid-rows-3 grid-flow-col gap-0.75">
              {items.map((item, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-xs cursor-help transition-all ${item.isRecorded ? levelColors[item.val] : 'bg-slate-100 border border-slate-200 opacity-50'}`}
                  title={`วันที่ ${item.date} เวร${item.shiftName}: ${item.isRecorded ? `ระดับ ${item.val}` : 'ยังไม่เข้ารับการรักษา'}`} suppressHydrationWarning />
              ))}
            </div>
          </div>
        );
      }
    },
    {
      title: 'ดำเนินการ', key: 'action', width: 130, align: 'center',
      render: (_, record) => (
        <div className="flex flex-col gap-2">
          <Button type="primary" size="small" className="bg-[#006b5f] flex items-center justify-center gap-1 mx-auto w-full"
            onClick={() => {
              setSelectedPatient(record);
              setIsDrawerOpen(true);
              const n = dayjs();
              setRecordDate(n);
              setRecordShift(getShiftIdFromTime(n));
              resetForm();
            }}>
            บันทึกเวร
          </Button>
          <Button size="small" className="text-[#006b5f] border-[#006b5f] flex items-center justify-center gap-1 mx-auto w-full hover:bg-teal-50"
            onClick={() => {
              setSelectedPatient(record);
              setIsHistoryDrawerOpen(true);
            }}>
            <PiClockBold /> ประวัติ
          </Button>
        </div>
      ),
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-[#006b5f] p-2 rounded-xl">
                <MdOutlineSummarize className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#006b5f] m-0">สรุปยอดผู้ป่วยรายเวร</h2>
                <p className="text-sm text-gray-500 m-0">Summary Patient by Shift</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-1 md:flex-none">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 whitespace-nowrap">เลือกหอผู้ป่วย:</span>
                <Select 
                  size="middle"
                  value={selectedWard}
                  className="w-35 md:w-50"
                  onChange={(value) => setSelectedWard(value)}
                  placeholder="กำลังโหลดข้อมูล..."
                  options={wards.map(w => ({ label: w.name, value: w.ward }))}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
              <Input size="middle" prefix={PREFIX_SEARCH} placeholder="ค้นหา HN, AN หรือชื่อ-สกุล"
                className="flex-1 md:flex-none md:w-70" onChange={e => setSearchText(e.target.value)} value={searchText} />
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={filteredPatients}
            rowKey="hn"
            size="small"
            pagination={{ pageSize: 10 }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>

        {/* ─── DRAWER ──────────────────────────────────────────────────────── */}
        <Drawer
          title={<span className="text-white font-bold text-lg">บันทึกข้อมูลอาการผู้ป่วยรายเวร</span>}
          placement="right"
          styles={{ wrapper: { width: 620 } }}
          onClose={handleCancel}
          open={isDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white font-sans"
        >
          {selectedPatient && (
            <div className="space-y-6">
              {/* ── Patient Card ─────────────────────────────────────────── */}
              <div className="bg-linear-to-r from-teal-50 to-white p-4 rounded-xl border border-teal-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#006b5f] flex items-center justify-center shrink-0">
                    <PiUserBold className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 m-0">{selectedPatient.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color="blue"   className="m-0">HN: {selectedPatient.hn}</Tag>
                      <Tag color="orange" className="m-0">AN: {selectedPatient.an}</Tag>
                      <span className="text-sm text-gray-500 whitespace-nowrap">อายุ {selectedPatient.age} ปี</span>
                    </div>
                  </div>
                </div>
                <Divider className="my-3" />
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">หอผู้ป่วยปัจจุบัน</span>
                    <span className="font-semibold text-gray-800">{selectedPatient.wardName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">เตียง</span>
                    <span className="font-semibold text-gray-800">เตียง {selectedPatient.bed}</span>
                  </div>
                </div>
              </div>

              {/* ── Tabs ─────────────────────────────────────────────────── */}
              <Tabs
                defaultActiveKey="1"
                className="[&_.ant-tabs-nav]:mb-4"
                items={[
                  // ════════════════════════════════════════════════════════
                  // TAB 1 : การประเมิน
                  // ════════════════════════════════════════════════════════
                  {
                    key: '1',
                    label: <span className="font-semibold px-1">การประเมิน</span>,
                    children: (
                      <div className="space-y-5">
                        {/* Shift selector */}
                        <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <PiCalendarCheckBold className="w-5 h-5 text-[#006b5f]" />
                            เลือกระบุเวรที่ต้องการบันทึก
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">วันที่</label>
                              <DatePicker value={recordDate} onChange={d => setRecordDate(d || dayjs())} className="w-full"
                                format="DD/MM/YYYY" allowClear={false}
                                disabledDate={cur => cur && (cur > dayjs().endOf('day') || cur < dayjs(selectedPatient.admitDateTimeIso).startOf('day'))} />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">เวร</label>
                              <Radio.Group value={recordShift} onChange={e => setRecordShift(e.target.value)}
                                className="w-full flex" optionType="button" buttonStyle="solid">
                                <Radio.Button value={1} className="flex-1 text-center">ดึก</Radio.Button>
                                <Radio.Button value={2} className="flex-1 text-center">เช้า</Radio.Button>
                                <Radio.Button value={3} className="flex-1 text-center">บ่าย</Radio.Button>
                              </Radio.Group>
                            </div>
                          </div>
                        </div>

                        {/* Severity */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <span className="text-red-500 mr-1">*</span>ระดับความรุนแรง
                          </label>
                          <Radio.Group className="w-full" value={severityLevelId} onChange={e => setSeverityLevelId(e.target.value)} size="small">
                            <div className="grid grid-cols-2 gap-2">
                              {severityLevels.map(level => {
                                const colors: Record<number,{bg:string;border:string;text:string;selectedBg:string}> = {
                                  1:{bg:'#f6ffed',border:'#b7eb8f',text:'#389e0d',selectedBg:'#52c41a'},
                                  2:{bg:'#fffbe6',border:'#ffe58f',text:'#d48806',selectedBg:'#faad14'},
                                  3:{bg:'#fff7e6',border:'#ffd591',text:'#d46b08',selectedBg:'#fa8c16'},
                                  4:{bg:'#fff1f0',border:'#ffccc7',text:'#cf1322',selectedBg:'#f5222d'},
                                  5:{bg:'#f9f0ff',border:'#d3adf7',text:'#531dab',selectedBg:'#722ed1'},
                                };
                                const isSelected = severityLevelId === level.severity_level_id;
                                const theme = colors[level.severity_level_id];
                                return (
                                  <Radio.Button key={level.severity_level_id} value={level.severity_level_id}
                                    style={{ backgroundColor: isSelected ? theme.selectedBg : theme.bg, borderColor: isSelected ? theme.selectedBg : theme.border,
                                      color: isSelected ? '#fff' : theme.text, height: 'auto', textAlign: 'center', padding: '8px 4px', lineHeight: '1.2', borderWidth: '1px', borderStyle: 'solid' }}
                                    className="transition-all">
                                    <span className="text-xs whitespace-normal">{level.severity_level_name.split(' / ')[0]}</span>
                                  </Radio.Button>
                                );
                              })}
                            </div>
                          </Radio.Group>
                        </div>

                        {/* Ventilator */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <span className="text-red-500 mr-1">*</span>การใช้เครื่องช่วยหายใจ (Ventilator)
                          </label>
                          <Radio.Group value={isVentilator} onChange={e => setIsVentilator(e.target.value)}
                            className="w-full flex" optionType="button" buttonStyle="solid">
                            <Radio.Button value={true}  className="flex-1 text-center font-semibold [&.ant-radio-button-wrapper-checked]:bg-orange-500 [&.ant-radio-button-wrapper-checked]:border-orange-500">ใส่เครื่องช่วยหายใจ</Radio.Button>
                            <Radio.Button value={false} className="flex-1 text-center font-semibold text-slate-500">ไม่ใส่เครื่องช่วยหายใจ</Radio.Button>
                          </Radio.Group>
                        </div>

                        <Divider className="my-4 border-gray-200" />

                        {/* Routine Check-list */}
                        <h4 className="text-[15px] font-bold text-gray-800 flex items-center gap-2 mb-1">
                          Routine Check-list
                        </h4>

                        {/* Level of Care */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Level of Care</label>
                          <Radio.Group value={levelOfCare} onChange={e => setLevelOfCare(e.target.value)}
                            className="w-full flex" optionType="button" buttonStyle="solid" size="middle">
                            <Radio.Button value="self"    className="flex-1 text-center">Self-care</Radio.Button>
                            <Radio.Button value="partial" className="flex-1 text-center">Partial-care</Radio.Button>
                            <Radio.Button value="total"   className="flex-1 text-center">Total-care</Radio.Button>
                          </Radio.Group>
                        </div>

                        {/* Vital Signs */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Vital Signs</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input prefix={PREFIX_BP}   placeholder="120/80" value={vsBp}   onChange={e => setVsBp(e.target.value)}   size="middle" />
                            <Input prefix={PREFIX_PR}   placeholder="80"     suffix={SUFFIX_BPM} value={vsPr} onChange={e => setVsPr(e.target.value)} size="middle" />
                            <Input prefix={PREFIX_RR}   placeholder="20"     suffix={SUFFIX_MIN} value={vsRr} onChange={e => setVsRr(e.target.value)} size="middle" />
                            <Input prefix={PREFIX_TEMP} placeholder="36.5"   suffix={SUFFIX_C}   value={vsTemp} onChange={e => setVsTemp(e.target.value)} size="middle" />
                            <Input prefix={PREFIX_SPO2} placeholder="98"     suffix={SUFFIX_PERCENT} value={vsO2} onChange={e => setVsO2(e.target.value)} size="middle" className="col-span-2" />
                          </div>
                        </div>

                        {/* Pain Score */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">
                            Pain Score: <span className="font-bold text-[14px] ml-1" style={{ color: `hsl(${((10-painScore)/10)*120},100%,45%)` }}>{painScore}</span>
                          </label>
                          <div className="px-2">
                            <Slider min={0} max={10}
                              marks={{0:<span style={{color:'hsl(120,100%,45%)',fontWeight:'bold'}}>0</span>,2:'2',4:'4',6:'6',8:'8',10:<span style={{color:'hsl(0,100%,45%)',fontWeight:'bold'}}>10</span>}}
                              value={painScore} onChange={val => setPainScore(val)}
                              trackStyle={{ backgroundColor: `hsl(${((10-painScore)/10)*120},100%,45%)` }}
                              handleStyle={{ borderColor: `hsl(${((10-painScore)/10)*120},100%,45%)` }} />
                          </div>
                        </div>

                        {/* I/O */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Intake / Output (I/O)</label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                              <span className="block text-[11px] font-bold text-blue-700 mb-2">In (รับเข้า)</span>
                              <div className="space-y-2">
                                <Input prefix={PREFIX_IV}   suffix={SUFFIX_ML} value={ioInFluid} onChange={e => setIoInFluid(e.target.value)} size="middle" />
                                <Input prefix={PREFIX_TUBE} suffix={SUFFIX_ML} value={ioInTube}  onChange={e => setIoInTube(e.target.value)}  size="middle" />
                                <Input prefix={PREFIX_ORAL} suffix={SUFFIX_ML} value={ioInOral}  onChange={e => setIoInOral(e.target.value)}  size="middle" />
                              </div>
                            </div>
                            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                              <span className="block text-[11px] font-bold text-amber-700 mb-2">Out (ขับออก)</span>
                              <div className="space-y-2">
                                <Input prefix={PREFIX_URINE} suffix={SUFFIX_ML}       value={ioOutUrine} onChange={e => setIoOutUrine(e.target.value)} size="middle" />
                                <Input prefix={PREFIX_FECES} placeholder="ครั้ง/กรัม" value={ioOutFeces} onChange={e => setIoOutFeces(e.target.value)} size="middle" />
                                <Input prefix={PREFIX_DRAIN} suffix={SUFFIX_ML}       value={ioOutDrain} onChange={e => setIoOutDrain(e.target.value)} size="middle" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Fall / Pressure */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Fall Risk Assessment</label>
                            <Select className="w-full" size="middle" value={fallRisk} onChange={setFallRisk}
                              options={[{label:'Low Risk',value:'low'},{label:'Medium Risk',value:'medium'},{label:'High Risk',value:'high'}]} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Pressure Sore Risk</label>
                            <Select className="w-full" size="middle" value={pressureSore} onChange={setPressureSore}
                              options={[{label:'Low Risk',value:'low'},{label:'Medium Risk',value:'medium'},{label:'High Risk',value:'high'}]} />
                          </div>
                        </div>

                        {/* Safety Precautions */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Safety Precautions</label>
                          <Select mode="multiple" allowClear size="small" className="w-full"
                            placeholder="เลือกการเฝ้าระวังพิเศษ" value={safetyPrecautions} onChange={setSafetyPrecautions}
                            options={[
                              {label:'ระวังพลัดตกหกล้ม (Fall Precaution)',     value:'fall'},
                              {label:'ระวังชัก (Seizure Precaution)',           value:'seizure'},
                              {label:'ระวังแผลกดทับ (Pressure Sore Precaution)',value:'bedsore'},
                              {label:'ระวังการดึงรั้งสาย (Tube Dislodgement)', value:'tube'},
                              {label:'เฝ้าระวังการติดเชื้อ (Infection Control)',value:'infection'},
                              {label:'ระวังการสำลัก (Aspiration Precaution)',   value:'aspiration'},
                            ]} />
                        </div>

                        <Divider className="my-4 border-gray-200" />

                        {/* ── GCS ──────────────────────────────────────── */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2">
                            Glasgow Coma Scale (GCS) — รวม:
                            <span className={`ml-2 px-2 py-0.5 rounded border text-xs font-bold ${gcsLevel.color}`}>
                              {gcsTotal} — {gcsLevel.label}
                            </span>
                          </label>
                          <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {[
                              { label: 'Eye Opening (E)',    value: gcsEye,    setter: setGcsEye,
                                options: [{v:4,l:'4 — Spontaneous'},{v:3,l:'3 — To voice'},{v:2,l:'2 — To pain'},{v:1,l:'1 — None'}] },
                              { label: 'Verbal Response (V)',value: gcsVerbal, setter: setGcsVerbal,
                                options: [{v:5,l:'5 — Oriented'},{v:4,l:'4 — Confused'},{v:3,l:'3 — Words'},{v:2,l:'2 — Sounds'},{v:1,l:'1 — None'}] },
                              { label: 'Motor Response (M)', value: gcsMotor,  setter: setGcsMotor,
                                options: [{v:6,l:'6 — Obeys'},{v:5,l:'5 — Localizes'},{v:4,l:'4 — Withdraws'},{v:3,l:'3 — Flexion'},{v:2,l:'2 — Extension'},{v:1,l:'1 — None'}] },
                            ].map(({ label, value, setter, options }) => (
                              <div key={label} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
                                <Select className="flex-1" size="small" value={value} onChange={setter}
                                  options={options.map(o => ({ value: o.v, label: o.l }))} />
                                <span className="text-sm font-bold text-[#006b5f] w-4 text-center">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ── Wound / Drainage ─────────────────────────── */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold text-gray-500">Wound / Drainage Assessment</label>
                            <Button size="small" type="dashed" onClick={addWound} className="text-xs">+ เพิ่มแผล/สาย</Button>
                          </div>
                          {wounds.length === 0 && (
                            <div className="text-center py-4 text-gray-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-300">
                              ไม่มีแผลหรือสายระบาย — กดปุ่ม "+ เพิ่มแผล/สาย" เพื่อบันทึก
                            </div>
                          )}
                          <div className="space-y-3">
                            {wounds.map((w, idx) => (
                              <div key={w.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-gray-600">แผล/สายที่ {idx + 1}</span>
                                  <Button size="small" type="text" danger onClick={() => removeWound(w.id)} icon={<PiXBold className="w-3 h-3" />} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <Input size="small" placeholder="ตำแหน่ง (เช่น แผลหน้าท้อง)" value={w.location} onChange={e => updateWound(w.id,'location',e.target.value)} />
                                  <Select size="small" className="w-full" value={w.type} onChange={v => updateWound(w.id,'type',v)}
                                    options={[{value:'surgical',label:'แผลผ่าตัด'},{value:'pressure',label:'แผลกดทับ'},{value:'drain',label:'สายระบาย (Drain)'},{value:'wound',label:'บาดแผลทั่วไป'},{value:'stoma',label:'Stoma'}]} />
                                  <Input size="small" placeholder="ขนาด/ปริมาณ (เช่น 5x3 cm / 50 ml)" value={w.size} onChange={e => updateWound(w.id,'size',e.target.value)} />
                                  <Select size="small" className="w-full" value={w.exudate} onChange={v => updateWound(w.id,'exudate',v)}
                                    options={[{value:'none',label:'ไม่มี Exudate'},{value:'serous',label:'Serous (ใส)'},{value:'bloody',label:'Bloody (เลือด)'},{value:'purulent',label:'Purulent (หนอง)'},{value:'serosanguinous',label:'Serosanguinous'}]} />
                                </div>
                                <TextArea size="small" rows={1} placeholder="หมายเหตุ / อาการแผล..." value={w.note} onChange={e => updateWound(w.id,'note',e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ),
                  },

                  // ════════════════════════════════════════════════════════
                  // TAB 2 : ส่งเวร (ISBAR)
                  // ════════════════════════════════════════════════════════
                  {
                    key: '2',
                    label: <span className="font-semibold px-1">ส่งเวร (ISBAR)</span>,
                    children: (
                      <div className="space-y-4">
                        {[
                          { key:'S', label:'Situation (สถานการณ์)',  color:'bg-blue-100 text-blue-600',    value:isbarSituation,     setter:setIsbarSituation,     placeholder:'อาการเปลี่ยนแปลงที่สำคัญ ปัญหาหลักที่เกิดขึ้น...' },
                          { key:'B', label:'Background (ภูมิหลัง)', color:'bg-green-100 text-green-600',  value:isbarBackground,    setter:setIsbarBackground,    placeholder:'ข้อมูลการรักษาที่สำคัญ ผล Lab/X-ray ที่ผิดปกติ...' },
                          { key:'A', label:'Assessment (การประเมิน)',color:'bg-orange-100 text-orange-600',value:isbarAssessment,    setter:setIsbarAssessment,    placeholder:'สัญญาณชีพ (V/S) ล่าสุด, Pain Score, GCS, I/O...' },
                          { key:'R', label:'Recommendation (ข้อเสนอแนะ)',color:'bg-purple-100 text-purple-600',value:isbarRecommendation,setter:setIsbarRecommendation,placeholder:'แผนการดูแล (Plan of care), สิ่งที่ต้องเฝ้าระวัง, ยาที่ต้องให้ต่อ...' },
                        ].map(item => (
                          <div key={item.key} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                              <span className={`w-5 h-5 rounded flex items-center justify-center ${item.color}`}>{item.key}</span>
                              {item.label}
                            </label>
                            <TextArea rows={2} placeholder={item.placeholder} value={item.value} onChange={e => item.setter(e.target.value)} className="mt-1" />
                          </div>
                        ))}
                      </div>
                    ),
                  },

                  // ════════════════════════════════════════════════════════
                  // TAB 3 : Focus Charting (F-DAR)
                  // ════════════════════════════════════════════════════════
                  {
                    key: '3',
                    label: <span className="font-semibold px-1">Focus Charting</span>,
                    children: (
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                            <span className="w-5 h-5 rounded flex items-center justify-center bg-indigo-100 text-indigo-600">F</span>
                            Focus (ปัญหา/อาการสำคัญ)
                          </label>
                          <AutoComplete options={focusHistoryOptions} style={{ width: '100%' }}
                            placeholder="เช่น มีไข้สูง, ปวดแผลผ่าตัด, เสี่ยงต่อการพลัดตกหกล้ม..."
                            value={focusChartFocus} onChange={value => setFocusChartFocus(value)}
                            filterOption={(input, option) => option!.value.toUpperCase().includes(input.toUpperCase())}
                            className="mt-1" />
                        </div>
                        {[
                          { key:'D', label:'Data (ข้อมูลสนับสนุน)',  color:'bg-sky-100 text-sky-600',      value:focusChartData,     setter:setFocusChartData,     placeholder:'ข้อมูลอัตวิสัย (Subjective) และปรนัย (Objective)...' },
                          { key:'A', label:'Action (การพยาบาล)',     color:'bg-teal-100 text-teal-600',    value:focusChartAction,   setter:setFocusChartAction,   placeholder:'กิจกรรมทางการพยาบาลที่ให้การดูแล...' },
                          { key:'R', label:'Response (การประเมินผล)',color:'bg-emerald-100 text-emerald-600',value:focusChartResponse,setter:setFocusChartResponse, placeholder:'ผลลัพธ์หลังให้การพยาบาล อาการทุเลาลง หรือต้องติดตามต่อ...' },
                        ].map(item => (
                          <div key={item.key} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                              <span className={`w-5 h-5 rounded flex items-center justify-center ${item.color}`}>{item.key}</span>
                              {item.label}
                            </label>
                            <TextArea rows={2} placeholder={item.placeholder} value={item.value} onChange={e => item.setter(e.target.value)} className="mt-1" />
                          </div>
                        ))}
                      </div>
                    ),
                  },

                  // ════════════════════════════════════════════════════════
                  // TAB 4 : ยา (Medication)
                  // ════════════════════════════════════════════════════════
                  {
                    key: '4',
                    label: <span className="font-semibold px-1">ยา</span>,
                    children: (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">รายการยาในเวรนี้</span>
                          <Button size="small" type="dashed" onClick={addMed}>+ เพิ่มยา</Button>
                        </div>

                        {medications.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            ยังไม่มีรายการยา — กดปุ่ม "+ เพิ่มยา" เพื่อบันทึก
                          </div>
                        )}

                        {medications.map((med, idx) => (
                          <div key={med.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-600">ยาที่ {idx + 1}</span>
                              <div className="flex items-center gap-2">
                                <Radio.Group size="small" value={med.given} onChange={e => updateMed(med.id,'given',e.target.value)}
                                  optionType="button" buttonStyle="solid">
                                  <Radio.Button value={true}  className="text-xs [&.ant-radio-button-wrapper-checked]:bg-green-500 [&.ant-radio-button-wrapper-checked]:border-green-500">ให้แล้ว ✓</Radio.Button>
                                  <Radio.Button value={false} className="text-xs">ยังไม่ให้</Radio.Button>
                                </Radio.Group>
                                <Button size="small" type="text" danger onClick={() => removeMed(med.id)} icon={<PiXBold className="w-3 h-3" />} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input size="small" placeholder="ชื่อยา" value={med.name} onChange={e => updateMed(med.id,'name',e.target.value)} className="col-span-2" />
                              <Input size="small" placeholder="ขนาด (เช่น 500 mg)" value={med.dose} onChange={e => updateMed(med.id,'dose',e.target.value)} />
                              <Select size="small" className="w-full" value={med.route} onChange={v => updateMed(med.id,'route',v)}
                                options={[
                                  {value:'oral',    label:'Oral (รับประทาน)'},
                                  {value:'iv',      label:'IV (ทางหลอดเลือด)'},
                                  {value:'im',      label:'IM (เข้ากล้าม)'},
                                  {value:'sc',      label:'SC (ใต้ผิวหนัง)'},
                                  {value:'topical', label:'Topical (ทาภายนอก)'},
                                  {value:'inhale',  label:'Inhale (สูดพ่น)'},
                                ]} />
                            </div>
                            <Input size="small" placeholder="หมายเหตุ (เช่น ให้หลังอาหาร, ผู้ป่วยปฏิเสธ)" value={med.note} onChange={e => updateMed(med.id,'note',e.target.value)} />
                          </div>
                        ))}

                        {/* Summary badge */}
                        {medications.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            <Tag color="green">ให้แล้ว {medications.filter(m => m.given).length} รายการ</Tag>
                            <Tag color="orange">รอให้ {medications.filter(m => !m.given).length} รายการ</Tag>
                          </div>
                        )}
                      </div>
                    ),
                  },

                  // ════════════════════════════════════════════════════════
                  // TAB 5 : แผนการพยาบาล (Care Plan)
                  // ════════════════════════════════════════════════════════
                  {
                    key: '5',
                    label: <span className="font-semibold px-1">แผนการพยาบาล</span>,
                    children: (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">การวินิจฉัยทางการพยาบาล</span>
                          <Button size="small" type="dashed" onClick={addCarePlan}>+ เพิ่มข้อวินิจฉัย</Button>
                        </div>

                        {carePlans.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            ยังไม่มีแผนการพยาบาล — กดปุ่ม "+ เพิ่มข้อวินิจฉัย" เพื่อบันทึก
                          </div>
                        )}

                        {carePlans.map((plan, idx) => (
                          <div key={plan.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-600">ข้อวินิจฉัยที่ {idx + 1}</span>
                              <div className="flex items-center gap-2">
                                <Select size="small" value={plan.status} onChange={v => updateCarePlan(plan.id,'status',v)}
                                  options={[
                                    {value:'active',    label:'🔴 Active'},
                                    {value:'improving', label:'🟡 Improving'},
                                    {value:'resolved',  label:'🟢 Resolved'},
                                  ]} />
                                <Button size="small" type="text" danger onClick={() => removeCarePlan(plan.id)} icon={<PiXBold className="w-3 h-3" />} />
                              </div>
                            </div>
                            {[
                              { field:'diagnosis',  label:'การวินิจฉัย (Nursing Diagnosis)', placeholder:'เช่น เสี่ยงต่อการติดเชื้อเนื่องจากมีแผลผ่าตัด' },
                              { field:'goal',       label:'เป้าหมาย (Goal)',                  placeholder:'เช่น แผลสะอาด ไม่มีสัญญาณการติดเชื้อ' },
                              { field:'action',     label:'กิจกรรมพยาบาล (Nursing Action)',   placeholder:'เช่น ทำแผลวันละ 1 ครั้ง, observe V/S ทุก 4 ชม.' },
                              { field:'evaluation', label:'การประเมินผล (Evaluation)',        placeholder:'เช่น แผลสะอาด ไม่บวมแดง ผู้ป่วยไม่มีไข้' },
                            ].map(({ field, label, placeholder }) => (
                              <div key={field}>
                                <label className="block text-[11px] text-gray-500 mb-0.5">{label}</label>
                                <TextArea size="small" rows={1} placeholder={placeholder}
                                  value={(plan as any)[field]}
                                  onChange={e => updateCarePlan(plan.id, field, e.target.value)} />
                              </div>
                            ))}
                          </div>
                        ))}

                        {/* Summary badges */}
                        {carePlans.length > 0 && (
                          <div className="flex gap-2 pt-1 flex-wrap">
                            <Tag color="red">   Active    {carePlans.filter(c => c.status === 'active').length}    ข้อ</Tag>
                            <Tag color="orange">Improving {carePlans.filter(c => c.status === 'improving').length} ข้อ</Tag>
                            <Tag color="green"> Resolved  {carePlans.filter(c => c.status === 'resolved').length}  ข้อ</Tag>
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />

              {/* ── Action buttons ──────────────────────────────────────── */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button size="middle" onClick={handleCancel}>ยกเลิก</Button>
                <Button type="primary" size="middle" icon={<PiArrowRightBold className="w-4 h-4" />}
                  onClick={handleConfirm} loading={isSubmitting}
                  className="bg-[#006b5f] hover:bg-[#00554c] border-[#006b5f] shadow-lg shadow-teal-900/20">
                  บันทึกข้อมูล
                </Button>
              </div>
            </div>
          )}
        </Drawer>

        {/* ─── HISTORY DRAWER ──────────────────────────────────────────────────────── */}
        <Drawer
          title={<span className="text-white font-bold text-lg">ประวัติการบันทึกอาการ</span>}
          placement="right"
          styles={{ wrapper: { width: 620 } }}
          onClose={() => {
            setIsHistoryDrawerOpen(false);
            if (!isDrawerOpen) setSelectedPatient(null);
          }}
          open={isHistoryDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white font-sans"
        >
          {selectedPatient && (
            <div className="space-y-6">
              {/* ── Patient Card ─────────────────────────────────────────── */}
              <div className="bg-linear-to-r from-teal-50 to-white p-4 rounded-xl border border-teal-100 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#006b5f] flex items-center justify-center shrink-0">
                    <PiUserBold className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 m-0">{selectedPatient.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color="blue"   className="m-0">HN: {selectedPatient.hn}</Tag>
                      <Tag color="orange" className="m-0">AN: {selectedPatient.an}</Tag>
                      <span className="text-sm text-gray-500 whitespace-nowrap">อายุ {selectedPatient.age} ปี</span>
                    </div>
                  </div>
                </div>
              </div>

              <Timeline
                items={mockHistoryRecords.map((record) => ({
                  color: '#006b5f',
                  content: (
                    <Card size="small" className="shadow-sm border-slate-200 mb-4" title={
                      <div className="flex justify-between items-center text-[#006b5f]">
                        <span className="font-bold flex items-center gap-1"><PiClockBold /> วันที่ {record.date} (เวร{record.shiftName})</span>
                        <span className="text-xs text-gray-500 font-normal">โดย {record.recorder}</span>
                      </div>
                    }>
                      <Collapse size="small" ghost items={[
                        {
                          key: '1',
                          label: <span className="font-semibold text-gray-700">ผลการประเมิน (Assessment)</span>,
                          children: (
                            <div className="space-y-2 text-sm bg-white border border-slate-100 p-3 rounded-lg">
                              <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-gray-500">ระดับความรุนแรง:</span> ระดับ {record.severityLevel}</div>
                                <div><span className="text-gray-500">เครื่องช่วยหายใจ:</span> {record.isVentilator ? 'ใส่' : 'ไม่ใส่'}</div>
                              </div>
                              <Divider className="my-2 border-slate-100" />
                              <div>
                                <span className="text-gray-500 font-semibold">V/S:</span> BP {record.vitals.bp}, PR {record.vitals.pr}, RR {record.vitals.rr}, T {record.vitals.temp}, SpO2 {record.vitals.o2}%
                              </div>
                              <div>
                                <span className="text-gray-500 font-semibold">GCS:</span> E{record.gcs.e} V{record.gcs.v} M{record.gcs.m} (รวม {record.gcs.total})
                              </div>
                            </div>
                          )
                        },
                        {
                          key: '2',
                          label: <span className="font-semibold text-gray-700">ส่งเวร (ISBAR)</span>,
                          children: (
                            <div className="space-y-2 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div><strong className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded mr-1">S</strong> {record.isbar.s}</div>
                              <div><strong className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded mr-1">B</strong> {record.isbar.b}</div>
                              <div><strong className="text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded mr-1">A</strong> {record.isbar.a}</div>
                              <div><strong className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mr-1">R</strong> {record.isbar.r}</div>
                            </div>
                          )
                        },
                        {
                          key: '3',
                          label: <span className="font-semibold text-gray-700">Focus Charting</span>,
                          children: (
                            <div className="space-y-2 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div><strong className="text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded mr-1">F</strong> {record.focus.f}</div>
                              <div><strong className="text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded mr-1">D</strong> {record.focus.d}</div>
                              <div><strong className="text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded mr-1">A</strong> {record.focus.a}</div>
                              <div><strong className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded mr-1">R</strong> {record.focus.r}</div>
                            </div>
                          )
                        }
                      ]} />
                    </Card>
                  )
                }))}
              />
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}