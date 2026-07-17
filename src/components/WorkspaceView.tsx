import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Database, 
  FileSpreadsheet, 
  FolderOpen, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  LogOut,
  Info,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  FileDown
} from 'lucide-react';
import { User, InventoryItem, InboundRecord, ReturnRecord, OrderRecord, TransactionTask } from '../types';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from '../utils/googleAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'sonner';

interface WorkspaceViewProps {
  inventory: InventoryItem[];
  orders: OrderRecord[];
  inbounds: InboundRecord[];
  returns: ReturnRecord[];
  tasks: TransactionTask[];
  onImportItems: (items: InventoryItem[]) => void;
  onRestoreFullDatabase?: (dbData: {
    inventory?: InventoryItem[];
    orders?: OrderRecord[];
    inbounds?: InboundRecord[];
    returns?: ReturnRecord[];
    tasks?: TransactionTask[];
  }) => void;
}

export default function WorkspaceView({
  inventory,
  orders,
  inbounds,
  returns,
  tasks,
  onImportItems,
  onRestoreFullDatabase
}: WorkspaceViewProps) {
  // Google Auth States
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPickerLoading, setIsPickerLoading] = useState(false);

  // Sheets Import States
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [sheetDataPreview, setSheetDataPreview] = useState<any[][] | null>(null);
  const [parsedItems, setParsedItems] = useState<InventoryItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Drive/Sheets Operation States
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<{ id: string; name: string } | null>(null);

  // Initialize listener for Google auth changes
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleConnect = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        toast.success(`Berhasil terhubung ke akun Google: ${result.user.email}`);
      }
    } catch (error: any) {
      console.error('Failed to login with Google:', error);
      toast.error('Gagal menghubungkan Google Account.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (confirm('Apakah Anda yakin ingin memutuskan sambungan dari Google Drive & Sheets?')) {
      try {
        await logoutGoogle();
        setGoogleUser(null);
        setAccessToken(null);
        setSelectedSheetId(null);
        setSheetDataPreview(null);
        setParsedItems([]);
        toast.success('Koneksi Google diputuskan.');
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }
  };

  // Helper: Load Google Picker Script Dynamically
  const loadPicker = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi && (window as any).google?.picker) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('picker', {
          callback: () => {
            resolve();
          },
          onerror: (err: any) => reject(err),
        });
      };
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  // Launch Google Picker to select a Spreadsheet
  const handleLaunchPicker = async () => {
    if (!accessToken) {
      toast.error('Silakan hubungkan akun Google Anda terlebih dahulu.');
      return;
    }

    setIsPickerLoading(true);
    try {
      await loadPicker();
      
      const pickerOrigin =
        window.location.ancestorOrigins &&
        window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      const view = new (window as any).google.picker.View((window as any).google.picker.ViewId.DOCS);
      view.setMimeTypes('application/vnd.google-apps.spreadsheet');

      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const file = data.docs[0];
            setSelectedSheetId(file.id);
            setSelectedSheetName(file.name);
            toast.success(`Terpilih spreadsheet: "${file.name}"`);
            await fetchSpreadsheetPreview(file.id);
          }
        })
        .setOrigin(pickerOrigin)
        .build();

      picker.setVisible(true);
    } catch (error) {
      console.error('Error loading Google Picker:', error);
      toast.error('Gagal membuka Google Picker.');
    } finally {
      setIsPickerLoading(false);
    }
  };

  // Launch Google Picker to select a WMS JSON backup file
  const handleLaunchBackupRestorePicker = async () => {
    if (!accessToken) {
      toast.error('Silakan hubungkan akun Google Anda terlebih dahulu.');
      return;
    }

    try {
      await loadPicker();
      
      const pickerOrigin =
        window.location.ancestorOrigins &&
        window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      const view = new (window as any).google.picker.View((window as any).google.picker.ViewId.DOCS);
      view.setMimeTypes('application/json');

      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const file = data.docs[0];
            if (confirm(`Apakah Anda yakin ingin memulihkan seluruh database dari cadangan "${file.name}"? Ini akan menggantikan data Anda saat ini!`)) {
              await restoreDatabaseFromFile(file.id, file.name);
            }
          }
        })
        .setOrigin(pickerOrigin)
        .build();

      picker.setVisible(true);
    } catch (error) {
      console.error('Error loading Google Picker for backup:', error);
      toast.error('Gagal membuka Google Picker.');
    }
  };

  // Read first 100 rows from Google Sheet to construct a preview
  const fetchSpreadsheetPreview = async (spreadsheetId: string) => {
    if (!accessToken) return;
    try {
      // Step A: Fetch first tab title from Spreadsheet metadata
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!metaRes.ok) throw new Error('Spreadsheet tidak dapat dibaca.');
      const metaData = await metaRes.json();
      const firstTabName = metaData.sheets?.[0]?.properties?.title || 'Sheet1';

      // Step B: Fetch values
      const range = `${firstTabName}!A1:J50`;
      const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!valuesRes.ok) throw new Error('Data Spreadsheet gagal diambil.');
      const valuesData = await valuesRes.json();
      const rows = valuesData.values;

      if (!rows || rows.length === 0) {
        toast.warning('Spreadsheet terpilih kosong.');
        setSheetDataPreview(null);
        setParsedItems([]);
        return;
      }

      setSheetDataPreview(rows);
      parseSpreadsheetRows(rows);
    } catch (err: any) {
      console.error('Spreadsheet fetch preview error:', err);
      toast.error(err.message || 'Gagal membaca isi spreadsheet.');
    }
  };

  // Smart Parser for sheet rows to InventoryItem structure
  const parseSpreadsheetRows = (rows: any[][]) => {
    const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
    
    // Header Mapping Index Helpers
    const getIndex = (variants: string[]) => {
      return headers.findIndex(h => variants.some(v => h.includes(v)));
    };

    const skuIdx = getIndex(['sku id', 'sku_id', 'sku', 'kode sku']);
    const nameIdx = getIndex(['nama produk', 'nama_produk', 'nama', 'product', 'name', 'sku name']);
    const brandIdx = getIndex(['brand', 'merek', 'merk']);
    const barcodeIdx = getIndex(['barcode', 'kode batang', 'upc', 'ean']);
    const qtyIdx = getIndex(['stok', 'qty', 'jumlah', 'quantity', 'stock']);
    const locIdx = getIndex(['lokasi', 'rak', 'bin', 'location']);
    const expIdx = getIndex(['expired', 'kedaluwarsa', 'tanggal expired', 'tgl kedaluwarsa']);
    const whIdx = getIndex(['gudang', 'warehouse']);

    if (skuIdx === -1 || nameIdx === -1) {
      toast.error('Gagal mengenali header wajib (SKU ID dan Nama Produk). Pastikan spreadsheet memiliki baris header yang tepat.');
      setParsedItems([]);
      return;
    }

    const items: InventoryItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || !row[skuIdx]) continue;

      const rawSku = String(row[skuIdx] || '').trim();
      const rawName = String(row[nameIdx] || '').trim();
      if (!rawSku || !rawName) continue;

      const rawBrand = brandIdx !== -1 ? String(row[brandIdx] || '').trim() : 'Tanpa Brand';
      const rawBarcode = barcodeIdx !== -1 ? String(row[barcodeIdx] || '').trim() : `BC-${rawSku}`;
      const rawQty = qtyIdx !== -1 ? parseInt(String(row[qtyIdx]), 10) : 0;
      const rawLoc = locIdx !== -1 ? String(row[locIdx] || '').trim() : 'AC-01-01-01';
      
      let rawExp = expIdx !== -1 ? String(row[expIdx] || '').trim() : '31/12/2028';
      // Format simple checks for standard DD/MM/YYYY
      if (rawExp.includes('-')) {
        const parts = rawExp.split('-');
        if (parts[0].length === 4) { // YYYY-MM-DD
          rawExp = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      let rawWh: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak' = 'Gudang Utama';
      if (whIdx !== -1) {
        const tempWh = String(row[whIdx]).toLowerCase();
        if (tempWh.includes('ac')) rawWh = 'Gudang AC';
        else if (tempWh.includes('rak')) rawWh = 'Gudang Rak';
      }

      items.push({
        id: `B-SKU-${rawSku}-${Date.now().toString().slice(-4)}-${i}`,
        skuId: rawSku,
        skuName: rawName,
        brand: rawBrand,
        barcode: rawBarcode,
        qty: isNaN(rawQty) ? 0 : rawQty,
        location: rawLoc || 'AC-01-01-01',
        warehouse: rawWh,
        expiredDate: rawExp,
        lowStockThreshold: 10,
        notes: 'Diimpor dari Google Sheets'
      });
    }

    setParsedItems(items);
    if (items.length > 0) {
      toast.success(`Berhasil mengurai ${items.length} data produk dari Spreadsheet!`);
    } else {
      toast.warning('Tidak ada baris data produk valid yang berhasil diurai.');
    }
  };

  // Perform bulk merge import into active WMS state
  const handleExecuteImport = () => {
    if (parsedItems.length === 0) return;
    setIsImporting(true);
    setTimeout(() => {
      onImportItems(parsedItems);
      toast.success(`Sukses mengimpor & menggabungkan ${parsedItems.length} produk ke dalam inventaris gudang!`);
      // Reset
      setSelectedSheetId(null);
      setSheetDataPreview(null);
      setParsedItems([]);
      setIsImporting(false);
    }, 800);
  };

  // Export current active WMS Inventory to a new Google Sheet
  const handleExportToGoogleSheets = async () => {
    if (!accessToken) {
      toast.error('Silakan hubungkan akun Google Anda.');
      return;
    }

    setIsExportingSheets(true);
    setExportedSheetUrl(null);

    try {
      const exportTitle = `WMS_TKS_Inventory_Export_${new Date().toISOString().split('T')[0]}`;
      
      // Step A: Create new spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: exportTitle
          }
        })
      });

      if (!createRes.ok) throw new Error('Gagal membuat Spreadsheet baru di Drive.');
      const sheetInfo = await createRes.json();
      const spreadsheetId = sheetInfo.spreadsheetId;
      const sheetUrl = sheetInfo.spreadsheetUrl;

      // Step B: Map data rows
      const tableHeaders = ['SKU ID', 'Nama Produk', 'Brand', 'Barcode', 'Stok (Qty)', 'Lokasi Rak', 'Gudang', 'Tanggal Expired', 'Ambang Batas', 'Catatan'];
      const dataRows = inventory.map(item => [
        item.skuId,
        item.skuName,
        item.brand,
        item.barcode,
        item.qty,
        item.location,
        item.warehouse,
        item.expiredDate,
        item.lowStockThreshold,
        item.notes || ''
      ]);

      const valuesBody = {
        values: [tableHeaders, ...dataRows]
      };

      // Step C: Write rows to Sheet1
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(valuesBody)
      });

      if (!writeRes.ok) throw new Error('Gagal mengisi baris data ke Spreadsheet.');

      setExportedSheetUrl(sheetUrl);
      toast.success('Sukses mengekspor inventaris aktif ke Google Sheets!');
    } catch (error: any) {
      console.error('Export sheets error:', error);
      toast.error(error.message || 'Gagal mengekspor data ke Sheets.');
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Save WMS database snapshot (JSON backup) to Google Drive
  const handleBackupDatabaseToDrive = async () => {
    if (!accessToken) {
      toast.error('Silakan hubungkan akun Google Anda.');
      return;
    }

    const confirmed = window.confirm(
      'Apakah Anda yakin ingin mengunggah cadangan database lengkap (stok, order, return, task, dan operator) saat ini ke Google Drive Anda?'
    );
    if (!confirmed) return;

    setIsBackingUp(true);
    setLastBackupInfo(null);

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
      const filename = `WMS_TKS_Backup_${dateStr}_${timeStr}.json`;

      const backupPayload = {
        meta: {
          appName: 'WAREHOUSE TKS v1',
          backupTime: now.toISOString(),
          recordCounts: {
            inventory: inventory.length,
            orders: orders.length,
            inbounds: inbounds.length,
            returns: returns.length,
            tasks: tasks.length
          }
        },
        data: {
          inventory,
          orders,
          inbounds,
          returns,
          tasks
        }
      };

      const metadata = {
        name: filename,
        mimeType: 'application/json'
      };

      const boundary = 'WMS_TKS_BACKUP_BOUNDARY_MULTIPART';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(backupPayload, null, 2) +
        closeDelimiter;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload cadangan gagal: ${errText}`);
      }

      const fileResult = await response.json();
      setLastBackupInfo({ id: fileResult.id, name: fileResult.name });
      toast.success(`Cadangan berhasil diunggah! Nama File: ${filename}`);
    } catch (err: any) {
      console.error('Backup Drive error:', err);
      toast.error(err.message || 'Gagal menyimpan cadangan ke Google Drive.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore active WMS state from Google Drive JSON backup file
  const restoreDatabaseFromFile = async (fileId: string, fileName: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error('Gagal mengunduh isi berkas cadangan dari Drive.');
      const snapshot = await res.json();

      if (snapshot.meta?.appName !== 'WAREHOUSE TKS v1' || !snapshot.data) {
        throw new Error('Format file cadangan tidak valid atau bukan berasal dari WAREHOUSE TKS.');
      }

      if (onRestoreFullDatabase) {
        onRestoreFullDatabase(snapshot.data);
        toast.success(`Database berhasil dipulihkan secara penuh dari berkas cadangan "${fileName}"!`);
      } else {
        // Fallback: import only inventory
        if (snapshot.data.inventory) {
          onImportItems(snapshot.data.inventory);
          toast.success(`Berhasil memulihkan ${snapshot.data.inventory.length} data inventaris dari berkas cadangan.`);
        }
      }
    } catch (err: any) {
      console.error('Database restore error:', err);
      toast.error(err.message || 'Proses pemulihan cadangan gagal.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mb-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-pink-500 text-xs font-black uppercase tracking-widest font-mono mb-2">
              <Cloud className="h-4.5 w-4.5 animate-pulse" />
              <span>Google Cloud Workspace</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              SINKRONISASI <span className="text-pink-500">CLOUD DRIVE & SHEETS</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 max-w-2xl">
              Hubungkan sistem manajemen gudang kecantikan dengan Google Workspace Anda untuk impor stok massal, ekspor instan ke spreadsheet, dan pencadangan database otomatis ke Drive pribadi.
            </p>
          </div>

          <div className="shrink-0">
            {!googleUser ? (
              <button
                onClick={handleGoogleConnect}
                disabled={isLoggingIn}
                className="gsi-material-button px-6 py-3.5 bg-white text-slate-800 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 active:scale-[0.98] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isLoggingIn ? 'Menghubungkan...' : 'Hubungkan Akun Google'}</span>
              </button>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3.5 max-w-xs">
                <img 
                  src={googleUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'} 
                  alt={googleUser.displayName || 'Google User'} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate leading-none mb-1">{googleUser.displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate leading-none mb-2 font-mono">{googleUser.email}</p>
                  <button
                    onClick={handleGoogleDisconnect}
                    className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-400 hover:text-rose-300 select-none cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" />
                    Putuskan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!googleUser ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center max-w-md mx-auto shadow-sm">
          <Cloud className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-bounce" />
          <h3 className="text-base font-bold text-slate-800">Koneksi Google Diperlukan</h3>
          <p className="text-xs text-slate-500 mt-2">
            Silakan hubungkan akun Google Drive Anda terlebih dahulu untuk mengaktifkan fitur pembaca dokumen spreadsheet, pembuat berkas otomatis, dan pencadangan terpusat.
          </p>
          <button
            onClick={handleGoogleConnect}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-pink-500/10 cursor-pointer transition-colors"
          >
            <span>Hubungkan Sekarang</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section: Import & Export Sheets */}
          <div className="space-y-6">
            
            {/* Card 1: Import Google Sheets with Picker */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Impor Produk dari Google Sheets</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Impor data stok kosmetik massal</p>
                  </div>
                </div>
                <button
                  onClick={handleLaunchPicker}
                  disabled={isPickerLoading}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {isPickerLoading ? 'Membuka...' : 'Pilih Berkas'}
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex gap-3 text-xs text-blue-800">
                  <Info className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Ketentuan Struktur Berkas Spreadsheet:</span>
                    <p className="text-[11px] text-blue-700/90 mt-1 leading-relaxed">
                      Wajib memiliki header kolom: <strong className="text-blue-900 font-extrabold">SKU ID</strong> dan <strong className="text-blue-900 font-extrabold">Nama Produk</strong>. Kolom opsional yang didukung: <strong className="text-slate-700">Brand</strong>, <strong className="text-slate-700">Barcode</strong>, <strong className="text-slate-700">Stok (Qty)</strong>, <strong className="text-slate-700">Lokasi</strong>, <strong className="text-slate-700">Gudang</strong>, dan <strong className="text-slate-700">Expired</strong>.
                    </p>
                  </div>
                </div>

                {selectedSheetId ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-700 truncate">{selectedSheetName}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-bold truncate">ID: {selectedSheetId}</p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase shrink-0">TERPILIH</span>
                    </div>

                    {sheetDataPreview && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">PREVIEW DATA SPREADSHEET (Maks 5 baris)</span>
                          <span className="text-[10px] font-bold text-emerald-600 font-mono">{parsedItems.length} baris terbaca</span>
                        </div>
                        <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-48">
                          <table className="min-w-full divide-y divide-slate-100 text-[10px] text-slate-600 font-sans">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                              <tr>
                                {sheetDataPreview[0].slice(0, 5).map((col, idx) => (
                                  <th key={idx} className="px-3 py-1.5 text-left font-bold">{String(col)}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {sheetDataPreview.slice(1, 6).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  {row.slice(0, 5).map((cell, cIdx) => (
                                    <td key={cIdx} className="px-3 py-1.5 truncate max-w-[120px]">{String(cell || '')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <button
                          onClick={handleExecuteImport}
                          disabled={isImporting || parsedItems.length === 0}
                          className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          {isImporting ? 'Sedang Mengimpor...' : `Impor & Gabungkan ${parsedItems.length} Produk`}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                    <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">Belum ada spreadsheet terpilih.</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Klik "Pilih Berkas" di pojok kanan atas untuk memilih berkas dari Google Drive Anda.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Export Inventory to Google Sheets */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                  <FileDown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ekspor Inventaris Aktif ke Sheets</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Buat laporan stok spreadsheet di Google Drive</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Tekan tombol di bawah untuk membuat berkas Google Spreadsheet baru yang berisi seluruh katalog produk aktif, lokasi rak, jumlah stok, ambang batas, dan tgl kedaluwarsa secara dinamis.
              </p>

              {exportedSheetUrl && (
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-800 animate-in fade-in duration-200">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Ekspor Berhasil!</span>
                    <p className="text-[11px] text-emerald-700 mt-1">Spreadsheet baru telah ditambahkan ke Google Drive Anda.</p>
                    <a
                      href={exportedSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-pink-600 font-bold hover:underline"
                    >
                      Buka Spreadsheet
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={handleExportToGoogleSheets}
                disabled={isExportingSheets || inventory.length === 0}
                className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-pink-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isExportingSheets ? 'animate-spin' : ''}`} />
                {isExportingSheets ? 'Mengekspor & Membuat Spreadsheet...' : `Ekspor Sekarang (${inventory.length} Baris)`}
              </button>
            </div>

          </div>

          {/* Section: Backup & Restore with Google Drive */}
          <div className="space-y-6">
            
            {/* Card 3: WMS SNAPSHOT COLD-BACKUPS */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Cadangan & Pulihkan Database</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Backup terpusat ke cloud Google Drive pribadi</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Simpan status lengkap sistem Anda (seluruh tabel database termasuk stok produk, log inbounds, return barang, histori pesanan, dan operator logs) ke Google Drive Anda sebagai berkas JSON cadangan yang aman.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <button
                  onClick={handleBackupDatabaseToDrive}
                  disabled={isBackingUp}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] border border-slate-800 text-slate-100 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Upload className={`h-4 w-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  {isBackingUp ? 'Membackup...' : 'Buat Cadangan'}
                </button>

                <button
                  onClick={handleLaunchBackupRestorePicker}
                  className="py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Pulihkan Cadangan
                </button>
              </div>

              {lastBackupInfo && (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-3 text-xs text-indigo-800 animate-in fade-in duration-200">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0 text-indigo-600 mt-0.5" />
                  <div className="overflow-hidden">
                    <span className="font-bold">Cadangan Cloud Tersimpan!</span>
                    <p className="text-[11px] text-indigo-700 truncate mt-1">Nama: {lastBackupInfo.name}</p>
                    <p className="text-[9px] text-indigo-400 font-mono font-bold truncate mt-1">ID Drive: {lastBackupInfo.id}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Google Workspace Integration Info */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-inner text-slate-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl" />
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-slate-800 text-pink-500 rounded-xl shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Integrasi Otentik & Aman</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5">
                    Aplikasi ini menggunakan teknologi Google OAuth standar dengan integrasi Google Picker untuk memilih berkas secara aman langsung di server Google. Kredensial, kunci otentikasi, dan token akses Anda disimpan dengan aman hanya dalam memori peramban (In-Memory Cache) dan tidak akan pernah diteruskan ke pihak ketiga manapun.
                  </p>
                  <div className="mt-4 flex items-center gap-5 text-[9px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-pink-500" /> OAuth 2.0</span>
                    <span className="flex items-center gap-1"><Cloud className="h-3.5 w-3.5 text-pink-500" /> Google Drive API</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
