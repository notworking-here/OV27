import React from 'react';
import { Proposal, ContactInfo } from '../../types';

export interface ProposalContactsSectionProps {
  proposal: Proposal;
  isFormLocked?: boolean;
  onChange: (updated: Partial<Proposal>) => void;
}

export function ProposalContactsSection({
  proposal,
  isFormLocked = false,
  onChange,
}: ProposalContactsSectionProps) {
  const pointOfContact = proposal.pointOfContact || { name: '', email: '', phone: '' };
  const divisionLeadContact = proposal.divisionLeadContact || { name: '', email: '', phone: '' };

  const handleContactChange = (
    field: 'pointOfContact' | 'divisionLeadContact' | 'gcLiaison',
    key: keyof ContactInfo,
    val: string
  ) => {
    if (isFormLocked) return;
    const current = proposal[field] || { name: '', email: '', phone: '' };
    onChange({
      [field]: {
        ...current,
        [key]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Proposal Point of Contact */}
      <div id="section-point-of-contact" className="transition-all rounded-xl p-1">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Point of Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Name"
            readOnly={isFormLocked}
            value={pointOfContact.name || ''}
            onChange={(e) => handleContactChange('pointOfContact', 'name', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
          <input
            type="email"
            placeholder="Email"
            readOnly={isFormLocked}
            value={pointOfContact.email || ''}
            onChange={(e) => handleContactChange('pointOfContact', 'email', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
          <input
            type="tel"
            placeholder="Phone"
            readOnly={isFormLocked}
            value={pointOfContact.phone || ''}
            onChange={(e) => handleContactChange('pointOfContact', 'phone', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
        </div>
      </div>

      {/* Union OneVoice27 Lead Contact */}
      <div id="section-lead-contact" className="transition-all rounded-xl p-1">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Union Lead</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Name"
            readOnly={isFormLocked}
            value={divisionLeadContact.name || ''}
            onChange={(e) => handleContactChange('divisionLeadContact', 'name', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
          <input
            type="email"
            placeholder="Email"
            readOnly={isFormLocked}
            value={divisionLeadContact.email || ''}
            onChange={(e) => handleContactChange('divisionLeadContact', 'email', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
          <input
            type="tel"
            placeholder="Phone"
            readOnly={isFormLocked}
            value={divisionLeadContact.phone || ''}
            onChange={(e) => handleContactChange('divisionLeadContact', 'phone', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition read-only:bg-[#f8fafc] read-only:focus:border-slate-200/80 read-only:focus:ring-0"
          />
        </div>
      </div>
    </div>
  );
}
