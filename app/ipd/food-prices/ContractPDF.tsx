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
    rowEven: '#f0faf8',
    border: '#d1e8e5',
    text: '#1a1a1a',
    muted: '#6b7280',
    white: '#ffffff',
    warn: '#b45309',
    warnBg: '#fffbeb',
    expired: '#9ca3af',
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
    headerBox: {
        backgroundColor: C.headerBg,
        borderRadius: 6,
        padding: '12 16',
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: { color: C.white, fontSize: 14, fontWeight: 'bold' },
    headerSub: { color: '#b2dfdb', fontSize: 9, marginTop: 3 },
    headerRight: { alignItems: 'flex-end' },
    headerRightText: { color: C.white, fontSize: 10, fontWeight: 600 },
    headerRightMuted: { color: '#b2dfdb', fontSize: 9, marginTop: 2 },

    sectionLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: C.primary,
        marginBottom: 5,
        marginTop: 12,
        borderLeftWidth: 3,
        borderLeftColor: C.primary,
        paddingLeft: 6,
    },
    sectionNote: { fontSize: 8, color: C.muted, marginBottom: 5 },

    table: { borderWidth: 1, borderColor: C.border, borderRadius: 4 },
    tableHeader: { backgroundColor: C.headerBg, flexDirection: 'row' },
    tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
    tableRowEven: { backgroundColor: C.rowEven },
    thCell: { color: C.white, fontWeight: 'bold', fontSize: 9, paddingVertical: 6, paddingHorizontal: 6 },
    tdCell: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 9 },
    tdBold: { fontWeight: 'bold' },
    tdMuted: { color: C.muted },
    tdExpired: { color: C.expired },
    tdMoney: { fontWeight: 'bold', color: C.primary },
    centerText: { textAlign: 'center' },
    rightText: { textAlign: 'right' },

    /* แถบคั่นบอกว่ากลุ่มถัดไปเป็นสัญญาของประเภทไหน อ่านง่ายกว่าซ้ำชื่อประเภททุกแถว */
    groupRow: { flexDirection: 'row', backgroundColor: '#e0f2ef', borderTopWidth: 1, borderTopColor: C.border },
    groupText: { fontSize: 9, fontWeight: 'bold', color: C.primary, paddingVertical: 4, paddingHorizontal: 6 },

    warnBox: {
        borderWidth: 1,
        borderColor: '#fcd34d',
        backgroundColor: C.warnBg,
        borderRadius: 4,
        padding: '6 10',
        marginTop: 10,
    },
    warnText: { fontSize: 9, color: C.warn },

    signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    signBox: { width: '45%', alignItems: 'center' },
    signLine: { borderTopWidth: 1, borderTopColor: C.muted, width: '100%', marginBottom: 4 },
    signLabel: { fontSize: 9, color: C.muted },

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
    footerText: { fontSize: 8, color: C.muted },
});

/* ราคาที่ใช้อยู่ ณ วันที่พิมพ์ — สรุปสั้นๆ ก่อนรายการสัญญาทั้งหมด */
const COL_CUR = { type: '22%', price: '20%', meals: '14%', meal_price: '20%', until: '24%' };
/* ทะเบียนสัญญา — ประเภทอยู่ในแถบคั่นแล้ว คอลัมน์จึงเหลือแต่เนื้อสัญญา */
const COL = { from: '13%', to: '13%', price: '12%', meals: '7%', status: '11%', vendor: '18%', note: '15%', by: '11%' };

export interface ContractPDFRow {
    food_type_price_id: number;
    food_type_id: number;
    food_type_name: string;
    price_per_day: number;
    meals_per_day: number;
    effective_from: string;
    effective_to: string | null;
    contract_note: string | null;
    created_at: string;
    created_by_name: string | null;
    /** บริษัทคู่สัญญา null = ยังไม่ระบุ ซึ่งบริษัทจะมองไม่เห็นสัญญาฉบับนั้น */
    vendor_name: string | null;
    /** ข้อความสถานะที่หน้าจอคิดไว้แล้ว ส่งมาเพื่อให้ PDF ตรงกับตารางบนจอเสมอ */
    status: string;
}

export interface ContractPDFCurrent {
    food_type_name: string;
    price_per_day: number | null;
    meals_per_day: number | null;
    price_per_meal: number | null;
    effective_to: string | null;
}

export interface ContractPDFProps {
    /** วันที่ใช้อ้างอิงว่าสัญญาไหน "ใช้อยู่" ในรูปแบบที่พิมพ์ได้เลย */
    asOfLabel: string;
    printedAt: string;
    current: ContractPDFCurrent[];
    contracts: ContractPDFRow[];
    /** แปลง YYYY-MM-DD เป็นวันที่ไทย ใช้ตัวเดียวกับหน้าจอ จะได้ไม่เพี้ยนกันคนละแบบ */
    formatDate: (iso: string) => string;
}

