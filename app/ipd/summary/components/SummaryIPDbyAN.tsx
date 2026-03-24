"use client";

import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  PDFViewer,
} from '@react-pdf/renderer';

// 1. ลงทะเบียน Font Sarabun
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/sarabun/Sarabun-Regular.ttf' },
    { src: '/fonts/sarabun/Sarabun-Bold.ttf', fontWeight: 'bold' },
  ],
});

// 2. Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Sarabun',
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#006b5f',
  },
  subHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    backgroundColor: '#e9ecef',
    padding: 4,
  },
  text: { fontSize: 10 },
  bold: { fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 4 },
  col4: { width: '25%' },
  col6: { width: '50%' },
  col12: { width: '100%' },
  
  // Table
  table: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#bfbfbf',
    borderTopStyle: 'solid',
    borderLeftWidth: 1,
    borderLeftColor: '#bfbfbf',
    borderLeftStyle: 'solid',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
    borderBottomStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    borderRightStyle: 'solid',
    padding: 4,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCol: {
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
    borderBottomStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    borderRightStyle: 'solid',
    padding: 4,
  },
  w10: { width: '10%' },
  w15: { width: '15%' },
  w20: { width: '20%' },
  w25: { width: '25%' },
  w30: { width: '30%' },
  w40: { width: '40%' },
  w50: { width: '50%' },
  flex1: { flex: 1 },
});

// 3. Mockup Data by AN
export interface PatientData {
  hn: string;
  an: string;
  name: string;
  age: number;
  gender: string;
  rights: string;
  admitDate: string;
  ward: string;
  bed: string;
  diagnosis: string;
  allergies: string;
}

const getMockupPatientData = (an: string): PatientData => {
  if (an === '6999999') {
    return {
      hn: '9999999',
      an: '6999999',
      name: 'นาง สมมติ ทดสอบ',
      age: 60,
      gender: 'หญิง',
      rights: 'จ่ายตรง',
      admitDate: '1 พฤศจิกายน 2566',
      ward: 'ศัลยกรรมหญิง',
      bed: '10',
      diagnosis: 'Appendicitis',
      allergies: 'แพ้ Penicillin',
    };
  }
  return {
    hn: '1234567',
    an: an || '9876543',
    name: 'นาย สมชาย ใจดี',
    age: 45,
    gender: 'ชาย',
    rights: 'บัตรทอง 30 บาท',
    admitDate: '26 ตุลาคม 2566',
    ward: 'อายุรกรรมชาย',
    bed: '01',
    diagnosis: 'Pneumonia',
    allergies: 'ปฏิเสธการแพ้ยาและอาหาร',
  };
};

// 4. Component ส่วนหัวกระดาษที่ใช้ซ้ำทุกหน้า
const PatientHeader = ({ patientData }: { patientData: PatientData }) => (
  <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#ccc', borderBottomStyle: 'solid' }}>
    <View style={styles.row}>
      <Text style={styles.col6}><Text style={styles.bold}>ชื่อ-สกุล: </Text>{patientData.name}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>HN: </Text>{patientData.hn}  <Text style={styles.bold}>AN: </Text>{patientData.an}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>อายุ: </Text>{patientData.age} ปี</Text>
      <Text style={styles.col4}><Text style={styles.bold}>เพศ: </Text>{patientData.gender}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>สิทธิ: </Text>{patientData.rights}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>หอผู้ป่วย: </Text>{patientData.ward}</Text>
      <Text style={styles.col4}><Text style={styles.bold}>เตียง: </Text>{patientData.bed}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>วันที่ Admit: </Text>{patientData.admitDate}</Text>
    </View>
  </View>
);

