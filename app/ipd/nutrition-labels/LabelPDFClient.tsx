'use client';

import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import TrayLabelPDF, { type TrayLabelPDFProps } from './TrayLabelPDF';

/* แยกไฟล์เพราะ @react-pdf/renderer ทำงานได้เฉพาะฝั่งเบราว์เซอร์ */

export function LabelPDFViewer(props: TrayLabelPDFProps) {
    return (
        <PDFViewer width="100%" height="100%" showToolbar>
            <TrayLabelPDF {...props} />
        </PDFViewer>
    );
}

export function LabelPDFDownloadBtn({ fileName, ...props }: TrayLabelPDFProps & { fileName: string }) {
    return (
        <PDFDownloadLink document={<TrayLabelPDF {...props} />} fileName={fileName}>
            {({ loading }) => (
                <Button
                    type="primary"
                    icon={<PiDownloadSimpleBold className="text-lg" />}
                    loading={loading}
                    className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                >
                    ดาวน์โหลด PDF
                </Button>
            )}
        </PDFDownloadLink>
    );
}
