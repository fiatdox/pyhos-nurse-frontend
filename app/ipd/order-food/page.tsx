'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Table,
  Select,
  DatePicker,
  Radio,
  Button,
  Tag,
  Divider,
  Drawer,
  Timeline,
  Modal,
  Input,
  Spin,
  Tooltip,
} from 'antd';
import Swal from 'sweetalert2';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { MdOutlineFastfood } from 'react-icons/md';
import { PiFloppyDiskBold, PiCopyBold, PiUserBold, PiClockBold, PiNotePencilBold, PiPrinterBold, PiTrashBold, PiLockSimpleBold } from 'react-icons/pi';

dayjs.locale('th');

const { Option } = Select;

// --- Interfaces ---
interface PatientFood {
  key: string; // ใช้เป็น RowKey สำหรับ Checkbox
  hn: string;
  an: string;
  name: string;
  bed: string;
  wardName: string;
  admissionListId: string;
  foodType: string | null;
  foodItemId?: number; // รหัสเมนูอาหาร
  foodOrderDate?: string; // วันที่สั่งอาหาร (YYYY-MM-DD)
  foodMealTime?: string; // มื้อที่สั่งอาหาร (breakfast/lunch/dinner)
  lastMeal: string | null;
  lastMealAddon?: string | null;
  // รหัสรายการของแต่ละมื้อ ใช้สั่งยกเลิก null = ยังไม่ได้สั่งมื้อนั้น
  breakfastOrderId?: number | null;
  lunchOrderId?: number | null;
  dinnerOrderId?: number | null;
  // งานโภชนาการรับรายการไปแล้วหรือยัง ถ้ารับแล้วหอผู้ป่วยยกเลิกเองไม่ได้
  breakfastReceived?: boolean;
  lunchReceived?: boolean;
  dinnerReceived?: boolean;
  recieverName?: string | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfastAddon?: string | null; // addon ที่บันทึกไว้ของแต่ละมื้อในวันที่เลือก
  lunchAddon?: string | null;
  dinnerAddon?: string | null;
  addonText?: string; // เพิ่มฟิลด์สำหรับเก็บข้อความ Addon
}

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}

interface NutritionMenu {
  food_item_id: number;
  food_name: string;
  food_type_id: number | null;
}

interface FoodOrderAddon {
  food_order_id: number;
  an: string;
  addon: string;
  bedno: string;
  patient_name: string;
  meal_name: string;
  food_name: string;
}

interface FoodOrderHistory {
  foodOrderId: number;
  orderDate: string;   // YYYY-MM-DD
  meal: number;        // 1 = เช้า, 2 = กลางวัน, 3 = เย็น
  mealName: string | null;
  foodName: string | null;
  addon: string | null;
  ward: string;
  cancelledAt: string | null;    // 'YYYY-MM-DD HH:mm' ถ้ารายการนี้ถูกยกเลิก
  cancelledBy: string | null;
  cancelReason: string | null;
}

// ป้ายมื้ออาหารและสีประจำมื้อ — ยึดตาม meal id ไม่ใช้ meal.name จากฐานข้อมูลซึ่งสะกด "เข้า"
const MEAL_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'มื้อเช้า', color: 'blue' },
  2: { label: 'มื้อกลางวัน', color: 'orange' },
  3: { label: 'มื้อเย็น', color: 'purple' },
};

const HISTORY_DAYS = 7;

/*
  มื้อที่ใช้เป็น "ต้นทาง" ได้ ชื่อคีย์ตรงกับฟิลด์ใน PatientFood จึงหยิบค่าด้วยคีย์ตรงๆ ได้
  lastMeal ใช้เฉพาะปุ่มสั่งตามมื้อล่าสุดของรายที่ติ๊กเลือกไว้
*/
type MealSource = 'breakfast' | 'lunch' | 'dinner' | 'lastMeal';

const SOURCE_LABEL: Record<MealSource, string> = {
  breakfast: 'มื้อเช้า',
  lunch: 'มื้อกลางวัน',
  dinner: 'มื้อเย็น',
  lastMeal: 'มื้อล่าสุด',
};

type MealKey = Exclude<MealSource, 'lastMeal'>;

/*
  มื้อก่อนหน้า 1 มื้อของแต่ละมื้อ — มื้อเช้าต้องข้ามไปเอาของเย็นเมื่อวาน
  ตารางในหน้านี้แสดงเฉพาะวันที่เลือก กรณี prevDay จึงต้องยิงขอข้อมูลอีกวันเพิ่ม
*/
const PREV_MEAL: Record<MealKey, { source: MealKey; prevDay: boolean }> = {
  breakfast: { source: 'dinner', prevDay: true },
  lunch: { source: 'breakfast', prevDay: false },
  dinner: { source: 'lunch', prevDay: false },
};

const MEAL_NUMBER: Record<MealKey, number> = { breakfast: 1, lunch: 2, dinner: 3 };

// ฟิลด์ addon ที่คู่กับคอลัมน์ต้นทางแต่ละอัน
const SOURCE_ADDON_FIELD: Record<MealSource, keyof PatientFood> = {
  breakfast: 'breakfastAddon',
  lunch: 'lunchAddon',
  dinner: 'dinnerAddon',
  lastMeal: 'lastMealAddon',
};

// แถวที่จะสั่ง — เก็บ foodItemId ไว้ตั้งแต่ตอนสร้าง เพื่อให้ modal บอกได้ก่อนกดยืนยัน
// ว่ารายไหนเทียบเมนูในระบบไม่เจอ (foodItemId = 0) แล้วจะถูกข้าม
interface CopyRow {
  patient: PatientFood;
  menuName: string;
  addon: string | null;
  foodItemId: number;
}

/*
  ช่องรายมื้อ: ชื่อเมนูย่อ พร้อม addon ที่บันทึกไว้ของมื้อนั้น (ถ้ามี)
  ปุ่มถังขยะอยู่ในช่องเลย เพราะแถวหนึ่งมีสามมื้อ ถ้าแยกไปเป็นคอลัมน์เดียว
  จะบอกไม่ได้ว่ากำลังจะลบมื้อไหน
*/
const renderMealCell = (
  menu: string | null,
  addon: string | null | undefined,
  color: string,
  onDelete?: () => void,
  received?: { by: string | null },
) => {
  if (!menu) return <span className="text-gray-300">-</span>;
  return (
    <div className="flex flex-col items-stretch gap-0.5">
      <div className="flex items-center gap-1">
        <Tag color={color} className="flex-1 truncate m-0" title={menu}>
          {menu.split(' ')[0]}
        </Tag>
        {/*
          รับแล้วจะไม่มีปุ่มลบให้กด แทนที่ด้วยกุญแจพร้อมบอกว่าใครรับไป
          ดีกว่าปล่อยให้กดแล้วเจอ error เพราะพยาบาลจะไม่รู้ว่าต้องไปคุยกับใคร
        */}
        {received ? (
          <Tooltip title={`${received.by || 'งานโภชนาการ'} รับรายการไปแล้ว ยกเลิกเองไม่ได้ ต้องแจ้งงานโภชนาการให้ถอนการรับก่อน`}>
            <PiLockSimpleBold className="text-gray-400 shrink-0" />
          </Tooltip>
        ) : onDelete && (
          <Tooltip title="ยกเลิกรายการอาหารมื้อนี้">
            <Button type="text" size="small" danger icon={<PiTrashBold />} onClick={onDelete} />
          </Tooltip>
        )}
      </div>
      {addon && (
        <span className="w-full text-left text-[11px] text-gray-500 italic leading-tight break-words" title={addon}>
          {addon}
        </span>
      )}
    </div>
  );
};