// ===================== Page 1 =====================
const AdmissionPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>1. การบันทึกการรับผู้ป่วย (Admission Record)</Text>
    <PatientHeader patientData={patientData} />
    
    <Text style={styles.subHeader}>การประเมินแรกรับ (Initial Assessment)</Text>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>อุณหภูมิ (T): </Text>38.5 °C</Text>
      <Text style={styles.col4}><Text style={styles.bold}>ชีพจร (PR): </Text>110 /min</Text>
      <Text style={styles.col4}><Text style={styles.bold}>การหายใจ (RR): </Text>24 /min</Text>
      <Text style={styles.col4}><Text style={styles.bold}>ความดัน (BP): </Text>130/80 mmHg</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>O2 Sat: </Text>95%</Text>
      <Text style={styles.col4}><Text style={styles.bold}>น้ำหนัก: </Text>65 kg</Text>
      <Text style={styles.col4}><Text style={styles.bold}>ส่วนสูง: </Text>170 cm</Text>
      <Text style={styles.col4}><Text style={styles.bold}>BMI: </Text>22.5</Text>
    </View>
    
    <Text style={styles.subHeader}>ประวัติการเจ็บป่วย / การแพ้</Text>
    <Text><Text style={styles.bold}>อาการสำคัญ (CC):</Text> ไข้สูง ไอมีเสมหะ หอบเหนื่อย 3 วันก่อนมา รพ.</Text>
    <Text><Text style={styles.bold}>ประวัติเจ็บป่วยปัจจุบัน (PI):</Text> 3 วันก่อนมีไข้สูง หนาวสั่น ทานยาลดไข้ไม่ดีขึ้น ไอมากขึ้น วันนี้หอบเหนื่อยจึงมา รพ.</Text>
    <Text><Text style={styles.bold}>โรคประจำตัว:</Text> ความดันโลหิตสูง</Text>
    <Text><Text style={styles.bold}>ประวัติแพ้ยา/อาหาร:</Text> {patientData.allergies}</Text>

    <Text style={styles.subHeader}>การประเมินความเสี่ยง</Text>
    <Text>- ความเสี่ยงพลัดตก/หกล้ม (Morse Fall Scale): 45 คะแนน (ปานกลาง)</Text>
    <Text>- ความเสี่ยงแผลกดทับ (Braden Scale): 18 คะแนน (ไม่มีความเสี่ยง)</Text>
  </Page>
);

// ===================== Page 2 =====================
const VitalSignsPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>2. แบบบันทึกสัญญาณชีพ (Vital Signs Record)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วันที่/เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>T (°C)</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>PR (/min)</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>RR (/min)</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>BP (mmHg)</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>O2 Sat</Text></View>
        <View style={[styles.tableColHeader, styles.w30]}><Text>ผู้บันทึก</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66 10:00</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>38.5</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>110</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>24</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>130/80</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>95%</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>พยบ. สมใจ</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66 14:00</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>37.8</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>98</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>20</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>120/75</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>98%</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>พยบ. สมใจ</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 3 =====================
const ProgressNotesPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>3. บันทึกทางการพยาบาล (Nursing Progress Notes)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วัน/เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.flex1]}><Text>Focus Charting / SOAPIE</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}>
          <Text>26/10/66</Text>
          <Text>10:00 น.</Text>
        </View>
        <View style={[styles.tableCol, styles.flex1]}>
          <Text style={styles.bold}>Focus: หอบเหนื่อย มีไข้</Text>
          <Text><Text style={styles.bold}>D (Data):</Text> ผู้ป่วยบ่นเหนื่อย หายใจเร็ว 24 ครั้ง/นาที, O2 Sat 95% (Room air), มีไข้ 38.5 °C ไอมีเสมหะเหลืองขุ่น</Text>
          <Text><Text style={styles.bold}>A (Action):</Text> 1. ดูแลให้ O2 cannula 3 LPM ตามแผนการรักษา 2. จัดท่านอนศีรษะสูง 3. เช็ดตัวลดไข้ 4. ให้ยา Paracetamol (500) 1 tab oral</Text>
          <Text><Text style={styles.bold}>R (Response):</Text> 11:00 น. ผู้ป่วยบอกว่าเหนื่อยน้อยลง หายใจ 20 ครั้ง/นาที O2 Sat 98% (O2 cannula 3 LPM) ไข้ลดลงเหลือ 37.5 °C</Text>
        </View>
      </View>
    </View>
  </Page>
);

