"use client";

import React, { use } from 'react';
import dynamic from 'next/dynamic';

const AdmitRecord = dynamic(() => import('../../components/AdmitRecord'), { ssr: false });
const VitalSignsRecord = dynamic(() => import('../../components/VitalSignsRecord'), { ssr: false });
const NursingProgressNotes = dynamic(() => import('../../components/NursingProgressNotes'), { ssr: false });
const NursingCarePlan = dynamic(() => import('../../components/NursingCarePlan'), { ssr: false });
const IORecord = dynamic(() => import('../../components/IORecord'), { ssr: false });
const MedicationRecord = dynamic(() => import('../../components/MedicationRecord'), { ssr: false });
const SpecialCareRecord = dynamic(() => import('../../components/SpecialCareRecord'), { ssr: false });
const PatientEducation = dynamic(() => import('../../components/PatientEducation'), { ssr: false });
const NursingHandover = dynamic(() => import('../../components/NursingHandover'), { ssr: false });
const DischargeRecord = dynamic(() => import('../../components/DischargeRecord'), { ssr: false });

const moduleComponents: Record<string, React.ComponentType<{ an: string }>> = {
  admit: AdmitRecord,
  vital: VitalSignsRecord,
  nursing: NursingProgressNotes,
  careplan: NursingCarePlan,
  io: IORecord,
  mar: MedicationRecord,
  special: SpecialCareRecord,
  education: PatientEducation,
  handover: NursingHandover,
  discharge: DischargeRecord,
};

const moduleNames: Record<string, string> = {
  admit: 'การบันทึกการรับผู้ป่วย',
  vital: 'แบบบันทึกสัญญาณชีพ (Vital Signs Record)',
  nursing: 'บันทึกทางการพยาบาล (Nursing Progress Notes)',
  careplan: 'แผนการพยาบาล (Nursing Care Plan)',
  io: 'บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)',
  mar: 'บันทึกการให้ยา (MAR)',
  special: 'บันทึกการดูแลพิเศษ (Special Care Records)',
  education: 'บันทึกการศึกษาและให้ความรู้ (Patient Education)',
  handover: 'บันทึกการส่งเวร (Nursing Handover / SBAR)',
  discharge: 'บันทึกการจำหน่าย (Discharge Record)',
  'fall-risk': 'แบบประเมินความเสี่ยงพลัดตกหกล้ม (Fall Risk)',
  braden: 'แบบประเมินแผลกดทับ (Braden Scale)',
  pain: 'แบบประเมินความปวด (Pain Assessment)',
  'wound-care': 'บันทึกการทำแผล (Wound Care Record)',
  restraint: 'บันทึกการผูกยึด (Restraint Record)',
  gcs: 'แบบประเมินระดับความรู้สึกตัว (GCS)',
  'mental-health': 'แบบประเมินสุขภาพจิต/ความวิตกกังวล',
};

export default function NursingRecordPage({ params }: { params: Promise<{ module: string; an: string }> }) {
  const { module, an } = use(params);
  const Component = moduleComponents[module];

  if (!Component) {
    const name = moduleNames[module] || module;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center p-10 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-bold text-[#006b5f] mb-2">{name}</h2>
          <p className="text-gray-500 text-lg">AN: <strong>{an}</strong></p>
          <p className="text-gray-400 mt-4">อยู่ระหว่างพัฒนา...</p>
        </div>
      </div>
    );
  }

  return <Component an={an} />;
}
