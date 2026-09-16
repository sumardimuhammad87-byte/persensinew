import React, { useState, useMemo } from 'react';
import {
  UserAccount,
  Teacher,
  ScheduleItem,
  Rombel,
  Subject,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  DayOfWeek,
  SchoolConfig,
} from '../types';
import {
  getTodayDateStr,
  getCurrentTimeStr,
  getIndonesianDayName,
  checkTeacherTeachingHours,
} from '../utils/storage';
import { formatIndonesianDateWithDay } from '../utils/holidays';
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Coffee,
  UserCheck,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Lock,
  ChevronRight,
  Layers,
  CalendarDays,
  FileSpreadsheet,
  Building2,
  Check,
  Shield,
  HelpCircle,
  Briefcase,
  Users,
} from 'lucide-react';

interface TeacherPortalTabProps {
  currentUser: UserAccount;
  teachers: Teacher[];
  schedules: ScheduleItem[];
  rombels: Rombel[];
  subjects: Subject[];
  teacherAttendanceRecords: TeacherAttendanceRecord[];
  schoolConfig: SchoolConfig;
  onRecordAttendance: (record: TeacherAttendanceRecord) => void;
  onDeleteAttendanceRecord?: (id: string) => void;
  onNavigateToClassAttendance?: (rombelId: string) => void;
  onUpdateCurrentUser?: (user: UserAccount) => void;
  onSyncAllTeacherAccounts?: () => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TeacherPortalTab: React.FC<TeacherPortalTabProps> = ({
  currentUser,
  teachers,
  schedules,
  rombels,
  subjects,
  teacherAttendanceRecords,
  schoolConfig,
  onRecordAttendance,
  onDeleteAttendanceRecord,
  onNavigateToClassAttendance,
  onUpdateCurrentUser,
  onSyncAllTeacherAccounts,
  onShowToast,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const todayStr = getTodayDateStr();
  const currentDayName = getIndonesianDayName(todayStr);

  // For Admin: Allow selecting which teacher to view/manage
  // For Teacher: Default to their own linked teacher record
  const initialTeacherId = useMemo(() => {
    if (currentUser.teacherId) {
      const match = teachers.find((t) => t.id === currentUser.teacherId);
      if (match) return match.id;
    }
    // Match by ID format USR-GUR-{teacherId}
    const cleanId = currentUser.id.replace('USR-GUR-', '');
    const idMatch = teachers.find((t) => t.id === cleanId);
    if (idMatch) return idMatch.id;

    // Match by email
    if (currentUser.email) {
      const emailMatch = teachers.find(
        (t) => t.email && t.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
      );
      if (emailMatch) return emailMatch.id;
    }
    // Match by name
    if (currentUser.nama) {
      const nameMatch = teachers.find(
        (t) => t.nama.toLowerCase().trim() === currentUser.nama.toLowerCase().trim()
      );
      if (nameMatch) return nameMatch.id;
    }
    // Match by username === NIP
    if (currentUser.username) {
      const nipMatch = teachers.find(
        (t) => t.nip.replace(/\s+/g, '') === currentUser.username.replace(/\s+/g, '')
      );
      if (nipMatch) return nipMatch.id;
    }
    // Fallback to first teacher
    return teachers.length > 0 ? teachers[0].id : '';
  }, [currentUser, teachers]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(initialTeacherId);

  // Active sub-tab inside Teacher Portal
  const [activeSubTab, setActiveSubTab] = useState<'status_hari_ini' | 'jadwal_mengajar' | 'kehadiran_saya' | 'pengaturan'>(
    'status_hari_ini'
  );

  // Active filter for weekly schedule view
  const [scheduleDayFilter, setScheduleDayFilter] = useState<'Semua' | DayOfWeek>('Semua');

  // Attendance Form States
  const [attStatus, setAttStatus] = useState<TeacherAttendanceStatus>('hadir');
  const [attKeterangan, setAttKeterangan] = useState<string>('');
  const [isSubmittingAtt, setIsSubmittingAtt] = useState<boolean>(false);

  // Password update states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Selected teacher object
  const currentTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId) || null;
  }, [teachers, selectedTeacherId]);

