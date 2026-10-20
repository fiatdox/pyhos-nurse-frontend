import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import { formatMoney } from '../../lib/money';

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
    headerBg: '#006b5f',
    groupBg: '#e0f2ef',
    rowEven: '#f0faf8',
    border: '#d1e8e5',
    text: '#1a1a1a',
    muted: '#6b7280',
    white: '#ffffff',
    zero: '#c7cdd3',
    warn: '#b45309',
    warnBg: '#fffbeb',
};

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Sarabun',
        fontSize: 9,
        color: C.text,
        paddingTop: 26,
        paddingBottom: 36,
        paddingHorizontal: 24,
    },
    headerBox: {
        backgroundColor: C.headerBg,
        borderRadius: 6,
        padding: '10 14',
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: { color: C.white, fontSize: 13, fontWeight: 'bold' },
    headerSub: { color: '#b2dfdb', fontSize: 8.5, marginTop: 3 },
    headerRight: { alignItems: 'flex-end' },
    headerRightText: { color: C.white, fontSize: 12, fontWeight: 'bold' },
    headerRightMuted: { color: '#b2dfdb', fontSize: 8.5, marginTop: 2 },

    axisRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
    axisChip: {
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 3,
        paddingVertical: 2,
        paddingHorizontal: 6,
        fontSize: 8,
        color: C.muted,
    },

    table: { borderWidth: 1, borderColor: C.border, borderRadius: 3 },
    headRow: { backgroundColor: C.headerBg, flexDirection: 'row' },
    row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
    rowEven: { backgroundColor: C.rowEven },
    rowTotal: { backgroundColor: C.groupBg },
    th: { color: C.white, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 3, textAlign: 'center' },
    thLeft: { color: C.white, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 4, textAlign: 'left' },
    /* เส้นคั่นกลุ่มบนสุด กันไม่ให้ป้าย "มื้อเช้า" กับ "มื้อกลางวัน" อ่านติดกันเป็นคำเดียว */
    thGroup: {
        color: C.white,
        fontWeight: 'bold',
        paddingVertical: 4,
        textAlign: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#4c948b',
    },
    td: { paddingVertical: 3, paddingHorizontal: 3, textAlign: 'right' },
    tdLabel: { paddingVertical: 3, paddingHorizontal: 4, fontWeight: 600 },
    tdZero: { color: C.zero },
    tdTotal: { fontWeight: 'bold', color: C.primary },
    tdBold: { fontWeight: 'bold' },

    sectionLabel: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: C.primary,
        marginBottom: 4,
        marginTop: 12,
        borderLeftWidth: 3,
        borderLeftColor: C.primary,
        paddingLeft: 6,
    },
    note: { fontSize: 7.5, color: C.muted, marginTop: 4 },
    warnBox: {
        borderWidth: 1,
        borderColor: '#fcd34d',
        backgroundColor: C.warnBg,
        borderRadius: 3,
        padding: '5 8',
        marginTop: 6,
    },
    warnText: { fontSize: 8, color: C.warn },

    footer: {
        position: 'absolute',
        bottom: 18,
        left: 24,
        right: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: C.border,
        paddingTop: 5,
    },
    footerText: { fontSize: 7.5, color: C.muted },
});

export interface PivotPDFCost {
    food_type_id: number;
    food_type_name: string;
    meals: number;
    price_per_day: number | null;
    meals_per_day: number | null;
    contract_note: string | null;
    amount: number | null;
    has_price: boolean;
    /** สั่งแล้วแต่งานโภชนาการยังไม่กดรับ ไม่เข้ายอดเงิน */
    pending_meals: number;
}

export interface PivotPDFProps {
    rangeLabel: string;
    printedAt: string;
    rowLabel: string;
    colLabel: string;
    /** หัวคอลัมน์ที่ผ่านการซ่อนคอลัมน์ศูนย์มาแล้ว เรียงตามที่แสดงบนจอ */
    colMembers: { sort: string; label: string }[];
    /** จริงเมื่อหัวคอลัมน์เป็นสองชั้น ป้ายจึงถูกคั่นด้วย ' · ' */
    twoLevel: boolean;
    rows: { label: string; values: number[]; total: number }[];
    colTotals: number[];
    grandTotal: number;
    cost: PivotPDFCost[];
    costTotal: number;
    costUnpricedMeals: number;
    costPendingMeals: number;
    /** แนวกระดาษ ผู้ใช้เลือกเองก่อนพิมพ์ ค่าเริ่มต้นเป็นแนวตั้ง */
    orientation: 'portrait' | 'landscape';
}

