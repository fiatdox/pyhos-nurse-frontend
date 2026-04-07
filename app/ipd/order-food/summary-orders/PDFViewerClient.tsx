'use client';

import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from 'antd';
import { PiDownloadSimpleBold } from 'react-icons/pi';
import FoodSummaryPDF from './FoodSummaryPDF';

interface FoodOrderAddon {
  food_order_id: number;
  an: string;
  addon: string;
  bedno: string;
  patient_name: string;
  meal_name: string;
  food_name: string;
}

interface Props {
  data: FoodOrderAddon[];
  wardName: string;
  dateLabel: string;
  mealLabel: string;
  printedAt: string;
  fileName: string;
}

export function PDFDownloadBtn({ data, wardName, dateLabel, mealLabel, printedAt, fileName }: Props) {
  return (
    <PDFDownloadLink
      document={<FoodSummaryPDF data={data} wardName={wardName} dateLabel={dateLabel} mealLabel={mealLabel} printedAt={printedAt} />}
      fileName={fileName}
    >
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

export function PDFViewerClient({ data, wardName, dateLabel, mealLabel, printedAt }: Omit<Props, 'fileName'>) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <FoodSummaryPDF data={data} wardName={wardName} dateLabel={dateLabel} mealLabel={mealLabel} printedAt={printedAt} />
    </PDFViewer>
  );
}
