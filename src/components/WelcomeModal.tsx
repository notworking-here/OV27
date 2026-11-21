import React, { useState, useEffect } from 'react';
import { UserProfile, UNION_CATEGORIES } from '../types';
import { X, Building, Mail, User, Briefcase } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  canDismiss?: boolean;
}

export function WelcomeModal({
  isOpen,
  onClose,
  profile,
  onSave,
  canDismiss = true,
}: WelcomeModalProps) {
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [division, setDivision] = useState(profile?.division || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [institution, setInstitution] = useState(profile?.institution || '');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setDivision(profile.division || '');
      setDepartment(profile.department || '');
      setInstitution(profile.institution || '');
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Director',
      email: email.trim(),
      division: division || 'East Central Philippine Union Conference',
      department: department.trim() || 'Media & Communication',
      institution: institution.trim() || division || 'Union Office',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 md:p-9 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {canDismiss && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to your workbook
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Tell us who you are and which Union you represent so we can label your strategic proposals and PDF exports accurately. You can also sign in or register at any time to sync your proposals to the cloud.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="sr-only" htmlFor="modal-name">Name</label>
            <input
              id="modal-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full px-4 py-3.5 rounded-2xl bg-[#f2f4f8] hover:bg-[#eef1f6] focus:bg-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-800 placeholder-slate-400 text-sm transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="sr-only" htmlFor="modal-email">Email</label>
            <input
              id="modal-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3.5 rounded-2xl bg-[#f2f4f8] hover:bg-[#eef1f6] focus:bg-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-800 placeholder-slate-400 text-sm transition"
            />
          </div>

          {/* Union dropdown */}
          <div>
            <label className="sr-only" htmlFor="modal-union">Select your union...</label>
            <select
              id="modal-union"
              required
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl bg-[#f2f4f8] hover:bg-[#eef1f6] focus:bg-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-800 text-sm transition cursor-pointer font-medium"
            >
              <option value="" disabled>Select your union...</option>
              {UNION_CATEGORIES.map((cat) => (
                <optgroup key={cat.category} label={cat.category} className="font-semibold text-slate-900 bg-white">
                  {cat.unions.map((u) => (
                    <option key={u} value={u} className="font-normal text-slate-800">
                      {u}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Institution & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <input
                id="modal-institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Institution (e.g. Hope Channel SSD)"
                className="w-full px-4 py-3 rounded-2xl bg-[#f2f4f8] hover:bg-[#eef1f6] focus:bg-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-800 placeholder-slate-400 text-sm transition"
              />
            </div>
            <div>
              <input
                id="modal-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department (e.g. Media / Communication)"
                className="w-full px-4 py-3 rounded-2xl bg-[#f2f4f8] hover:bg-[#eef1f6] focus:bg-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-800 placeholder-slate-400 text-sm transition"
              />
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-2xl bg-[#9cb0cf] hover:bg-[#869fc4] active:bg-[#7791b8] text-white font-semibold text-base transition shadow-sm cursor-pointer"
            >
              Start writing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
