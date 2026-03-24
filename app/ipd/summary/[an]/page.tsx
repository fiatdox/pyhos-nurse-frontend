"use client";

import React, { use } from 'react'
import dynamic from 'next/dynamic'

const SummaryIPDbyAN = dynamic(() => import('../components/SummaryIPDbyAN'), { ssr: false })

export default function Page({ params }: { params: Promise<{ an: string }> }) {
  const resolvedParams = use(params);
  return (
    <div>
      <SummaryIPDbyAN an={resolvedParams.an} />
    </div>
  )
}