import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Shuffle, 
  ArrowRightLeft, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  Layers,
  ArrowRight,
  X,
  Upload,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, User, TransferRecord } from '../types';
import { downloadTransferTemplate } from '../utils/excelTemplates';

interface TransferStockViewProps {
  inventory: InventoryItem[];
  currentUser: User;
  onTransferStock: (transfer: TransferRecord, updatedInventory: InventoryItem[]) => void;
}

export default function TransferStockView({
  inventory,
  currentUser,
  onTransferStock,
}: TransferStockViewProps) {
  // Transfer Form States
  const [selectedSku, setSelectedSku] = useState('');
  const [targetWarehouse, setTargetWarehouse] = useState<'Gudang AC' | 'Gudang Utama' | 'Gudang Rak'>('Gudang Utama');
  const [targetLocation, setTargetLocation] = useState('');
  const [qtyToMove, setQtyToMove] = useState(10);
  const [notes, setNotes] = useState('');

  // Inline Notification
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Selected Item computed helper
  const sourceItem = inventory.find(i => i.skuId === selectedSku);

  // List of completed transfers
  const [completedTransfers, setCompletedTransfers] = useState<TransferRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportTransferExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData.length === 0) {
          toast.error('File Excel kosong atau tidak ada data.');
          return;
        }

        // Deep clone the inventory to manipulate
        let currentInventory = JSON.parse(JSON.stringify(inventory)) as InventoryItem[];
        const transferItems: any[] = [];
        let successCount = 0;
        let failReasons: string[] = [];

        jsonData.forEach((row, rowIndex) => {
          const getValueByKeys = (item: any, keys: string[]): string => {
            const matchKey = Object.keys(item).find(k => keys.some(key => k.trim().toLowerCase() === key.toLowerCase()));
            return matchKey ? item[matchKey].toString().trim() : '';
          };

          const skuId = getValueByKeys(row, ['kode sku', 'sku id', 'sku_id', 'sku', 'kode barang']).toUpperCase();
          const targetW = getValueByKeys(row, ['gudang tujuan', 'target warehouse', 'gudang_tujuan', 'warehouse tujuan']);
          const targetLoc = getValueByKeys(row, ['lokasi tujuan', 'target location', 'lokasi_tujuan', 'rak tujuan', 'lokasi rak tujuan']).toUpperCase();
          const qtyVal = parseInt(getValueByKeys(row, ['qty', 'quantity', 'jumlah', 'stok']), 10);

          if (!skuId || !targetLoc || isNaN(qtyVal) || qtyVal <= 0) {
            failReasons.push(`Baris ${rowIndex + 2}: Data tidak lengkap atau Qty tidak valid.`);
            return;
          }

          // Validate warehouse type
          let finalWarehouse: 'Gudang AC' | 'Gudang Utama' | 'Gudang Rak' = 'Gudang Utama';
          if (targetW.toUpperCase().includes('AC')) {
            finalWarehouse = 'Gudang AC';
          } else if (targetW.toUpperCase().includes('RAK')) {
            finalWarehouse = 'Gudang Rak';
          }

          // Find a source item in CURRENT modified inventory that has stock of this SKU
          const sourceIdx = currentInventory.findIndex(item => item.skuId === skuId && item.qty >= qtyVal);
          if (sourceIdx === -1) {
            failReasons.push(`Baris ${rowIndex + 2}: SKU ${skuId} tidak ditemukan atau stoknya kurang dari ${qtyVal} pcs.`);
            return;
          }

          const sourceItem = currentInventory[sourceIdx];

          if (sourceItem.location === targetLoc) {
            failReasons.push(`Baris ${rowIndex + 2}: Lokasi asal dan tujuan sama (${targetLoc}).`);
            return;
          }

          // Apply transfer in cloned inventory
          // 1. Subtract qty from source item
          currentInventory[sourceIdx].qty -= qtyVal;

          // 2. Add qty to destination item in our temp list
          const destIdx = currentInventory.findIndex(item => 
            item.skuId === skuId && 
            item.location === targetLoc &&
            item.warehouse === finalWarehouse
          );

          if (destIdx !== -1) {
            currentInventory[destIdx].qty += qtyVal;
          } else {
            const newBinItem: InventoryItem = {
              id: `STK-BIN-EXCEL-${Date.now()}-${rowIndex}`,
              brand: sourceItem.brand,
              skuId: sourceItem.skuId,
              skuName: sourceItem.skuName,
              barcode: sourceItem.barcode,
              expiredDate: sourceItem.expiredDate,
              location: targetLoc,
              warehouse: finalWarehouse,
              qty: qtyVal,
              lowStockThreshold: sourceItem.lowStockThreshold,
              notes: `Pindahan Massal Excel dari ${sourceItem.location} pada ${new Date().toLocaleDateString('id-ID')}`
            };
            currentInventory.push(newBinItem);
          }

          transferItems.push({
            skuId,
            skuName: sourceItem.skuName,
            brand: sourceItem.brand,
            barcode: sourceItem.barcode,
            qty: qtyVal,
            fromLocation: sourceItem.location,
            toLocation: targetLoc
          });
          successCount++;
        });

        if (successCount > 0) {
          const transferId = `TRF-BLK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 90) + 10)}`;
          const newTransfer: TransferRecord = {
            id: transferId,
            date: new Date().toLocaleDateString('id-ID'),
            items: transferItems,
            status: 'COMPLETED',
            transferBy: currentUser.name,
            notes: `Mutasi Massal Excel (${successCount} item berhasil)`,
            createdAt: new Date().toISOString()
          };

          onTransferStock(newTransfer, currentInventory);
          setCompletedTransfers([newTransfer, ...completedTransfers]);

          let msg = `Berhasil memutasi ${successCount} item via Excel.`;
          if (failReasons.length > 0) {
            msg += ` Namun ada ${failReasons.length} baris gagal: ${failReasons.slice(0, 2).join('; ')}...`;
          }
          setFeedback({
            type: 'success',
            message: msg
          });
          toast.success(`Berhasil memproses transfer massal!`);
        } else {
          setFeedback({
            type: 'error',
            message: `Gagal transfer massal Excel. Alasan:\n` + failReasons.join('\n')
          });
          toast.error(`Gagal memproses transfer Excel.`);
        }
      } catch (err) {
        toast.error('Gagal membaca file Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku || !sourceItem || qtyToMove <= 0) return;

    if (qtyToMove > sourceItem.qty) {
      setFeedback({
        type: 'error',
        message: `Stok tidak mencukupi untuk transfer! Stok di ${sourceItem.location} hanya ada ${sourceItem.qty} pcs.`
      });
      return;
    }

    if (sourceItem.location === targetLocation.trim().toUpperCase()) {
      setFeedback({
        type: 'error',
        message: `Lokasi asal dan tujuan tidak boleh sama (${sourceItem.location}).`
      });
      return;
    }

    const cleanTargetLocation = targetLocation.trim().toUpperCase();

    // Deep clone the inventory to manipulate
    const clonedInventory = JSON.parse(JSON.stringify(inventory)) as InventoryItem[];

    // 1. Subtract qty from source item
    const sourceIdx = clonedInventory.findIndex(item => item.id === sourceItem.id);
    clonedInventory[sourceIdx].qty -= qtyToMove;

    // 2. Add qty to destination item. Check if the SKU already exists at the target location!
    const destIdx = clonedInventory.findIndex(item => 
      item.skuId === selectedSku && 
      item.location === cleanTargetLocation &&
      item.warehouse === targetWarehouse
    );

    if (destIdx !== -1) {
      // Exists already: increment quantity
      clonedInventory[destIdx].qty += qtyToMove;
    } else {
      // Doesn't exist at that target shelf yet: Create a new InventoryItem row!
      const newBinItem: InventoryItem = {
        id: `STK-BIN-${Date.now()}`,
        brand: sourceItem.brand,
        skuId: sourceItem.skuId,
        skuName: sourceItem.skuName,
        barcode: sourceItem.barcode,
        expiredDate: sourceItem.expiredDate,
        location: cleanTargetLocation,
        warehouse: targetWarehouse,
        qty: qtyToMove,
        lowStockThreshold: sourceItem.lowStockThreshold,
        notes: `Pindahan dari ${sourceItem.location} pada ${new Date().toLocaleDateString('id-ID')}`
      };
      clonedInventory.push(newBinItem);
    }

    // 3. Register a TransferRecord for historical log
    const transferId = `TRF-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 90) + 10)}`;
    const newTransfer: TransferRecord = {
      id: transferId,
      date: new Date().toLocaleDateString('id-ID'),
      items: [{
        skuId: selectedSku,
        skuName: sourceItem.skuName,
        brand: sourceItem.brand,
        barcode: sourceItem.barcode,
        qty: qtyToMove,
        fromLocation: sourceItem.location,
        toLocation: cleanTargetLocation
      }],
      status: 'COMPLETED',
      transferBy: currentUser.name,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    onTransferStock(newTransfer, clonedInventory);
    setCompletedTransfers([newTransfer, ...completedTransfers]);

    // Reset forms
    setSelectedSku('');
    setTargetLocation('');
    setNotes('');
    setQtyToMove(10);
    setFeedback({
      type: 'success',
      message: `Berhasil! Memindahkan ${qtyToMove} pcs SKU ${sourceItem.skuId} dari ${sourceItem.location} ke ${cleanTargetLocation} (${targetWarehouse}).`
    });
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Mutasi & Transfer Stok (Bin Move)</h2>
          <p className="text-[11px] text-slate-500">Pindahkan kosmetik antar rak, perbaiki kesalahan letak, atau seimbangkan kapasitas tampung gudang.</p>
        </div>
        <div className="text-[10px] font-bold bg-pink-50 text-pink-600 px-2.5 py-1 rounded border border-pink-100 flex items-center gap-1">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Aman & Tervalidasi
        </div>
      </div>

      {currentUser.role !== 'ADMIN' && (
        <div className="p-3 bg-amber-50 text-amber-900 rounded border border-amber-200 text-xs flex items-start gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" />
          <p className="leading-relaxed">
            Akses Terbatas: Menu transfer lokasi penyimpanan hanya boleh dieksekusi oleh operator dengan peran <strong>ADMIN</strong>. Anda saat ini menggunakan akun <strong>{currentUser.role}</strong>.
          </p>
        </div>
      )}

      {/* Inline Feedback Panel */}
      {feedback && (
        <div className={`p-3 rounded border text-xs flex justify-between items-start ${
          feedback.type === 'error' 
            ? 'bg-pink-50 text-pink-900 border-pink-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <div className="flex items-start gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <p className="font-medium leading-relaxed">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        
        {/* Left column: Form to register a transfer */}
        <div className="lg:col-span-3">
          <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-3">Formulir Perpindahan Lokasi</h3>

            <form onSubmit={handleTransferSubmit} className="space-y-3">
              {/* Select SKU */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pilih Barang yang Mau Dipindah</label>
                <select
                  required
                  value={selectedSku}
                  onChange={(e) => {
                    setSelectedSku(e.target.value);
                    setFeedback(null);
                  }}
                  disabled={currentUser.role !== 'ADMIN'}
                  className="w-full p-1.5 border border-slate-200 rounded text-xs bg-slate-50/50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">-- Pilih SKU --</option>
                  {inventory.filter(i => i.qty > 0).map(item => (
                    <option key={item.id} value={item.skuId}>
                      {item.skuId} — {item.skuName} (Lokasi: {item.location} | Qty: {item.qty} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Source item info brief */}
              {sourceItem && (
                <div className="p-2.5 bg-pink-50/20 border border-pink-100 rounded text-xs flex justify-between items-center">
                  <div>
                    <span className="text-[9px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.5 rounded">Asal: {sourceItem.location}</span>
                    <p className="font-bold text-slate-800 mt-1.5 text-[11px]">{sourceItem.skuName}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sourceItem.warehouse}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-500 text-[10px]">Maksimal Pindah:</p>
                    <strong className="text-slate-800 text-xs font-mono">{sourceItem.qty} pcs</strong>
                  </div>
                </div>
              )}

              {/* Destination layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pilih Gudang Tujuan</label>
                  <select
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value as any)}
                    disabled={currentUser.role !== 'ADMIN'}
                    className="w-full p-1.5 border border-slate-200 rounded text-xs bg-slate-50/50 text-slate-700"
                  >
                    <option value="Gudang AC">Gudang AC (Suhu Dingin Skincare)</option>
                    <option value="Gudang Utama">Gudang Utama (Bulk Box)</option>
                    <option value="Gudang Rak">Gudang Rak (Varian Kecil/Lipstik)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kode Lokasi Baru (To Bin)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AC-01-02-05"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    disabled={currentUser.role !== 'ADMIN'}
                    className="w-full p-1.5 border border-slate-200 rounded text-xs font-mono text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jumlah Pcs</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={qtyToMove}
                    onChange={(e) => setQtyToMove(Math.max(1, Number(e.target.value)))}
                    disabled={currentUser.role !== 'ADMIN'}
                    className="w-full p-1.5 border border-slate-200 rounded text-xs text-slate-700 font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alasan Mutasi (Notes)</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: Optimasi rute picking, perataan rak"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={currentUser.role !== 'ADMIN'}
                    className="w-full p-1.5 border border-slate-200 rounded text-xs text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={currentUser.role !== 'ADMIN' || !selectedSku}
                className="w-full py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded shadow-2xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Eksekusi Transfer Stok
              </button>
             </form>
          </div>

          {/* Excel Upload and Template Download Section for Transfer */}
          {currentUser.role === 'ADMIN' && (
            <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs mt-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-emerald-600 animate-bounce" /> Mutasi Massal via Excel
                </h3>
                <button
                  type="button"
                  onClick={downloadTransferTemplate}
                  className="text-[9px] text-pink-600 font-extrabold hover:underline flex items-center gap-0.5"
                >
                  <Download className="h-3 w-3" /> Unduh Form Template
                </button>
              </div>

              <p className="text-[10px] text-slate-500 leading-normal">
                Punya puluhan item yang dipindahkan sekaligus? Silakan download form template di atas, isi data SKU, Gudang Tujuan, Lokasi Tujuan, dan Kuantitas, lalu upload di bawah ini untuk pemrosesan instan.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportTransferExcel}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="h-4 w-4" />
                Pilih & Upload File Mutasi Massal (.xlsx)
              </button>
            </div>
          )}
        </div>

        {/* Right column: Recent mutasi history */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs h-fit space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Log Mutasi Terkini</h3>
            
            {completedTransfers.length === 0 ? (
              <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50/50">
                <Shuffle className="h-6 w-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-600">Belum Ada Riwayat Mutasi</p>
                <p className="text-[9px] px-2 mt-0.5">Lakukan mutasi rak melalui formulir sebelah kiri untuk melihat catatan histori.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {completedTransfers.map((trf) => (
                  <div key={trf.id} className="text-xs p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono font-bold">
                      <span>ID: {trf.id}</span>
                      <span>{trf.date}</span>
                    </div>

                    {trf.items.map((it, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className="font-bold text-slate-800 leading-tight text-[11px]">{it.skuName}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                          <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold">{it.fromLocation}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-mono bg-pink-50 text-pink-700 border border-pink-100 px-1.5 py-0.5 rounded text-[9px] font-bold">{it.toLocation}</span>
                          <span className="ml-auto font-bold text-slate-800">{it.qty} pcs</span>
                        </div>
                      </div>
                    ))}
                    
                    <p className="text-[9px] text-slate-400 italic mt-1 pt-1 border-t border-slate-200/60">
                      Operator: {trf.transferBy}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