export default function ContractPDF({
    asOfLabel, printedAt, current, contracts, formatDate,
}: ContractPDFProps) {
    /*
      เรียงตามประเภทก่อน แล้วไล่วันที่จากเก่าไปใหม่
      ทะเบียนสัญญาอ่านตามลำดับเวลา ต่างจากตารางบนจอที่เอาฉบับล่าสุดขึ้นก่อน
      เพราะบนจอคนดูว่า "ตอนนี้ใช้อะไร" แต่บนกระดาษคนไล่ดูว่า "ผ่านอะไรมาบ้าง"
    */
    const sorted = [...contracts].sort((a, b) =>
        a.food_type_id - b.food_type_id || a.effective_from.localeCompare(b.effective_from));

    const groups = sorted.reduce<{ name: string; rows: ContractPDFRow[] }[]>((acc, c) => {
        const last = acc[acc.length - 1];
        if (last && last.name === c.food_type_name) last.rows.push(c);
        else acc.push({ name: c.food_type_name, rows: [c] });
        return acc;
    }, []);

    const unpriced = current.filter(c => c.price_per_day === null).map(c => c.food_type_name);

    return (
        <Document title={`ทะเบียนสัญญาราคาอาหารผู้ป่วย ณ ${asOfLabel}`}>
            <Page size="A4" style={styles.page}>

                <View style={styles.headerBox}>
                    <View>
                        <Text style={styles.headerTitle}>ทะเบียนสัญญาราคาอาหารผู้ป่วย โรงพยาบาลพะเยา</Text>
                        <Text style={styles.headerSub}>
                            หนึ่งฉบับ = ประเภทอาหาร + ช่วงวันที่ + ราคาต่อผู้ป่วยหนึ่งคนหนึ่งวัน
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerRightText}>ณ วันที่ {asOfLabel}</Text>
                        <Text style={styles.headerRightMuted}>ทั้งหมด {contracts.length} ฉบับ</Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>ราคาที่ใช้อยู่ ณ วันที่ {asOfLabel}</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.thCell, { width: COL_CUR.type }]}>ประเภทอาหาร</Text>
                        <Text style={[styles.thCell, styles.rightText, { width: COL_CUR.price }]}>ราคา/วัน (บาท)</Text>
                        <Text style={[styles.thCell, styles.centerText, { width: COL_CUR.meals }]}>มื้อ/วัน</Text>
                        <Text style={[styles.thCell, styles.rightText, { width: COL_CUR.meal_price }]}>เฉลี่ยมื้อละ (บาท)</Text>
                        <Text style={[styles.thCell, styles.centerText, { width: COL_CUR.until }]}>ใช้ถึงวันที่</Text>
                    </View>
                    {current.map((t, i) => (
                        <View key={t.food_type_name} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                            <Text style={[styles.tdCell, styles.tdBold, { width: COL_CUR.type }]}>{t.food_type_name}</Text>
                            {t.price_per_day === null ? (
                                <Text style={[styles.tdCell, { width: '78%', color: C.warn }]}>
                                    ยังไม่มีสัญญาที่ครอบคลุมวันนี้ — คิดเงินไม่ได้
                                </Text>
                            ) : (
                                <>
                                    <Text style={[styles.tdCell, styles.tdMoney, styles.rightText, { width: COL_CUR.price }]}>
                                        {formatMoney(t.price_per_day)}
                                    </Text>
                                    <Text style={[styles.tdCell, styles.centerText, { width: COL_CUR.meals }]}>
                                        {t.meals_per_day ?? '-'}
                                    </Text>
                                    <Text style={[styles.tdCell, styles.rightText, { width: COL_CUR.meal_price }]}>
                                        {formatMoney(t.price_per_meal)}
                                    </Text>
                                    <Text style={[styles.tdCell, styles.centerText, { width: COL_CUR.until }]}>
                                        {t.effective_to ? formatDate(t.effective_to) : 'ไม่กำหนด'}
                                    </Text>
                                </>
                            )}
                        </View>
                    ))}
                </View>
                <Text style={styles.sectionNote}>
                    ราคาเฉลี่ยต่อมื้อไว้ตรวจทานเท่านั้น การจ่ายจริงคิดเป็นวันเต็มก่อน เศษมื้อที่เหลือจึงนำมาเฉลี่ย
                </Text>

                {unpriced.length > 0 && (
                    <View style={styles.warnBox}>
                        <Text style={styles.warnText}>
                            ประเภทที่ยังไม่มีสัญญาครอบคลุมวันที่ {asOfLabel}: {unpriced.join(', ')} —
                            ถาดของประเภทนี้จะคิดเงินไม่ได้จนกว่าจะบันทึกสัญญาที่ครอบคลุมวันที่สั่ง
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>สัญญาทั้งหมด แยกตามประเภทอาหาร</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader} fixed>
                        <Text style={[styles.thCell, styles.centerText, { width: COL.from }]}>ตั้งแต่วันที่</Text>
                        <Text style={[styles.thCell, styles.centerText, { width: COL.to }]}>ถึงวันที่</Text>
                        <Text style={[styles.thCell, styles.rightText, { width: COL.price }]}>ราคา/วัน</Text>
                        <Text style={[styles.thCell, styles.centerText, { width: COL.meals }]}>มื้อ/วัน</Text>
                        <Text style={[styles.thCell, styles.centerText, { width: COL.status }]}>สถานะ</Text>
                        <Text style={[styles.thCell, { width: COL.vendor }]}>บริษัทคู่สัญญา</Text>
                        <Text style={[styles.thCell, { width: COL.note }]}>เลขที่สัญญา</Text>
                        <Text style={[styles.thCell, { width: COL.by }]}>ผู้บันทึก</Text>
                    </View>

                    {groups.length === 0 && (
                        <View style={styles.tableRow}>
                            <Text style={[styles.tdCell, styles.tdMuted, styles.centerText, { width: '100%' }]}>
                                ยังไม่มีสัญญาในระบบ
                            </Text>
                        </View>
                    )}

                    {groups.map(g => (
                        <View key={g.name}>
                            {/* wrap=false กันไม่ให้หัวข้อประเภทตกไปอยู่ท้ายหน้าโดยไม่มีแถวตามมา */}
                            <View style={styles.groupRow} wrap={false}>
                                <Text style={styles.groupText}>
                                    {g.name} · {g.rows.length} ฉบับ
                                </Text>
                            </View>
                            {g.rows.map((c, i) => {
                                const expired = c.status === 'หมดอายุ';
                                return (
                                    <View key={c.food_type_price_id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]} wrap={false}>
                                        <Text style={[styles.tdCell, styles.centerText, expired ? styles.tdExpired : {}, { width: COL.from }]}>
                                            {formatDate(c.effective_from)}
                                        </Text>
                                        <Text style={[styles.tdCell, styles.centerText, expired ? styles.tdExpired : {}, { width: COL.to }]}>
                                            {c.effective_to ? formatDate(c.effective_to) : 'ไม่กำหนด'}
                                        </Text>
                                        <Text style={[styles.tdCell, styles.rightText, expired ? styles.tdExpired : styles.tdMoney, { width: COL.price }]}>
                                            {formatMoney(c.price_per_day)}
                                        </Text>
                                        <Text style={[styles.tdCell, styles.centerText, expired ? styles.tdExpired : {}, { width: COL.meals }]}>
                                            {c.meals_per_day}
                                        </Text>
                                        <Text style={[styles.tdCell, styles.centerText, expired ? styles.tdExpired : styles.tdBold, { width: COL.status }]}>
                                            {c.status}
                                        </Text>
                                        <Text style={[styles.tdCell, expired ? styles.tdExpired : styles.tdBold, { width: COL.vendor }]}>
                                            {c.vendor_name || 'ยังไม่ระบุบริษัท'}
                                        </Text>
                                        <Text style={[styles.tdCell, expired ? styles.tdExpired : {}, { width: COL.note }]}>
                                            {c.contract_note || '-'}
                                        </Text>
                                        <Text style={[styles.tdCell, styles.tdMuted, { width: COL.by }]}>
                                            {c.created_by_name || '-'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionNote}>
                    สัญญาเก่าไม่ถูกลบเมื่อเพิ่มฉบับใหม่ เพื่อให้คิดยอดย้อนหลังได้ตรงกับราคาที่ใช้อยู่ในตอนนั้น
                    ช่วงที่ไม่มีสัญญาครอบคลุมจะคิดเงินไม่ได้ ไม่ใช่ใช้ราคาเก่าต่อ
                </Text>

                <View style={styles.signRow}>
                    <View style={styles.signBox}>
                        <View style={styles.signLine} />
                        <Text style={styles.signLabel}>ผู้จัดทำ</Text>
                    </View>
                    <View style={styles.signBox}>
                        <View style={styles.signLine} />
                        <Text style={styles.signLabel}>ผู้ตรวจสอบ</Text>
                    </View>
                </View>

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>พิมพ์เมื่อ: {printedAt}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`} />
                </View>

            </Page>
        </Document>
    );
}
