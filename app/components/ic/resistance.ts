/*
  สีของกลุ่มการดื้อยา ใช้ร่วมกันทุกหน้าในงาน IC

  ไล่ตามความเร่งด่วนทางระบาดวิทยา ไม่ใช่ตามลำดับตัวอักษร
  กลุ่มดื้อ carbapenem กับ VRE ต้องแยกผู้ป่วยทันที จึงใช้โทนแดง

  อยู่ในไฟล์กลางเพราะสีเหล่านี้สื่อความหมายทางคลินิก ไม่ใช่แค่ความสวยงาม
  ถ้าแยกกันนิยามในแต่ละหน้า วันหนึ่งสีของ CRE ในสองหน้าจะไม่ตรงกัน
  แล้วคนอ่านจะตีความผิดโดยไม่มีอะไรเตือน
*/
export const RESISTANCE_COLOR: { match: RegExp; color: string }[] = [
    { match: /CRE/, color: 'red' },
    { match: /CRAB/, color: 'volcano' },
    { match: /CRPA/, color: 'orange' },
    { match: /VRE/, color: 'magenta' },
    { match: /MRSA/, color: 'purple' },
    { match: /MRCONS|MRSE/, color: 'geekblue' },
    { match: /ESCR/, color: 'gold' },
    { match: /MDR/, color: 'cyan' },
];

export const colorOfResistance = (value: string) =>
    RESISTANCE_COLOR.find(r => r.match.test(value))?.color ?? 'default';
