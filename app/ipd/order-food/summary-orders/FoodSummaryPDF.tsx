import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Sarabun/Sarabun-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Sarabun/Sarabun-SemiBold.ttf', fontWeight: 600 },
  ],
});

const C = {
  primary: '#006b5f',
  primaryDark: '#005a50',
  headerBg: '#006b5f',
  rowEven: '#f0faf8',
  border: '#d1e8e5',
  text: '#1a1a1a',
  muted: '#6b7280',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 10,
    color: C.text,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },
  // --- Header ---
  headerBox: {
    backgroundColor: C.headerBg,
    borderRadius: 6,
    padding: '12 16',
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#b2dfdb',
    fontSize: 9,
    marginTop: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerRightText: {
    color: C.white,
    fontSize: 10,
    fontWeight: 600,
  },
  headerRightMuted: {
    color: '#b2dfdb',
    fontSize: 9,
    marginTop: 2,
  },

  // --- Section label ---
  sectionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.primary,
    marginBottom: 5,
    marginTop: 5,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    paddingLeft: 6,
  },

  // --- Table ---
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRowEven: {
    backgroundColor: C.rowEven,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowTotal: {
    backgroundColor: '#e0f2ef',
  },
  tableHeader: {
    backgroundColor: C.headerBg,
    flexDirection: 'row',
  },
  thCell: {
    color: C.white,
    fontWeight: 'bold',
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tdCell: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  tdBold: {
    fontWeight: 'bold',
  },
  tdMuted: {
    color: C.muted,
  },
  tdGreen: {
    color: C.primary,
    fontWeight: 600,
  },
  centerText: { textAlign: 'center' },
  rightText: { textAlign: 'right' },

  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: C.muted,
  },
  pageNum: {
    fontSize: 8,
    color: C.muted,
  },
});

// --- Column width helpers ---
const COL_SUMMARY = { no: '6%', name: '60%', count: '17%', total: '17%' };
const COL_PATIENT = { no: '6%', an: '16%', name: '28%', bed: '10%', food: '28%', addon: '12%' };

// --- Helpers ---
function parseFoodCategory(foodName: string): 'premium' | 'special' | 'normal' {
  const upper = foodName.toUpperCase();
  if (upper.includes('[PREMIUM]')) return 'premium';
  if (upper.includes('[อาหารพิเศษ]') || upper.includes('พิเศษ')) return 'special';
  return 'normal';
}

function baseFoodName(foodName: string): string {
  return foodName.replace(/\[(.*?)\]/g, '').trim();
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

interface SummaryRow {
  name: string;
  normal: number;
  special: number;
  premium: number;
}

function buildSummary(data: FoodOrderAddon[]): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const d of data) {
    const base = baseFoodName(d.food_name);
    const cat = parseFoodCategory(d.food_name);
    if (!map.has(base)) map.set(base, { name: base, normal: 0, special: 0, premium: 0 });
    const row = map.get(base)!;
    row[cat] += 1;
  }
  return Array.from(map.values());
}

interface Props {
  data: FoodOrderAddon[];
  wardName: string;
  dateLabel: string;
  mealLabel: string;
  printedAt: string;
}

