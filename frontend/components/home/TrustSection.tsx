'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

export default function TrustSection() {
  const { t } = useTranslation();

  const trustPillars = [
    {
      icon: 'bolt',
      title: t('customer.instantPayTitle'),
      description: t('customer.instantPayDesc'),
    },
    {
      icon: 'verified_user',
      title: t('customer.antiFraudTitle'),
      description: t('customer.antiFraudDesc'),
    },
    {
      icon: 'support_agent',
      title: t('customer.supportTitle'),
      description: t('customer.supportDesc'),
    },
  ];

  return (
    <section className="bg-white dark:bg-slate-900 py-14 border-y border-[#E4E7EC] dark:border-slate-800 transition-colors">
      <div className="max-w-[80rem] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {trustPillars.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E4E7EC] dark:border-slate-800 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-xl text-[#FF6500] shrink-0 border border-orange-200/60 dark:border-orange-800/40">
                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-[#101828] dark:text-white leading-snug">
                  {item.title}
                </h4>
                <p className="text-[13px] text-[#667085] dark:text-slate-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
