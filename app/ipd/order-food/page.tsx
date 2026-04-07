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
} from 'antd';
import Swal from 'sweetalert2';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { MdOutlineFastfood } from 'react-icons/md';
import { PiFloppyDiskBold, PiCopyBold, PiUserBold, PiClockBold, PiNotePencilBold, PiPrinterBold } from 'react-icons/pi';

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
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
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

interface FoodOrderRecord {
  admission_list_id: number;
  hn: string;
  an: string;
  patient_name: string;
  bedno: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
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

  // Copy Last Meal Confirmation State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    selectedPatients: PatientFood[];
    meals: { name: string; foodItemId: number }[];
  } | null>(null);

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
          axios.get('/api/v1/wardsV1', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/nutrition-menu', { headers }).catch(() => ({ data: { data: [] } }))
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
      const response = await axios.post('/api/v1/food-orders-by-ward', {
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
          breakfast: p.breakfast,
          lunch: p.lunch,
          dinner: p.dinner,
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

  // สั่งเหมือนมื้อล่าสุด - แสดง Confirmation Dialog
  const handleCopyLastMeal = () => {
    if (selectedRowKeys.length === 0) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาเลือกผู้ป่วยที่ต้องการคัดลอกข้อมูลมื้อล่าสุด', timer: 2000, showConfirmButton: false });
      return;
    }

    const selectedPatients = patients.filter(p => selectedRowKeys.includes(p.key));
    const meals = selectedPatients.map(p => {
      const lastMealName = p.lastMeal || 'อาหารธรรมดา (Normal Diet)';
      const lastMealMenu = foodMenus.find(m => m.food_name === lastMealName);
      return {
        name: lastMealName,
        foodItemId: lastMealMenu?.food_item_id || 0
      };
    });

    setConfirmData({ selectedPatients, meals });
    setIsConfirmOpen(true);
  };

  // ยืนยันการสั่งเหมือนมื้อล่าสุด
  const handleConfirmCopyLastMeal = () => {
    if (!confirmData) return;

    setPatients(prev =>
      prev.map(p => {
        if (selectedRowKeys.includes(p.key)) {
          const mealData = confirmData.meals[selectedRowKeys.indexOf(p.key)];
          return {
            ...p,
            foodType: mealData?.name || 'อาหารธรรมดา (Normal Diet)',
            foodItemId: mealData?.foodItemId || 0,
            foodOrderDate: orderDate.format('YYYY-MM-DD'),
            foodMealTime: mealTime
          };
        }
        return p;
      })
    );

    setIsConfirmOpen(false);
    setConfirmData(null);
    setSelectedRowKeys([]); // เคลียร์การเลือก
    setIsAddonMode(true); // เปลี่ยนไปเป็น addon mode เพื่อแสดงรายการที่สั่ง
    Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'คัดลอกข้อมูลอาหารจากมื้อล่าสุดสำเร็จ - คลิก Addon เพื่อเพิ่มรายละเอียด', timer: 2500, showConfirmButton: false });
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
            request_by: userId,
            addon: p.addonText || ''
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
            request_by: userId,
            addon: p.addonText || ''
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

      const response = await axios.post('/api/v1/order-menu', orderData, { headers });

      if (response.status === 200 || response.status === 201) {
        const mealLabel = mealTime === 'breakfast' ? 'มื้อเช้า' : mealTime === 'lunch' ? 'มื้อกลางวัน' : 'มื้อเย็น';
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: `บันทึกข้อมูล ${mealLabel} วันที่ ${orderDate.format('DD/MM/YYYY')} จำนวน ${orderData.length} รายการ เรียบร้อยแล้ว`, timer: 2500, showConfirmButton: false });
        setSelectedRowKeys([]);
        fetchFoodOrders();
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

  const openHistoryDrawer = (patient: PatientFood) => {
    setSelectedHistoryPatient(patient);
    setIsHistoryDrawerOpen(true);
  };

  const closeHistoryDrawer = () => {
    setIsHistoryDrawerOpen(false);
    setSelectedHistoryPatient(null);
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
          <span className="font-semibold text-[#006b5f]">{text}</span>
        </div>
      )
    },
    {
      title: 'ประวัติมื้อเช้า',
      dataIndex: 'breakfast',
      key: 'breakfast',
      width: 130,
      align: 'center',
      render: (text) => text ? <Tag color="blue" className="w-full truncate">{text.split(' ')[0]}</Tag> : <span className="text-gray-300">-</span>
    },
    {
      title: 'ประวัติมื้อกลางวัน',
      dataIndex: 'lunch',
      key: 'lunch',
      width: 130,
      align: 'center',
      render: (text) => text ? <Tag color="orange" className="w-full truncate">{text.split(' ')[0]}</Tag> : <span className="text-gray-300">-</span>
    },
    {
      title: 'ประวัติมื้อเย็น',
      dataIndex: 'dinner',
      key: 'dinner',
      width: 130,
      align: 'center',
      render: (text) => text ? <Tag color="purple" className="w-full truncate">{text.split(' ')[0]}</Tag> : <span className="text-gray-300">-</span>
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
        <Button size="small" type="link" className="text-[#006b5f] flex items-center justify-center gap-1 mx-auto hover:bg-teal-50" onClick={() => openHistoryDrawer(record)}>
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
      const response = await axios.post('/api/v1/food-orders-addon-by-ward', {
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
      render: (text) => <span className="font-semibold text-[#006b5f]">{text}</span>
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
      const response = await axios.post('/api/v1/update-food-orders-addon', {
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
                <h2 className="text-xl font-bold text-[#006b5f] m-0">ระบบสั่งอาหารผู้ป่วย (Food Order)</h2>
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
                }}
                className={isAddonMode ? "bg-amber-500 hover:bg-amber-400 border-none shadow-md shadow-amber-500/30" : "text-amber-600 border-amber-500 hover:bg-amber-50"}
              >
                {isAddonMode ? "กลับไปหน้าสั่งอาหารปกติ" : "ระบุ Addon เพิ่มเติม"}
              </Button>

              {!isAddonMode && (
                <Button 
                  icon={<PiCopyBold className="text-lg" />} 
                  onClick={handleCopyLastMeal}
                  className="text-[#006b5f] border-[#006b5f] hover:bg-teal-50"
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
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">ประวัติย้อนหลัง 7 วัน</h4>
                <Timeline
                  items={Array.from({ length: 7 }).flatMap((_, dayIdx) => {
                    const dateTime = dayjs().subtract(6 - dayIdx, 'day');
                    const meals = [
                      { time: 'มื้อเช้า', color: 'blue', menu: 'โจก', addon: selectedHistoryPatient?.addonText && dayIdx === 0 ? selectedHistoryPatient.addonText : '' },
                      { time: 'มื้อกลางวัน', color: 'orange', menu: 'ข้าวผัดมี่กลอง', addon: selectedHistoryPatient?.addonText && dayIdx === 0 ? selectedHistoryPatient.addonText : '' },
                      { time: 'มื้อเย็น', color: 'purple', menu: 'ข้าวต้มไก่', addon: selectedHistoryPatient?.addonText && dayIdx === 0 ? selectedHistoryPatient.addonText : '' },
                    ];
                    return meals.map(meal => ({
                      color: meal.color,
                      content: (
                        <div className="mb-3">
                          <span className="font-bold text-gray-700 text-sm">{dateTime.format('DD/MM/YYYY')} - {meal.time}</span>
                          <br/>
                          <span className="text-[#006b5f] text-sm font-semibold">{meal.menu}</span>
                          {meal.addon && (
                            <>
                              <br/>
                              <span className="text-gray-500 text-xs italic">
                                {meal.addon}
                              </span>
                            </>
                          )}
                        </div>
                      )
                    }));
                  })}
                />
              </div>
            </div>
          )}
        </Drawer>

        {/* Copy Last Meal Confirmation Modal */}
        <Modal
          title={<span className="text-lg font-bold text-[#006b5f]">ยืนยันการสั่งเหมือนมื้อล่าสุด</span>}
          open={isConfirmOpen}
          onCancel={() => {
            setIsConfirmOpen(false);
            setConfirmData(null);
          }}
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
              className="bg-[#006b5f] hover:bg-[#005a50]"
              onClick={handleConfirmCopyLastMeal}
            >
              ยืนยัน
            </Button>,
          ]}
        >
          {confirmData && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">ข้อมูลการสั่ง:</p>
                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">📅 วันที่: {orderDate.format('DD/MM/YYYY')}</Tag>
                  <Tag color="orange">🍽️ มื้อ: {mealTime === 'breakfast' ? 'เช้า' : mealTime === 'lunch' ? 'กลางวัน' : 'เย็น'}</Tag>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">รายชื่อผู้ป่วยและอาหารที่จะสั่ง:</p>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">เตียง</th>
                        <th className="px-3 py-2 text-left font-semibold">ชื่อผู้ป่วย</th>
                        <th className="px-3 py-2 text-left font-semibold">อาหารที่จะสั่ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmData.selectedPatients.map((p, idx) => (
                        <tr key={p.key} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold text-gray-700">{p.bed}</td>
                          <td className="px-3 py-2 text-gray-700">{p.name}</td>
                          <td className="px-3 py-2">
                            <Tag color="green">{confirmData.meals[idx]?.name}</Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-xs text-gray-600">
                  ✓ คุณกำลังสั่งอาหารตามมื้อล่าสุดของผู้ป่วย {confirmData.selectedPatients.length} รายการ
                </p>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </div>
  );
}