/*
  คอลัมน์เยอะขึ้นก็ต้องย่อตัวอักษรลง ไม่งั้นตัวเลขจะดันกันจนตัดบรรทัด
  แนวตั้งมีที่ให้ตารางราว 547 พอยต์ ส่วนแนวนอนได้ 794 จึงย่อช้ากว่ากันอยู่ขั้นหนึ่ง
*/
const fontFor = (cols: number, landscape: boolean) => landscape
    ? (cols <= 12 ? 8 : cols <= 20 ? 7 : cols <= 30 ? 6 : 5)
    : (cols <= 10 ? 8 : cols <= 16 ? 7 : cols <= 24 ? 6 : 5);

export default function PivotPDF({
    rangeLabel, printedAt, rowLabel, colLabel, colMembers, twoLevel,
    rows, colTotals, grandTotal, cost, costTotal, costUnpricedMeals, costPendingMeals, orientation,
}: PivotPDFProps) {
    const landscape = orientation === 'landscape';
    const n = Math.max(colMembers.length, 1);
    const fs = fontFor(colMembers.length, landscape);
    /* บีบช่องว่างซ้ายขวาในเซลล์เมื่อคอลัมน์แน่น ตัวเลขจะได้มีที่ยืนมากกว่าขอบ */
    const cellPad = colMembers.length > (landscape ? 26 : 20) ? 1 : 3;

    /*
      ความกว้างคิดเป็นเปอร์เซ็นต์ ป้ายแถวกับช่องรวมกินส่วนคงที่
      ที่เหลือหารเท่ากันทุกคอลัมน์ ตารางจึงพอดีหน้ากระดาษเสมอไม่ว่าจะกี่คอลัมน์
    */
    const labelW = colMembers.length > (landscape ? 26 : 20) ? 14 : 20;
    const totalW = 8;
    const cellW = (100 - labelW - totalW) / n;
    const pct = (v: number) => `${v}%`;

    /* จับกลุ่มหัวคอลัมน์ชั้นบน เรียงตามลำดับเดิม กลุ่มเดียวกันต้องอยู่ติดกันอยู่แล้ว */
    const groups: { top: string; count: number }[] = [];
    if (twoLevel) {
        for (const cm of colMembers) {
            const top = cm.label.split(' · ')[0] ?? '';
            const last = groups[groups.length - 1];
            if (last && last.top === top) last.count += 1;
            else groups.push({ top, count: 1 });
        }
    }
    const leafLabel = (label: string) => twoLevel ? label.split(' · ').slice(1).join(' · ') : label;

    const totalMeals = cost.reduce((s, c) => s + c.meals, 0);

    return (
        <Document title={`ตารางไขว้ยอดการสั่งอาหาร ${rangeLabel}`}>
            <Page size="A4" orientation={orientation} style={styles.page}>

                <View style={styles.headerBox}>
                    <View>
                        <Text style={styles.headerTitle}>ตารางไขว้ยอดการสั่งอาหารผู้ป่วย โรงพยาบาลพะเยา</Text>
                        <Text style={styles.headerSub}>
                            นับเป็นจำนวนมื้อ (ถาด) ไม่รวมรายการงดอาหารและรายการที่ถูกยกเลิก
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerRightText}>{grandTotal.toLocaleString('th-TH')} มื้อ</Text>
                        <Text style={styles.headerRightMuted}>ช่วงวันที่ {rangeLabel}</Text>
                    </View>
                </View>

                <View style={styles.axisRow}>
                    <Text style={styles.axisChip}>แถว: {rowLabel}</Text>
                    <Text style={styles.axisChip}>คอลัมน์: {colLabel}</Text>
                    <Text style={styles.axisChip}>{rows.length} แถว × {colMembers.length} คอลัมน์</Text>
                </View>

                <View style={styles.table}>
                    {twoLevel && (
                        <View style={styles.headRow} fixed>
                            <Text style={[styles.thLeft, { width: pct(labelW), fontSize: fs }]}>{rowLabel}</Text>
                            {groups.map((g, i) => (
                                <Text
                                    key={`${g.top}-${i}`}
                                    style={[styles.thGroup, { width: pct(cellW * g.count), fontSize: fs }]}
                                >
                                    {g.top}
                                </Text>
                            ))}
                            <Text style={[styles.th, { width: pct(totalW), fontSize: fs, paddingHorizontal: cellPad }]}>รวม</Text>
                        </View>
                    )}

                    <View style={styles.headRow} fixed>
                        {/* ชั้นบนกินป้ายแถวกับช่องรวมไปแล้ว ชั้นล่างจึงเว้นไว้ให้ตรงกัน */}
                        <Text style={[styles.thLeft, { width: pct(labelW), fontSize: fs }]}>
                            {twoLevel ? '' : rowLabel}
                        </Text>
                        {colMembers.map(cm => (
                            <Text key={cm.sort} style={[styles.th, { width: pct(cellW), fontSize: fs, paddingHorizontal: cellPad }]}>
                                {leafLabel(cm.label)}
                            </Text>
                        ))}
                        <Text style={[styles.th, { width: pct(totalW), fontSize: fs, paddingHorizontal: cellPad }]}>
                            {twoLevel ? '' : 'รวม'}
                        </Text>
                    </View>

                    {rows.length === 0 && (
                        <View style={styles.row}>
                            <Text style={[styles.td, { width: '100%', textAlign: 'center', color: C.muted, fontSize: fs }]}>
                                ช่วงที่เลือกไม่มีการสั่งอาหาร
                            </Text>
                        </View>
                    )}

                    {rows.map((r, i) => (
                        <View key={r.label} style={[styles.row, i % 2 === 1 ? styles.rowEven : {}]} wrap={false}>
                            <Text style={[styles.tdLabel, { width: pct(labelW), fontSize: fs }]}>{r.label}</Text>
                            {r.values.map((v, j) => (
                                <Text
                                    key={colMembers[j]?.sort ?? j}
                                    style={[styles.td, v === 0 ? styles.tdZero : {}, { width: pct(cellW), fontSize: fs, paddingHorizontal: cellPad }]}
                                >
                                    {v === 0 ? '-' : v.toLocaleString('th-TH')}
                                </Text>
                            ))}
                            <Text style={[styles.td, styles.tdTotal, { width: pct(totalW), fontSize: fs, paddingHorizontal: cellPad }]}>
                                {r.total.toLocaleString('th-TH')}
                            </Text>
                        </View>
                    ))}

                    {rows.length > 0 && (
                        <View style={[styles.row, styles.rowTotal]} wrap={false}>
                            <Text style={[styles.tdLabel, styles.tdBold, { width: pct(labelW), fontSize: fs }]}>รวมทั้งสิ้น</Text>
                            {colTotals.map((v, j) => (
                                <Text
                                    key={colMembers[j]?.sort ?? j}
                                    style={[styles.td, styles.tdBold, { width: pct(cellW), fontSize: fs, paddingHorizontal: cellPad }]}
                                >
                                    {v.toLocaleString('th-TH')}
                                </Text>
                            ))}
                            <Text style={[styles.td, styles.tdTotal, { width: pct(totalW), fontSize: fs, paddingHorizontal: cellPad }]}>
                                {grandTotal.toLocaleString('th-TH')}
                            </Text>
                        </View>
                    )}
                </View>

                {cost.length > 0 && (
                    <>
                        <Text style={styles.sectionLabel}>สรุปค่าใช้จ่ายตามประเภท</Text>
                        <View style={styles.table}>
                            <View style={styles.headRow}>
                                <Text style={[styles.thLeft, { width: '22%', fontSize: 8 }]}>ประเภท</Text>
                                <Text style={[styles.th, { width: '11%', fontSize: 8, textAlign: 'right' }]}>ถาดที่รับแล้ว</Text>
                                <Text style={[styles.th, { width: '9%', fontSize: 8, textAlign: 'right' }]}>รอรับ</Text>
                                <Text style={[styles.th, { width: '13%', fontSize: 8, textAlign: 'right' }]}>ราคาตามประเภท</Text>
                                <Text style={[styles.th, { width: '9%', fontSize: 8 }]}>÷ มื้อ/วัน</Text>
                                <Text style={[styles.thLeft, { width: '21%', fontSize: 8 }]}>การคำนวณ</Text>
                                <Text style={[styles.th, { width: '15%', fontSize: 8, textAlign: 'right' }]}>เป็นเงิน (บาท)</Text>
                            </View>
                            {cost.map((c, i) => (
                                <View key={c.food_type_id} style={[styles.row, i % 2 === 1 ? styles.rowEven : {}]} wrap={false}>
                                    <View style={{ width: '22%', paddingVertical: 3, paddingHorizontal: 4 }}>
                                        <Text style={{ fontSize: 8, fontWeight: 600 }}>{c.food_type_name}</Text>
                                        {c.contract_note ? (
                                            <Text style={{ fontSize: 7, color: C.muted }}>{c.contract_note}</Text>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.td, styles.tdBold, { width: '11%', fontSize: 8 }]}>
                                        {c.meals.toLocaleString('th-TH')}
                                    </Text>
                                    <Text style={[styles.td, { width: '9%', fontSize: 8, color: c.pending_meals > 0 ? C.warn : C.muted }]}>
                                        {c.pending_meals > 0 ? c.pending_meals.toLocaleString('th-TH') : '-'}
                                    </Text>
                                    <Text style={[styles.td, { width: '13%', fontSize: 8, color: c.has_price ? C.text : C.warn }]}>
                                        {c.has_price ? formatMoney(c.price_per_day) : 'ยังไม่ตั้งราคา'}
                                    </Text>
                                    <Text style={[styles.td, { width: '9%', fontSize: 8, textAlign: 'center' }]}>
                                        {c.meals_per_day ?? '-'}
                                    </Text>
                                    <Text style={[styles.td, { width: '21%', fontSize: 7.5, textAlign: 'left', color: C.muted }]}>
                                        {c.has_price
                                            ? `${c.meals} x ${formatMoney(c.price_per_day)} / ${c.meals_per_day}`
                                            : 'คิดไม่ได้'}
                                    </Text>
                                    <Text style={[styles.td, styles.tdTotal, { width: '15%', fontSize: 9 }]}>
                                        {c.amount === null ? '-' : formatMoney(c.amount)}
                                    </Text>
                                </View>
                            ))}
                            <View style={[styles.row, styles.rowTotal]} wrap={false}>
                                <Text style={[styles.tdLabel, styles.tdBold, { width: '22%', fontSize: 8 }]}>รวมทั้งสิ้น</Text>
                                <Text style={[styles.td, styles.tdBold, { width: '11%', fontSize: 8 }]}>
                                    {totalMeals.toLocaleString('th-TH')}
                                </Text>
                                <Text style={[styles.td, styles.tdBold, { width: '9%', fontSize: 8, color: costPendingMeals > 0 ? C.warn : C.muted }]}>
                                    {costPendingMeals > 0 ? costPendingMeals.toLocaleString('th-TH') : '-'}
                                </Text>
                                <Text style={[styles.td, { width: '43%' }]}></Text>
                                <Text style={[styles.td, styles.tdTotal, { width: '15%', fontSize: 10 }]}>
                                    {formatMoney(costTotal)}
                                </Text>
                            </View>
                        </View>

                        {costPendingMeals > 0 && (
                            <View style={styles.warnBox}>
                                <Text style={styles.warnText}>
                                    มี {costPendingMeals.toLocaleString('th-TH')} ถาดที่สั่งแล้วแต่งานโภชนาการยังไม่กดรับ —
                                    ยังไม่เข้ายอดเงินด้านบน
                                    {cost.every(c => c.meals === 0) ? ' ยอดจึงเป็น 0 บาท' : ''}
                                </Text>
                            </View>
                        )}

                        {costUnpricedMeals > 0 && (
                            <View style={styles.warnBox}>
                                <Text style={styles.warnText}>
                                    มี {costUnpricedMeals.toLocaleString('th-TH')} ถาดที่คิดเงินไม่ได้เพราะยังไม่ได้ตั้งราคาตามสัญญา —
                                    ยอดรวมด้านบนยังไม่รวมส่วนนี้
                                </Text>
                            </View>
                        )}

                        <Text style={styles.note}>
                            ค่าใช้จ่ายคิดเฉพาะถาดที่งานโภชนาการรับมอบแล้ว ไม่ขึ้นกับแกนที่สลับอยู่ในตารางด้านบน
                            ซึ่งนับตามที่หอผู้ป่วยสั่ง จำนวนสองชุดนี้จึงไม่เท่ากัน
                        </Text>
                    </>
                )}

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>พิมพ์เมื่อ: {printedAt}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
}
