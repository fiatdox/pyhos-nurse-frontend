import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
    family: 'Sarabun',
    fonts: [
        { src: '/fonts/Sarabun/Sarabun-Regular.ttf', fontWeight: 'normal' },
        { src: '/fonts/Sarabun/Sarabun-Bold.ttf', fontWeight: 'bold' },
        { src: '/fonts/Sarabun/Sarabun-SemiBold.ttf', fontWeight: 600 },
    ],
});

/** มิลลิเมตรเป็นพอยต์ หน่วยเดียวที่ @react-pdf/renderer รับสำหรับขนาดหน้า */
const mm = (v: number) => v * 2.834645669;

export interface TrayLabel {
    food_order_id: number;
    ward_name: string;
    bedno: string | null;
    patient_name: string;
    food_name: string;
    addon: string | null;
    meal_name: string;
}

export interface TrayLabelPDFProps {
    labels: TrayLabel[];
    dateLabel: string;
    mealLabel: string;
    widthMm: number;
    heightMm: number;
}

export default function TrayLabelPDF({ labels, dateLabel, mealLabel, widthMm, heightMm }: TrayLabelPDFProps) {
    /*
      ขนาดตัวอักษรผูกกับความสูงของดวง ไม่ใช่ค่าคงที่
      เพราะผู้ใช้ตั้งขนาดม้วนเองได้ ถ้าฝังค่าตายตัวไว้ พอเปลี่ยนเป็นดวงเล็กลง
      ตัวหนังสือจะล้นออกนอกสติกเกอร์โดยไม่มีอะไรเตือน
    */
    const base = heightMm / 30;
    const s = StyleSheet.create({
        page: {
            fontFamily: 'Sarabun',
            paddingVertical: mm(1.6),
            paddingHorizontal: mm(2),
            justifyContent: 'space-between',
        },
        head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
        ward: { fontSize: 7 * base, fontWeight: 'bold' },
        bed: { fontSize: 8 * base, fontWeight: 'bold' },
        patient: { fontSize: 7 * base, marginTop: mm(0.4) },
        // ชื่ออาหารคือสิ่งที่คนจัดถาดต้องอ่านก่อน จึงใหญ่สุดและมีเส้นคาดบน-ล่าง
        foodBox: {
            borderTopWidth: 0.6,
            borderBottomWidth: 0.6,
            borderColor: '#000',
            paddingVertical: mm(0.8),
            marginVertical: mm(0.8),
        },
        food: { fontSize: 9.5 * base, fontWeight: 'bold' },
        addon: { fontSize: 7 * base, fontWeight: 600, marginTop: mm(0.5) },
        foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
        meal: { fontSize: 8 * base, fontWeight: 'bold' },
        date: { fontSize: 7 * base },
    });

    return (
        <Document title={`ฉลากติดถาดอาหาร ${mealLabel} ${dateLabel}`}>
            {labels.map(l => (
                // หนึ่งดวงหนึ่งหน้า เครื่องพิมพ์ม้วนจะตัดทีละดวงได้พอดี
                <Page key={l.food_order_id} size={[mm(widthMm), mm(heightMm)]} style={s.page}>
                    <View>
                        <View style={s.head}>
                            <Text style={s.ward}>{l.ward_name}</Text>
                            <Text style={s.bed}>เตียง {l.bedno || '-'}</Text>
                        </View>
                        <Text style={s.patient}>{l.patient_name}</Text>
                    </View>

                    <View style={s.foodBox}>
                        <Text style={s.food}>{l.food_name}</Text>
                        {l.addon && <Text style={s.addon}>* {l.addon}</Text>}
                    </View>

                    <View style={s.foot}>
                        <Text style={s.meal}>{l.meal_name}</Text>
                        <Text style={s.date}>{dateLabel}</Text>
                    </View>
                </Page>
            ))}
        </Document>
    );
}
