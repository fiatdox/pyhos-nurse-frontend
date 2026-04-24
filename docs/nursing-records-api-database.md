# Nursing Records - API & Database Design

## Overview

ระบบบันทึกทางการพยาบาล 17 โมดูล สำหรับผู้ป่วยใน (IPD)
ทุกตารางมี `an` (Admission Number) และข้อมูล ward/staff เพื่อระบุที่มาของข้อมูล

---

## Common Fields (ทุกตารางต้องมี)

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK AUTO_INCREMENT | Primary key |
| `an` | VARCHAR(20) NOT NULL INDEX | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL INDEX | รหัสตึก/หอผู้ป่วย |
| `ward_name` | VARCHAR(100) | ชื่อตึก/หอผู้ป่วย |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาลผู้บันทึก |
| `nurse_name` | VARCHAR(100) NOT NULL | ชื่อพยาบาลผู้บันทึก |
| `created_at` | DATETIME DEFAULT NOW() | วันที่สร้าง |
| `updated_at` | DATETIME ON UPDATE NOW() | วันที่แก้ไขล่าสุด |
| `created_by` | VARCHAR(20) | ผู้สร้าง (staff_id) |
| `updated_by` | VARCHAR(20) | ผู้แก้ไขล่าสุด (staff_id) |
| `is_deleted` | TINYINT(1) DEFAULT 0 | Soft delete flag |

---

## 1. การบันทึกการรับผู้ป่วย (Admit Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/admit/:an` | ดึงข้อมูลการรับผู้ป่วย |
| POST | `/api/v1/nursing-records/admit` | บันทึกการรับผู้ป่วยใหม่ |
| PUT | `/api/v1/nursing-records/admit/:id` | แก้ไขข้อมูลการรับผู้ป่วย |

