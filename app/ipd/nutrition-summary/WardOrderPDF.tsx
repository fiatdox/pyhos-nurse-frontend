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
    headerBg: '#006b5f',
    rowEven: '#f0faf8',
    border: '#d1e8e5',
    text: '#1a1a1a',
    muted: '#6b7280',
    white: '#ffffff',
    warn: '#b45309',
    warnBg: '#fffbeb',
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

    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 4,
        padding: '6 10',
        marginBottom: 12,
    },
    statusText: { fontSize: 9, color: C.muted },
    statusStrong: { fontSize: 9, color: C.primary, fontWeight: 600 },

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

    table: { borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },
    tableHeader: { backgroundColor: C.headerBg, flexDirection: 'row' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
    tableRowEven: { backgroundColor: C.rowEven },
    tableRowLast: { borderBottomWidth: 0 },
    tableRowTotal: { backgroundColor: '#e0f2ef' },
    thCell: { color: C.white, fontWeight: 'bold', fontSize: 9, paddingVertical: 6, paddingHorizontal: 8 },
    tdCell: { paddingVertical: 5, paddingHorizontal: 8, fontSize: 9 },
    tdBold: { fontWeight: 'bold' },
    tdMuted: { color: C.muted },
    tdWarn: { color: C.warn, fontWeight: 600 },
    centerText: { textAlign: 'center' },

    signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
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

const COL_MENU = { no: '8%', name: '72%', qty: '20%' };
const COL_ADDON = { no: '7%', bed: '11%', name: '30%', food: '27%', addon: '25%' };

export interface WardOrderPDFProps {
    wardName: string;
    dateLabel: string;
    mealLabel: string;
    printedAt: string;
    menus: { food_name: string; qty: number }[];
    addons: { bedno: string | null; patient_name: string | null; food_name: string; addon: string }[];
    status: {
        total: number;
        received: number;
        pending: number;
        reciever_name: string | null;
        received_at: string | null;
    };
}

export default function WardOrderPDF({
    wardName, dateLabel, mealLabel, printedAt, menus, addons, status,
}: WardOrderPDFProps) {
    const total = menus.reduce((s, m) => s + m.qty, 0);

    /*
      NPO (งดอาหาร) นับรวมในยอดทั้งหมด แต่แยกยอดที่ต้องทำจริงออกมาให้ครัวเห็นด้วย
      เพราะจำนวนที่ต้องตั้งหม้อไม่เท่ากับจำนวนคนไข้ที่มีรายการ
    */
    const npo = menus.filter(m => m.food_name.toUpperCase().includes('NPO')).reduce((s, m) => s + m.qty, 0);

    return (
        <Document title={`ใบรายการอาหาร ${wardName} ${mealLabel} ${dateLabel}`}>
            <Page size="A4" style={styles.page}>

                <View style={styles.headerBox}>
                    <View>
                        <Text style={styles.headerTitle}>ใบรายการอาหารผู้ป่วย โรงพยาบาลพะเยา</Text>
                        <Text style={styles.headerSub}>หอผู้ป่วย: {wardName}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerRightText}>{mealLabel}</Text>
                        <Text style={styles.headerRightText}>วันที่ {dateLabel}</Text>
                        <Text style={styles.headerRightMuted}>ทั้งหมด {total} ที่</Text>
                    </View>
                </View>

                <View style={styles.statusBar}>
                    <Text style={styles.statusText}>
                        สถานะ:{' '}
                        {status.received === 0
                            ? 'ยังไม่ได้รับรายการ'
                            : status.pending > 0
                                ? `รับแล้วบางส่วน ${status.received}/${status.total} รายการ`
                                : 'งานโภชนาการรับรายการแล้ว'}
                    </Text>
                    {status.received > 0 && (
                        <Text style={styles.statusStrong}>
                            ผู้รับ: {status.reciever_name || 'ไม่ระบุ'} · {status.received_at || '-'} น.
                        </Text>
                    )}
                </View>

                <Text style={styles.sectionLabel}>รายการอาหารที่ต้องจัดส่ง</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.thCell, { width: COL_MENU.no, textAlign: 'center' }]}>#</Text>
                        <Text style={[styles.thCell, { width: COL_MENU.name }]}>ชื่อรายการอาหาร</Text>
                        <Text style={[styles.thCell, { width: COL_MENU.qty, textAlign: 'center' }]}>จำนวน (ที่)</Text>
                    </View>
                    {menus.map((m, i) => (
                        <View
                            key={m.food_name}
                            style={[
                                styles.tableRow,
                                i % 2 === 1 ? styles.tableRowEven : {},
                                i === menus.length - 1 ? styles.tableRowLast : {},
                            ]}
                        >
                            <Text style={[styles.tdCell, styles.tdMuted, styles.centerText, { width: COL_MENU.no }]}>{i + 1}</Text>
                            <Text style={[styles.tdCell, { width: COL_MENU.name }]}>{m.food_name}</Text>
                            <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_MENU.qty }]}>{m.qty}</Text>
                        </View>
                    ))}
                    <View style={[styles.tableRow, styles.tableRowTotal, styles.tableRowLast]}>
                        <Text style={[styles.tdCell, { width: COL_MENU.no }]}></Text>
                        <Text style={[styles.tdCell, styles.tdBold, { width: COL_MENU.name }]}>
                            รวมทั้งหมด{npo > 0 ? ` (เป็น NPO งดอาหาร ${npo} ราย)` : ''}
                        </Text>
                        <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_MENU.qty }]}>{total}</Text>
                    </View>
                </View>

                {addons.length > 0 && (
                    <>
                        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                            หมายเหตุพิเศษรายผู้ป่วย ({addons.length} ราย)
                        </Text>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.thCell, { width: COL_ADDON.no, textAlign: 'center' }]}>#</Text>
                                <Text style={[styles.thCell, { width: COL_ADDON.bed, textAlign: 'center' }]}>เตียง</Text>
                                <Text style={[styles.thCell, { width: COL_ADDON.name }]}>ชื่อผู้ป่วย</Text>
                                <Text style={[styles.thCell, { width: COL_ADDON.food }]}>อาหาร</Text>
                                <Text style={[styles.thCell, { width: COL_ADDON.addon }]}>หมายเหตุ</Text>
                            </View>
                            {addons.map((a, i) => (
                                <View
                                    key={`${a.bedno}-${i}`}
                                    style={[
                                        styles.tableRow,
                                        i % 2 === 1 ? styles.tableRowEven : {},
                                        i === addons.length - 1 ? styles.tableRowLast : {},
                                    ]}
                                >
                                    <Text style={[styles.tdCell, styles.tdMuted, styles.centerText, { width: COL_ADDON.no }]}>{i + 1}</Text>
                                    <Text style={[styles.tdCell, styles.tdBold, styles.centerText, { width: COL_ADDON.bed }]}>{a.bedno || '-'}</Text>
                                    <Text style={[styles.tdCell, { width: COL_ADDON.name }]}>{a.patient_name || '-'}</Text>
                                    <Text style={[styles.tdCell, { width: COL_ADDON.food }]}>{a.food_name}</Text>
                                    <Text style={[styles.tdCell, styles.tdWarn, { width: COL_ADDON.addon }]}>{a.addon}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <View style={styles.signRow}>
                    <View style={styles.signBox}>
                        <View style={styles.signLine} />
                        <Text style={styles.signLabel}>ผู้จัดอาหาร (งานโภชนาการ)</Text>
                    </View>
                    <View style={styles.signBox}>
                        <View style={styles.signLine} />
                        <Text style={styles.signLabel}>ผู้รับอาหาร (หอผู้ป่วย)</Text>
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
