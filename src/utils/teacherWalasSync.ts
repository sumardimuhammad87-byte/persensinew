import { Teacher, Rombel, UserAccount, UserRole } from '../types';

/**
 * Utility untuk Konsolidasi 1 Akun Terpadu untuk Wali Kelas & Guru Pengajar
 * 
 * Aturan Utama:
 * 1. Seorang guru yang juga menjabat sebagai Wali Kelas HANYA MEMILIKI TEPAT 1 AKUN PENGGUNA.
 * 2. Tidak boleh ada akun terpisah (misal akun 'walas_x' terpisah dari akun 'guru_budi').
 * 3. Akun terpadu ini memiliki:
 *    - role: 'walas' (memiliki seluruh wewenang Wali Kelas & wewenang Guru Pengajar)
 *    - teacherId: ID Guru terkait (terhubung ke presensi guru mandiri & jadwal mengajar)
 *    - rombelId: ID Kelas perwaliannya (terhubung ke presensi siswa kelas perwaliannya)
 *    - jabatan: "Wali Kelas [Nama Rombel] & Guru Pengajar"
 * 4. Jika ada akun duplikat lama (misal akun khusus walas dan akun guru yang terpisah):
 *    - Sistem otomatis menggabungkannya (merge/deduplikasi) menjadi 1 akun terpadu.
 *    - Kata sandi custom yang sudah diubah oleh pengguna akan tetap dipertahankan.
 * 5. Login fleksibel: Guru/Walas dapat masuk menggunakan NIP/NUPTK (dengan/tanpa spasi), email, atau username.
 */

export function cleanString(str?: string): string {
  return str ? str.trim().toLowerCase() : '';
}

export function cleanNip(nip?: string): string {
  if (!nip || nip === '-') return '';
  return nip.replace(/\s+/g, '');
}

