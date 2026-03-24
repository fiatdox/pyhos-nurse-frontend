"use client";

import React from 'react'
import dynamic from 'next/dynamic'

const SummaryIPD = dynamic(() => import('./components/SummaryIPD'), { ssr: false })

const Page = () => {
  return (
    <div><SummaryIPD /></div>
  )
}

export default Page