// ===================== Page 4 =====================
const CarePlanPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>4. แผนการพยาบาล (Nursing Care Plan)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w25]}><Text>ข้อวินิจฉัยทางการพยาบาล</Text></View>
        <View style={[styles.tableColHeader, styles.w25]}><Text>เป้าหมาย</Text></View>
        <View style={[styles.tableColHeader, styles.w25]}><Text>กิจกรรมการพยาบาล</Text></View>
        <View style={[styles.tableColHeader, styles.w25]}><Text>การประเมินผล</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w25]}>
          <Text>เสี่ยงต่อภาวะพร่องออกซิเจนเนื่องจากประสิทธิภาพการแลกเปลี่ยนก๊าซลดลง</Text>
        </View>
        <View style={[styles.tableCol, styles.w25]}>
          <Text>ผู้ป่วยไม่มีภาวะพร่องออกซิเจน (O2 Sat `{'>'}` 95%, หายใจไม่หอบ 16-20 ครั้ง/นาที)</Text>
        </View>
        <View style={[styles.tableCol, styles.w25]}>
          <Text>1. ประเมิน V/S และ O2 Sat ทุก 4 ชม.</Text>
          <Text>2. ดูแลให้ O2 ตามแผนการรักษา</Text>
          <Text>3. สอนการไออย่างถูกวิธี</Text>
        </View>
        <View style={[styles.tableCol, styles.w25]}>
          <Text>27/10/66: ผู้ป่วยหายใจ 20 ครั้ง/นาที O2 sat 98% ไอบรรเทาลง</Text>
        </View>
      </View>
    </View>
  </Page>
);

// ===================== Page 5 =====================
const IORecordPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>5. บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.w30]}><Text>Intake (รับเข้า)</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>ปริมาณ (ml)</Text></View>
        <View style={[styles.tableColHeader, styles.w30]}><Text>Output (ขับออก)</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>ปริมาณ (ml)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>12:00</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>น้ำดื่ม</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>200</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>Urine</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>300</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>16:00</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>IV Fluid (5%D/N/2)</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>400</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>-</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>-</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 6 =====================
const MARPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>6. บันทึกการให้ยา (MAR)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w30]}><Text>ชื่อยา / ขนาด / วิธีให้</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>ความถี่</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วันที่</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>เวลา (ลงนามผู้ให้)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w30]}><Text>Ceftriaxone 1g IV</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>OD</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>10:00 (พยบ. สมใจ)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w30]}><Text>Paracetamol (500) 1 tab oral</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>PRN for fever</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>10:30 (พยบ. สมใจ)</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 7 =====================
const SpecialCarePage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>7. บันทึกการดูแลพิเศษ (Special Care Records)</Text>
    <PatientHeader patientData={patientData} />
    
    <Text style={styles.subHeader}>Pain Assessment & Management</Text>
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w20]}><Text>เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>Pain Score</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>การจัดการ (Intervention)</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>ผู้บันทึก</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w20]}><Text>10:00</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>2/10</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>จัดท่าสุขสบาย ไม่ต้องให้ยาแก้ปวด</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>พยบ. สมใจ</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 8 =====================
const EducationPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>8. บันทึกการศึกษาและให้ความรู้ (Patient Education)</Text>
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วันที่</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>เนื้อหาที่ให้ความรู้</Text></View>
        <View style={[styles.tableColHeader, styles.w25]}><Text>การตอบสนอง/ความเข้าใจ</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>ผู้สอน</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>สอนการไออย่างถูกวิธี (Effective Coughing)</Text></View>
        <View style={[styles.tableCol, styles.w25]}><Text>เข้าใจและทำตามได้ถูกต้อง</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>พยบ. สมใจ</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 9 =====================
const HandoverPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>9. บันทึกการส่งเวร (Nursing Handover / SBAR)</Text>
    <PatientHeader patientData={patientData} />
    <Text style={styles.subHeader}>เวรเช้า ส่งต่อ เวรบ่าย (วันที่ 26/10/66)</Text>
    <View style={[styles.table, { borderTopWidth: 0, borderLeftWidth: 0 }]}>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>S (Situation):</Text>
        <Text style={styles.flex1}>ผู้ป่วยชาย 45 ปี Dx. Pneumonia มีไข้ หอบเหนื่อย ได้รับ O2 cannula 3 LPM</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>B (Background):</Text>
        <Text style={styles.flex1}>Admit วันแรก มีโรคประจำตัว HT ปฏิเสธแพ้ยา</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>A (Assessment):</Text>
        <Text style={styles.flex1}>รู้สึกตัวดี V/S ล่าสุด T 37.5, PR 98, RR 20, BP 120/75, O2 Sat 98% ไอมีเสมหะ</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>R (Recommendation):</Text>
        <Text style={styles.flex1}>ติดตามไข้และอาการหอบเหนื่อย, O2 Sat คอยกระตุ้นให้จิบน้ำบ่อยๆ และไอระบายเสมหะ</Text>
      </View>
    </View>
  </Page>
);

// ===================== Page 10 =====================
const DischargePage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.header}>10. บันทึกการจำหน่าย (Discharge Record)</Text>
    <PatientHeader patientData={patientData} />
    
    <Text style={styles.subHeader}>ข้อมูลการจำหน่ายผู้ป่วย</Text>
    <View style={styles.row}>
      <Text style={styles.col6}><Text style={styles.bold}>วันที่จำหน่าย: </Text>29/10/66</Text>
      <Text style={styles.col6}><Text style={styles.bold}>ประเภทการจำหน่าย: </Text>แพทย์อนุญาตให้กลับ (Improved)</Text>
    </View>
    
    <Text style={styles.subHeader}>สภาพผู้ป่วยเมื่อจำหน่าย</Text>
    <Text>ผู้ป่วยรู้สึกตัวดี ไม่มีไข้ หายใจปกติไม่ต้องใช้ O2 ทานอาหารได้ปกติ เดินได้เอง</Text>
    
    <Text style={styles.subHeader}>คำแนะนำการดูแลตนเองที่บ้าน (D-METHOD)</Text>
    <Text><Text style={styles.bold}>D (Disease): </Text>ให้ความรู้เรื่องปอดอักเสบ การป้องกันการติดเชื้อซ้ำ</Text>
    <Text><Text style={styles.bold}>M (Medication): </Text>อธิบายสรรพคุณยาและให้รับประทานยาปฏิชีวนะจนหมด</Text>
    <Text><Text style={styles.bold}>E (Environment): </Text>จัดสิ่งแวดล้อมให้อากาศถ่ายเทสะดวก พักผ่อนให้เพียงพอ</Text>
    
    <Text style={styles.subHeader}>การนัดหมายติดตามอาการ</Text>
    <Text>คลินิกอายุรกรรม วันที่ 5/11/66 เวลา 09:00 น.</Text>
  </Page>
);

// ===================== Main Document =====================
const FullMedicalReport = ({ patientData }: { patientData: PatientData }) => (
  <Document>
    <AdmissionPage patientData={patientData} />
    <VitalSignsPage patientData={patientData} />
    <ProgressNotesPage patientData={patientData} />
    <CarePlanPage patientData={patientData} />
    <IORecordPage patientData={patientData} />
    <MARPage patientData={patientData} />
    <SpecialCarePage patientData={patientData} />
    <EducationPage patientData={patientData} />
    <HandoverPage patientData={patientData} />
    <DischargePage patientData={patientData} />
  </Document>
);

const SummaryIPDbyAN = ({ an }: { an: string }) => {
  const patientData = getMockupPatientData(an);
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
        <FullMedicalReport patientData={patientData} />
      </PDFViewer>
    </div>
  );
};

export default SummaryIPDbyAN;