'use client';

import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import WardOrderPDF, { type WardOrderPDFProps } from './WardOrderPDF';

/*
  แยกไฟล์ออกมาเพราะ @react-pdf/renderer ทำงานได้เฉพาะฝั่งเบราว์เซอร์
  หน้าหลักจึงโหลดไฟล์นี้ด้วย next/dynamic แบบปิด ssr
*/

export function WardPDFViewer(props: WardOrderPDFProps) {
    return (
        <PDFViewer width="100%" height="100%" showToolbar>
            <WardOrderPDF {...props} />
        </PDFViewer>
    );
}

export function WardPDFDownloadBtn({ fileName, ...props }: WardOrderPDFProps & { fileName: string }) {
    return (
        <PDFDownloadLink document={<WardOrderPDF {...props} />} fileName={fileName}>
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
