import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, Rombel, SchoolConfig, UserAccount } from '../types';
import { generateQrDataUrl } from '../utils/qrcode';
import {
  Printer,
  Search,
  Filter,
  Users,
  User,
  CreditCard,
  QrCode,
  Download,
  Scissors,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowUpDown,
  Building2,
  Calendar,
  Eye,
  Check,
  RotateCcw,
  ExternalLink,
  FileDown,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface PrintStudentCardsTabProps {
  students: Student[];
  rombels: Rombel[];
  schoolConfig: SchoolConfig;
  currentUser: UserAccount;
  onSelectSingleCard?: (student: Student) => void;
}

export const PrintStudentCardsTab: React.FC<PrintStudentCardsTabProps> = ({
  students,
  rombels,
  schoolConfig,
  currentUser,
  onSelectSingleCard,
}) => {
  // 3 Primary filter modes requested: 'semua' | 'perkelas' | 'per_orang'
  const [filterMode, setFilterMode] = useState<'semua' | 'perkelas' | 'per_orang'>('semua');
  
  // Secondary filter states
  const [selectedRombelId, setSelectedRombelId] = useState<string>(rombels[0]?.id || '');
  const [selectedStudentNipd, setSelectedStudentNipd] = useState<string>(students[0]?.nipd || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Automatically ensure selected rombel and student default to first items if not set
  useEffect(() => {
    if (!selectedRombelId && rombels.length > 0) {
      setSelectedRombelId(rombels[0].id);
    }
  }, [rombels, selectedRombelId]);

  useEffect(() => {
    if (!selectedStudentNipd && students.length > 0) {
      setSelectedStudentNipd(students[0].nipd);
    }
  }, [students, selectedStudentNipd]);

  // Card formatting options
  // ISO/IEC 7810 ID-1 standard KTP/ID card dimension: 85.6mm x 53.98mm
  const [cardOrientation, setCardOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeCardBack, setIncludeCardBack] = useState<boolean>(false);
  const [showCutGuides, setShowCutGuides] = useState<boolean>(true);
  const [colorTheme, setColorTheme] = useState<'emerald' | 'blue' | 'slate'>('emerald');

  // QR Code data URL cache by student NIPD
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printNotice, setPrintNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Fast rombel lookup
  const rombelMap = useMemo(() => {
    const map = new Map<string, Rombel>();
    rombels.forEach((r) => map.set(r.id, r));
    return map;
  }, [rombels]);

  // Determine which students to print based on filters
  const filteredStudents = useMemo(() => {
    let list = [...students];

    if (filterMode === 'perkelas') {
      const targetRombel = selectedRombelId || rombels[0]?.id;
      if (targetRombel) {
        list = list.filter((s) => s.rombelId === targetRombel);
      }
    } else if (filterMode === 'per_orang') {
      const targetNipd = selectedStudentNipd || students[0]?.nipd;
      if (targetNipd) {
        list = list.filter((s) => s.nipd === targetNipd);
      }
    }

    // Apply text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.nama.toLowerCase().includes(q) ||
          s.nipd.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.toLowerCase().includes(q))
      );
    }

    return list;
  }, [students, filterMode, selectedRombelId, selectedStudentNipd, searchQuery, rombels]);

  // Generate QR codes on demand for visible students
  useEffect(() => {
    let isCancelled = false;

    const generateBatchQr = async () => {
      const missing = filteredStudents.filter((s) => !qrCodeMap[s.nipd]);
      if (missing.length === 0) return;

      const newEntries: Record<string, string> = {};
      for (const std of missing) {
        if (isCancelled) break;
        try {
          const url = await generateQrDataUrl(std.nipd);
          newEntries[std.nipd] = url;
        } catch (err) {
          console.error('Failed to generate QR for', std.nipd, err);
        }
      }

      if (!isCancelled && Object.keys(newEntries).length > 0) {
        setQrCodeMap((prev) => ({ ...prev, ...newEntries }));
      }
    };

    generateBatchQr();

    return () => {
      isCancelled = true;
    };
  }, [filteredStudents, qrCodeMap]);

  // Count ready QR codes
  const readyQrCount = useMemo(() => {
    return filteredStudents.filter((s) => !!qrCodeMap[s.nipd]).length;
  }, [filteredStudents, qrCodeMap]);
  const isGeneratingQr = readyQrCount < filteredStudents.length && filteredStudents.length > 0;

  // Calculate paper sheet estimates
  // Landscape cards: 8 per A4 sheet (2 cols x 4 rows)
  // Portrait cards: 9 per A4 sheet (3 cols x 3 rows)
  const cardsPerPage = cardOrientation === 'landscape' ? 8 : 9;
  const multiplier = includeCardBack ? 2 : 1;
  const estimatedSheets = Math.ceil((filteredStudents.length * multiplier) / cardsPerPage);

  // Construct self-contained printable HTML document for fallback, new tab, and file download
  const getPrintableHtml = () => {
    const sheetEl = document.getElementById('printable-cards-sheet');
    if (!sheetEl) return null;

    const cardWidth = cardOrientation === 'landscape' ? '85.6mm' : '54mm';
    const cardHeight = cardOrientation === 'landscape' ? '54mm' : '85.6mm';
    const gridCols = cardOrientation === 'landscape' ? 'repeat(2, 85.6mm)' : 'repeat(3, 54mm)';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Cetak Kartu Absen Siswa - ${schoolConfig.namaSekolah}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .print-exclude {
      display: none !important;
    }
    .id-card-print-grid {
      display: grid !important;
      grid-template-columns: ${gridCols} !important;
      gap: 4mm !important;
      justify-content: center !important;
      page-break-inside: auto !important;
    }
    .id-card-unit {
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      width: ${cardWidth} !important;
      height: ${cardHeight} !important;
      margin: 0 !important;
      border: ${showCutGuides ? '1px dashed #94a3b8' : '1px solid #cbd5e1'} !important;
      border-radius: 3.18mm !important;
      overflow: hidden !important;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="print-sheet-wrapper">
    ${sheetEl.innerHTML}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  <\/script>
</body>
</html>`;
  };

  // Primary Print Action: Triggers window.print() and gracefully falls back to isolated iframe or new tab
  const handlePrint = () => {
    setIsPrinting(true);
    setPrintNotice({ message: 'Mempersiapkan dialog cetak...', type: 'info' });

    try {
      // Direct window.print()
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        setPrintNotice(null);
      }, 1000);
    } catch (err) {
      console.warn('Direct print failed, switching to isolated iframe print', err);
      handleIframePrint();
    }
  };

  // Isolated iframe print method for nested environments
  const handleIframePrint = () => {
    const html = getPrintableHtml();
    if (!html) {
      window.print();
      setIsPrinting(false);
      return;
    }

    try {
      let iframe = document.getElementById('card-print-iframe') as HTMLIFrameElement;
      if (iframe) iframe.remove();

      iframe = document.createElement('iframe');
      iframe.id = 'card-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setIsPrinting(false);
          setPrintNotice({ message: 'Dialog cetak berhasil dibuka.', type: 'success' });
          setTimeout(() => setPrintNotice(null), 4000);
        }, 500);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (e) {
      console.error('Iframe print error', e);
      setIsPrinting(false);
      handleOpenInNewTab();
    }
  };

  // Open clean printable layout in a new tab (100% reliable in any browser, tablet, or sandbox)
  const handleOpenInNewTab = () => {
    const html = getPrintableHtml();
    if (!html) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setPrintNotice({
        message: 'Pratinjau cetak berhasil dibuka di tab baru. Anda dapat langsung mencetak atau menyimpannya sebagai PDF.',
        type: 'success',
      });
      setTimeout(() => setPrintNotice(null), 6000);
    } else {
      // Popup was blocked, trigger standard print
      window.print();
      setPrintNotice({
        message: 'Popup diblokir peramban. Mencetak langsung di halaman ini.',
        type: 'info',
      });
      setTimeout(() => setPrintNotice(null), 5000);
    }
  };

  // Download standalone HTML file ready to print anytime
  const handleDownloadHtmlFile = () => {
    const html = getPrintableHtml();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kartu-Absen-${schoolConfig.namaSekolah.replace(/[^a-zA-Z0-9]/g, '_')}-${filteredStudents.length}-siswa.html`;
    a.click();
    URL.revokeObjectURL(url);
    setPrintNotice({
      message: 'Berkas HTML siap cetak berhasil diunduh. Anda dapat membukanya kapan saja di browser mana pun untuk mencetak.',
      type: 'success',
    });
    setTimeout(() => setPrintNotice(null), 6000);
  };

  const handleDownloadSingleQr = (student: Student) => {
    const url = qrCodeMap[student.nipd];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-NIPD-${student.nipd.replace(/[^a-zA-Z0-9]/g, '_')}-${student.nama}.png`;
    a.click();
  };

  return (
    <div id="print-student-cards-container" className="space-y-6">
      {/* ========================================================================= */}
      {/* PRINT-ONLY CSS: Exact KTP/ID Card Dimensions (85.6mm x 54mm) on A4 Paper */}
      {/* ========================================================================= */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all navigational chrome and non-printable elements */
          header, footer, nav, button, .print-exclude, #toast-notice, #app-navigation, #top-navbar, #sidebar {
            display: none !important;
          }
          /* Ensure parent containers do not clip printing content */
          #root, #app-container, main {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
          .print-sheet-wrapper {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .id-card-print-grid {
            display: grid !important;
            grid-template-columns: ${
              cardOrientation === 'landscape' ? 'repeat(2, 85.6mm)' : 'repeat(3, 54mm)'
            } !important;
            gap: 4mm !important;
            justify-content: center !important;
            page-break-inside: auto !important;
          }
          .id-card-unit {
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: ${cardOrientation === 'landscape' ? '85.6mm' : '54mm'} !important;
            height: ${cardOrientation === 'landscape' ? '54mm' : '85.6mm'} !important;
            margin: 0 !important;
            border: ${showCutGuides ? '1px dashed #94a3b8' : '1px solid #cbd5e1'} !important;
            border-radius: 3.18mm !important;
            overflow: hidden !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Notice Banner */}
      {printNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs print-exclude ${
            printNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : printNotice.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{printNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrintNotice(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE CONTROLS & FILTER PANEL (Hidden in Print)                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 print-exclude space-y-5">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-lg sm:text-xl">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <span>Cetak Kartu Absen Siswa (Ukuran KTP / ID Card)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Pilihan cetak berformat standar ISO CR80 (85.6 mm × 54 mm) seukuran KTP, SIM, & ATM. 
              Dilengkapi barcode QR Code presensi tajam, pasfoto siswa, kop resmi sekolah, dan garis potong rapi untuk kertas A4.
            </p>
          </div>

          {/* Action Buttons: Cetak Sekarang, Tab Baru, Unduh HTML */}
          <div className="flex flex-wrap items-center gap-2">
            {isGeneratingQr && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>QR ({readyQrCount}/{filteredStudents.length})</span>
              </span>
            )}

            <button
              id="btn-open-print-new-tab"
              type="button"
              onClick={handleOpenInNewTab}
              disabled={filteredStudents.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Buka tampilan cetak di tab baru browser (bebas batasan iframe)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Buka di Tab Baru</span>
            </button>

            <button
              id="btn-download-html-file"
              type="button"
              onClick={handleDownloadHtmlFile}
              disabled={filteredStudents.length === 0}
              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Unduh berkas HTML siap cetak untuk dibuka dan dicetak di mana pun"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              <span>Unduh Berkas Cetak</span>
            </button>

            <button
              id="btn-trigger-print-cards"
              type="button"
              onClick={handlePrint}
              disabled={filteredStudents.length === 0 || isPrinting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Cetak Sekarang ({filteredStudents.length} Kartu)</span>
            </button>
          </div>
        </div>

        {/* 1. PRIMARY FILTER TABS: Semua | Per Kelas | Per Orang */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
            1. Pilih Target Siswa Yang Akan Dicetak:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tab: Semua Siswa */}
            <button
              id="filter-card-mode-all"
              type="button"
              onClick={() => {
                setFilterMode('semua');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                filterMode === 'semua'
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  filterMode === 'semua' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm">Semua Siswa</div>
                <div className="text-[11px] text-slate-500">
                  Cetak massal seluruh siswa ({students.length} Siswa)
                </div>
              </div>
            </button>

            {/* Tab: Per Kelas */}
            <button
              id="filter-card-mode-class"
              type="button"
              onClick={() => {
                setFilterMode('perkelas');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                filterMode === 'perkelas'
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  filterMode === 'perkelas' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm">Per Kelas (Rombel)</div>
                <div className="text-[11px] text-slate-500">
                  Cetak per rombongan belajar ({rombels.length} Rombel)
                </div>
              </div>
            </button>

            {/* Tab: Per Orang */}
            <button
              id="filter-card-mode-single"
              type="button"
              onClick={() => {
                setFilterMode('per_orang');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                filterMode === 'per_orang'
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 text-emerald-950'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  filterMode === 'per_orang' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm">Per Orang (Individu)</div>
                <div className="text-[11px] text-slate-500">
                  Cetak 1 kartu khusus untuk siswa tertentu
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 2. SUB-FILTERS (Dependent on selected mode) */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
          {filterMode === 'perkelas' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Pilih Kelas / Rombel:
              </label>
              <select
                id="select-card-rombel"
                value={selectedRombelId}
                onChange={(e) => setSelectedRombelId(e.target.value)}
                className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {rombels.map((r) => {
                  const count = students.filter((s) => s.rombelId === r.id).length;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.nama} ({count} Siswa)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {filterMode === 'per_orang' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Nama Siswa:
                </label>
                <select
                  id="select-card-student"
                  value={selectedStudentNipd}
                  onChange={(e) => setSelectedStudentNipd(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {students.map((s) => {
                    const r = rombelMap.get(s.rombelId);
                    return (
                      <option key={s.nipd} value={s.nipd}>
                        {s.nama} - NIPD: {s.nipd} ({r?.nama || s.rombelId})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Atau Cari Berdasarkan NIPD / Nama:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ketik NIPD atau Nama siswa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {filterMode === 'semua' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Mencetak seluruh <strong>{students.length} siswa</strong> dari {rombels.length} kelas. Anda dapat memfilter pencarian instan di bawah jika diperlukan.
              </div>
              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Saring nama / NIPD..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. FORMAT & CUSTOMIZATION OPTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          {/* Card Orientation */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Orientasi Kartu (KTP):
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCardOrientation('landscape')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                  cardOrientation === 'landscape'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Lanskap (Model KTP)
              </button>
              <button
                type="button"
                onClick={() => setCardOrientation('portrait')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                  cardOrientation === 'portrait'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Portret (Model Tali)
              </button>
            </div>
          </div>

          {/* Sisi Belakang Kartu */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Sisi Belakang Kartu:
            </label>
            <button
              type="button"
              onClick={() => setIncludeCardBack(!includeCardBack)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between transition ${
                includeCardBack
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{includeCardBack ? '✓ Cetak Depan & Belakang' : 'Hanya Sisi Depan'}</span>
              <span className="text-[10px] text-slate-400">Tata Tertib</span>
            </button>
          </div>

          {/* Garis Potong (Cut Guides) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Panduan Garis Potong:
            </label>
            <button
              type="button"
              onClick={() => setShowCutGuides(!showCutGuides)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between transition ${
                showCutGuides
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" />
                {showCutGuides ? 'Garis Gunting Aktif' : 'Garis Solid Biasa'}
              </span>
              <span className="text-[10px] text-slate-400">Kertas A4</span>
            </button>
          </div>

          {/* Print Summary Card Info */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 flex flex-col justify-center">
            <div className="font-bold flex items-center justify-between">
              <span>Siap Cetak:</span>
              <span className="text-emerald-700">{filteredStudents.length} Kartu</span>
            </div>
            <div className="text-[11px] text-emerald-800/80 mt-0.5 flex items-center justify-between">
              <span>Estimasi Kertas:</span>
              <span>~{estimatedSheets} Lembar A4</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARD GRID PREVIEW (Screen preview + Exact dimensions print layout)        */}
      {/* ========================================================================= */}
      <div className="print-sheet-wrapper">
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs print-exclude">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">Tidak ada siswa yang cocok</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Silakan ubah filter rombel atau kata kunci pencarian Anda untuk melihat pratinjau kartu absen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Screen Helper Info Banner */}
            <div className="bg-slate-800 text-slate-200 rounded-xl p-3 px-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs print-exclude">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Pratinjau {filteredStudents.length} Kartu Absen Siswa seukuran KTP (85.6mm × 54mm). Gunakan tombol <strong>Cetak Sekarang</strong> untuk print rapi tanpa elemen UI.
                </span>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Dialog</span>
              </button>
            </div>

            {/* Cards Grid Container */}
            <div id="printable-cards-sheet" className="id-card-print-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 justify-items-center">
              {filteredStudents.map((std, index) => {
                const rombel = rombelMap.get(std.rombelId);
                const qrUrl = qrCodeMap[std.nipd];

                return (
                  <React.Fragment key={std.nipd}>
                    {/* Front of ID Card */}
                    <div
                      className={`id-card-unit relative bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 text-slate-900 shadow-sm transition hover:shadow-md ${
                        showCutGuides ? 'border border-dashed border-slate-400' : 'border border-slate-300'
                      }`}
                      style={{
                        width: cardOrientation === 'landscape' ? '85.6mm' : '54mm',
                        height: cardOrientation === 'landscape' ? '54mm' : '85.6mm',
                        borderRadius: '3.18mm',
                        boxSizing: 'border-box',
                        padding: '2.5mm',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Watermark Logo Background */}
                      {schoolConfig.logoUrl && (
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.04] bg-center bg-no-repeat bg-contain"
                          style={{ backgroundImage: `url(${schoolConfig.logoUrl})` }}
                        />
                      )}

                      {/* LANDSCAPE CARD LAYOUT (Standard KTP: 85.6mm x 54mm) */}
                      {cardOrientation === 'landscape' ? (
                        <>
                          {/* 1. Header (Kop Sekolah) */}
                          <div className="border-b border-emerald-600/40 pb-1 flex items-center justify-between gap-1.5 shrink-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {schoolConfig.logoUrl ? (
                                <img
                                  src={schoolConfig.logoUrl}
                                  alt="Logo"
                                  className="w-7 h-7 object-contain rounded bg-white p-0.5 border border-emerald-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-emerald-700 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                                  SMK
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-[9px] uppercase leading-tight tracking-tight text-slate-900 truncate">
                                  {schoolConfig.namaSekolah}
                                </h4>
                                <p className="text-[7px] text-slate-500 leading-tight truncate">
                                  {schoolConfig.alamatSekolah}, {schoolConfig.kotaKab}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="inline-block text-[6.5px] font-extrabold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded tracking-wider uppercase border border-emerald-300">
                                KARTU PRESENSI SISWA
                              </span>
                            </div>
                          </div>

                          {/* 2. Middle Body: Photo (Left) + Bio (Center) + QR Code (Right) */}
                          <div className="flex-1 flex items-center gap-2 py-1 min-h-0">
                            {/* Pasfoto Siswa 3x4 */}
                            <div className="w-[18mm] h-[24mm] shrink-0 rounded border border-emerald-500/80 overflow-hidden bg-slate-100 shadow-2xs relative flex items-center justify-center">
                              {std.foto ? (
                                <img
                                  src={std.foto}
                                  alt={std.nama}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-0.5 text-center">
                                  <User className="w-5 h-5 text-emerald-400" />
                                  <span className="text-[5.5px] font-semibold text-emerald-700 leading-tight">3x4</span>
                                </div>
                              )}
                              <span className="absolute bottom-0 right-0 text-[6px] font-bold bg-emerald-800 text-white px-1 py-0.2 rounded-tl">
                                {std.jk}
                              </span>
                            </div>

                            {/* Bio Details (Center) */}
                            <div className="flex-1 min-w-0 text-[7.5px] leading-tight space-y-0.5">
                              <div>
                                <span className="text-[6px] text-slate-500 font-semibold block uppercase">Nama Lengkap</span>
                                <span className="font-black text-[9px] text-slate-950 block leading-tight truncate">
                                  {std.nama}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 pt-0.5">
                                <div>
                                  <span className="text-[6px] text-slate-500 font-semibold block uppercase">NIPD</span>
                                  <span className="font-mono font-bold text-emerald-800 text-[8px]">
                                    {std.nipd}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-slate-500 font-semibold block uppercase">NISN</span>
                                  <span className="font-mono text-slate-800 text-[7.5px]">
                                    {std.nisn || '-'}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                <div>
                                  <span className="text-[6px] text-slate-500 font-semibold block uppercase">Kelas</span>
                                  <span className="font-bold text-slate-800 text-[7.5px] truncate block">
                                    {rombel?.nama || std.rombelId}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-slate-500 font-semibold block uppercase">Kelamin</span>
                                  <span className="text-slate-700 text-[7px]">
                                    {std.jk === 'L' ? 'Laki-Laki' : 'Perempuan'}
                                  </span>
                                </div>
                              </div>
                              <div className="truncate">
                                <span className="text-[6px] text-slate-500 font-semibold block uppercase">TTL</span>
                                <span className="text-slate-700 text-[7px] truncate block">
                                  {std.tempatLahir}, {std.tanggalLahir}
                                </span>
                              </div>
                            </div>

                            {/* QR Code Column (Right) */}
                            <div className="w-[19mm] shrink-0 flex flex-col items-center justify-center text-center pl-1 border-l border-emerald-100">
                              <div className="w-[16mm] h-[16mm] bg-white p-0.5 rounded border border-emerald-300 shadow-2xs flex items-center justify-center">
                                {qrUrl ? (
                                  <img
                                    src={qrUrl}
                                    alt={`QR ${std.nipd}`}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-[6px] text-slate-400">QR...</span>
                                )}
                              </div>
                              <span className="text-[6px] font-mono font-bold text-emerald-900 mt-0.5 block tracking-tighter truncate max-w-[18mm]">
                                {std.nipd}
                              </span>
                              <span className="text-[5.5px] text-slate-400 font-semibold uppercase block">
                                Scan Presensi
                              </span>
                            </div>
                          </div>

                          {/* 3. Footer Strip */}
                          <div className="border-t border-emerald-500/30 pt-0.5 flex items-center justify-between text-[6.5px] text-slate-600 shrink-0">
                            <span className="font-semibold text-emerald-900">
                              • Wajib dibawa setiap hari sekolah
                            </span>
                            <span className="italic text-slate-500">
                              {schoolConfig.kotaKab}
                            </span>
                          </div>
                        </>
                      ) : (
                        /* PORTRAIT CARD LAYOUT (54mm x 85.6mm) */
                        <>
                          {/* Header */}
                          <div className="text-center border-b border-emerald-600/40 pb-1 shrink-0">
                            <div className="flex items-center justify-center gap-1">
                              {schoolConfig.logoUrl && (
                                <img
                                  src={schoolConfig.logoUrl}
                                  alt="Logo"
                                  className="w-6 h-6 object-contain rounded bg-white p-0.5"
                                />
                              )}
                              <h4 className="font-extrabold text-[8px] uppercase leading-tight text-slate-900">
                                {schoolConfig.namaSekolah}
                              </h4>
                            </div>
                            <span className="inline-block text-[6px] font-extrabold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded uppercase mt-0.5">
                              KARTU PRESENSI PELAJAR
                            </span>
                          </div>

                          {/* Center: Photo & Bio */}
                          <div className="flex flex-col items-center text-center my-1">
                            <div className="w-[18mm] h-[23mm] rounded border border-emerald-500 overflow-hidden bg-slate-100 shadow-2xs mb-1">
                              {std.foto ? (
                                <img
                                  src={std.foto}
                                  alt={std.nama}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                  <User className="w-5 h-5 text-emerald-400" />
                                </div>
                              )}
                            </div>
                            <div className="font-extrabold text-[8.5px] text-slate-900 leading-tight truncate max-w-full">
                              {std.nama}
                            </div>
                            <div className="font-mono font-bold text-[7.5px] text-emerald-800">
                              NIPD: {std.nipd}
                            </div>
                            <div className="text-[7px] text-slate-600 font-semibold">
                              {rombel?.nama || std.rombelId} • NISN: {std.nisn || '-'}
                            </div>
                          </div>

                          {/* Bottom: QR Code */}
                          <div className="flex flex-col items-center justify-center border-t border-emerald-200 pt-1 shrink-0">
                            <div className="w-[18mm] h-[18mm] bg-white p-0.5 rounded border border-emerald-300">
                              {qrUrl && (
                                <img
                                  src={qrUrl}
                                  alt={`QR ${std.nipd}`}
                                  className="w-full h-full object-contain"
                                />
                              )}
                            </div>
                            <span className="text-[5.5px] text-slate-500 uppercase mt-0.5">
                              Barcode Presensi Harian
                            </span>
                          </div>
                        </>
                      )}

                      {/* Screen-Only Quick Action Hover Overlay */}
                      <div className="absolute top-1 right-1 print-exclude opacity-0 hover:opacity-100 transition flex items-center gap-1 bg-slate-900/80 backdrop-blur-xs p-1 rounded-md text-white">
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleQr(std)}
                          title="Unduh QR PNG"
                          className="p-1 hover:bg-slate-700 rounded text-[10px]"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Optional Back Side of ID Card */}
                    {includeCardBack && (
                      <div
                        className={`id-card-unit relative bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800 shadow-sm ${
                          showCutGuides ? 'border border-dashed border-slate-400' : 'border border-slate-300'
                        }`}
                        style={{
                          width: cardOrientation === 'landscape' ? '85.6mm' : '54mm',
                          height: cardOrientation === 'landscape' ? '54mm' : '85.6mm',
                          borderRadius: '3.18mm',
                          boxSizing: 'border-box',
                          padding: '3mm',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          overflow: 'hidden',
                        }}
                      >
                        <div className="border-b border-slate-300 pb-1 text-center">
                          <h5 className="font-extrabold text-[8px] uppercase tracking-wider text-slate-800">
                            KETENTUAN & TATA TERTIB KARTU PRESENSI
                          </h5>
                          <span className="text-[6px] text-slate-500 block">
                            {schoolConfig.namaSekolah}
                          </span>
                        </div>

                        <div className="space-y-1 text-[6.5px] leading-tight text-slate-700 py-1">
                          <div className="flex items-start gap-1">
                            <span className="font-bold">1.</span>
                            <span>Kartu ini merupakan tanda pengenal resmi sekaligus kartu absensi berbasis QR Code.</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-bold">2.</span>
                            <span>Wajib dibawa setiap hari masuk sekolah dan discan pada saat kedatangan dan kepulangan.</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-bold">3.</span>
                            <span>Dilarang keras memindahtangankan, memalsukan, atau menitipkan kartu kepada siswa lain.</span>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="font-bold">4.</span>
                            <span>Apabila kartu ini hilang atau rusak, segera melapor kepada Wali Kelas atau Bagian Tata Usaha.</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-300 pt-1 flex items-center justify-between text-[6px] text-slate-500">
                          <div>
                            <span className="block font-bold truncate max-w-[40mm]">{schoolConfig.namaSekolah}</span>
                            <span>Telp: {schoolConfig.telepon || '-'}</span>
                          </div>
                          <div className="text-right">
                            <span className="block italic">Tanda Tangan Kepala Sekolah</span>
                            <span className="font-bold underline text-[6.5px] block mt-2">{schoolConfig.namaKepalaSekolah}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
