'use client';

import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import ContractPDF, { type ContractPDFProps } from './ContractPDF';

/*
  แยกไฟล์ออกมาเพราะ @react-pdf/renderer ทำงานได้เฉพาะฝั่งเบราว์เซอร์
  หน้าหลักจึงโหลดไฟล์นี้ด้วย next/dynamic แบบปิด ssr
*/

export function ContractPDFViewer(props: ContractPDFProps) {
    return (
        <PDFViewer width="100%" height="100%" showToolbar>
            <ContractPDF {...props} />
        </PDFViewer>
    );
}

export function ContractPDFDownloadBtn({ fileName, ...props }: ContractPDFProps & { fileName: string }) {
    return (
        <PDFDownloadLink document={<ContractPDF {...props} />} fileName={fileName}>
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