interface FoodOrderRecord {
  admission_list_id: number;
  hn: string;
  an: string;
  patient_name: string;
  bedno: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  breakfast_addon: string | null;
  lunch_addon: string | null;
  dinner_addon: string | null;
  breakfast_order_id: number | null;
  lunch_order_id: number | null;
  dinner_order_id: number | null;
  breakfast_received: boolean | null;
  lunch_received: boolean | null;
  dinner_received: boolean | null;
  reciever_name: string | null;
}

export default function OrderFoodPage() {
  // --- State ---
  const [patients, setPatients] = useState<PatientFood[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [foodMenus, setFoodMenus] = useState<NutritionMenu[]>([]);
  
  // Filters
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [orderDate, setOrderDate] = useState<dayjs.Dayjs>(dayjs());
  const [mealTime, setMealTime] = useState<string>('breakfast');
  const [globalFoodType, setGlobalFoodType] = useState<string | null>(null);

  // View Mode
  const [isAddonMode, setIsAddonMode] = useState(false);

  // History Drawer State
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState<PatientFood | null>(null);
  const [historyData, setHistoryData] = useState<FoodOrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Copy Last Meal Confirmation State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    source: MealSource;
    sourceDate: dayjs.Dayjs;
    target: MealKey;
    scope: 'selected' | 'all';
    rows: CopyRow[];
    alreadyOrdered: number;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  // เก็บเป็นชื่อมื้อ ไม่ใช่ boolean เพื่อให้หมุนเฉพาะปุ่มที่กด ไม่ใช่หมุนทั้งสามปุ่ม
  const [loadingTarget, setLoadingTarget] = useState<MealKey | null>(null);

  // Cancel Order State
  const [cancelTarget, setCancelTarget] = useState<{
    patient: PatientFood;
    meal: MealKey;
    orderId: number;
    menuName: string;
    addon: string | null;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // User ID State
  const [userId, setUserId] = useState<number>(1);

  const [loadingFoodOrders, setLoadingFoodOrders] = useState(false);
  const [addonData, setAddonData] = useState<FoodOrderAddon[]>([]);
  const [loadingAddon, setLoadingAddon] = useState(false);
  const [addonEdits, setAddonEdits] = useState<Record<number, string>>({});

  // --- Fetch Data & Get User ID ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };

        // Decode JWT token เพื่อหา user ID
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]));
            if (decoded.id) {
              setUserId(decoded.id);
            }
          }
        } catch (decodeError) {
          console.warn("Could not decode token:", decodeError);
        }

        const [wardRes, menuRes] = await Promise.all([
          axios.get('/api/v1/system/wardsV1', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/nutrition/menu', { headers }).catch(() => ({ data: { data: [] } }))
        ]);

        const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
        setWards(wardList);
        if (wardList.length > 0) {
          setSelectedWard(wardList[0].his_code);
        }

        const menuList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data.data || [];
        setFoodMenus(menuList);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // --- Fetch Patients from API ---
  const fetchFoodOrders = useCallback(async () => {
    if (!selectedWard) {
      setPatients([]);
      return;
    }
    setLoadingFoodOrders(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post('/api/v1/nutrition/food-orders-by-ward', {
        ward: selectedWard,
        date: orderDate.format('YYYY-MM-DD'),
      }, { headers });
      if (response.data?.success) {
        const wardName = wards.find(w => w.his_code === selectedWard)?.ward_name || selectedWard;
        const mapped: PatientFood[] = (response.data.data || []).map((p: FoodOrderRecord) => ({
          key: p.admission_list_id,
          hn: p.hn,
          an: p.an,
          name: p.patient_name,
          bed: p.bedno,
          wardName,
          admissionListId: p.admission_list_id,
          foodType: null,
          lastMeal: p.dinner ?? p.lunch ?? p.breakfast ?? null,
          // addon ต้องมาจากมื้อเดียวกับที่เลือกเป็น "มื้อล่าสุด" ไม่งั้นจะได้หมายเหตุข้ามมื้อ
          lastMealAddon: p.dinner ? p.dinner_addon : p.lunch ? p.lunch_addon : p.breakfast ? p.breakfast_addon : null,
          breakfast: p.breakfast,
          lunch: p.lunch,
          dinner: p.dinner,
          breakfastAddon: p.breakfast_addon ?? null,
          lunchAddon: p.lunch_addon ?? null,
          dinnerAddon: p.dinner_addon ?? null,
          breakfastOrderId: p.breakfast_order_id ?? null,
          lunchOrderId: p.lunch_order_id ?? null,
          dinnerOrderId: p.dinner_order_id ?? null,
          breakfastReceived: p.breakfast_received === true,
          lunchReceived: p.lunch_received === true,
          dinnerReceived: p.dinner_received === true,
          recieverName: p.reciever_name ?? null,
        }));
        setPatients(mapped);
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Error fetching food orders:', error);
      setPatients([]);
    } finally {
      setLoadingFoodOrders(false);
    }
    setSelectedRowKeys([]);
    setGlobalFoodType(null);
    setIsAddonMode(false);
  }, [selectedWard, orderDate, wards]);

  useEffect(() => {
    fetchFoodOrders();
  }, [fetchFoodOrders]);

  useEffect(() => {
    if (isAddonMode) fetchAddonData();
  }, [isAddonMode, selectedWard, orderDate, mealTime]);

  // --- Handlers ---
  const handleGlobalFoodTypeChange = (value: string) => {
    setGlobalFoodType(value);
    // เมื่อเลือกประเภทอาหารด้านบน ให้เปลี่ยนค่าในแถวที่ติ๊กเลือกไว้ทั้งหมด
    if (selectedRowKeys.length > 0 && value) {
      // หา foodItemId จาก foodMenus
      const selectedMenu = foodMenus.find(m => m.food_name === value);
      const foodItemId = selectedMenu?.food_item_id || 0;

      setPatients(prev =>
        prev.map(p => selectedRowKeys.includes(p.key) ? {
          ...p,
          foodType: value,
          foodItemId,
          foodOrderDate: orderDate.format('YYYY-MM-DD'),
          foodMealTime: mealTime
        } : p)
      );
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    // ถ้าเลือกคนเพิ่ม และมีการเลือกประเภทอาหารด้านบนไว้แล้ว ให้ใส่ค่าประเภทอาหารอัตโนมัติ
    if (globalFoodType) {
      const newlySelected = newSelectedRowKeys.filter(k => !selectedRowKeys.includes(k));
      if (newlySelected.length > 0) {
        // หา foodItemId จาก foodMenus
        const selectedMenu = foodMenus.find(m => m.food_name === globalFoodType);
        const foodItemId = selectedMenu?.food_item_id || 0;

        setPatients(prev =>
          prev.map(p => newlySelected.includes(p.key) && !p.foodType ? {
            ...p,
            foodType: globalFoodType,
            foodItemId,
            foodOrderDate: orderDate.format('YYYY-MM-DD'),
            foodMealTime: mealTime
          } : p)
        );
      }
    }
  };

  /**
   * แปลงผู้ป่วยเป็นแถวที่จะสั่ง โดยอ่านเมนูจากคอลัมน์ต้นทางที่เลือก
   *
   * ผู้ป่วยที่คอลัมน์นั้นว่าง (ยังไม่เคยสั่งมื้อนั้น) จะไม่ถูกใส่มาเลย
   * เพราะการเดาเมนูให้เองแปลว่าคนไข้ได้อาหารที่ไม่มีใครสั่ง
   */
  const buildCopyRows = (source: MealSource, pool: PatientFood[]): CopyRow[] =>
    pool
      .filter(p => p[source])
      .map(p => {
        const menuName = p[source] as string;
        return {
          patient: p,
          menuName,
          // ยกหมายเหตุของมื้อต้นทางมาด้วย เพราะ upsert ฝั่งเซิร์ฟเวอร์เขียนทับ addon เสมอ
          // ถ้าส่งค่าว่างไป หมายเหตุที่พยาบาลเคยบันทึกไว้ของมื้อปลายทางจะหายทั้งหอ
          addon: (p[SOURCE_ADDON_FIELD[source]] as string | null | undefined) ?? null,
          foodItemId: foodMenus.find(m => m.food_name === menuName)?.food_item_id ?? 0,
        };
      });

  // สั่งเหมือนมื้อล่าสุด เฉพาะรายที่ติ๊กเลือกไว้ (ปุ่มในแถบเครื่องมือ)
  const handleCopyLastMeal = () => {
    const pool = patients.filter(p => selectedRowKeys.includes(p.key));
    if (pool.length === 0) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาเลือกผู้ป่วยที่ต้องการคัดลอกข้อมูลมื้อล่าสุด', timer: 2000, showConfirmButton: false });
      return;
    }

    const rows = buildCopyRows('lastMeal', pool);
    if (rows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูลให้คัดลอก',
        text: 'ผู้ป่วยที่เลือกไว้ยังไม่มีรายการอาหารของวันนี้เลย',
        timer: 2500,
        showConfirmButton: false,
      });
      return;
    }

    setConfirmData({
      source: 'lastMeal',
      sourceDate: orderDate,
      target: mealTime as MealKey,
      scope: 'selected',
      rows,
      alreadyOrdered: 0,
    });
    setIsConfirmOpen(true);
  };

  /**
   * ปุ่มบนหัวคอลัมน์มื้อ — เติมมื้อนั้นด้วยข้อมูลของมื้อก่อนหน้า 1 มื้อ
   *
   * คอลัมน์ที่กดคือ "ปลายทาง" ระบบหาต้นทางให้เอง มื้อกลางวันกับมื้อเย็น
   * อ่านจากตารางที่แสดงอยู่ได้เลย แต่มื้อเช้าต้องย้อนไปเอาของเย็นเมื่อวาน
   * ซึ่งไม่ได้อยู่ในชุดข้อมูลของวันที่เลือก จึงต้องยิงขอเพิ่มอีกครั้ง
   */
  const handleCopyPrevMeal = async (target: MealKey) => {
    const cfg = PREV_MEAL[target];
    if (!selectedWard) return;

    const sourceDate = cfg.prevDay ? orderDate.subtract(1, 'day') : orderDate;
    setIsConfirmOpen(true);
    setConfirmData(null);
    setLoadingTarget(target);

    try {
      let pool = patients;

      if (cfg.prevDay) {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.post('/api/v1/nutrition/food-orders-by-ward', {
          ward: selectedWard,
          date: sourceDate.format('YYYY-MM-DD'),
        }, { headers });

        const prevByAn = new Map<string, FoodOrderRecord>(
          (res.data?.data ?? []).map((r: FoodOrderRecord) => [r.an, r])
        );
        // ยึดรายชื่อของวันที่เลือกเป็นหลัก คนที่จำหน่ายไปแล้วเมื่อวานจะได้ไม่ถูกสั่งอาหารให้
        pool = patients.map(p => {
          const prev = prevByAn.get(p.an);
          return { ...p, dinner: prev?.dinner ?? null, dinnerAddon: prev?.dinner_addon ?? null };
        });
      }

      // ปุ่มนี้ทำหน้าที่ "เติมช่องที่ยังว่าง" รายที่สั่งมื้อนี้ไว้แล้วต้องไม่ถูกเขียนทับ
      // ฝั่งเซิร์ฟเวอร์เป็น upsert ถ้าส่งไปด้วยจะทับของที่พยาบาลตั้งใจสั่งไว้เอง
      const alreadyOrdered = pool.filter(p => p[target]).length;
      const rows = buildCopyRows(cfg.source, pool.filter(p => !p[target]));

      if (rows.length === 0) {
        setIsConfirmOpen(false);
        Swal.fire({
          icon: 'info',
          title: 'ไม่มีรายการให้เพิ่ม',
          text: alreadyOrdered > 0 && alreadyOrdered === pool.length
            ? `ผู้ป่วยทุกรายสั่ง${SOURCE_LABEL[target]}ไว้แล้ว`
            : `ยังไม่มีรายการอาหารของ${SOURCE_LABEL[cfg.source]} วันที่ ${sourceDate.format('DD/MM/YYYY')} ให้คัดลอก`,
          timer: 3000,
          showConfirmButton: false,
        });
        return;
      }

      setConfirmData({ source: cfg.source, sourceDate, target, scope: 'all', rows, alreadyOrdered });
    } catch (error) {
      console.error('Error fetching previous meal:', error);
      setIsConfirmOpen(false);
      Swal.fire({ icon: 'error', title: 'ดึงข้อมูลมื้อก่อนหน้าไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง', timer: 3000, showConfirmButton: false });
    } finally {
      setLoadingTarget(null);
    }
  };

  // ยืนยันการสั่งตามมื้อเดิม
  const handleConfirmCopyLastMeal = async () => {
    if (!confirmData) return;

    // เมนูที่เทียบรหัสในระบบไม่เจอต้องไม่ถูกส่งไป ไม่งั้นจะบันทึก food_item_id = 0
    // ซึ่งเป็นรายการอาหารที่ไม่มีอยู่จริง แล้วครัวจะไม่รู้ว่าต้องทำอะไรให้
    const orderable = confirmData.rows.filter(r => r.foodItemId > 0);
    if (orderable.length === 0) return;

    setConfirming(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      if (!token) {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่พบ token การอนุญาต กรุณา login ใหม่', timer: 2000, showConfirmButton: false });
        return;
      }
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const orderData = orderable.map(r => ({
        admission_list_id: parseInt(r.patient.admissionListId) || 0,
        an: r.patient.an,
        ward: selectedWard || '',
        order_date: orderDate.format('YYYY-MM-DD'),
        // ปลายทางมาจากคอลัมน์ที่กดปุ่ม ไม่ใช่ปุ่มเลือกมื้อด้านบน
        meal: MEAL_NUMBER[confirmData.target],
        food_item_id: r.foodItemId,
        request_by: String(userId),
        addon: r.addon,
      }));

      const response = await axios.post('/api/v1/nutrition/order-menu', orderData, { headers });

      if (response.status === 200 || response.status === 201) {
        const target = confirmData.target;
        setIsConfirmOpen(false);
        setConfirmData(null);
        setSelectedRowKeys([]);
        // ย้ายมื้อที่เลือกด้านบนไปตามปลายทางด้วย ไม่งั้นหน้า Addon จะเปิดคนละมื้อกับที่เพิ่งบันทึก
        setMealTime(target);
        setIsAddonMode(true);
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: `บันทึก${SOURCE_LABEL[target]} ${orderData.length} รายการเรียบร้อย สามารถระบุ Addon เพิ่มเติมได้`, timer: 2500, showConfirmButton: false });
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        Swal.fire({ icon: 'error', title: 'ข้อมูลไม่ถูกต้อง', text: error.response?.data?.message || 'กรุณาตรวจสอบข้อมูลอีกครั้ง', timer: 3000, showConfirmButton: false });
      } else if (error.response?.status === 401) {
        Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์', text: 'ต้องเข้าสู่ระบบใหม่', timer: 2000, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message, timer: 3000, showConfirmButton: false });
      }
    } finally {
      setConfirming(false);
    }
  };


  // แปลง mealTime เป็นตัวเลข
  const getMealNumber = (meal: string): number => {
    if (meal === 'breakfast') return 1;
    if (meal === 'lunch') return 2;
    if (meal === 'dinner') return 3;
    return 1;
  };

  // บันทึกข้อมูล
  const handleSave = async () => {
    if (!isAddonMode && selectedRowKeys.length === 0) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาเลือกผู้ป่วยที่ต้องการสั่งอาหาร', timer: 2000, showConfirmButton: false });
      return;
    }

    if (!isAddonMode) {
      // Validate เฉพาะตอนอยู่โหมดสั่งอาหารปกติ
      const selectedPatients = patients.filter(p => selectedRowKeys.includes(p.key));
      const invalidPatients = selectedPatients.filter(p => !p.foodType);

      if (invalidPatients.length > 0) {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณาระบุ "ประเภทอาหาร" ด้านบนก่อน หรือใช้ปุ่มสั่งเหมือนมื้อล่าสุด', timer: 2500, showConfirmButton: false });
        return;
      }
    }

    try {
      // สร้างข้อมูลเพื่อส่ง API
      let orderData: any[] = [];

      if (isAddonMode) {
        // สั่งจากรายการที่มีการสั่งแล้ว
        orderData = patients
          .filter(p =>
            p.foodType &&
            p.foodOrderDate === orderDate.format('YYYY-MM-DD') &&
            p.foodMealTime === mealTime
          )
          .map(p => ({
            admission_list_id: parseInt(p.admissionListId) || 0,
            an: p.an,
            ward: selectedWard || '',
            order_date: orderDate.format('YYYY-MM-DD'),
            meal: getMealNumber(mealTime),
            food_item_id: p.foodItemId || 0,
            request_by: String(userId),
            addon: p.addonText || null
          }));
      } else {
        // สั่งจากการเลือก checkbox
        orderData = patients
          .filter(p => selectedRowKeys.includes(p.key) && p.foodType)
          .map(p => ({
            admission_list_id: parseInt(p.admissionListId) || 0,
            an: p.an,
            ward: selectedWard || '',
            order_date: orderDate.format('YYYY-MM-DD'),
            meal: getMealNumber(mealTime),
            food_item_id: p.foodItemId || 0,
            request_by: String(userId),
            addon: p.addonText || null
          }));
      }

      if (orderData.length === 0) {
        Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'ไม่มีรายการที่จะบันทึก', timer: 2000, showConfirmButton: false });
        return;
      }

      // ส่ง API
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

      if (!token) {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่พบ token การอนุญาต กรุณา login ใหม่', timer: 2000, showConfirmButton: false });
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log('Sending order data:', JSON.stringify(orderData, null, 2));
      console.log('Headers:', headers);

      const response = await axios.post('/api/v1/nutrition/order-menu', orderData, { headers });

      if (response.status === 200 || response.status === 201) {
        const mealLabel = mealTime === 'breakfast' ? 'มื้อเช้า' : mealTime === 'lunch' ? 'มื้อกลางวัน' : 'มื้อเย็น';
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: `บันทึกข้อมูล ${mealLabel} วันที่ ${orderDate.format('DD/MM/YYYY')} จำนวน ${orderData.length} รายการ เรียบร้อยแล้ว`, timer: 2500, showConfirmButton: false });
        setSelectedRowKeys([]);
        setIsAddonMode(true);
      }
    } catch (error: any) {
      console.error('Error saving order:', error);
      console.error('Response:', error.response?.data);

      if (error.response?.status === 422) {
        Swal.fire({ icon: 'error', title: 'ข้อมูลไม่ถูกต้อง', text: error.response?.data?.message || 'กรุณาตรวจสอบข้อมูลอีกครั้ง', timer: 3000, showConfirmButton: false });
      } else if (error.response?.status === 401) {
        Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์', text: 'ต้องเข้าสู่ระบบใหม่', timer: 2000, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message, timer: 3000, showConfirmButton: false });
      }
    }
  };

  const openHistoryDrawer = async (patient: PatientFood) => {
    setSelectedHistoryPatient(patient);
    setIsHistoryDrawerOpen(true);
    setHistoryData([]);
    setLoadingHistory(true);

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        '/api/v1/nutrition/food-order-history',
        { an: patient.an, days: HISTORY_DAYS },
        { headers }
      );
      setHistoryData(response.data?.data ?? []);
    } catch (error) {
      console.error('Error fetching food order history:', error);
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryDrawer = () => {
    setIsHistoryDrawerOpen(false);
    setSelectedHistoryPatient(null);
    setHistoryData([]);
  };

  const ORDER_ID_FIELD: Record<MealKey, 'breakfastOrderId' | 'lunchOrderId' | 'dinnerOrderId'> = {
    breakfast: 'breakfastOrderId',
    lunch: 'lunchOrderId',
    dinner: 'dinnerOrderId',
  };

  const openCancelModal = (patient: PatientFood, meal: MealKey) => {
    const orderId = patient[ORDER_ID_FIELD[meal]];
    if (!orderId) return;
    setCancelReason('');
    setCancelTarget({
      patient,
      meal,
      orderId,
      menuName: patient[meal] ?? '',
      addon: (patient[SOURCE_ADDON_FIELD[meal]] as string | null | undefined) ?? null,
    });
  };

  /**
   * ยกเลิกรายการอาหารที่สั่งผิด
   *
   * ฝั่งเซิร์ฟเวอร์ไม่ได้ลบแถวทิ้ง แต่ทำเครื่องหมายพร้อมชื่อคนยกเลิกกับเหตุผล
   * เพราะใบสรุปอาจถูกพิมพ์ส่งครัวไปแล้ว ต้องย้อนดูได้ว่ายอดเปลี่ยนเพราะอะไร
   */
  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
      const res = await axios.post('/api/v1/nutrition/cancel-order-menu', [{
        food_order_id: cancelTarget.orderId,
        reason: cancelReason.trim() || null,
      }], { headers });

      if (res.data?.success) {
        setCancelTarget(null);
        // fetchFoodOrders พาออกจากโหมด Addon เสมอ ถ้ายกเลิกจากหน้านั้นต้องรีเฟรชคนละตัว
        if (isAddonMode) await fetchAddonData();
        else await fetchFoodOrders();
        Swal.fire({ icon: 'success', title: 'ยกเลิกรายการแล้ว', text: res.data.message, timer: 2000, showConfirmButton: false });
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
        : 'กรุณาลองใหม่อีกครั้ง';
      Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
    } finally {
      setCancelling(false);
    }
  };

  /*
    หัวคอลัมน์มื้ออาหาร — คอลัมน์ที่กดคือมื้อปลายทางที่จะถูกเติม
    ปุ่มมีความหมายเดียวคือ "ดึงมื้อก่อนหน้า 1 มื้อมาใส่มื้อนี้" ผู้ใช้ไม่ต้องเลือกต้นทางเอง
  */
  const mealColumnTitle = (label: string, target: MealKey) => {
    const cfg = PREV_MEAL[target];
    const sourceDate = cfg.prevDay ? orderDate.subtract(1, 'day') : orderDate;
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span>{label}</span>
        <Tooltip title={`ดึง${SOURCE_LABEL[cfg.source]} วันที่ ${sourceDate.format('DD/MM/YYYY')} มาสั่งเป็น${SOURCE_LABEL[target]}`}>
          <Button
            size="small"
            icon={<PiCopyBold />}
            loading={loadingTarget === target}
            onClick={() => handleCopyPrevMeal(target)}
            className="border-white/40 text-white bg-white/10 hover:bg-white/20 flex items-center"
          />
        </Tooltip>
      </div>
    );
  };

  // --- Table Columns ---
  const columns: ColumnsType<PatientFood> = [
    { 
      title: 'เตียง', 
      dataIndex: 'bed', 
      key: 'bed', 
      width: 70, 
      align: 'center',
      render: (text) => <span className="font-bold text-gray-700">{text}</span>
    },
    { 
      title: 'HN / AN', 
      key: 'hn_an', 
      width: 140,
      render: (_, record) => (
        <div className="flex flex-col text-xs">
          <span className="text-blue-600 font-semibold">{record.hn}</span>
          <span className="text-gray-500">{record.an}</span>
        </div>
      )
    },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'name', 
      key: 'name',
      width: 200,
      render: (text) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <PiUserBold />
          </div>
          <span className="font-semibold text-[var(--brand-text)]">{text}</span>
        </div>
      )
    },
    {
      title: mealColumnTitle('มื้อเช้า', 'breakfast'),
      dataIndex: 'breakfast',
      key: 'breakfast',
      width: 150,
      align: 'center',
      render: (text, record) => renderMealCell(text, record.breakfastAddon, 'blue',
        record.breakfastOrderId ? () => openCancelModal(record, 'breakfast') : undefined,
        record.breakfastReceived ? { by: record.recieverName ?? null } : undefined)
    },
    {
      title: mealColumnTitle('มื้อกลางวัน', 'lunch'),
      dataIndex: 'lunch',
      key: 'lunch',
      width: 160,
      align: 'center',
      render: (text, record) => renderMealCell(text, record.lunchAddon, 'orange',
        record.lunchOrderId ? () => openCancelModal(record, 'lunch') : undefined,
        record.lunchReceived ? { by: record.recieverName ?? null } : undefined)
    },
    {
      title: mealColumnTitle('มื้อเย็น', 'dinner'),
      dataIndex: 'dinner',
      key: 'dinner',
      width: 150,
      align: 'center',
      render: (text, record) => renderMealCell(text, record.dinnerAddon, 'purple',
        record.dinnerOrderId ? () => openCancelModal(record, 'dinner') : undefined,
        record.dinnerReceived ? { by: record.recieverName ?? null } : undefined)
    },
    {
      title: 'มื้อล่าสุด',
      dataIndex: 'lastMeal',
      key: 'lastMeal',
      width: 130,
      align: 'center',
      render: (text) => text ? <Tag color="default" className="w-full truncate border-gray-300">{text.split(' ')[0]}</Tag> : <span className="text-gray-300">-</span>
    },
    {
      title: 'อาหารที่สั่ง',
      key: 'foodOrdered',
      width: 180,
      render: (_, record) => {
        if (!record.foodType) {
          return <span className="text-gray-300 text-xs">ยังไม่ได้สั่ง</span>;
        }
        return (
          <div className="space-y-1">
            <Tag color="green" className="whitespace-normal h-auto py-0.5">
              {record.foodType}
            </Tag>
            {record.addonText && (
              <div className="text-xs text-gray-500 italic break-words">
                {record.addonText}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'ดำเนินการ',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button size="small" type="link" className="text-[var(--brand-text)] flex items-center justify-center gap-1 mx-auto hover:bg-teal-50" onClick={() => openHistoryDrawer(record)}>
          <PiClockBold /> ประวัติ
        </Button>
      )
    }
  ];

  // --- Fetch Addon Data ---
  const fetchAddonData = useCallback(async () => {
    if (!selectedWard) return;
    setLoadingAddon(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
      const response = await axios.post('/api/v1/nutrition/food-orders-addon-by-ward', {
        ward: selectedWard,
        date: orderDate.format('YYYY-MM-DD'),
        meal: getMealNumber(mealTime),
      }, { headers });
      if (response.data?.success) {
        const data: FoodOrderAddon[] = response.data.data || [];
        setAddonData(data);
        const initEdits: Record<number, string> = {};
        data.forEach(d => { initEdits[d.food_order_id] = d.addon ?? ''; });
        setAddonEdits(initEdits);
      } else {
        setAddonData([]);
        setAddonEdits({});
      }
    } catch (error) {
      console.error('Error fetching addon data:', error);
      setAddonData([]);
    } finally {
      setLoadingAddon(false);
    }
  }, [selectedWard, orderDate, mealTime]);

  // --- Table Columns (Addon Mode) ---
  const addonColumns: ColumnsType<FoodOrderAddon> = [
    {
      title: 'เตียง',
      dataIndex: 'bedno',
      key: 'bedno',
      width: 70,
      align: 'center',
      render: (text) => <span className="font-bold text-gray-700">{text}</span>
    },
    {
      title: 'AN',
      dataIndex: 'an',
      key: 'an',
      width: 120,
      render: (text) => <span className="text-gray-600">{text}</span>
    },
    {
      title: 'ชื่อ-สกุล',
      dataIndex: 'patient_name',
      key: 'patient_name',
      width: 200,
      render: (text) => <span className="font-semibold text-[var(--brand-text)]">{text}</span>
    },
    {
      title: 'มื้อ',
      dataIndex: 'meal_name',
      key: 'meal_name',
      width: 80,
      align: 'center',
      render: (text) => <Tag color="default">{text}</Tag>
    },
    {
      title: 'ชื่ออาหาร',
      dataIndex: 'food_name',
      key: 'food_name',
      width: 180,
      render: (text) => <Tag color="green" className="whitespace-normal h-auto py-0.5">{text}</Tag>
    },
    {
      title: 'Addon',
      key: 'addon',
      render: (_, record) => (
        <Input
          value={addonEdits[record.food_order_id] ?? ''}
          onChange={(e) => setAddonEdits(prev => ({ ...prev, [record.food_order_id]: e.target.value }))}
          placeholder="ระบุ Addon เช่น ไม่ใส่ผัก, งดเค็ม..."
          allowClear
        />
      )
    },
    {
      // ตารางนี้ 1 แถว = 1 รายการอยู่แล้ว ปุ่มลบจึงเป็นคอลัมน์ของตัวเองได้ ไม่กำกวม
      title: 'ยกเลิก',
      key: 'cancel',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="ยกเลิกรายการอาหารรายการนี้">
          <Button
            type="text"
            size="small"
            danger
            icon={<PiTrashBold />}
            onClick={() => {
              const patient = patients.find(p => p.an === record.an);
              if (!patient) return;
              setCancelReason('');
              setCancelTarget({
                patient,
                meal: mealTime as MealKey,
                orderId: record.food_order_id,
                menuName: record.food_name,
                addon: addonEdits[record.food_order_id] || null,
              });
            }}
          />
        </Tooltip>
      )
    },
  ];

  const handleSaveAddon = async () => {
    if (addonData.length === 0) return;
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };
      const orders = addonData.map(p => ({
        food_order_id: p.food_order_id,
        addon: addonEdits[p.food_order_id] ?? null,
      }));
      const response = await axios.patch('/api/v1/nutrition/update-food-orders-addon', {
        ward: selectedWard,
        date: orderDate.format('YYYY-MM-DD'),
        meal: getMealNumber(mealTime),
        orders,
      }, { headers });
      if (response.data?.success) {
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'บันทึก Addon เรียบร้อยแล้ว', timer: 2000, showConfirmButton: false });
      }
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message, timer: 3000, showConfirmButton: false });
    }
  };

  const router = useRouter();

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const handlePrint = () => {
    const params = new URLSearchParams({
      ward: selectedWard || '',
      date: orderDate.format('YYYY-MM-DD'),
      meal: mealTime,
    });
    router.push(`/ipd/order-food/summary-orders?${params.toString()}`);
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans pb-10">
      <Navbar />
      
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          
          {/* Header Title */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                <MdOutlineFastfood className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--brand-text)] m-0">ระบบสั่งอาหารผู้ป่วย (Food Order)</h2>
                <p className="text-sm text-gray-500 m-0">จัดการรายการอาหารผู้ป่วยในตามมื้อและวัน</p>
              </div>
            </div>
          </div>


          {/* Filters Section */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 mb-2 flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">เลือกหอผู้ป่วย</label>
              <Select 
                size="middle"
                value={selectedWard}
                onChange={setSelectedWard}
                className="w-48"
                placeholder="กำลังโหลดข้อมูล..."
                options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
                showSearch
                optionFilterProp="label"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่สั่งอาหาร</label>
              <DatePicker 
                size="middle"
                value={orderDate} 
                onChange={(d) => setOrderDate(d || dayjs())} 
                format="DD/MM/YYYY"
                className="w-40"
                allowClear={false}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">มื้ออาหาร</label>
              <Radio.Group 
                value={mealTime} 
                onChange={e => setMealTime(e.target.value)}
                optionType="button" 
                buttonStyle="solid"
                className="flex"
              >
                <Radio.Button value="breakfast" className="w-24 text-center">เช้า</Radio.Button>
                <Radio.Button value="lunch" className="w-24 text-center">กลางวัน</Radio.Button>
                <Radio.Button value="dinner" className="w-24 text-center">เย็น</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ประเภทอาหาร</label>
              <Select
                className="w-64"
                size="middle"
                placeholder="กำหนดประเภทอาหาร (ทุกคนที่เลือก)"
                value={globalFoodType}
                onChange={handleGlobalFoodTypeChange}
                showSearch
                optionFilterProp="children"
                allowClear
              >
                {foodMenus.map(opt => <Option key={opt.food_item_id} value={opt.food_name}>{opt.food_name}</Option>)}
              </Select>
            </div>
          </div>

          {/* Action Buttons Top */}
          <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-semibold">รายการผู้ป่วย</span>
              <Tag color="cyan" className="rounded-full px-3">
                {isAddonMode
                  ? patients.filter(p =>
                      p.foodType &&
                      p.foodOrderDate === orderDate.format('YYYY-MM-DD') &&
                      p.foodMealTime === mealTime
                    ).length
                  : patients.length} เตียง
              </Tag>
              {!isAddonMode && selectedRowKeys.length > 0 && (
                <Tag color="blue" className="rounded-full px-3 text-sm">เลือกแล้ว {selectedRowKeys.length} รายการ</Tag>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type={isAddonMode ? "primary" : "default"}
                icon={<PiNotePencilBold className="text-lg" />}
                onClick={() => {
                  const next = !isAddonMode;
                  setIsAddonMode(next);
                  if (next) fetchAddonData();
                  else fetchFoodOrders();
                }}
                className={isAddonMode ? "bg-amber-500 hover:bg-amber-400 border-none shadow-md shadow-amber-500/30" : "text-amber-600 border-amber-500 hover:bg-amber-50"}
              >
                {isAddonMode ? "กลับไปหน้าสั่งอาหารปกติ" : "ระบุ Addon เพิ่มเติม"}
              </Button>

              {!isAddonMode && (
                <Button 
                  icon={<PiCopyBold className="text-lg" />} 
                  onClick={handleCopyLastMeal}
                  className="text-[var(--brand-text)] border-[#006b5f] hover:bg-teal-50"
                >
                  สั่งเหมือนมื้อล่าสุด
                </Button>
              )}
              <Button
                icon={<PiPrinterBold className="text-lg" />}
                onClick={handlePrint}
                className="text-blue-600 border-blue-500 hover:bg-blue-50"
              >
                พิมพ์ใบสรุปรายการอาหาร
              </Button>
              <Button
                type="primary"
                icon={<PiFloppyDiskBold className="text-lg" />}
                onClick={isAddonMode ? handleSaveAddon : handleSave}
                className="bg-[#006b5f] hover:bg-[#005a50] shadow-lg shadow-teal-900/20"
              >
                {isAddonMode ? 'บันทึก Addon' : 'บันทึกรายการ'}
              </Button>
            </div>
          </div>

          {/* Data Table */}
          {isAddonMode ? (
            <Table<FoodOrderAddon>
              columns={addonColumns}
              dataSource={addonData}
              rowKey="food_order_id"
              loading={loadingAddon}
              pagination={false}
              size="middle"
              bordered
              className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
            />
          ) : (
            <Table<PatientFood>
              rowSelection={rowSelection}
              columns={columns}
              dataSource={patients}
              rowKey="key"
              loading={loadingFoodOrders}
              pagination={false}
              size="middle"
              bordered
              className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
            />
          )}

        </Card>

        {/* History Drawer */}
        <Drawer
          title={<span className="text-white font-bold text-lg flex items-center gap-2"><PiClockBold /> ประวัติการสั่งอาหาร</span>}
          placement="right"
          styles={{ wrapper: { width: 450 } }}
          onClose={closeHistoryDrawer}
          open={isHistoryDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white font-sans"
        >
          {selectedHistoryPatient && (
            <div className="space-y-6">
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#006b5f] flex items-center justify-center shrink-0">
                    <PiUserBold className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 m-0">{selectedHistoryPatient.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Tag color="blue" className="m-0 border-blue-200">HN: {selectedHistoryPatient.hn}</Tag>
                      <span className="text-sm font-semibold text-gray-600">เตียง {selectedHistoryPatient.bed}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4">
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">
                  ประวัติย้อนหลัง {HISTORY_DAYS} วัน
                </h4>

                {loadingHistory ? (
                  <div className="flex justify-center py-10">
                    <Spin />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-gray-500 text-sm mb-1">ไม่พบประวัติการสั่งอาหาร</p>
                    <p className="text-gray-400 text-xs">ผู้ป่วยรายนี้ยังไม่มีรายการสั่งอาหารใน {HISTORY_DAYS} วันที่ผ่านมา</p>
                  </div>
                ) : (
                  <Timeline
                    items={historyData.map(record => {
                      const meal = MEAL_LABEL[record.meal] ?? { label: record.mealName ?? '-', color: 'gray' };
                      // รายการที่ถูกยกเลิกยังแสดงอยู่ แต่ทำให้จางและขีดฆ่า
                      // พร้อมบอกว่าใครเอาออกเมื่อไหร่ ซึ่งเป็นเหตุผลที่ระบบไม่ลบแถวทิ้ง
                      const cancelled = !!record.cancelledAt;
                      return {
                        color: cancelled ? 'gray' : meal.color,
                        content: (
                          <div className="mb-3">
                            <span className={`font-bold text-sm ${cancelled ? 'text-gray-400' : 'text-gray-700'}`}>
                              {dayjs(record.orderDate).format('DD/MM/YYYY')} - {meal.label}
                            </span>
                            {cancelled && (
                              <Tag color="red" className="ml-2 text-[10px] leading-4">ยกเลิกแล้ว</Tag>
                            )}
                            <br />
                            <span className={`text-sm font-semibold ${cancelled ? 'text-gray-400 line-through' : 'text-[var(--brand-text)]'}`}>
                              {record.foodName ?? 'ไม่ระบุเมนู'}
                            </span>
                            {record.addon && (
                              <>
                                <br />
                                <span className={`text-xs italic ${cancelled ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                                  {record.addon}
                                </span>
                              </>
                            )}
                            {cancelled && (
                              <div className="mt-1 text-[11px] text-red-500 leading-tight">
                                ยกเลิกโดย {record.cancelledBy || 'ไม่ทราบผู้ใช้'} เมื่อ {record.cancelledAt} น.
                                {record.cancelReason && <div className="text-gray-500 italic">เหตุผล: {record.cancelReason}</div>}
                              </div>
                            )}
                          </div>
                        ),
                      };
                    })}
                  />
                )}
              </div>
            </div>
          )}
        </Drawer>

        {/*
          ยืนยันก่อนยกเลิก เพราะรายการนี้อาจถูกพิมพ์ส่งครัวไปแล้ว
          เหตุผลไม่บังคับกรอก กรณีที่พบบ่อยที่สุดคือกดผิดมื้อแล้วรีบแก้
          ถ้าบังคับทุกครั้งจะกลายเป็นพิมพ์มั่วๆ ให้ผ่านไป ซึ่งไม่ได้ช่วยใครเลย
        */}
        <Modal
          open={cancelTarget !== null}
          onCancel={() => setCancelTarget(null)}
          onOk={handleCancelOrder}
          okText="ยกเลิกรายการ"
          cancelText="ไม่ใช่ตอนนี้"
          okButtonProps={{ danger: true, loading: cancelling }}
          title={<span className="font-semibold text-red-600">ยกเลิกรายการอาหาร</span>}
          width={520}
          destroyOnHidden
        >
          {cancelTarget && (
            <div className="space-y-3">
              <p className="text-gray-700 mb-0">
                จะเอา{' '}
                <span className="font-semibold text-[var(--brand-text)]">{cancelTarget.menuName}</span>
                {cancelTarget.addon && <span className="text-gray-500 italic"> ({cancelTarget.addon})</span>}
                {' '}ของ{' '}
                <span className="font-semibold">{cancelTarget.patient.name}</span>{' '}
                (เตียง {cancelTarget.patient.bed || '-'}) ใน{' '}
                <span className="font-semibold text-[var(--brand-text)]">
                  {SOURCE_LABEL[cancelTarget.meal]} วันที่ {orderDate.format('DD/MM/YYYY')}
                </span>{' '}
                ออกจากรายการที่ส่งครัว
              </p>
              <p className="text-xs text-gray-500 mb-0">
                รายการจะไม่ถูกลบทิ้ง แต่ถูกทำเครื่องหมายไว้พร้อมชื่อผู้ยกเลิก ดูย้อนหลังได้ที่ปุ่ม “ประวัติ” ของผู้ป่วยรายนี้
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  เหตุผล <span className="text-gray-400">(ไม่บังคับ)</span>
                </label>
                <Input.TextArea
                  rows={2}
                  maxLength={500}
                  showCount
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="เช่น สั่งผิดมื้อ / ผู้ป่วยงดอาหารเพื่อทำหัตถการ"
                />
              </div>
            </div>
          )}
        </Modal>

        {/* Copy Last Meal Confirmation Modal */}
        <Modal
          title={
            <span className="text-lg font-bold text-[var(--brand-text)]">
              {confirmData?.scope === 'selected' ? 'ยืนยันการสั่งตามมื้อล่าสุด' : 'ดึงข้อมูลมื้อก่อนหน้า'}
            </span>
          }
          open={isConfirmOpen}
          onCancel={() => {
            setIsConfirmOpen(false);
            setConfirmData(null);
          }}
          width={640}
          footer={[
            <Button key="cancel" onClick={() => {
              setIsConfirmOpen(false);
              setConfirmData(null);
            }}>
              ยกเลิก
            </Button>,
            <Button
              key="confirm"
              type="primary"
              loading={confirming}
              disabled={loadingTarget !== null || !confirmData || confirmData.rows.every(r => r.foodItemId === 0)}
              className="bg-[#006b5f] hover:bg-[#005a50]"
              onClick={handleConfirmCopyLastMeal}
            >
              ยืนยัน
            </Button>,
          ]}
        >
          {loadingTarget && (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          )}

          {confirmData && (() => {
            const orderable = confirmData.rows.filter(r => r.foodItemId > 0);
            const unknown = confirmData.rows.filter(r => r.foodItemId === 0);
            return (
              <div className="space-y-4">
                {/* ประโยคเดียวจบว่าเอาอะไรไปใส่ที่ไหน แบบเดียวกับหน้าประเมินระดับการดูแลรายเวร */}
                <p className="text-gray-700 mb-0">
                  คุณต้องการใช้ข้อมูลเดียวกันกับ{' '}
                  <span className="font-semibold text-[var(--brand-text)]">
                    {SOURCE_LABEL[confirmData.source]} วันที่ {confirmData.sourceDate.format('DD/MM/YYYY')}
                  </span>{' '}
                  มาใช้กับ{' '}
                  <span className="font-semibold text-[var(--brand-text)]">
                    {SOURCE_LABEL[confirmData.target]} วันที่ {orderDate.format('DD/MM/YYYY')}
                  </span>{' '}
                  {confirmData.scope === 'selected'
                    ? `เฉพาะ ${confirmData.rows.length} รายที่เลือกไว้`
                    : 'ทั้งหอผู้ป่วย'} ใช่หรือไม่?
                </p>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">รายชื่อผู้ป่วยและอาหารที่จะสั่ง:</p>
                  <div className="border border-gray-300 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">เตียง</th>
                          <th className="px-3 py-2 text-left font-semibold">ชื่อผู้ป่วย</th>
                          <th className="px-3 py-2 text-left font-semibold">อาหารที่จะสั่ง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmData.rows.map(r => (
                          <tr key={r.patient.key} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-3 py-2 font-semibold text-gray-700">{r.patient.bed}</td>
                            <td className="px-3 py-2 text-gray-700">{r.patient.name}</td>
                            <td className="px-3 py-2">
                              {r.foodItemId > 0
                                ? <Tag color="green" className="whitespace-normal h-auto py-0.5">{r.menuName}</Tag>
                                : <Tag color="red" className="whitespace-normal h-auto py-0.5">{r.menuName} — ไม่พบเมนูนี้ในระบบ</Tag>}
                              {r.addon && (
                                <div className="text-xs text-gray-500 italic break-words">{r.addon}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-gray-600 mb-0">
                    ✓ จะเพิ่มรายการอาหาร {orderable.length} รายการ ให้{SOURCE_LABEL[confirmData.target]} ของวันที่ {orderDate.format('DD/MM/YYYY')}
                  </p>
                  {orderable.some(r => r.addon) && (
                    <p className="text-xs text-gray-600 mt-1 mb-0">
                      ✓ หมายเหตุ (Addon) ของ{SOURCE_LABEL[confirmData.source]}จะถูกคัดลอกมาด้วย แก้ไขภายหลังได้ที่ปุ่ม “ระบุ Addon เพิ่มเติม”
                    </p>
                  )}
                  {/* บอกให้ชัดว่าปุ่มนี้ไม่ทับของเดิม ไม่งั้นพยาบาลจะไม่กล้ากดตอนสั่งไปแล้วบางส่วน */}
                  {confirmData.alreadyOrdered > 0 && (
                    <p className="text-xs text-gray-600 mt-1 mb-0">
                      ✓ ข้าม {confirmData.alreadyOrdered} รายที่สั่ง{SOURCE_LABEL[confirmData.target]}ไว้แล้ว ของเดิมไม่ถูกแก้
                    </p>
                  )}
                  {/*
                    ผู้ป่วยที่ยังไม่เคยสั่งมื้อต้นทางถูกตัดออกตั้งแต่ตอนสร้างรายการ
                    ที่เหลือมาโผล่ตรงนี้คือเทียบชื่อเมนูกับทะเบียนอาหารไม่ตรง ต้องสั่งเองทีละราย
                  */}
                  {unknown.length > 0 && (
                    <p className="text-xs text-red-600 mt-1 mb-0">
                      ⚠ ข้าม {unknown.length} รายการที่เทียบเมนูในระบบไม่ได้ ต้องเลือกประเภทอาหารให้ใหม่เอง
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>

      </div>
    </div>
  );
}