export function syncTeachersAndWalasWithUserAccounts(
  teachers: Teacher[],
  rombels: Rombel[],
  existingUsers: UserAccount[]
): {
  updatedUsers: UserAccount[];
  updatedTeachers: Teacher[];
  countConsolidated: number;
  countCreated: number;
} {
  let countConsolidated = 0;
  let countCreated = 0;

  // Clone lists to avoid direct mutations
  let currentUsers = [...existingUsers];
  let currentTeachers = [...teachers];

  // Helper maps
  const rombelMap = new Map<string, Rombel>();
  rombels.forEach((r) => rombelMap.set(r.id, r));

  // 1. Sync Rombel <-> Teacher Wali Kelas Bidirectional Linking
  // Pastikan jika Rombel mencatat waliKelasNip / waliKelasNama, Teacher memiliki rombelWaliKelasId yang cocok, dan sebaliknya
  currentTeachers = currentTeachers.map((teacher) => {
    let assignedRombelId = teacher.rombelWaliKelasId;

    if (!assignedRombelId) {
      // Cari apakah ada rombel yang menunjuk guru ini sebagai walas
      const matchingRombel = rombels.find((r) => {
        const nipMatch = cleanNip(r.waliKelasNip) && cleanNip(r.waliKelasNip) === cleanNip(teacher.nip);
        const nameMatch = cleanString(r.waliKelasNama) && cleanString(r.waliKelasNama) === cleanString(teacher.nama);
        return nipMatch || nameMatch;
      });
      if (matchingRombel) {
        assignedRombelId = matchingRombel.id;
      }
    }

    if (assignedRombelId !== teacher.rombelWaliKelasId) {
      return { ...teacher, rombelWaliKelasId: assignedRombelId };
    }
    return teacher;
  });

  // 2. Map penugasan Wali Kelas per Guru
  // teacherId -> Rombel
  const teacherWalasMap = new Map<string, Rombel>();
  currentTeachers.forEach((t) => {
    if (t.rombelWaliKelasId && rombelMap.has(t.rombelWaliKelasId)) {
      teacherWalasMap.set(t.id, rombelMap.get(t.rombelWaliKelasId)!);
    } else {
      // Cari berdasarkan NIP atau Nama
      const match = rombels.find((r) => {
        const nipMatch = cleanNip(r.waliKelasNip) && cleanNip(r.waliKelasNip) === cleanNip(t.nip);
        const nameMatch = cleanString(r.waliKelasNama) && cleanString(r.waliKelasNama) === cleanString(t.nama);
        return nipMatch || nameMatch;
      });
      if (match) {
        teacherWalasMap.set(t.id, match);
      }
    }
  });

  // 3. Proses setiap Teacher untuk memastikan TEPAT 1 AKUN PENGGUNA TERPADU
  const processedUserIds = new Set<string>();
  const consolidatedList: UserAccount[] = [];

  currentTeachers.forEach((teacher) => {
    const walasRombel = teacherWalasMap.get(teacher.id);
    const isWalas = Boolean(walasRombel);
    const teacherCleanNip = cleanNip(teacher.nip);
    const teacherCleanEmail = cleanString(teacher.email);
    const teacherCleanName = cleanString(teacher.nama);

    // Cari semua akun pengguna yang cocok dengan guru ini
    const matchingIndices: number[] = [];
    currentUsers.forEach((u, idx) => {
      if (processedUserIds.has(u.id)) return;

      // Siswa dan pengurus kelas tidak boleh dicocokkan sebagai guru
      if (u.role === 'siswa' || u.role === 'ketua_kelas' || u.role === 'sekretaris') return;

      const matchesTeacherId = u.teacherId === teacher.id || u.id === `USR-GUR-${teacher.id}`;
      const matchesEmail = teacherCleanEmail && cleanString(u.email) === teacherCleanEmail;
      const matchesNip = teacherCleanNip && (cleanNip(u.username) === teacherCleanNip || cleanNip(u.nipd) === teacherCleanNip);
      const matchesName = teacherCleanName && cleanString(u.nama) === teacherCleanName && (u.role === 'guru' || u.role === 'walas');
      const matchesWalasRombel = isWalas && u.role === 'walas' && u.rombelId === walasRombel!.id;

      if (matchesTeacherId || matchesEmail || matchesNip || matchesName || matchesWalasRombel) {
        matchingIndices.push(idx);
      }
    });

    const targetRole: UserRole = isWalas ? 'walas' : 'guru';
    const targetJabatan = isWalas
      ? `Wali Kelas ${walasRombel!.nama} & Guru Pengajar`
      : 'Guru Pengajar';
    const targetRombelId = isWalas ? walasRombel!.id : undefined;

    if (matchingIndices.length === 0) {
      // Belum ada akun sama sekali: Buat 1 akun terpadu baru
      const fallbackUsername = teacherCleanNip || teacher.nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || teacher.id.toLowerCase();
      const newUser: UserAccount = {
        id: isWalas && walasRombel ? `USR-WALAS-${walasRombel.id.replace(/[^a-zA-Z0-9]/g, '')}` : `USR-GUR-${teacher.id}`,
        teacherId: teacher.id,
        nama: teacher.nama,
        email: teacher.email || `${fallbackUsername}@smkhusada.sch.id`,
        username: fallbackUsername,
        role: targetRole,
        password: isWalas ? 'walas123' : 'guru123',
        rombelId: targetRombelId,
        jabatan: targetJabatan,
        telepon: teacher.telepon,
        statusAktif: teacher.statusAktif !== false,
      };

      processedUserIds.add(newUser.id);
      consolidatedList.push(newUser);
      countCreated++;
    } else if (matchingIndices.length === 1) {
      // Tepat 1 akun: Perbarui datanya agar terpadu penuh
      const targetIdx = matchingIndices[0];
      const existingUser = currentUsers[targetIdx];
      processedUserIds.add(existingUser.id);

      const updatedUser: UserAccount = {
        ...existingUser,
        teacherId: teacher.id,
        nama: teacher.nama,
        email: teacher.email || existingUser.email,
        telepon: teacher.telepon || existingUser.telepon,
        role: existingUser.role === 'admin' ? 'admin' : targetRole,
        rombelId: targetRombelId,
        jabatan: targetJabatan,
        statusAktif: teacher.statusAktif !== false,
      };

      consolidatedList.push(updatedUser);
    } else {
      // LEBIH DARI 1 AKUN (DUPLIKAT TERPISAH, MISAL WALAS DAN GURU TERPISAH)
      // Konsolidasi menjadi TEPAT 1 AKUN TERPADU
      const matchedAccounts = matchingIndices.map((i) => currentUsers[i]);
      matchedAccounts.forEach((acc) => processedUserIds.add(acc.id));

      // Pilih akun utama yang dipertahankan:
      // Prioritaskan akun yang sudah memiliki password custom, atau akun walas/guru yang paling lengkap
      const primaryAccount =
        matchedAccounts.find((a) => a.role === 'walas') ||
        matchedAccounts.find((a) => a.teacherId === teacher.id) ||
        matchedAccounts[0];

      // Cari password custom jika ada yang telah diubah pengguna
      const customPassword = matchedAccounts.find(
        (a) => a.password && a.password !== '123' && a.password !== '123456' && a.password !== 'guru123' && a.password !== 'walas123'
      )?.password || primaryAccount.password || 'walas123';

      const unifiedAccount: UserAccount = {
        ...primaryAccount,
        teacherId: teacher.id,
        nama: teacher.nama,
        email: teacher.email || primaryAccount.email,
        telepon: teacher.telepon || primaryAccount.telepon,
        role: primaryAccount.role === 'admin' ? 'admin' : targetRole,
        password: customPassword,
        rombelId: targetRombelId,
        jabatan: targetJabatan,
        statusAktif: teacher.statusAktif !== false,
      };

      consolidatedList.push(unifiedAccount);
      countConsolidated += matchedAccounts.length - 1;
    }
  });

  // 4. Masukkan kembali akun-akun lain yang belum diproses (admin, staf, siswa, ketua kelas, sekretaris)
  currentUsers.forEach((u) => {
    if (!processedUserIds.has(u.id)) {
      consolidatedList.push(u);
    }
  });

  return {
    updatedUsers: consolidatedList,
    updatedTeachers: currentTeachers,
    countConsolidated,
    countCreated,
  };
}
