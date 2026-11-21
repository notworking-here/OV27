import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  Search,
  User,
  UserCheck,
  Mail,
  Building,
  AlertCircle,
  CheckCircle2,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Proposal, UserAccount, UNION_ACRONYMS, UNIONS } from '../../types';
import { fetchAllUsers, transferProposalOwnership } from '../../services/proposalService';

export interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal | null;
  currentUser: UserAccount;
  onTransferSuccess: (updatedProposal: Proposal) => void;
}

export function TransferOwnershipModal({
  isOpen,
  onClose,
  proposal,
  currentUser,
  onTransferSuccess,
}: TransferOwnershipModalProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Manual entry toggle/state if typing an unregistered email
  const [entryMode, setEntryMode] = useState<'directory' | 'manual'>('directory');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualUnion, setManualUnion] = useState('');

  // Options
  const [updatePointOfContact, setUpdatePointOfContact] = useState(true);
  const [addAuditNote, setAddAuditNote] = useState(true);
  const [transferReason, setTransferReason] = useState('');

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load directory users when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingUsers(true);
    setErrorMessage(null);
    setSelectedUser(null);
    setSearchQuery('');
    setManualName('');
    setManualEmail('');
    setManualPhone('');
    setManualUnion(proposal?.union || '');
    setTransferReason('');
    setEntryMode('directory');

    fetchAllUsers()
      .then((data) => {
        if (isMounted) {
          setUsers(data);
          setLoadingUsers(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Failed to load user directory for transfer:', err);
          setLoadingUsers(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, proposal]);

  // Filtered directory users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const currentOwnerEmail = (proposal?.userEmail || proposal?.pointOfContact?.email || '').toLowerCase();

    return users.filter((u) => {
      // Don't show current owner as a target
      if (currentOwnerEmail && u.email.toLowerCase() === currentOwnerEmail) {
        return false;
      }
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.union && u.union.toLowerCase().includes(q)) ||
        (u.title && u.title.toLowerCase().includes(q))
      );
    });
  }, [users, searchQuery, proposal]);

  if (!isOpen || !proposal) return null;

  const currentOwnerDisplayName =
    proposal.userName || proposal.pointOfContact?.name || proposal.userEmail || 'Unassigned';
  const currentOwnerEmail =
    proposal.userEmail || proposal.pointOfContact?.email || 'No email recorded';

  const handleConfirmTransfer = async () => {
    setErrorMessage(null);

    let targetPayload: {
      uid?: string;
      displayName: string;
      email: string;
      union?: string;
      phone?: string;
    };

    if (entryMode === 'directory') {
      if (!selectedUser) {
        setErrorMessage('Please select a user from the directory to transfer ownership to.');
        return;
      }
      targetPayload = {
        uid: selectedUser.uid,
        displayName: selectedUser.displayName,
        email: selectedUser.email,
        union: selectedUser.union,
      };
    } else {
      const cleanEmail = manualEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      const cleanName = manualName.trim() || cleanEmail.split('@')[0];
      targetPayload = {
        displayName: cleanName,
        email: cleanEmail,
        union: manualUnion.trim() || proposal.union,
        phone: manualPhone.trim(),
      };
    }

    setIsSubmitting(true);
    try {
      const updated = await transferProposalOwnership(
        proposal,
        targetPayload,
        currentUser,
        {
          updatePointOfContact,
          addAuditNote,
          reason: transferReason.trim() || undefined,
        }
      );

      setIsSubmitting(false);
      onTransferSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to transfer ownership. Please check your network and try again.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1c398e] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Transfer Proposal Ownership</h2>
              <p className="text-xs text-blue-100">
                Reassign project author, edit permissions, and primary liaison
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Target Proposal Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Proposal To Transfer
            </div>
            <div className="font-bold text-sm text-slate-900 leading-snug">
              {(proposal.title || '').trim() || 'Untitled Proposal'}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-slate-600 pt-1 border-t border-slate-200/80">
              <span className="font-semibold text-slate-500">Current Owner:</span>
              <span className="font-bold text-slate-800">{currentOwnerDisplayName}</span>
              <span className="text-slate-400">({currentOwnerEmail})</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-100/70 text-[#1c398e] font-semibold text-[10px]">
                {UNION_ACRONYMS[proposal.union] || proposal.union}
              </span>
            </div>
          </div>

          {/* Mode Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-900 text-xs">
                Select New Owner
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setEntryMode('directory')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    entryMode === 'directory'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  From Directory
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    entryMode === 'manual'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Type Email
                </button>
              </div>
            </div>

            {entryMode === 'directory' ? (
              <div className="space-y-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, union, or office..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1c398e] focus:ring-1 focus:ring-[#1c398e]"
                  />
                </div>

                {/* Directory List */}
                <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {loadingUsers ? (
                    <div className="p-6 text-center text-slate-400">Loading user directory...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      No matching registered users found. Try switching to "Type Email".
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUser?.uid === u.uid;
                      const uUnionAcronym = UNION_ACRONYMS[u.union] || u.union;

                      return (
                        <div
                          key={u.uid}
                          onClick={() => setSelectedUser(u)}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-50/90 border-l-4 border-l-[#1c398e]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[#1c398e] text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{u.displayName}</span>
                                {u.role === 'super_admin' && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate flex items-center gap-2">
                                <span>{u.email}</span>
                                {uUnionAcronym && <span>• {uUnionAcronym}</span>}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#1c398e] shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedUser && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-medium">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      <span>
                        Selected New Owner: <strong>{selectedUser.displayName}</strong> ({selectedUser.email})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Entry Form */
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                      New Owner Email *
                    </label>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="e.g. colleague@adventist.asia"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1c398e]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Pastor John Doe"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1c398e]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                      Affiliated Union
                    </label>
                    <select
                      value={manualUnion || proposal.union}
                      onChange={(e) => setManualUnion(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1c398e]"
                    >
                      {UNIONS.map((u) => (
                        <option key={u} value={u}>
                          {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="+63 912 345 6789"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1c398e]"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  If this user does not have an active account yet, a provisional profile will automatically be created so they gain access immediately upon logging in with this email.
                </p>
              </div>
            )}
          </div>

          {/* Options & Clarifications */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            {/* Checkbox 1: Point of Contact */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={updatePointOfContact}
                onChange={(e) => setUpdatePointOfContact(e.target.checked)}
                className="mt-0.5 rounded text-[#1c398e] focus:ring-[#1c398e] cursor-pointer"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Update Primary Point of Contact (POC)
                </span>
                <p className="text-[11px] text-slate-500">
                  Overwrites the proposal’s Point of Contact name and email with the new owner’s details. Uncheck if the original contact person should remain the operational lead.
                </p>
              </div>
            </label>

            {/* Checkbox 2: Audit History Note */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={addAuditNote}
                onChange={(e) => setAddAuditNote(e.target.checked)}
                className="mt-0.5 rounded text-[#1c398e] focus:ring-[#1c398e] cursor-pointer"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Record transfer in Review Notes History
                </span>
                <p className="text-[11px] text-slate-500">
                  Logs an official timestamped message in the proposal message board recording who performed the transfer.
                </p>
              </div>
            </label>

            {/* Optional Reason Input */}
            <div>
              <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                Reason / Transfer Note (Optional)
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Taking over communication directorship for 2026/2027"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1c398e]"
              />
            </div>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmTransfer}
            disabled={isSubmitting || (entryMode === 'directory' && !selectedUser)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#1c398e] hover:bg-blue-800 text-white transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Transferring Ownership...' : 'Transfer Ownership'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
