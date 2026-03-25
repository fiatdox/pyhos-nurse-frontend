'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Select, 
  DatePicker, 
  Radio, 
  Button, 
  message,
  Tag,
  Divider,
  Drawer,
  Timeline,
  Input
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { MdOutlineFastfood } from 'react-icons/md';
import { PiFloppyDiskBold, PiCopyBold, PiUserBold, PiClockBold, PiNotePencilBold } from 'react-icons/pi';

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
  foodType: string | null;
  lastMeal: string | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  addonText?: string; // เพิ่มฟิลด์สำหรับเก็บข้อความ Addon
}

interface Ward {
  ward: string;
  name: string;
}

interface NutritionMenu {
  food_item_id: number;
  food_name: string;
  food_type_id: number | null;
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

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };

        const [wardRes, menuRes] = await Promise.all([
          axios.get('/api/v1/wards', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/nutrition-menu', { headers }).catch(() => ({ data: { data: [] } }))
        ]);

        const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
        setWards(wardList);
        if (wardList.length > 0) {
          setSelectedWard(String(wardList[0].ward));
        }

        const menuList = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data.data || [];
        setFoodMenus(menuList);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // --- Fetch Patients Mock ---
  useEffect(() => {
    if (!selectedWard) {
      setPatients([]);
      return;
    }
    
    // จำลองการสร้างข้อมูลผู้ป่วยตามหอผู้ป่วยที่เลือก
    const currentWard = wards.find(w => String(w.ward) === String(selectedWard));
    const wardName = currentWard ? currentWard.name : `หอผู้ป่วย ${selectedWard}`;
    
    // สร้าง seed จากรหัส ward เพื่อจำลองจำนวนคนไข้ (3 - 8 คน) แบบสุ่มแต่คงที่
    const seed = parseInt(selectedWard, 10) || 1;
    const patientCount = (seed % 6) + 3;

    const mockData: PatientFood[] = Array.from({ length: patientCount }).map((_, idx) => ({
      key: `${selectedWard}-${idx + 1}`,
      hn: `00${selectedWard}1${idx}`,
      an: `6700${selectedWard}${idx}`,
      name: `ผู้ป่วยสมมติ ${idx + 1} (${wardName})`,
      bed: String(idx + 1).padStart(2, '0'),
      wardName: wardName,
      foodType: idx % 2 === 0 ? 'ธรรมดา (สามัญ)' : null, // จำลองให้ผู้ป่วยบางคนถูกสั่งอาหารไว้แล้วเพื่อดูผลในโหมด Addon
      lastMeal: idx % 2 === 0 ? 'อาหารอ่อน (Soft Diet)' : 'อาหารธรรมดา (Normal Diet)',
      breakfast: idx % 2 === 0 ? 'อาหารอ่อน (Soft Diet)' : 'อาหารธรรมดา (Normal Diet)',
      lunch: idx % 3 === 0 ? 'NPO (งดน้ำและอาหาร)' : null,
      dinner: null,
      addonText: idx % 4 === 0 ? 'งดเค็ม' : '', // จำลองให้บางคนมีการพิมพ์ Addon ไว้แล้ว
    }));

    setPatients(mockData);
    setSelectedRowKeys([]); // เคลียร์การเลือกเมื่อเปลี่ยนตึก
    setGlobalFoodType(null); // เคลียร์ประเภทอาหารที่เลือกไว้
    setIsAddonMode(false); // กลับเป็นโหมดปกติเมื่อเปลี่ยนตึก
  }, [selectedWard, wards]);

  // --- Handlers ---
  const handleGlobalFoodTypeChange = (value: string) => {
    setGlobalFoodType(value);
    // เมื่อเลือกประเภทอาหารด้านบน ให้เปลี่ยนค่าในแถวที่ติ๊กเลือกไว้ทั้งหมด
    if (selectedRowKeys.length > 0 && value) {
      setPatients(prev => 
        prev.map(p => selectedRowKeys.includes(p.key) ? { ...p, foodType: value } : p)
      );
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    // ถ้าเลือกคนเพิ่ม และมีการเลือกประเภทอาหารด้านบนไว้แล้ว ให้ใส่ค่าประเภทอาหารอัตโนมัติ
    if (globalFoodType) {
      const newlySelected = newSelectedRowKeys.filter(k => !selectedRowKeys.includes(k));
      if (newlySelected.length > 0) {
        setPatients(prev => 
          prev.map(p => newlySelected.includes(p.key) && !p.foodType ? { ...p, foodType: globalFoodType } : p)
        );
      }
    }
  };

  // สั่งเหมือนมื้อล่าสุด
  const handleCopyLastMeal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('กรุณาเลือกผู้ป่วยที่ต้องการคัดลอกข้อมูลมื้อล่าสุด');
      return;
    }
    
    setPatients(prev => 
      prev.map(p => {
        if (selectedRowKeys.includes(p.key)) {
          return { ...p, foodType: p.lastMeal || 'อาหารธรรมดา (Normal Diet)' };
        }
        return p;
      })
    );
    message.success('คัดลอกข้อมูลอาหารจากมื้อล่าสุดสำเร็จ (สำหรับผู้ป่วยที่เลือก)');
  };

  const handleAddonChange = (key: string, value: string) => {
    setPatients(prev => prev.map(p => p.key === key ? { ...p, addonText: value } : p));
  };

  // บันทึกข้อมูล
  const handleSave = () => {
    if (!isAddonMode && selectedRowKeys.length === 0) {
      message.warning('กรุณาเลือกผู้ป่วยที่ต้องการสั่งอาหาร');
      return;
    }

    if (!isAddonMode) {
      // Validate เฉพาะตอนอยู่โหมดสั่งอาหารปกติ
      const selectedPatients = patients.filter(p => selectedRowKeys.includes(p.key));
      const invalidPatients = selectedPatients.filter(p => !p.foodType);

      if (invalidPatients.length > 0) {
        message.error(`กรุณาระบุ "ประเภทอาหาร" ด้านบนก่อน หรือใช้ปุ่มสั่งเหมือนมื้อล่าสุด`);
        return;
      }
    }

    const mealLabel = mealTime === 'breakfast' ? 'มื้อเช้า' : mealTime === 'lunch' ? 'มื้อกลางวัน' : 'มื้อเย็น';
    
    const count = isAddonMode ? patients.filter(p => p.addonText).length : selectedRowKeys.length;
    message.success(`บันทึกข้อมูล ${mealLabel} วันที่ ${orderDate.format('DD/MM/YYYY')} จำนวน ${count} รายการ เรียบร้อยแล้ว`);
    
    // จำลองการ Reset Checkbox หลังบันทึกสำเร็จ
    setSelectedRowKeys([]);
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

  // --- Table Columns (Addon Mode) ---
  const addonColumns: ColumnsType<PatientFood> = [
    { 
      title: 'เตียง', 
      dataIndex: 'bed', 
      key: 'bed', 
      width: 70, 
      align: 'center',
      render: (text) => <span className="font-bold text-gray-700">{text}</span>
    },
    { 
      title: 'AN', 
      dataIndex: 'an',
      key: 'an', 
      width: 100,
      render: (text) => <span className="text-gray-600">{text}</span>
    },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'name', 
      key: 'name',
      width: 200,
      render: (text) => <span className="font-semibold text-[#006b5f]">{text}</span>
    },
    {
      title: 'ชื่ออาหาร (ที่สั่ง)',
      dataIndex: 'foodType',
      key: 'foodType',
      width: 180,
      render: (text) => text ? <Tag color="green" className="whitespace-normal h-auto py-0.5">{text}</Tag> : <span className="text-red-400 text-xs italic">ยังไม่ได้สั่งอาหาร</span>
    },
    {
      title: 'วันที่ / มื้อ',
      key: 'date_meal',
      width: 140,
      render: () => {
        const mealTh = mealTime === 'breakfast' ? 'เช้า' : mealTime === 'lunch' ? 'กลางวัน' : 'เย็น';
        return <span className="text-xs text-gray-500">{orderDate.format('DD/MM/YY')} <Tag color="default" className="ml-1 m-0">{mealTh}</Tag></span>;
      }
    },
    {
      title: 'รายการเพิ่มเติมในรายการอาหาร (Addon)',
      key: 'addon',
      render: (_, record) => (
        <Input placeholder="ระบุคำเพิ่มเติม เช่น ไม่ใส่ผัก, งดเค็ม..." value={record.addonText} onChange={(e) => handleAddonChange(record.key, e.target.value)} />
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
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
                options={wards.map(w => ({ label: w.name, value: String(w.ward) }))}
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
                {isAddonMode ? patients.filter(p => p.foodType).length : patients.length} เตียง
              </Tag>
              {!isAddonMode && selectedRowKeys.length > 0 && (
                <Tag color="blue" className="rounded-full px-3 text-sm">เลือกแล้ว {selectedRowKeys.length} รายการ</Tag>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type={isAddonMode ? "primary" : "default"}
                icon={<PiNotePencilBold className="text-lg" />}
                onClick={() => setIsAddonMode(!isAddonMode)}
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
                type="primary" 
                icon={<PiFloppyDiskBold className="text-lg" />}
                onClick={handleSave}
                className="bg-[#006b5f] hover:bg-[#005a50] shadow-lg shadow-teal-900/20"
              >
                บันทึกรายการ
              </Button>
            </div>
          </div>

          {/* Data Table */}
          <Table
            rowSelection={isAddonMode ? undefined : rowSelection}
            columns={isAddonMode ? addonColumns : columns}
            dataSource={isAddonMode ? patients.filter(p => p.foodType) : patients}
            pagination={false}
            size="middle"
            bordered
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />

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
                <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">ประวัติย้อนหลัง 3 วัน</h4>
                <Timeline
                  items={[
                    { color: 'purple', content: <div className="mb-4"><span className="font-bold text-gray-700">เมื่อวาน - มื้อเย็น</span><br/><span className="text-[#006b5f]">{selectedHistoryPatient.lastMeal}</span></div> },
                    { color: 'orange', content: <div className="mb-4"><span className="font-bold text-gray-700">เมื่อวาน - มื้อกลางวัน</span><br/><span className="text-[#006b5f]">อาหารอ่อน (Soft Diet)</span></div> },
                    { color: 'blue',   content: <div className="mb-4"><span className="font-bold text-gray-700">เมื่อวาน - มื้อเช้า</span><br/><span className="text-[#006b5f]">อาหารอ่อน (Soft Diet)</span></div> },
                    { color: 'purple', content: <div className="mb-4"><span className="font-bold text-gray-700">{dayjs().subtract(2, 'day').format('DD/MM/YYYY')} - มื้อเย็น</span><br/><span className="text-[#006b5f]">อาหารธรรมดา (Normal Diet)</span></div> },
                    { color: 'orange', content: <div className="mb-4"><span className="font-bold text-gray-700">{dayjs().subtract(2, 'day').format('DD/MM/YYYY')} - มื้อกลางวัน</span><br/><span className="text-[#006b5f]">อาหารธรรมดา (Normal Diet)</span></div> },
                    { color: 'blue',   content: <div className="mb-4"><span className="font-bold text-gray-700">{dayjs().subtract(2, 'day').format('DD/MM/YYYY')} - มื้อเช้า</span><br/><span className="text-[#006b5f]">อาหารธรรมดา (Normal Diet)</span></div> },
                    { color: 'gray',   content: <span className="text-gray-400 italic">สิ้นสุดประวัติ</span> }
                  ]}
                />
              </div>
            </div>
          )}
        </Drawer>

      </div>
    </div>
  );
}