export default function FoodSummaryPDF({ data, wardName, dateLabel, mealLabel, printedAt }: Props) {
  const summary = buildSummary(data);
  const nonNPO = data.filter(d => !d.food_name.toUpperCase().includes('NPO'));
  const totalNormal = summary.filter(r => !r.name.toUpperCase().includes('NPO')).reduce((s, r) => s + r.normal, 0);
  const totalSpecial = summary.filter(r => !r.name.toUpperCase().includes('NPO')).reduce((s, r) => s + r.special, 0);
  const totalPremium = summary.filter(r => !r.name.toUpperCase().includes('NPO')).reduce((s, r) => s + r.premium, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.headerBox}>
          <View>
            <Text style={styles.headerTitle}>ใบสรุปรายการอาหารผู้ป่วย โรงพยาบาลพะเยา</Text>
            <Text style={styles.headerSub}>หอผู้ป่วย: {wardName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightText}>{mealLabel}</Text>
            <Text style={styles.headerRightText}>วันที่ {dateLabel}</Text>
            <Text style={styles.headerRightMuted}>ทั้งหมด {data.length} รายการ</Text>
          </View>
        </View>

        {/* Section 1: Summary */}
        <Text style={styles.sectionLabel}>รายการอาหารที่สั่ง</Text>
        <View style={styles.table}>
          {/* head */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: COL_SUMMARY.no, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.thCell, { width: COL_SUMMARY.name }]}>ชื่อรายการอาหาร</Text>
            <Text style={[styles.thCell, { width: COL_SUMMARY.count, textAlign: 'center' }]}>อาหารสามัญ</Text>
            <Text style={[styles.thCell, { width: COL_SUMMARY.count, textAlign: 'center' }]}>อาหารพิเศษ</Text>
            <Text style={[styles.thCell, { width: COL_SUMMARY.total, textAlign: 'center' }]}>VIP</Text>
          </View>
          {summary.map((row, i) => (
            <View
              key={i}
              style={[
                styles.tableRow,
                i % 2 === 1 ? styles.tableRowEven : {},
                i === summary.length - 1 ? styles.tableRowLast : {},
              ]}
            >
              <Text style={[styles.tdCell, styles.tdMuted, styles.centerText, { width: COL_SUMMARY.no }]}>{i + 1}</Text>
              <Text style={[styles.tdCell, { width: COL_SUMMARY.name }]}>{row.name}</Text>
              <Text style={[styles.tdCell, styles.centerText, { width: COL_SUMMARY.count }]}>{row.normal || '-'}</Text>
              <Text style={[styles.tdCell, styles.centerText, { width: COL_SUMMARY.count }]}>{row.special || '-'}</Text>
              <Text style={[styles.tdCell, styles.centerText, { width: COL_SUMMARY.total }]}>{row.premium || '-'}</Text>
            </View>
          ))}
          {/* Total row */}
          <View style={[styles.tableRow, styles.tableRowTotal, styles.tableRowLast]}>
            <Text style={[styles.tdCell, { width: COL_SUMMARY.no }]}></Text>
            <Text style={[styles.tdCell, styles.tdBold, { width: COL_SUMMARY.name }]}>รวม (ไม่นับ NPO)</Text>
            <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_SUMMARY.count }]}>{totalNormal}</Text>
            <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_SUMMARY.count }]}>{totalSpecial}</Text>
            <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_SUMMARY.total }]}>{totalPremium}</Text>
          </View>
        </View>

        {/* Section 2: Patient list */}
        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>ผู้รับรายการ</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: COL_PATIENT.no, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.thCell, { width: COL_PATIENT.name }]}>ชื่อผู้ป่วย</Text>
            <Text style={[styles.thCell, { width: COL_PATIENT.bed, textAlign: 'center' }]}>เตียง</Text>
            <Text style={[styles.thCell, { width: COL_PATIENT.food }]}>อาหาร</Text>
            <Text style={[styles.thCell, { width: COL_PATIENT.addon }]}>รายการเพิ่มเติม</Text>
          </View>
          {data.map((p, i) => (
            <View
              key={p.food_order_id}
              style={[
                styles.tableRow,
                i % 2 === 1 ? styles.tableRowEven : {},
                i === data.length - 1 ? styles.tableRowLast : {},
              ]}
            >
              <Text style={[styles.tdCell, styles.tdMuted, styles.centerText, { width: COL_PATIENT.no }]}>{i + 1}</Text>
              <Text style={[styles.tdCell, styles.tdGreen, { width: COL_PATIENT.name }]}>{p.patient_name}</Text>
              <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_PATIENT.bed }]}>{p.bedno}</Text>
              <Text style={[styles.tdCell, { width: COL_PATIENT.food }]}>{p.food_name}</Text>
              <Text style={[styles.tdCell, styles.tdMuted, { width: COL_PATIENT.addon }]}>{p.addon || '-'}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>พิมพ์เมื่อ: {printedAt}</Text>
          <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
