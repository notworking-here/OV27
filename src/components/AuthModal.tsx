import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  X,
  Shield,
  ShieldCheck,
  User,
  LogOut,
  Mail,
  ArrowRight,
  CheckCircle2,
  Building,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  KeyRound,
} from 'lucide-react';
import {
  UserAccount,
  UserRole,
  UNION_CATEGORIES,
  ALL_INSTITUTION_CATEGORIES,
  UNION_ACRONYMS,
  UNIONS,
  isSuperAdminEmail,
} from '../types';
import {
  auth,
  signInWithGooglePopup,
  completeGoogleSignIn,
  authenticateWithEmailPassword,
  sendUserPasswordReset,
} from '../lib/firebase';
import { updateUserAccountDetails } from '../services/proposalService';
import { HopeChannelLogo } from './HopeChannelLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onUpdateUser: (updated: UserAccount) => void;
  onSignOut: () => void | Promise<void>;
  onSimulateRole: (role: UserRole, union?: string) => void;
  isSimulated?: boolean;
  initialPendingGoogleUser?: FirebaseUser | null;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onSignOut,
  onSimulateRole,
  isSimulated,
  initialPendingGoogleUser,
}: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email & Password Authentication State
  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'forgot_password'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [union, setUnion] = useState('');
  const [title, setTitle] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Pending First-Time Google User State
  const [pendingGoogleUser, setPendingGoogleUser] = useState<FirebaseUser | null>(
    initialPendingGoogleUser || null
  );
  const [googleSelectedUnion, setGoogleSelectedUnion] = useState('');
  const [googleSelectedTitle, setGoogleSelectedTitle] = useState('');
  const [simulatorUnion, setSimulatorUnion] = useState<string>(
    currentUser?.union || 'Southeastern Asia Union Mission'
  );

  // Sync prop when an unconfirmed Google user is passed
  useEffect(() => {
    if (initialPendingGoogleUser) {
      setPendingGoogleUser(initialPendingGoogleUser);
    }
  }, [initialPendingGoogleUser]);

  // Profile Edit State (when already logged in)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentUser?.displayName || '');
  const [editTitle, setEditTitle] = useState(currentUser?.title || '');
  const [editUnion, setEditUnion] = useState(
    currentUser?.union || 'East Central Philippine Union Conference'
  );
  const [editDept, setEditDept] = useState(currentUser?.department || 'Media & Communication');

  if (!isOpen) return null;

  const isLoggedIn = Boolean(currentUser && currentUser.email);
  const isPendingGoogle =
    !isLoggedIn &&
    Boolean(
      pendingGoogleUser &&
        pendingGoogleUser.providerData?.some((p) => p.providerId === 'google.com')
    );
  const isSuperAdminEmailDetected = isSuperAdminEmail(email);

  // 1-Click Google Sign In
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user: fbUser, existingAccount } = await signInWithGooglePopup();
      const emailLower = (fbUser.email || '').toLowerCase();
      const isSuperAdmin = isSuperAdminEmail(emailLower);

      // Check if returning user ALREADY has an explicitly confirmed union in Firestore:
      const hasConfirmedUnion = Boolean(
        existingAccount &&
        existingAccount.union &&
        existingAccount.unionConfirmed
      );

      if (isSuperAdmin || hasConfirmedUnion) {
        const assignedUnion = isSuperAdmin
          ? 'Southern Asia-Pacific Division'
          : existingAccount!.union;
        const account = await completeGoogleSignIn(fbUser, assignedUnion);
        onUpdateUser(account);
        setSuccessMsg(`Welcome, ${account.displayName}! Signed in with Google.`);
        setTimeout(() => {
          onClose();
        }, 500);
        return;
      }

      // First-time Google registrant or unconfirmed user: prompt for union selection
      setPendingGoogleUser(fbUser);
      setGoogleSelectedUnion(existingAccount?.union || '');
    } catch (err: unknown) {
      console.warn('Google sign-in error:', err);
      const isPopupIssue =
        err instanceof Error &&
        (err.message.includes('popup') ||
          err.message.includes('cancelled') ||
          err.message.includes('closed') ||
          err.message.includes('blocked'));

      if (isPopupIssue) {
        setErrorMsg(
          'Google pop-up was blocked or closed. You can instantly sign in using your work email below.'
        );
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Google sign-in was not completed. You can use your work email below.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Confirm Union for first-time Google sign-in
  const handleConfirmGoogleUnion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;

    if (!googleSelectedUnion) {
      setErrorMsg('Please select your Union Affiliation to proceed.');
      return;
    }

    if (!googleSelectedTitle.trim()) {
      setErrorMsg('Please enter your official office title / designation.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const account = await completeGoogleSignIn(
        pendingGoogleUser,
        googleSelectedUnion,
        googleSelectedTitle.trim()
      );
      onUpdateUser(account);
      setSuccessMsg(`Welcome, ${account.displayName}! Profile configured.`);
      setTimeout(() => {
        setPendingGoogleUser(null);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Error completing Google setup:', err);
      setErrorMsg('Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Email & Password
  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your work email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const account = await authenticateWithEmailPassword(email.trim(), password, false);
      onUpdateUser(account);
      setSuccessMsg(
        account.role === 'super_admin'
          ? 'Welcome, Elder Anthony Stanyer (Division Admin)!'
          : `Welcome back, ${account.displayName}!`
      );
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      console.warn('Sign-in notice:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not sign in with this email and password.');
    } finally {
      setLoading(false);
    }
  };

  // Register New Account with Email & Password
  const handleEmailPasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter your work email address.');
      return;
    }
    if (!union) {
      setErrorMsg('Please select your union affiliation.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter your official office title / designation.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter matching passwords.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const account = await authenticateWithEmailPassword(
        email.trim(),
        password,
        true,
        name.trim(),
        isSuperAdminEmailDetected ? 'Southern Asia-Pacific Division' : union,
        isSuperAdminEmailDetected ? 'super_admin' : 'user',
        title.trim()
      );
      onUpdateUser(account);
      setSuccessMsg(`Welcome, ${account.displayName}! Account created and registered successfully in SSD directory.`);
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: unknown) {
      console.warn('Registration notice:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Send Password Reset Link
  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await sendUserPasswordReset(email.trim());
      setSuccessMsg(`Password reset link sent to ${email.trim()}! Check your inbox to set a new password.`);
    } catch (err: unknown) {
      console.warn('Password reset notice:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await onSignOut();
      setSuccessMsg('Signed out successfully.');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 400);
    } catch (err: unknown) {
      console.error('Sign-out error:', err);
      setErrorMsg('Failed to sign out completely.');
    } finally {
      setLoading(false);
    }
  };

  // Save profile changes (Department, Title, Name, Union) and persist to Firestore
  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanDept = editDept.trim() || 'Communication';
      const cleanTitle = editTitle.trim() || currentUser.title || 'Director';
      const cleanName = editName.trim() || currentUser.displayName;

      const canEditUnion = !currentUser.unionConfirmed || currentUser.role === 'super_admin';
      const effectiveUnion = canEditUnion ? editUnion : currentUser.union;

      const updates: Partial<UserAccount> = {
        displayName: cleanName,
        title: cleanTitle,
        department: cleanDept,
        ...(canEditUnion ? { union: effectiveUnion, institution: effectiveUnion } : {}),
      };

      // Persist to Firestore if user is authenticated with a UID
      if (currentUser.uid) {
        await updateUserAccountDetails(currentUser.uid, updates);
      }

      const updated: UserAccount = {
        ...currentUser,
        ...updates,
      };

      onUpdateUser(updated);
      setIsEditingProfile(false);
      setSuccessMsg('Profile updated and saved to cloud.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      setErrorMsg('Could not save profile changes to cloud. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (roleValue: UserRole) => {
    switch (roleValue) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            Division Admin (All Unions)
          </span>
        );
      case 'division_liaison':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-950 border border-indigo-300">
            <Shield className="w-3.5 h-3.5 text-indigo-700" />
            Division Liaison
          </span>
        );
      case 'coordinator':
      case 'treasurer':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-300">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            {roleValue === 'treasurer' ? 'Union Treasurer' : 'Union Coordinator'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <User className="w-3.5 h-3.5 text-slate-600" />
            Proposal Author
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-[#fbfcfd]">
          <div className="flex items-center gap-3">
            <HopeChannelLogo className="w-10 h-10 shadow-xs" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isLoggedIn
                  ? 'Account & Access'
                  : isPendingGoogle
                  ? 'Confirm Your Union'
                  : 'SSD OneVoice27 Sign In'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPendingGoogleUser(null);
              onClose();
            }}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed flex items-center gap-2">
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: LOGGED IN USER PROFILE */}
          {isLoggedIn && currentUser && (
            <div className="p-5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1c398e] text-white flex items-center justify-center font-bold text-lg shadow-xs overflow-hidden">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      currentUser.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {currentUser.displayName}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              {/* Role badge & Union Affiliation */}
              <div className="pt-3 border-t border-slate-200/60 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Access Level:</span>
                  {getRoleBadge(currentUser.role)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Assigned Union:</span>
                  <span
                    className="font-bold text-slate-800 text-right truncate max-w-[240px]"
                    title={currentUser.union}
                  >
                    {currentUser.union}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Office Title:</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-[240px]">
                    {currentUser.title || (currentUser.role === 'super_admin' ? 'Division Admin' : 'Director')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Department:</span>
                  <span className="font-medium text-slate-700">
                    {currentUser.department || 'Communication'}
                  </span>
                </div>
              </div>

              {/* Toggle Profile Edit */}
              {!isEditingProfile ? (
                <div className="pt-1 flex items-center justify-between border-t border-slate-200/50">
                  <span className="text-[11px] text-slate-400">Connected & Synced</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(currentUser.displayName);
                      setEditTitle(currentUser.title || '');
                      setEditUnion(currentUser.union);
                      setEditDept(currentUser.department || '');
                      setIsEditingProfile(true);
                    }}
                    className="text-xs font-semibold text-[#1c398e] hover:underline cursor-pointer"
                  >
                    {currentUser.unionConfirmed && currentUser.role !== 'super_admin'
                      ? 'Edit profile details'
                      : 'Edit details & union'}
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Office Title / Designation
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Communication Director, Hope Channel Lead, Union Treasurer"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      placeholder="e.g. Communication & Hope Channel, Treasury, Secretariat, Youth"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Union Affiliation
                    </label>
                    {currentUser.unionConfirmed && currentUser.role !== 'super_admin' ? (
                      <div className="space-y-1">
                        <div className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600 flex items-center justify-between">
                          <span className="truncate">{currentUser.union}</span>
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          Union affiliation is locked after confirmation. Contact Division Admin to reassign territories.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={editUnion}
                        onChange={(e) => setEditUnion(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                          <optgroup key={cat.category} label={cat.category}>
                            {cat.unions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1c398e] text-white hover:bg-[#152c70] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      {loading ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              )}

              {/* Simulation Quick Switcher for Verified Super Admins */}
              {Boolean(auth.currentUser && isSuperAdminEmail(auth.currentUser.email)) &&
                (currentUser.role === 'super_admin' || isSimulated) && (
                <div className="pt-3 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Role Preview Simulator
                    </span>
                    {isSimulated && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Simulating {UNION_ACRONYMS[currentUser.union] || currentUser.union}
                      </span>
                    )}
                  </div>

                  {/* Territory Selector for simulation */}
                  <div className="space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Target Union:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSimulatorUnion('Southeastern Asia Union Mission')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                            simulatorUnion.includes('Southeastern Asia') || simulatorUnion === 'SEUM'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          SEUM
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimulatorUnion('East Central Philippine Union Conference')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                            simulatorUnion.includes('East Central') || simulatorUnion === 'ECPUC'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          ECPUC
                        </button>
                      </div>
                    </div>
                    <select
                      value={simulatorUnion}
                      onChange={(e) => setSimulatorUnion(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {UNIONS.map((u) => (
                        <option key={u} value={u}>
                          {UNION_ACRONYMS[u] ? `${UNION_ACRONYMS[u]} — ` : ''}{u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Role Selector Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => onSimulateRole('super_admin')}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                        currentUser.role === 'super_admin' && !isSimulated
                          ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => onSimulateRole('division_liaison', simulatorUnion)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                        currentUser.role === 'division_liaison'
                          ? 'bg-indigo-100 text-indigo-950 border-indigo-300 ring-1 ring-indigo-400 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      Liaison
                    </button>
                    <button
                      type="button"
                      onClick={() => onSimulateRole('coordinator', simulatorUnion)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                        currentUser.role === 'coordinator'
                          ? 'bg-blue-100 text-blue-900 border-blue-300 ring-1 ring-blue-400 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      Coordinator
                    </button>
                    <button
                      type="button"
                      onClick={() => onSimulateRole('treasurer', simulatorUnion)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                        currentUser.role === 'treasurer'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      Treasurer
                    </button>
                    <button
                      type="button"
                      onClick={() => onSimulateRole('user', simulatorUnion)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition border cursor-pointer ${
                        currentUser.role === 'user' && isSimulated
                          ? 'bg-slate-200 text-slate-900 border-slate-300 ring-1 ring-slate-400 font-bold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      Author
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FIRST-TIME GOOGLE USER UNION CONFIRMATION */}
          {isPendingGoogle && pendingGoogleUser && (
            <form onSubmit={handleConfirmGoogleUnion} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200/80 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#1c398e] text-white flex items-center justify-center font-bold text-lg shadow-xs overflow-hidden shrink-0">
                  {pendingGoogleUser.photoURL ? (
                    <img
                      src={pendingGoogleUser.photoURL}
                      alt={pendingGoogleUser.displayName || ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (pendingGoogleUser.displayName || 'D').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    Welcome, {pendingGoogleUser.displayName || 'Director'}!
                  </h3>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    {pendingGoogleUser.email}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Your Union Affiliation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={googleSelectedUnion}
                  onChange={(e) => setGoogleSelectedUnion(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="" disabled>
                    -- Select Your Union Affiliation --
                  </option>
                  {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                    <optgroup key={cat.category} label={cat.category}>
                      {cat.unions.map((u) => (
                        <option key={u} value={u}>
                          {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                          {u}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Your proposals, reviews, and budget pool will be tied to this Union.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Office Title / Designation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={googleSelectedTitle}
                  onChange={(e) => setGoogleSelectedTitle(e.target.value)}
                  placeholder="e.g. Communication Director, Union Treasurer, Hope Channel Lead"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Your official title will appear on submitted proposals and administrative records.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingGoogleUser(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !googleSelectedUnion}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Save Union & Continue to Workbook</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: SECURE SIGN IN & REGISTRATION (DEFAULT NOT LOGGED IN) */}
          {!isLoggedIn && !isPendingGoogle && (
            <div className="space-y-4">
              {/* Primary 1-Click Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 transition shadow-xs cursor-pointer group"
              >
                <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Or continue with Email & Password
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Mode Toggle Switch: Sign In vs Create Account */}
              {authMode !== 'forgot_password' ? (
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'signin'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create Account</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    Reset Your Password
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}

              {/* SUB-VIEW A: SIGN IN FORM */}
              {authMode === 'signin' && (
                <form onSubmit={handleEmailPasswordSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Work Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        placeholder="Work email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot_password');
                          setErrorMsg(null);
                        }}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter your account password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isSuperAdminEmailDetected && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-semibold animate-in fade-in">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Executive Account detected: Logging in as Division Admin</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="remember-device"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="remember-device" className="text-xs text-slate-600 select-none cursor-pointer">
                      Keep me signed in on this computer
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
                  >
                    <span>Sign In to Workbook</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* SUB-VIEW B: REGISTER NEW ACCOUNT FORM */}
              {authMode === 'register' && (
                <form onSubmit={handleEmailPasswordRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Pastor John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Work Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        placeholder="work.email@adventist.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Union Affiliation <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <select
                        value={union}
                        onChange={(e) => setUnion(e.target.value)}
                        required
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer bg-white"
                      >
                        <option value="" disabled>
                          -- Select Your Union Affiliation --
                        </option>
                        {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                          <optgroup key={cat.category} label={cat.category}>
                            {cat.unions.map((u) => (
                              <option key={u} value={u}>
                                {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                                {u}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Office Title / Designation <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Communication Director, Union Treasurer, Hope Channel Lead"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Create Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder="Min 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder="Re-type password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Account will be automatically registered in the SSD directory for role management.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-2xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
                  >
                    <span>Create Account & Register</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* SUB-VIEW C: FORGOT PASSWORD FORM */}
              {authMode === 'forgot_password' && (
                <form onSubmit={handleForgotPasswordReset} className="space-y-3.5">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                    Enter your registered work email address below. We will send you an official password reset link.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Work Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        placeholder="Work email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <span>Send Password Reset Email</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => {
              setPendingGoogleUser(null);
              onClose();
            }}
            className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
          >
            Continue as Guest (Local Draft Only)
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingGoogleUser(null);
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