  // Walas homeroom check if teacher is also a Wali Kelas (1 akun terpadu)
  const teacherWaliKelas = useMemo(() => {
    const targetRombelId =
      currentTeacher?.rombelWaliKelasId ||
      (currentUser.role === 'walas' ? currentUser.rombelId : undefined);
    if (!targetRombelId) return null;
    return rombels.find((r) => r.id === targetRombelId) || null;
  }, [currentTeacher, currentUser, rombels]);

  // Rombels lookup
  const rombelMap = useMemo(() => {
    const map = new Map<string, Rombel>();
    rombels.forEach((r) => map.set(r.id, r));
    return map;
  }, [rombels]);

  // Subjects lookup
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => {
      map.set(s.id, s);
      map.set(s.nama.toLowerCase(), s);
    });
    return map;
  }, [subjects]);

  // Teaching hours check for selected teacher today
  const teachingInfo = useMemo(() => {
    if (!selectedTeacherId) {
      return {
        hasTeachingHours: false,
        countSessions: 0,
        totalJamPelajaran: 0,
        dayName: currentDayName,
        schedulesToday: [] as ScheduleItem[],
        allTeacherSchedules: [] as ScheduleItem[],
        nextSchedule: null,
      };
    }
    return checkTeacherTeachingHours(selectedTeacherId, schedules, todayStr);
  }, [selectedTeacherId, schedules, todayStr, currentDayName]);

  // Attendance records for selected teacher
  const teacherRecords = useMemo(() => {
    if (!selectedTeacherId) return [];
    return teacherAttendanceRecords
      .filter((r) => r.teacherId === selectedTeacherId)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [teacherAttendanceRecords, selectedTeacherId]);

  // Today's attendance record for selected teacher
  const todayRecord = useMemo(() => {
    return teacherRecords.find((r) => r.tanggal === todayStr) || null;
  }, [teacherRecords, todayStr]);

  // Attendance Statistics
  const stats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let dinas = 0;

    teacherRecords.forEach((r) => {
      if (r.status === 'hadir') hadir++;
      else if (r.status === 'izin') izin++;
      else if (r.status === 'sakit') sakit++;
      else if (r.status === 'dinas_luar') dinas++;
    });

    const total = teacherRecords.length;
    const rate = total > 0 ? Math.round((hadir / total) * 100) : 100;

    return { hadir, izin, sakit, dinas, total, rate };
  }, [teacherRecords]);

  // Filtered schedules for weekly schedule view
  const displayedSchedules = useMemo(() => {
    if (scheduleDayFilter === 'Semua') {
      const daysOrder: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return [...teachingInfo.allTeacherSchedules].sort((a, b) => {
        const dayA = daysOrder.indexOf(a.hari);
        const dayB = daysOrder.indexOf(b.hari);
        if (dayA !== dayB) return dayA - dayB;
        return (a.jamMulai || '').localeCompare(b.jamMulai || '');
      });
    }
    return teachingInfo.allTeacherSchedules
      .filter((s) => s.hari === scheduleDayFilter)
      .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));
  }, [teachingInfo.allTeacherSchedules, scheduleDayFilter]);

  // Total JP per week
  const totalJPWeekly = useMemo(() => {
    return teachingInfo.allTeacherSchedules.reduce((acc, curr) => acc + (curr.jumlahJam || 2), 0);
  }, [teachingInfo.allTeacherSchedules]);

  // Calculate current session status (ongoing, upcoming, finished)
  const getSessionTimeStatus = (schedule: ScheduleItem) => {
    if (!schedule.jamMulai || !schedule.jamSelesai) return 'none';
    const now = getCurrentTimeStr();
    const [startH, startM] = schedule.jamMulai.split(':').map(Number);
    const [endH, endM] = schedule.jamSelesai.split(':').map(Number);
    const [currH, currM] = now.split(':').map(Number);

    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;
    const currVal = currH * 60 + currM;

    if (currVal >= startVal && currVal <= endVal) {
      return 'ongoing'; // Sedang berlangsung
    } else if (currVal < startVal) {
      return 'upcoming'; // Akan datang
    } else {
      return 'finished'; // Selesai
    }
  };

  // Handle Attendance Check-In (Masuk)
  const handleCheckIn = () => {
    if (!currentTeacher) return;
    setIsSubmittingAtt(true);
    const nowTime = getCurrentTimeStr();

    const newRecord: TeacherAttendanceRecord = {
      id: `TATT-${todayStr}-${currentTeacher.id}`,
      teacherId: currentTeacher.id,
      nip: currentTeacher.nip || '-',
      namaGuru: currentTeacher.nama,
      tanggal: todayStr,
      waktuMasuk: nowTime,
      status: attStatus,
      metode: 'mandiri',
      keterangan: attKeterangan.trim() || (attStatus === 'hadir' ? 'Hadir tepat waktu' : undefined),
      adaJamMengajarHariIni: teachingInfo.hasTeachingHours,
      jumlahJamMengajarHariIni: teachingInfo.countSessions,
      recordedByName: currentUser.nama,
      recordedByRole: currentUser.role,
    };

    onRecordAttendance(newRecord);
    setIsSubmittingAtt(false);
    onShowToast?.(`Presensi masuk berhasil dicatat pada ${nowTime} WIB!`, 'success');
  };

  // Handle Attendance Check-Out (Pulang)
  const handleCheckOut = () => {
    if (!currentTeacher || !todayRecord) return;
    const nowTime = getCurrentTimeStr();

    const updatedRecord: TeacherAttendanceRecord = {
      ...todayRecord,
      waktuPulang: nowTime,
    };

    onRecordAttendance(updatedRecord);
    onShowToast?.(`Presensi pulang berhasil dicatat pada ${nowTime} WIB!`, 'success');
  };

  // Handle Password Update
  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      onShowToast?.('Password minimal 4 karakter!', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onShowToast?.('Konfirmasi password tidak cocok!', 'error');
      return;
    }

    if (onUpdateCurrentUser) {
      onUpdateCurrentUser({
        ...currentUser,
        password: newPassword,
      });
      setNewPassword('');
      setConfirmPassword('');
      onShowToast?.('Kata sandi berhasil diperbarui!', 'success');
    }
  };

  if (!currentTeacher && teachers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Belum Ada Data Guru</h3>
        <p className="text-sm">Silakan tambahkan data guru terlebih dahulu di tab Direktori Guru.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & TEACHER PROFILE CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-900/30 shrink-0">
              {currentTeacher?.nama ? currentTeacher.nama.charAt(0).toUpperCase() : 'G'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentTeacher?.nama || 'Akun Guru'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {teacherWaliKelas ? `Wali Kelas ${teacherWaliKelas.nama}` : 'Guru Pengajar'}
                </span>
                {currentTeacher?.statusKepegawaian && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {currentTeacher.statusKepegawaian}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong className="text-slate-300">NIP/NUPTK:</strong>{' '}
                  {currentTeacher?.nip && currentTeacher.nip !== '-' ? currentTeacher.nip : 'Belum diisi'}
                </span>
                {currentTeacher?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {currentTeacher.email}
                  </span>
                )}
                {currentTeacher?.telepon && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {currentTeacher.telepon}
                  </span>
                )}
              </p>

              {/* Mata Pelajaran yang diampu */}
              {currentTeacher?.mataPelajaran && currentTeacher.mataPelajaran.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 mr-1">Mapel Diampu:</span>
                  {currentTeacher.mataPelajaran.map((mapel, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-teal-300 border border-slate-700/80"
                    >
                      {mapel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Action: Admin Switch Teacher & Sync Accounts */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {isAdmin && (
              <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 block">
                  Pilih Guru untuk Dilihat (Mode Admin):
                </label>
                <select
                  id="select-teacher-portal"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama} {t.rombelWaliKelasId ? `(Walas)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && onSyncAllTeacherAccounts && (
              <button
                id="btn-sync-all-teachers"
                onClick={onSyncAllTeacherAccounts}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-900/20"
                title="Pastikan semua guru memiliki akun login aktif di sistem"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sinkronkan Akun Semua Guru
              </button>
            )}
          </div>
        </div>

        {/* SUB NAVIGATION PILLS */}
        <div className="flex items-center gap-2 overflow-x-auto mt-6 pt-4 border-t border-slate-800/80 scrollbar-none">
          <button
            id="subtab-status-hari-ini"
            onClick={() => setActiveSubTab('status_hari_ini')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeSubTab === 'status_hari_ini'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Status Hari Ini & Presensi
            {teachingInfo.hasTeachingHours ? (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            ) : null}
          </button>

          <button
            id="subtab-jadwal-mengajar"
            onClick={() => setActiveSubTab('jadwal_mengajar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeSubTab === 'jadwal_mengajar'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-purple-400" />
            Jadwal Mengajar ({teachingInfo.allTeacherSchedules.length} Sesi / {totalJPWeekly} JP)
          </button>

          <button
            id="subtab-kehadiran-saya"
            onClick={() => setActiveSubTab('kehadiran_saya')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeSubTab === 'kehadiran_saya'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-400" />
            Riwayat Kehadiran ({teacherRecords.length})
          </button>

          <button
            id="subtab-pengaturan-akun"
            onClick={() => setActiveSubTab('pengaturan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeSubTab === 'pengaturan'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-400" />
            Keamanan & Info Akun
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUBTAB: STATUS HARI INI & PRESENSI MANDIRI */}
      {/* ========================================================================= */}
      {activeSubTab === 'status_hari_ini' && (
        <div className="space-y-6">
          {/* BANNER STATUS: ADA JAM MENGAJAR ATAU TIDAK */}
          <div
            className={`p-6 rounded-3xl border transition-all ${
              teachingInfo.hasTeachingHours
                ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                : 'bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border-slate-800 shadow-lg'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    teachingInfo.hasTeachingHours
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {teachingInfo.hasTeachingHours ? (
                    <BookOpen className="w-7 h-7" />
                  ) : (
                    <Coffee className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
                      {formatIndonesianDateWithDay(todayStr)}
                    </span>
                    {teachingInfo.hasTeachingHours ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                        ADA JAM MENGAJAR HARI INI
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-amber-400 border border-amber-500/30">
                        TIDAK ADA JAM MENGAJAR HARI INI
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-white">
                    {teachingInfo.hasTeachingHours
                      ? `Hari ini Anda memiliki ${teachingInfo.countSessions} sesi kelas tatap muka (${teachingInfo.totalJamPelajaran} Jam Pelajaran)`
                      : 'Hari ini Anda bebas tugas mengajar tatap muka di kelas'}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                    {teachingInfo.hasTeachingHours
                      ? 'Pastikan melakukan presensi mandiri dan mencatat kehadiran siswa pada setiap rombel kelas di bawah ini.'
                      : teachingInfo.nextSchedule
                      ? `Jadwal mengajar berikutnya: ${teachingInfo.nextSchedule.day} (${teachingInfo.nextSchedule.schedule.jamMulai} - ${teachingInfo.nextSchedule.schedule.jamSelesai}) di rombel ${
                          rombelMap.get(teachingInfo.nextSchedule.schedule.rombelId)?.nama ||
                          teachingInfo.nextSchedule.schedule.rombelId
                        }.`
                      : 'Belum ada jadwal mengajar yang terdaftar untuk hari lain.'}
                  </p>
                </div>
              </div>

              {/* Quick stats badge */}
              <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-800 shrink-0">
                <div className="text-center px-2">
                  <span className="text-xs text-slate-500 block font-medium">Sesi Hari Ini</span>
                  <span className="text-lg font-black text-white">{teachingInfo.countSessions}</span>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="text-center px-2">
                  <span className="text-xs text-slate-500 block font-medium">Jam Pelajaran</span>
                  <span className="text-lg font-black text-emerald-400">
                    {teachingInfo.totalJamPelajaran} JP
                  </span>
                </div>
              </div>
            </div>

            {/* IF HAS TEACHING HOURS: RENDER TODAY'S CLASS SESSIONS */}
            {teachingInfo.hasTeachingHours && (
              <div className="mt-6 pt-5 border-t border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Rincian Jadwal Mengajar Hari Ini ({currentDayName}):
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teachingInfo.schedulesToday.map((item, idx) => {
                    const rombelObj = rombelMap.get(item.rombelId);
                    const subjectObj = subjectMap.get(item.subjectId);
                    const timeStatus = getSessionTimeStatus(item);

                    return (
                      <div
                        key={item.id || idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          timeStatus === 'ongoing'
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            {item.jamMulai || '--:--'} - {item.jamSelesai || '--:--'}
                          </span>

                          {timeStatus === 'ongoing' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                              SEDANG BERLANGSUNG
                            </span>
                          )}
                          {timeStatus === 'upcoming' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Akan Datang
                            </span>
                          )}
                          {timeStatus === 'finished' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                              Selesai
                            </span>
                          )}
                        </div>

                        <h5 className="text-sm font-bold text-white mb-0.5">
                          {subjectObj?.nama || item.subjectId}
                        </h5>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold text-slate-300">
                            {rombelObj?.nama || item.rombelId}
                          </span>
                          {item.ruangan && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{item.ruangan}</span>
                            </>
                          )}
                        </p>

                        {onNavigateToClassAttendance && (
                          <button
                            id={`btn-open-class-${item.id}`}
                            onClick={() => onNavigateToClassAttendance(item.rombelId)}
                            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition flex items-center justify-center gap-1.5 group"
                          >
                            <span>Buka Presensi Kelas {rombelObj?.nama || ''}</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* UNIFIED WALAS CARD IF TEACHER IS ALSO A WALI KELAS */}
          {teacherWaliKelas && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/40 border border-teal-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                      1 Akun Terpadu Walas & Guru
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      Wali Kelas Aktif
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Kelas Bimbingan Perwalian:{' '}
                    <span className="text-teal-300">{teacherWaliKelas.nama}</span>
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      ({teacherWaliKelas.tingkat} - {teacherWaliKelas.jurusan})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sebagai Wali Kelas, Anda dapat memantau presensi harian, scanner barcode, atau token kehadiran kelas perwalian Anda langsung dari akun ini tanpa perlu login ulang.
                  </p>
                </div>
              </div>

              {onNavigateToClassAttendance && (
                <button
                  id="btn-portal-open-homeroom"
                  onClick={() => onNavigateToClassAttendance(teacherWaliKelas.id)}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-teal-950/40 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Buka Presensi Kelas {teacherWaliKelas.nama}</span>
                </button>
              )}
            </div>
          )}

          {/* PRESENSI MANDIRI HARI INI CARD */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CHECK-IN / CHECK-OUT INTERACTIVE FORM */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Presensi Mandiri Guru Hari Ini</h3>
                    <p className="text-xs text-slate-400">
                      Pencatatan kehadiran dinas guru SMK Bakti Putra Mandiri
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                    {todayStr}
                  </span>
                </div>
              </div>

              {/* Status Alert if already checked in */}
              {todayRecord ? (
                <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Status Kehadiran Tercatat:</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            todayRecord.status === 'hadir'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : todayRecord.status === 'izin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : todayRecord.status === 'sakit'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {todayRecord.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-300 font-mono">
                          Masuk: <strong className="text-white">{todayRecord.waktuMasuk} WIB</strong>
                        </span>
                        {todayRecord.waktuPulang && (
                          <span className="text-xs text-slate-300 font-mono">
                            Pulang: <strong className="text-white">{todayRecord.waktuPulang} WIB</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {!todayRecord.waktuPulang && (
                      <button
                        id="btn-presensi-pulang"
                        onClick={handleCheckOut}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-teal-900/30 shrink-0"
                      >
                        <Clock className="w-4 h-4" />
                        Presensi Pulang (Check-Out)
                      </button>
                    )}
                  </div>

                  {todayRecord.keterangan && (
                    <div className="text-xs text-slate-300 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                      <strong className="text-slate-400">Catatan/Keterangan:</strong>{' '}
                      {todayRecord.keterangan}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-700/60">
                    <span>Metode: {todayRecord.metode === 'mandiri' ? 'Presensi Mandiri' : 'Manual'}</span>
                    <span>
                      Jam Mengajar: {todayRecord.adaJamMengajarHariIni ? 'Ada Mengajar' : 'Bebas Mengajar'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Form if not yet checked in */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-2">
                      Pilih Status Kehadiran Anda Hari Ini:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAttStatus('hadir')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                          attStatus === 'hadir'
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Hadir
                      </button>

                      <button
                        type="button"
                        onClick={() => setAttStatus('izin')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                          attStatus === 'izin'
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        Izin
                      </button>

                      <button
                        type="button"
                        onClick={() => setAttStatus('sakit')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                          attStatus === 'sakit'
                            ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <HelpCircle className="w-5 h-5 text-rose-400" />
                        Sakit
                      </button>

                      <button
                        type="button"
                        onClick={() => setAttStatus('dinas_luar')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                          attStatus === 'dinas_luar'
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Briefcase className="w-5 h-5 text-blue-400" />
                        Dinas Luar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Keterangan / Catatan Tugas (Opsional):
                    </label>
                    <input
                      type="text"
                      id="input-att-keterangan"
                      value={attKeterangan}
                      onChange={(e) => setAttKeterangan(e.target.value)}
                      placeholder={
                        attStatus === 'hadir'
                          ? 'Contoh: Hadir mengajar di kelas, siap tatap muka'
                          : attStatus === 'dinas_luar'
                          ? 'Contoh: Rapat MGMP di Dinas Pendidikan Kota'
                          : 'Tuliskan alasan izin/sakit...'
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    id="btn-submit-presensi-masuk"
                    onClick={handleCheckIn}
                    disabled={isSubmittingAtt}
                    className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Catat Presensi Masuk Sekarang
                  </button>
                </div>
              )}
            </div>

            {/* KPI STATS CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Rekap Kehadiran Guru
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 block">Total Hadir</span>
                  <span className="text-xl font-black text-emerald-400">{stats.hadir}</span>
                  <span className="text-[10px] text-slate-500 block">Hari Efektif</span>
                </div>

                <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 block">Persentase</span>
                  <span className="text-xl font-black text-teal-300">{stats.rate}%</span>
                  <span className="text-[10px] text-slate-500 block">Tingkat Hadir</span>
                </div>

                <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 block">Izin / Sakit</span>
                  <span className="text-xl font-black text-amber-400">{stats.izin + stats.sakit}</span>
                  <span className="text-[10px] text-slate-500 block">
                    {stats.izin} Izin / {stats.sakit} Sakit
                  </span>
                </div>

                <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 block">Dinas Luar</span>
                  <span className="text-xl font-black text-blue-400">{stats.dinas}</span>
                  <span className="text-[10px] text-slate-500 block">Kegiatan Luar</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Data kehadiran guru tersinkronisasi otomatis dengan server cloud Firestore dan
                  dapat dipantau oleh Kepala Sekolah serta bagian kurikulum.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBTAB: JADWAL MENGAJAR LENGKAP */}
      {/* ========================================================================= */}
      {activeSubTab === 'jadwal_mengajar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-purple-400" />
                Jadwal Mengajar Lengkap: {currentTeacher?.nama}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total {teachingInfo.allTeacherSchedules.length} sesi tatap muka • {totalJPWeekly} Jam Pelajaran (JP) per minggu
              </p>
            </div>

            {/* DAY FILTER PILLS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  id={`filter-day-${day}`}
                  onClick={() => setScheduleDayFilter(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    scheduleDayFilter === day
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* SCHEDULES TABLE / CARDS */}
          {displayedSchedules.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400">
              <Coffee className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">Tidak ada jadwal mengajar pada hari {scheduleDayFilter}</p>
              <p className="text-xs text-slate-500 mt-1">
                Guru bebas dari jam tatap muka pada hari ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedSchedules.map((item, idx) => {
                const rombelObj = rombelMap.get(item.rombelId);
                const subjectObj = subjectMap.get(item.subjectId);
                const isToday = item.hari === currentDayName;

                return (
                  <div
                    key={item.id || idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isToday
                        ? 'bg-slate-800/90 border-purple-500/40 shadow-md'
                        : 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          isToday ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {item.hari}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" />
                        {item.jamMulai || '--:--'} - {item.jamSelesai || '--:--'}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-white mb-1">
                      {subjectObj?.nama || item.subjectId}
                    </h5>

                    <div className="text-xs text-slate-400 space-y-1 mb-3">
                      <p className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Rombel:</span>
                        <strong className="text-slate-200">{rombelObj?.nama || item.rombelId}</strong>
                      </p>
                      {item.ruangan && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ruangan:</span>
                          <span className="text-slate-300">{item.ruangan}</span>
                        </p>
                      )}
                    </div>

                    {onNavigateToClassAttendance && (
                      <button
                        onClick={() => onNavigateToClassAttendance(item.rombelId)}
                        className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition flex items-center justify-center gap-1.5"
                      >
                        <span>Buka Presensi Siswa</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUBTAB: RIWAYAT KEHADIRAN SAYA */}
      {/* ========================================================================= */}
      {activeSubTab === 'kehadiran_saya' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                Riwayat Presensi Guru: {currentTeacher?.nama}
              </h3>
              <p className="text-xs text-slate-400">
                Catatan absensi harian dan status jam mengajar guru
              </p>
            </div>
          </div>

          {teacherRecords.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">Belum Ada Riwayat Presensi</p>
              <p className="text-xs text-slate-500 mt-1">
                Lakukan presensi mandiri pada sub-tab &quot;Status Hari Ini &amp; Presensi&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Tanggal &amp; Hari</th>
                    <th className="py-3 px-4">Jam Masuk</th>
                    <th className="py-3 px-4">Jam Pulang</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Ada Jam Mengajar</th>
                    <th className="py-3 px-4">Keterangan</th>
                    {isAdmin && onDeleteAttendanceRecord && (
                      <th className="py-3 px-4 text-center">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {teacherRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                        {formatIndonesianDateWithDay(r.tanggal)}
                      </td>
                      <td className="py-3 px-4 font-mono">{r.waktuMasuk || '-'}</td>
                      <td className="py-3 px-4 font-mono">{r.waktuPulang || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            r.status === 'hadir'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : r.status === 'izin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : r.status === 'sakit'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.adaJamMengajarHariIni ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            Ada ({r.jumlahJamMengajarHariIni || 1} Sesi)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-400">
                            Tidak Ada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        {r.keterangan || '-'}
                      </td>
                      {isAdmin && onDeleteAttendanceRecord && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onDeleteAttendanceRecord(r.id)}
                            className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition"
                            title="Hapus rekaman absen ini"
                          >
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUBTAB: PENGATURAN & KEAMANAN AKUN */}
      {/* ========================================================================= */}
      {activeSubTab === 'pengaturan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PASSWORD CHANGE FORM */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Ganti Kata Sandi Akun
            </h3>
            <p className="text-xs text-slate-400">
              Ubah kata sandi untuk mengamankan akun guru Anda saat login ke sistem presensi.
            </p>

            <form onSubmit={handlePasswordUpdate} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Kata Sandi Baru:
                </label>
                <input
                  type="password"
                  id="input-teacher-new-pwd"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ulangi Kata Sandi Baru:
                </label>
                <input
                  type="password"
                  id="input-teacher-confirm-pwd"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                id="btn-save-teacher-password"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center justify-center gap-2 shadow-md shadow-amber-900/30"
              >
                <Lock className="w-3.5 h-3.5" />
                Simpan Kata Sandi Baru
              </button>
            </form>
          </div>

          {/* ACCOUNT INFO & CREDENTIALS DETAILS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Informasi Akun &amp; Kredensial Login
            </h3>
            <p className="text-xs text-slate-400">
              Gunakan informasi di bawah ini untuk masuk ke aplikasi di ponsel atau perangkat lain.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">Username Login:</span>
                <span className="font-mono font-bold text-white">
                  {currentUser.username || (currentTeacher?.nip && currentTeacher.nip !== '-' ? currentTeacher.nip.replace(/\s+/g, '') : currentTeacher?.id.toLowerCase())}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">Email Terdaftar:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {currentTeacher?.email || currentUser.email || '-'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">Hak Akses Sistem:</span>
                <span className="font-bold text-white uppercase">{currentUser.role}</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">Status Kepegawaian:</span>
                <span className="font-semibold text-slate-200">
                  {currentTeacher?.statusKepegawaian || 'Pendidik / Tenaga Kependidikan'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