### Table: `nursing_admit_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `admit_from` | ENUM('ER','OPD','OR','ICU','WARD','REFER') | รับจาก |
| `admit_method` | ENUM('walk','wheelchair','stretcher','ambulance') | วิธีการรับ |
| `admit_reason` | VARCHAR(500) | เหตุผลการรับ |
| `chief_complaint` | TEXT | อาการสำคัญ |
| `present_illness` | TEXT | ประวัติการเจ็บป่วยปัจจุบัน |
| `past_illness` | TEXT | ประวัติการเจ็บป่วยในอดีต |
| `allergies` | VARCHAR(500) | ประวัติแพ้ยา/อาหาร |
| `current_medications` | VARCHAR(500) | ยาที่ใช้ประจำ |
| `general_appearance` | ENUM('good','fair','poor','critical') | สภาพทั่วไป |
| `skin_condition` | ENUM('normal','dry','edema','wound','rash','jaundice') | สภาพผิวหนัง |
| `mobility` | ENUM('independent','assist','bedridden','wheelchair') | การเคลื่อนไหว |
| `communication` | ENUM('normal','difficulty','unable','interpreter') | การสื่อสาร |
| `religion` | ENUM('buddhism','islam','christianity','other') | ศาสนา |
| `occupation` | VARCHAR(100) | อาชีพ |
| `vital_t` | DECIMAL(4,1) | อุณหภูมิ (°C) |
| `vital_p` | INT | ชีพจร (bpm) |
| `vital_r` | INT | อัตราการหายใจ |
| `vital_bp` | VARCHAR(10) | ความดันโลหิต (e.g. 120/80) |
| `vital_o2sat` | INT | Oxygen Saturation (%) |
| `consciousness` | ENUM('alert','drowsy','stupor','coma') | ระดับความรู้สึกตัว |
| `pain_score` | TINYINT | คะแนนความปวด (0-10) |
| `nutrition_screening` | ENUM('normal','risk','malnutrition') | คัดกรองโภชนาการ |
| `weight` | DECIMAL(5,1) | น้ำหนัก (kg) |
| `height` | DECIMAL(5,1) | ส่วนสูง (cm) |
| `bmi` | DECIMAL(4,1) | BMI |
| `diagnosis_summary` | TEXT | สรุปการวินิจฉัย |
| `treatment_summary` | TEXT | สรุปแผนการรักษา |
| `caregiver_name` | VARCHAR(100) | ชื่อผู้ดูแล |
| `caregiver_relation` | VARCHAR(50) | ความสัมพันธ์กับผู้ป่วย |
| `caregiver_phone` | VARCHAR(20) | เบอร์โทรผู้ดูแล |
| `nursing_diagnosis` | TEXT | ข้อวินิจฉัยทางการพยาบาล |
| `nursing_plan` | TEXT | แผนการพยาบาล |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 2. แบบบันทึกสัญญาณชีพ (Vital Signs Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/vital/:an` | ดึงข้อมูลสัญญาณชีพทั้งหมด |
| POST | `/api/v1/nursing-records/vital` | บันทึกสัญญาณชีพ |
| DELETE | `/api/v1/nursing-records/vital/:id` | ลบรายการ |

### Table: `nursing_vital_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่วัด |
| `vital_t` | DECIMAL(4,1) | อุณหภูมิ (°C) |
| `vital_p` | INT | ชีพจร (bpm) |
| `vital_r` | INT | อัตราการหายใจ |
| `vital_bp_s` | INT | Systolic BP |
| `vital_bp_d` | INT | Diastolic BP |
| `vital_o2sat` | INT | O2 Saturation (%) |
| `pain_score` | TINYINT | คะแนนความปวด (0-10) |
| `consciousness` | ENUM('Alert','Drowsy','Stupor','Coma') | ระดับความรู้สึกตัว |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 3. บันทึกทางการพยาบาล (Nursing Progress Notes)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/nursing/:an` | ดึงบันทึกทั้งหมด |
| POST | `/api/v1/nursing-records/nursing` | สร้างบันทึกใหม่ |
| PUT | `/api/v1/nursing-records/nursing/:id` | แก้ไขบันทึก |
| DELETE | `/api/v1/nursing-records/nursing/:id` | ลบบันทึก |

### Table: `nursing_progress_notes`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `focus` | VARCHAR(200) | จุดเน้น/ปัญหา |
| `note_type` | VARCHAR(10) DEFAULT 'DAR' | รูปแบบบันทึก |
| `subjective` | TEXT | S - ข้อมูลจากผู้ป่วย |
| `objective` | TEXT | O - สิ่งที่ตรวจพบ |
| `assessment` | TEXT | A - การประเมิน |
| `intervention` | TEXT | I - การพยาบาลที่ให้ |
| `plan` | TEXT | P - แผนการดูแล |
| `evaluation` | TEXT | E - การตอบสนอง/ผลลัพธ์ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 4. แผนการพยาบาล (Nursing Care Plan)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/careplan/:an` | ดึงแผนการพยาบาลทั้งหมด |
| POST | `/api/v1/nursing-records/careplan` | สร้างแผนใหม่ |
| PUT | `/api/v1/nursing-records/careplan/:id` | แก้ไขแผน |
| DELETE | `/api/v1/nursing-records/careplan/:id` | ลบแผน |

### Table: `nursing_care_plans`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `start_date` | DATE NOT NULL | วันที่เริ่มแผน |
| `priority` | ENUM('high','medium','low') NOT NULL | ลำดับความสำคัญ |
| `nursing_diagnosis` | VARCHAR(500) NOT NULL | ข้อวินิจฉัยทางการพยาบาล |
| `related_to` | TEXT | สาเหตุ/ปัจจัยที่เกี่ยวข้อง |
| `goal` | TEXT | เป้าหมาย |
| `expected_outcome` | TEXT | ผลลัพธ์ที่คาดหวัง |
| `interventions` | TEXT | กิจกรรมการพยาบาล |
| `evaluation` | TEXT | การประเมินผล |
| `evaluation_date` | DATE | วันที่ประเมินผล |
| `status` | ENUM('active','resolved','revised') DEFAULT 'active' | สถานะ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 5. บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/io/:an` | ดึงข้อมูล I/O ทั้งหมด |
| POST | `/api/v1/nursing-records/io` | บันทึก I/O ใหม่ |
| DELETE | `/api/v1/nursing-records/io/:id` | ลบรายการ |

### Table: `nursing_io_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `io_type` | ENUM('intake','output') NOT NULL | ประเภท (รับเข้า/ขับออก) |
| `category` | VARCHAR(50) NOT NULL | หมวดหมู่ |
| `item_name` | VARCHAR(200) | ชื่อรายการ |
| `amount` | DECIMAL(10,1) NOT NULL | ปริมาณ |
| `unit` | ENUM('ml','L','unit','bag') DEFAULT 'ml' | หน่วย |
| `route` | ENUM('IV','Oral','NG','SC') | เส้นทาง (สำหรับ intake) |
| `note` | VARCHAR(500) | หมายเหตุ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Category Options:**
- **Intake:** `IV Fluid`, `Oral`, `Blood`, `NG`, `Other Intake`
- **Output:** `Urine`, `Drain`, `Vomit`, `Stool`, `Blood Loss`, `NG Aspirate`, `Other Output`

---

## 6. บันทึกการให้ยา (Medication Administration Record - MAR)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/mar/orders/:an` | ดึงคำสั่งยา |
| GET | `/api/v1/nursing-records/mar/admins/:an` | ดึงบันทึกการให้ยา |
| POST | `/api/v1/nursing-records/mar/admin` | บันทึกการให้ยา |
| DELETE | `/api/v1/nursing-records/mar/admin/:id` | ลบบันทึก |

### Table: `nursing_medication_orders`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `order_datetime` | DATETIME NOT NULL | วันเวลาสั่งยา |
| `medication_name` | VARCHAR(200) NOT NULL | ชื่อยา (Trade name) |
| `generic_name` | VARCHAR(200) | ชื่อสามัญ |
| `dose` | VARCHAR(50) NOT NULL | ขนาดยา |
| `unit` | VARCHAR(20) | หน่วย |
| `route` | VARCHAR(20) NOT NULL | เส้นทางการให้ยา |
| `frequency` | VARCHAR(50) NOT NULL | ความถี่ |
| `prn` | TINYINT(1) DEFAULT 0 | ให้ยาเมื่อจำเป็น |
| `prn_reason` | VARCHAR(200) | เหตุผล PRN |
| `start_date` | DATE NOT NULL | วันเริ่ม |
| `end_date` | DATE | วันสิ้นสุด |
| `status` | ENUM('active','discontinued','completed') DEFAULT 'active' | สถานะ |
| `doctor_name` | VARCHAR(100) | แพทย์ผู้สั่ง |
| `note` | VARCHAR(500) | หมายเหตุ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

### Table: `nursing_medication_admins`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `order_id` | BIGINT NOT NULL FK | อ้างอิง medication_orders.id |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `admin_datetime` | DATETIME NOT NULL | วันเวลาที่ให้ยา |
| `shift` | ENUM('ดึก','เช้า','บ่าย') | เวร |
| `medication_name` | VARCHAR(200) NOT NULL | ชื่อยา |
| `dose_given` | VARCHAR(50) NOT NULL | ขนาดที่ให้จริง |
| `route` | VARCHAR(20) | เส้นทาง |
| `site` | VARCHAR(50) | ตำแหน่งฉีด |
| `status` | ENUM('given','held','refused','omitted') NOT NULL | สถานะการให้ยา |
| `held_reason` | VARCHAR(500) | เหตุผลที่ hold/refused |
| `note` | VARCHAR(500) | หมายเหตุ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Site Options:** `Lt. hand`, `Rt. hand`, `Lt. arm`, `Rt. arm`, `Lt. deltoid`, `Rt. deltoid`, `Abdomen`, `Lt. thigh`, `Rt. thigh`, `Buttock`

---

## 7. บันทึกการดูแลพิเศษ (Special Care Records)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/special/:an` | ดึงบันทึกทั้งหมด |
| POST | `/api/v1/nursing-records/special` | บันทึกใหม่ |
| PUT | `/api/v1/nursing-records/special/:id` | แก้ไข |
| DELETE | `/api/v1/nursing-records/special/:id` | ลบ |

### Table: `nursing_special_care_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `care_type` | VARCHAR(50) NOT NULL | ประเภทการดูแล |
| `care_detail` | VARCHAR(500) | รายละเอียด |
| `procedure_done` | TEXT | หัตถการที่ทำ |
| `patient_response` | TEXT | การตอบสนองของผู้ป่วย |
| `complications` | VARCHAR(500) | ภาวะแทรกซ้อน |
| `equipment_used` | VARCHAR(500) | อุปกรณ์ที่ใช้ |
| `next_plan` | TEXT | แผนต่อไป |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Care Type Options:** `suction`, `o2therapy`, `ventilator`, `tracheostomy`, `chest_tube`, `cvc`, `ngt`, `foley`, `wound_vac`, `dialysis`, `blood_transfusion`, `isolation`, `cpr`, `other`

---

## 8. บันทึกการศึกษาและให้ความรู้ (Patient Education)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/education/:an` | ดึงบันทึกทั้งหมด |
| POST | `/api/v1/nursing-records/education` | บันทึกใหม่ |
| PUT | `/api/v1/nursing-records/education/:id` | แก้ไข |
| DELETE | `/api/v1/nursing-records/education/:id` | ลบ |

### Table: `nursing_education_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่สอน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `category` | VARCHAR(50) NOT NULL | หมวดหมู่ |
| `topic` | VARCHAR(500) NOT NULL | หัวข้อ |
| `target_audience` | VARCHAR(200) | ผู้รับการสอน (ผู้ป่วย/ญาติ) |
| `teaching_method` | VARCHAR(50) | วิธีการสอน |
| `content_taught` | TEXT | เนื้อหาที่สอน |
| `materials_used` | VARCHAR(500) | สื่อที่ใช้ |
| `learner_response` | TEXT | การตอบสนองของผู้เรียน |
| `understanding_level` | ENUM('excellent','good','fair','poor','unable') | ระดับความเข้าใจ |
| `barriers` | VARCHAR(500) | อุปสรรค |
| `follow_up_plan` | VARCHAR(500) | แผนติดตาม |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Category Options:** `disease`, `medication`, `diet`, `wound_care`, `activity`, `self_care`, `device`, `discharge`, `safety`, `infection`, `other`

**Teaching Method Options:** `verbal`, `demonstration`, `return_demo`, `pamphlet`, `video`, `group`, `other`

---

## 9. บันทึกการส่งเวร (Nursing Handover / SBAR)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/handover/:an` | ดึงบันทึกส่งเวรทั้งหมด |
| POST | `/api/v1/nursing-records/handover` | บันทึกส่งเวรใหม่ |
| PUT | `/api/v1/nursing-records/handover/:id` | แก้ไข |
| DELETE | `/api/v1/nursing-records/handover/:id` | ลบ |

### Table: `nursing_handover_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาลผู้ส่งเวร |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `handover_datetime` | DATETIME NOT NULL | วันเวลาส่งเวร |
| `shift_from` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวรที่ส่ง |
| `shift_to` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวรที่รับ |
| `nurse_from` | VARCHAR(100) NOT NULL | พยาบาลผู้ส่ง |
| `nurse_to` | VARCHAR(100) NOT NULL | พยาบาลผู้รับ |
| `situation` | TEXT | S - สถานการณ์ปัจจุบัน |
| `background` | TEXT | B - ประวัติผู้ป่วย |
| `assessment` | TEXT | A - ผลการประเมิน |
| `recommendation` | TEXT | R - ข้อเสนอแนะ |
| `pending_orders` | TEXT | คำสั่งค้าง |
| `pending_labs` | TEXT | Lab ค้าง |
| `iv_fluid_status` | VARCHAR(500) | สถานะ IV Fluid |
| `diet` | VARCHAR(200) | อาหาร |
| `activity` | VARCHAR(200) | กิจกรรม |
| `safety_concerns` | VARCHAR(500) | ข้อควรระวัง |
| `family_issues` | VARCHAR(500) | ประเด็นครอบครัว |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 10. บันทึกการจำหน่าย (Discharge Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/discharge/:an` | ดึงข้อมูลจำหน่าย |
| POST | `/api/v1/nursing-records/discharge` | บันทึกจำหน่ายใหม่ |
| PUT | `/api/v1/nursing-records/discharge/:id` | แก้ไข |

### Table: `nursing_discharge_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `discharge_datetime` | DATETIME NOT NULL | วันเวลาจำหน่าย |
| `discharge_type` | ENUM('physician_order','against_advice','transfer','death','escape') NOT NULL | ประเภทการจำหน่าย |
| `discharge_condition` | ENUM('improved','recovered','unchanged','worse','death') NOT NULL | สภาพตอนจำหน่าย |
| `vital_t` | DECIMAL(4,1) | อุณหภูมิ |
| `vital_p` | INT | ชีพจร |
| `vital_r` | INT | อัตราหายใจ |
| `vital_bp` | VARCHAR(10) | ความดันโลหิต |
| `vital_o2sat` | INT | O2 Saturation |
| `diagnosis_summary` | TEXT | สรุปการวินิจฉัย |
| `treatment_summary` | TEXT | สรุปการรักษา |
| `procedure_done` | TEXT | หัตถการที่ทำ |
| `medication_instructions` | TEXT | คำแนะนำยา |
| `diet_instructions` | TEXT | คำแนะนำอาหาร |
| `activity_instructions` | TEXT | คำแนะนำกิจกรรม |
| `wound_care_instructions` | TEXT | คำแนะนำดูแลแผล |
| `warning_signs` | TEXT | อาการผิดปกติที่ต้องพบแพทย์ |
| `follow_up_appointment` | VARCHAR(500) | นัดติดตาม |
| `education_completed` | TINYINT(1) DEFAULT 0 | สอนสุขศึกษาแล้ว |
| `medication_provided` | TINYINT(1) DEFAULT 0 | จ่ายยาแล้ว |
| `documents_given` | TINYINT(1) DEFAULT 0 | มอบเอกสารแล้ว |
| `transportation_arranged` | TINYINT(1) DEFAULT 0 | จัดเตรียมรถแล้ว |
| `referral_arranged` | TINYINT(1) DEFAULT 0 | ส่งต่อแล้ว |
| `discharged_with` | ENUM('relative','self','ambulance','refer_team') | กลับไปกับ |
| `caregiver_name` | VARCHAR(100) | ชื่อผู้รับกลับ |
| `caregiver_phone` | VARCHAR(20) | เบอร์โทรผู้รับกลับ |
| `discharge_destination` | VARCHAR(200) | สถานที่กลับไป |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

---

## 11. แบบประเมินความเสี่ยงพลัดตกหกล้ม (Fall Risk - Morse Fall Scale)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/fall-risk/:an` | ดึงผลประเมินทั้งหมด |
| POST | `/api/v1/nursing-records/fall-risk` | บันทึกประเมินใหม่ |
| DELETE | `/api/v1/nursing-records/fall-risk/:id` | ลบรายการ |

### Table: `nursing_fall_risk_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ประเมิน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `history_of_falling` | TINYINT NOT NULL | ประวัติหกล้ม (0=ไม่มี, 25=มี) |
| `secondary_diagnosis` | TINYINT NOT NULL | โรคร่วม (0=ไม่มี, 15=มี) |
| `ambulatory_aid` | TINYINT NOT NULL | อุปกรณ์ช่วยเดิน (0/15/30) |
| `iv_heparin_lock` | TINYINT NOT NULL | IV/Heparin lock (0=ไม่มี, 20=มี) |
| `gait` | TINYINT NOT NULL | การเดิน (0=ปกติ, 10=อ่อนแรง, 20=บกพร่อง) |
| `mental_status` | TINYINT NOT NULL | สภาพจิต (0=รู้ตัว, 15=หลงลืม) |
| `total_score` | INT NOT NULL | คะแนนรวม (0-125) |
| `risk_level` | ENUM('low','moderate','high') NOT NULL | ระดับความเสี่ยง |
| `interventions` | TEXT | มาตรการป้องกัน |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Risk Level Criteria:**
- **Low:** 0-24 คะแนน
- **Moderate:** 25-44 คะแนน
- **High:** >= 45 คะแนน

---

## 12. แบบประเมินแผลกดทับ (Braden Scale)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/braden/:an` | ดึงผลประเมินทั้งหมด |
| POST | `/api/v1/nursing-records/braden` | บันทึกประเมินใหม่ |
| DELETE | `/api/v1/nursing-records/braden/:id` | ลบรายการ |

### Table: `nursing_braden_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ประเมิน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `sensory_perception` | TINYINT NOT NULL | การรับรู้ (1-4) |
| `moisture` | TINYINT NOT NULL | ความชื้น (1-4) |
| `activity` | TINYINT NOT NULL | กิจกรรม (1-4) |
| `mobility` | TINYINT NOT NULL | การเคลื่อนไหว (1-4) |
| `nutrition` | TINYINT NOT NULL | โภชนาการ (1-4) |
| `friction_shear` | TINYINT NOT NULL | แรงเสียดทาน (1-3) |
| `total_score` | INT NOT NULL | คะแนนรวม (6-23) |
| `risk_level` | ENUM('very_high','high','moderate','mild','no_risk') NOT NULL | ระดับความเสี่ยง |
| `interventions` | TEXT | มาตรการป้องกัน |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Risk Level Criteria (คะแนนยิ่งต่ำ = ยิ่งเสี่ยง):**
- **Very High:** <= 9
- **High:** 10-12
- **Moderate:** 13-14
- **Mild:** 15-18
- **No Risk:** 19-23

**Scoring Details:**

| Item | 1 | 2 | 3 | 4 |
|------|---|---|---|---|
| Sensory Perception | จำกัดอย่างมาก | จำกัดมาก | จำกัดเล็กน้อย | ไม่จำกัด |
| Moisture | ชื้นตลอดเวลา | ชื้นมาก | ชื้นเป็นบางครั้ง | แห้ง |
| Activity | นอนติดเตียง | นั่งเก้าอี้ | เดินได้บ้าง | เดินได้ปกติ |
| Mobility | จำกัดสมบูรณ์ | จำกัดมาก | จำกัดเล็กน้อย | ไม่จำกัด |
| Nutrition | แย่มาก | อาจไม่เพียงพอ | เพียงพอ | ดีมาก |
| Friction & Shear | มีปัญหา | อาจมีปัญหา | ไม่มีปัญหา | - |

---

## 13. แบบประเมินความปวด (Pain Assessment)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/pain/:an` | ดึงผลประเมินทั้งหมด |
| POST | `/api/v1/nursing-records/pain` | บันทึกประเมินใหม่ |
| DELETE | `/api/v1/nursing-records/pain/:id` | ลบรายการ |

### Table: `nursing_pain_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ประเมิน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `assessment_tool` | ENUM('NRS','VAS','Wong-Baker','FLACC','BPS') NOT NULL | เครื่องมือประเมิน |
| `pain_score` | TINYINT NOT NULL | คะแนนความปวด (0-10) |
| `pain_level` | ENUM('no_pain','mild','moderate','severe','worst') NOT NULL | ระดับความปวด |
| `location` | VARCHAR(100) | ตำแหน่งที่ปวด |
| `character` | VARCHAR(50) | ลักษณะความปวด |
| `onset` | VARCHAR(200) | จุดเริ่มต้น |
| `duration` | VARCHAR(100) | ระยะเวลา |
| `aggravating` | VARCHAR(500) | สิ่งที่ทำให้ปวดมากขึ้น |
| `alleviating` | VARCHAR(500) | สิ่งที่ทำให้ปวดน้อยลง |
| `intervention` | TEXT | การจัดการความปวด |
| `reassess_score` | TINYINT | คะแนนหลังจัดการ (0-10) |
| `reassess_time` | VARCHAR(50) | เวลาที่ประเมินซ้ำ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Pain Level Criteria:**
- **no_pain:** 0
- **mild:** 1-3
- **moderate:** 4-6
- **severe:** 7-9
- **worst:** 10

**Location Options:** `ศีรษะ`, `หน้าอก`, `ท้อง`, `หลัง`, `แขนซ้าย`, `แขนขวา`, `ขาซ้าย`, `ขาขวา`, `ข้อเข่า`, `สะโพก`, `แผลผ่าตัด`, `อื่นๆ`

**Character Options:** `sharp`, `throbbing`, `burning`, `cramping`, `dull`, `stabbing`, `shooting`, `pressure`, `other`

---

## 14. บันทึกการทำแผล (Wound Care Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/wound-care/:an` | ดึงบันทึกทั้งหมด |
| POST | `/api/v1/nursing-records/wound-care` | บันทึกใหม่ |
| PUT | `/api/v1/nursing-records/wound-care/:id` | แก้ไข |
| DELETE | `/api/v1/nursing-records/wound-care/:id` | ลบ |

### Table: `nursing_wound_care_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ทำแผล |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `wound_type` | VARCHAR(50) NOT NULL | ชนิดแผล |
| `wound_location` | VARCHAR(50) NOT NULL | ตำแหน่งแผล |
| `wound_size` | VARCHAR(50) | ขนาดแผล (LxW cm) |
| `wound_stage` | ENUM('Stage I','Stage II','Stage III','Stage IV','Unstageable','DTI') | ระยะแผล (กดทับ) |
| `wound_appearance` | VARCHAR(50) | ลักษณะแผล |
| `exudate_type` | ENUM('Serous','Sanguineous','Serosanguineous','Purulent') | ชนิดสิ่งคัดหลั่ง |
| `exudate_amount` | ENUM('ไม่มี','เล็กน้อย','ปานกลาง','มาก') | ปริมาณสิ่งคัดหลั่ง |
| `surrounding_skin` | VARCHAR(200) | ผิวหนังรอบแผล |
| `odor` | ENUM('ไม่มี','เล็กน้อย','มาก') | กลิ่น |
| `pain_score` | TINYINT | ปวดขณะทำแผล (0-10) |
| `cleansing_solution` | VARCHAR(50) | น้ำยาล้างแผล |
| `dressing_type` | VARCHAR(50) | ชนิดวัสดุปิดแผล |
| `procedure_detail` | TEXT | รายละเอียดการทำแผล |
| `wound_status` | ENUM('improving','stable','worsening','healed') NOT NULL | สถานะแผล |
| `next_dressing` | VARCHAR(100) | กำหนดทำแผลครั้งต่อไป |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Wound Type Options:** `surgical wound`, `pressure ulcer`, `diabetic wound`, `burn`, `laceration`, `abrasion`, `tracheostomy`, `drain site`, `IV site`, `other`

**Wound Location Options:** `head`, `forehead`, `chest`, `abdomen`, `back`, `sacrum`, `hip`, `arms`, `hands`, `legs`, `feet`, `other`

**Wound Appearance Options:** `clean`, `granulation`, `slough`, `necrotic`, `epithelializing`, `infected`, `mixed`

**Cleansing Solution Options:** `NSS`, `Betadine`, `Chlorhexidine`, `H2O2`, `Acetic acid`, `clean water`, `other`

**Dressing Type Options:** `Dry dressing`, `Wet dressing`, `Foam`, `Hydrocolloid`, `Hydrogel`, `Alginate`, `Silver`, `Film`, `Gauze packing`, `VAC`, `other`

---

## 15. บันทึกการผูกยึด (Restraint Record)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/restraint/:an` | ดึงบันทึกทั้งหมด |
| POST | `/api/v1/nursing-records/restraint` | บันทึกใหม่ |
| PUT | `/api/v1/nursing-records/restraint/:id` | แก้ไข |
| DELETE | `/api/v1/nursing-records/restraint/:id` | ลบ |

### Table: `nursing_restraint_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่บันทึก |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `restraint_type` | VARCHAR(50) NOT NULL | ชนิดการผูกยึด |
| `restraint_site` | JSON NOT NULL | ตำแหน่งที่ผูก (array) |
| `indication` | VARCHAR(100) NOT NULL | ข้อบ่งชี้ |
| `physician_order` | TINYINT(1) DEFAULT 0 | คำสั่งแพทย์ |
| `start_time` | DATETIME NOT NULL | เวลาเริ่มผูก |
| `release_time` | DATETIME | เวลาปลด |
| `duration` | VARCHAR(50) | ระยะเวลาปลด |
| `circulation_check` | TINYINT(1) DEFAULT 0 | ตรวจการไหลเวียน |
| `skin_check` | TINYINT(1) DEFAULT 0 | ตรวจผิวหนัง |
| `rom_exercise` | TINYINT(1) DEFAULT 0 | บริหารข้อ |
| `repositioning` | TINYINT(1) DEFAULT 0 | พลิกตะแคง |
| `nutrition_hydration` | TINYINT(1) DEFAULT 0 | อาหาร/น้ำ |
| `toileting` | TINYINT(1) DEFAULT 0 | ขับถ่าย |
| `patient_response` | TEXT | การตอบสนองผู้ป่วย |
| `complications` | TEXT | ภาวะแทรกซ้อน |
| `status` | ENUM('active','released','discontinued') NOT NULL | สถานะ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Restraint Type Options:** `wrist restraint`, `ankle restraint`, `vest/jacket restraint`, `mitt restraint`, `side rails`, `other`

**Restraint Site Options (multi-select):** `ข้อมือซ้าย`, `ข้อมือขวา`, `ข้อเท้าซ้าย`, `ข้อเท้าขวา`, `ลำตัว`, `มือซ้าย`, `มือขวา`, `ทั้ง 4 extremities`

**Indication Options:** `prevent ETT dislodging`, `prevent IV line pulling`, `prevent self-harm`, `prevent harming others`, `agitation/delirium`, `prevent bed falls`, `other`

---

## 16. แบบประเมินระดับความรู้สึกตัว (Glasgow Coma Scale - GCS)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/gcs/:an` | ดึงผลประเมินทั้งหมด |
| POST | `/api/v1/nursing-records/gcs` | บันทึกประเมินใหม่ |
| DELETE | `/api/v1/nursing-records/gcs/:id` | ลบรายการ |

### Table: `nursing_gcs_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ประเมิน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `eye_opening` | TINYINT NOT NULL | E - ลืมตา (1-4) |
| `verbal_response` | TINYINT NOT NULL | V - พูด (1-5) |
| `motor_response` | TINYINT NOT NULL | M - เคลื่อนไหว (1-6) |
| `total_score` | INT NOT NULL | คะแนนรวม (3-15) |
| `level` | ENUM('coma_deep','severe','moderate','mild') NOT NULL | ระดับ |
| `pupil_left` | VARCHAR(20) | ม่านตาซ้าย (1-8mm / pinpoint) |
| `pupil_right` | VARCHAR(20) | ม่านตาขวา (1-8mm / pinpoint) |
| `pupil_reaction_left` | ENUM('brisk','sluggish','fixed') | ปฏิกิริยาม่านตาซ้าย |
| `pupil_reaction_right` | ENUM('brisk','sluggish','fixed') | ปฏิกิริยาม่านตาขวา |
| `additional_notes` | TEXT | หมายเหตุเพิ่มเติม |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**GCS Level Criteria:**
- **Deep Coma:** 3
- **Severe:** 4-8
- **Moderate:** 9-12
- **Mild:** 13-15

**Scoring Details:**

| Score | Eye Opening (E) | Verbal Response (V) | Motor Response (M) |
|-------|-----------------|---------------------|---------------------|
| 1 | ไม่ลืมตา | ไม่มีเสียง | ไม่เคลื่อนไหว |
| 2 | ลืมเมื่อเจ็บ | มีเสียงไม่เป็นคำ | Extensor posturing |
| 3 | ลืมเมื่อเรียก | พูดไม่รู้เรื่อง | Flexor posturing |
| 4 | ลืมเอง | สับสน | Withdrawal |
| 5 | - | พูดรู้เรื่อง | Localizing pain |
| 6 | - | - | ทำตามคำสั่ง |

---

## 17. แบบประเมินสุขภาพจิต/ความวิตกกังวล (Mental Health Assessment)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nursing-records/mental-health/:an` | ดึงผลประเมินทั้งหมด |
| POST | `/api/v1/nursing-records/mental-health` | บันทึกประเมินใหม่ |
| DELETE | `/api/v1/nursing-records/mental-health/:id` | ลบรายการ |

### Table: `nursing_mental_health_records`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT PK | - |
| `an` | VARCHAR(20) NOT NULL | Admission Number |
| `ward_code` | VARCHAR(20) NOT NULL | รหัสตึก |
| `ward_name` | VARCHAR(100) | ชื่อตึก |
| `staff_id` | VARCHAR(20) NOT NULL | รหัสพยาบาล |
| `nurse_name` | VARCHAR(100) | ชื่อพยาบาล |
| `record_datetime` | DATETIME NOT NULL | วันเวลาที่ประเมิน |
| `shift` | ENUM('ดึก','เช้า','บ่าย') NOT NULL | เวร |
| `assessment_tool` | ENUM('ST-5','2Q','9Q') NOT NULL | เครื่องมือประเมิน |
| `q1_score` | TINYINT DEFAULT 0 | คำถามข้อ 1 |
| `q2_score` | TINYINT DEFAULT 0 | คำถามข้อ 2 |
| `q3_score` | TINYINT DEFAULT 0 | คำถามข้อ 3 |
| `q4_score` | TINYINT DEFAULT 0 | คำถามข้อ 4 |
| `q5_score` | TINYINT DEFAULT 0 | คำถามข้อ 5 |
| `q6_score` | TINYINT DEFAULT 0 | คำถามข้อ 6 (9Q only) |
| `q7_score` | TINYINT DEFAULT 0 | คำถามข้อ 7 (9Q only) |
| `q8_score` | TINYINT DEFAULT 0 | คำถามข้อ 8 (9Q only) |
| `q9_score` | TINYINT DEFAULT 0 | คำถามข้อ 9 (9Q only) |
| `total_score` | INT NOT NULL | คะแนนรวม |
| `risk_level` | VARCHAR(30) NOT NULL | ระดับความเสี่ยง |
| `mood` | VARCHAR(50) | อารมณ์ |
| `sleep_pattern` | VARCHAR(200) | รูปแบบการนอน |
| `appetite` | VARCHAR(200) | ความอยากอาหาร |
| `social_interaction` | VARCHAR(200) | ปฏิสัมพันธ์สังคม |
| `interventions` | TEXT | การพยาบาล |
| `referral` | VARCHAR(500) | การส่งต่อ |
| `created_at` | DATETIME | - |
| `updated_at` | DATETIME | - |
| `created_by` | VARCHAR(20) | - |
| `updated_by` | VARCHAR(20) | - |
| `is_deleted` | TINYINT(1) DEFAULT 0 | - |

**Assessment Tool Details:**

### ST-5 (Suicidal Tendency - 5 Questions)
คำถาม (ตอบ ใช่=1, ไม่ใช่=0):
1. นอนไม่หลับ/หลับๆ ตื่นๆ
2. รู้สึกเศร้า หดหู่ ท้อแท้
3. ไม่มีความสุข/เบื่อหน่าย
4. รู้สึกตนเองไร้ค่า
5. คิดทำร้ายตนเอง/อยากตาย

| Risk Level | Score | Description |
|------------|-------|-------------|
| no_risk | 0 | ไม่มีความเสี่ยง |
| low | 1-2 | เสี่ยงต่ำ |
| moderate | 3-4 | เสี่ยงปานกลาง |
| high | 5 | เสี่ยงสูง |

### 2Q (Depression Screening - 2 Questions)
คำถาม (ตอบ ใช่=1, ไม่ใช่=0):
1. ใน 2 สัปดาห์ที่ผ่านมา คุณรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวังหรือไม่?
2. ใน 2 สัปดาห์ที่ผ่านมา คุณรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลินหรือไม่?

| Result | Score | Description |
|--------|-------|-------------|
| negative | 0 | ผลลบ (ปกติ) |
| positive | >= 1 | ผลบวก (ต้องประเมิน 9Q ต่อ) |

### 9Q / PHQ-9 (Patient Health Questionnaire - 9 Questions)
คะแนน: 0=ไม่เลย, 1=มี 1-7 วัน, 2=มีมากกว่า 7 วัน, 3=มีทุกวัน

คำถาม:
1. เบื่อ ไม่สนใจอยากทำอะไร
2. ไม่สบายใจ ซึมเศร้า ท้อแท้
3. หลับยาก หลับๆ ตื่นๆ หลับมากไป
4. เหนื่อยง่าย ไม่ค่อยมีแรง
5. เบื่ออาหาร กินมากไป
6. รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว
7. สมาธิไม่ดี เช่น ดูโทรทัศน์ ฟังวิทยุ ทำงานไม่ได้
8. พูดช้า ทำอะไรช้าลง กระวนกระวาย
9. คิดทำร้ายตัวเอง คิดว่าตายไปจะดีกว่า

| Risk Level | Score | Description |
|------------|-------|-------------|
| no_depression | 0-6 | ไม่มีอาการ |
| mild | 7-12 | อาการเล็กน้อย |
| moderate | 13-18 | อาการปานกลาง |
| severe | 19-27 | อาการรุนแรง |

**Mood Options:** `calm`, `anxious`, `sad`, `angry`, `fearful`, `confused`, `apathetic`, `other`

---

## Request/Response Format

### POST Request Body (ตัวอย่าง)

ทุก POST request ต้องส่ง `an`, `ward_code`, `ward_name`, `staff_id` เสมอ

```json
{
  "an": "6801000001",
  "ward_code": "W01",
  "ward_name": "ตึกอายุรกรรมชาย 1",
  "staff_id": "N001",
  "nurse_name": "พย.สมศรี ดีงาม",
  "record_datetime": "2026-04-21T08:30:00",
  "shift": "เช้า",
  "...": "module-specific fields"
}
```

### GET Response (ตัวอย่าง)

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "an": "6801000001",
      "ward_code": "W01",
      "ward_name": "ตึกอายุรกรรมชาย 1",
      "staff_id": "N001",
      "nurse_name": "พย.สมศรี ดีงาม",
      "record_datetime": "2026-04-21T08:30:00",
      "created_at": "2026-04-21T08:35:00",
      "updated_at": "2026-04-21T08:35:00",
      "...": "module-specific fields"
    }
  ]
}
```

### DELETE Response

```json
{
  "success": true,
  "message": "Record deleted successfully"
}
```

---

## Indexes

ทุกตารางควรมี Index เหล่านี้:

```sql
-- สำหรับทุกตาราง
CREATE INDEX idx_{table}_an ON {table}(an);
CREATE INDEX idx_{table}_ward ON {table}(ward_code);
CREATE INDEX idx_{table}_staff ON {table}(staff_id);
CREATE INDEX idx_{table}_datetime ON {table}(record_datetime);
CREATE INDEX idx_{table}_deleted ON {table}(is_deleted);

-- Composite index สำหรับ query ที่ใช้บ่อย
CREATE INDEX idx_{table}_an_datetime ON {table}(an, record_datetime);
CREATE INDEX idx_{table}_ward_datetime ON {table}(ward_code, record_datetime);
```

---

## Summary Table

| # | Module Key | Table Name | API Base Path | CRUD |
|---|-----------|------------|---------------|------|
| 1 | admit | nursing_admit_records | /nursing-records/admit | CR**U** |
| 2 | vital | nursing_vital_records | /nursing-records/vital | CR**D** |
| 3 | nursing | nursing_progress_notes | /nursing-records/nursing | CRUD |
| 4 | careplan | nursing_care_plans | /nursing-records/careplan | CRUD |
| 5 | io | nursing_io_records | /nursing-records/io | CR**D** |
| 6 | mar | nursing_medication_orders + nursing_medication_admins | /nursing-records/mar | CR**D** |
| 7 | special | nursing_special_care_records | /nursing-records/special | CRUD |
| 8 | education | nursing_education_records | /nursing-records/education | CRUD |
| 9 | handover | nursing_handover_records | /nursing-records/handover | CRUD |
| 10 | discharge | nursing_discharge_records | /nursing-records/discharge | CR**U** |
| 11 | fall-risk | nursing_fall_risk_records | /nursing-records/fall-risk | CR**D** |
| 12 | braden | nursing_braden_records | /nursing-records/braden | CR**D** |
| 13 | pain | nursing_pain_records | /nursing-records/pain | CR**D** |
| 14 | wound-care | nursing_wound_care_records | /nursing-records/wound-care | CRUD |
| 15 | restraint | nursing_restraint_records | /nursing-records/restraint | CRUD |
| 16 | gcs | nursing_gcs_records | /nursing-records/gcs | CR**D** |
| 17 | mental-health | nursing_mental_health_records | /nursing-records/mental-health | CR**D** |

**CRUD Legend:** C=Create, R=Read, U=Update, D=Delete (bold = supported operations)
