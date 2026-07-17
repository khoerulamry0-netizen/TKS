import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { 
  Undo2, 
  Plus, 
  ShieldAlert, 
  CheckCircle, 
  X, 
  Trash2, 
  ArrowRight, 
  HeartCrack, 
  AlertCircle,
  HelpCircle,
  Clock,
  Barcode,
  Upload,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReturnRecord, InventoryItem, User, ReturnReason, ReturnStatus } from '../types';
import { downloadReturnTemplate } from '../utils/excelTemplates';

interface ReturnViewProps {
  returns: ReturnRecord[];
  inventory: InventoryItem[];
  currentUser: User;
  onAddReturn: (record: ReturnRecord) => void;
  onUpdateReturn: (record: ReturnRecord) => void;
  onRestoreGoodStock: (skuId: string, qty: number) => void;
  onDeleteReturn: (id: string) => void;
}

export default function ReturnView({
  returns,
  inventory,
  currentUser,
  onAddReturn,
  onUpdateReturn,
  onRestoreGoodStock,
  onDeleteReturn,
}: ReturnViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);

  // New Return form states
  const [returnFrom, setReturnFrom] = useState('');
  const [reason, setReason] = useState<ReturnReason>('WRONG_ITEM');
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedCondition, setSelectedCondition] = useState<'GOOD' | 'DAMAGED' | 'EXPIRED'>('GOOD');
  const [returnItems, setReturnItems] = useState<{ skuId: string; qty: number; condition: 'GOOD' | 'DAMAGED' | 'EXPIRED' }[]>([]);

  // Input Massal & Barcode Scanner states for Customer Return
  const [activeInputMode, setActiveInputMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [bulkInputText, setBulkInputText] = useState('');
  const [returnScanText, setReturnScanText] = useState('');
  const [returnScanFeedback, setReturnScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sound effect helper
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Low buzz
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const handleProcessBulkReturn = () => {
    if (!bulkInputText.trim()) return;
    const lines = bulkInputText.split('\n');
    let addedCount = 0;
    const newItems = [...returnItems];

    lines.forEach(line => {
      const parts = line.trim().replace(/\t/g, ' ').split(/\s+/);
      if (parts.length >= 1) {
        const code = parts[0].trim().toUpperCase();
        if (!code) return;

        let qty = 1;
        if (parts.length >= 2) {
          const parsedQty = parseInt(parts[1]);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = parsedQty;
          }
        }

        let condition: 'GOOD' | 'DAMAGED' | 'EXPIRED' = 'GOOD';
        if (parts.length >= 3) {
          const rawCond = parts[2].toUpperCase();
          if (rawCond === 'DAMAGED' || rawCond === 'RUSAK') {
            condition = 'DAMAGED';
          } else if (rawCond === 'EXPIRED' || rawCond === 'KEDALUWARSA') {
            condition = 'EXPIRED';
          }
        }

        const match = inventory.find(i => i.skuId.toUpperCase() === code || i.barcode === parts[0]);
        const finalSkuId = match ? match.skuId : code;

        const existsIdx = newItems.findIndex(item => item.skuId === finalSkuId && item.condition === condition);
        if (existsIdx >= 0) {
          newItems[existsIdx].qty += qty;
        } else {
          newItems.push({ skuId: finalSkuId, qty, condition });
        }
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setReturnItems(newItems);
      playBeep('success');
      setBulkInputText('');
    } else {
      playBeep('error');
      toast.error('Format tidak valid. Pastikan format: SKU_ID JUMLAH KONDISI (Kondisi opsional: GOOD/DAMAGED/EXPIRED)');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportReturnExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const newItems = [...returnItems];
        let importedCount = 0;

        jsonData.forEach(row => {
          const getValueByKeys = (item: any, keys: string[]): string => {
            const matchKey = Object.keys(item).find(k => keys.some(key => k.trim().toLowerCase() === key.toLowerCase()));
            return matchKey ? item[matchKey].toString().trim() : '';
          };

          const skuId = getValueByKeys(row, ['kode sku', 'sku id', 'sku_id', 'sku', 'kode barang']).toUpperCase();
          const qtyVal = parseInt(getValueByKeys(row, ['qty', 'quantity', 'jumlah', 'kuantitas']), 10);
          const rawCond = getValueByKeys(row, ['kondisi', 'condition', 'status']).toUpperCase();
          const senderVal = getValueByKeys(row, ['pelanggan', 'pengirim', 'customer', 'sender']);

          if (senderVal && !returnFrom) {
            setReturnFrom(senderVal);
          }

          let condition: 'GOOD' | 'DAMAGED' | 'EXPIRED' = 'GOOD';
          if (rawCond === 'DAMAGED' || rawCond === 'RUSAK' || rawCond === 'RUSAK SEBAGIAN') {
            condition = 'DAMAGED';
          } else if (rawCond === 'EXPIRED' || rawCond === 'KEDALUWARSA') {
            condition = 'EXPIRED';
          }

          if (skuId && !isNaN(qtyVal) && qtyVal > 0) {
            const existsIdx = newItems.findIndex(item => item.skuId === skuId && item.condition === condition);
            if (existsIdx >= 0) {
              newItems[existsIdx].qty += qtyVal;
            } else {
              newItems.push({ skuId, qty: qtyVal, condition });
            }
            importedCount++;
          }
        });

        if (importedCount > 0) {
          setReturnItems(newItems);
          toast.success(`Berhasil mengimpor ${importedCount} item retur dari Excel.`);
          playBeep('success');
        } else {
          toast.error('Tidak ada data item retur valid dalam file Excel.');
        }
      } catch (err) {
        toast.error('Gagal membaca file Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

  const handleReturnScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = returnScanText.trim();
    if (!code) return;

    const upperCode = code.toUpperCase();
    const match = inventory.find(i => i.skuId.toUpperCase() === upperCode || i.barcode === code);

    const finalSkuId = match ? match.skuId : upperCode;
    const condition = selectedCondition; // Uses the active selectedCondition from dropdown

    setReturnItems(prev => {
      const exists = prev.findIndex(item => item.skuId === finalSkuId && item.condition === condition);
      if (exists >= 0) {
        return prev.map((item, idx) => idx === exists ? { ...item, qty: item.qty + 1 } : item);
      } else {
        return [...prev, { skuId: finalSkuId, qty: 1, condition }];
      }
    });

    playBeep('success');
    setReturnScanFeedback({
      type: 'success',
      message: `SCAN SUKSES: +1 ${match ? match.skuName : finalSkuId} [Kondisi: ${condition}]`
    });

    setReturnScanText('');
  };

  // Filter return status tabs
  const [activeTab, setActiveTab] = useState<ReturnStatus | 'ALL'>('ALL');

  const filteredReturns = returns.filter(rec => {
    if (activeTab === 'ALL') return true;
    return rec.status === activeTab;
  });

  // Auto-select first return if none is selected or if the selected one is no longer in the list
  React.useEffect(() => {
    if (filteredReturns.length > 0) {
      const isStillAvailable = filteredReturns.some(r => r.id === selectedReturn?.id);
      if (!isStillAvailable) {
        setSelectedReturn(filteredReturns[0]);
      }
    } else {
      setSelectedReturn(null);
    }
  }, [filteredReturns, selectedReturn]);

  const handleAddItemToReturn = () => {
    if (!selectedSku || selectedQty <= 0) return;

    const exists = returnItems.some(item => item.skuId === selectedSku && item.condition === selectedCondition);
    if (exists) {
      setReturnItems(returnItems.map(item => 
        (item.skuId === selectedSku && item.condition === selectedCondition)
          ? { ...item, qty: item.qty + selectedQty }
          : item
      ));
    } else {
      setReturnItems([...returnItems, { skuId: selectedSku, qty: selectedQty, condition: selectedCondition }]);
    }

    setSelectedQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setReturnItems(returnItems.filter((_, idx) => idx !== index));
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnItems.length === 0 || !returnFrom) return;

    const mappedItems = returnItems.map(ret => {
      const invItem = inventory.find(i => i.skuId === ret.skuId);
      return {
        skuId: ret.skuId,
        skuName: invItem ? invItem.skuName : 'Produk Kosmetik',
        brand: invItem ? invItem.brand : 'Cosmetics',
        barcode: invItem ? invItem.barcode : '899' + Math.floor(Math.random() * 100000000),
        qty: ret.qty,
        location: invItem ? invItem.location : 'UT-01-01-01',
        condition: ret.condition
      };
    });

    const newReturn: ReturnRecord = {
      id: `RET-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 90) + 10)}`,
      date: new Date().toLocaleDateString('id-ID'),
      reason: reason,
      items: mappedItems,
      status: 'PENDING',
      returnFrom: returnFrom.trim(),
      processedBy: currentUser.name,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    onAddReturn(newReturn);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setReturnFrom('');
    setReason('WRONG_ITEM');
    setNotes('');
    setReturnItems([]);
    setSelectedSku('');
  };

  // Inspect Return Claim Flow
  const handleInspectReturn = (record: ReturnRecord, action: 'INSPECT' | 'APPROVE' | 'REJECT' | 'COMPLETE') => {
    let nextStatus: ReturnStatus = record.status;

    if (action === 'INSPECT') nextStatus = 'INSPECTED';
    else if (action === 'APPROVE') nextStatus = 'APPROVED';
    else if (action === 'REJECT') nextStatus = 'REJECTED';
    else if (action === 'COMPLETE') {
      nextStatus = 'COMPLETED';
      // Restoration logic: If status is COMPLETED, add the items marked as GOOD back to stock!
      record.items.forEach(item => {
        if (item.condition === 'GOOD') {
          onRestoreGoodStock(item.skuId, item.qty);
        }
      });
    }

    const updated = {
      ...record,
      status: nextStatus,
      processedBy: currentUser.name
    };

    onUpdateReturn(updated);
    setSelectedReturn(updated);
  };

  const getReasonLabel = (reason: ReturnReason) => {
    switch (reason) {
      case 'EXPIRED': return 'Kedaluwarsa';
      case 'DAMAGED': return 'Kemasan Rusak';
      case 'WRONG_ITEM': return 'Salah Kirim Item';
      case 'QUALITY_ISSUE': return 'Masalah Mutu Formula';
      case 'OTHER': return 'Lainnya';
    }
  };

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold rounded-full">Klaim Masuk</span>;
      case 'INSPECTED':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold rounded-full">Selesai Cek QC</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-bold rounded-full">Retur Disetujui</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold rounded-full">Retur Ditolak</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold rounded-full">Selesai Restorasi</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Return & Klaim Barang</h2>
          <p className="text-[11px] text-slate-500">Proses pengembalian produk rusak/salah kirim dari pelanggan dan lakukan audit kualitas.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 font-extrabold text-xs rounded transition-all flex items-center gap-1.5 border border-pink-200 cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Registrasi Retur Pelanggan
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        {(['ALL', 'PENDING', 'INSPECTED', 'APPROVED', 'REJECTED', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-bold transition-all relative shrink-0 ${
              activeTab === tab 
                ? 'text-pink-600 border-b-2 border-pink-500' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'ALL' && 'Semua Klaim'}
            {tab === 'PENDING' && 'Klaim Masuk (Pending)'}
            {tab === 'INSPECTED' && 'Sudah QC'}
            {tab === 'APPROVED' && 'Disetujui'}
            {tab === 'REJECTED' && 'Ditolak'}
            {tab === 'COMPLETED' && 'Selesai Restorasi'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Claims list */}
        <div className="lg:col-span-2 space-y-3">
          {filteredReturns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white border border-slate-200 rounded">
              <Undo2 className="h-8 w-8 text-slate-300 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Tidak Ada Klaim Retur</p>
              <p className="text-[10px] mt-0.5">Semua pengembalian barang bersih atau tidak ditemukan.</p>
            </div>
          ) : (
            filteredReturns.map((record) => (
              <div 
                key={record.id} 
                onClick={() => setSelectedReturn(record)}
                className={`p-3.5 rounded border transition-all cursor-pointer bg-white ${
                  selectedReturn?.id === record.id 
                    ? 'border-pink-500 ring-1 ring-pink-500/15 shadow-2xs' 
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs text-slate-800">{record.id}</span>
                      {getStatusBadge(record.status)}
                    </div>
                    <p className="text-xs font-extrabold text-slate-700 mt-1.5">Dari: {record.returnFrom}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Sebab: <span className="text-pink-600 font-bold">{getReasonLabel(record.reason)}</span></p>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded border border-slate-200/50">
                        {record.items.reduce((sum, item) => sum + item.qty, 0)} pcs ({record.items.length} SKU)
                      </span>
                      <button
                        title="Hapus Transaksi"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReturn(record.id);
                          if (selectedReturn?.id === record.id) {
                            setSelectedReturn(null);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono">{record.date}</p>
                  </div>
                </div>

                {/* Items and conditions preview */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  {record.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-150">
                      <div className="truncate pr-2">
                        <span className="font-medium text-slate-700 block truncate">{it.skuName}</span>
                        <span className={`text-[8px] font-bold ${
                          it.condition === 'GOOD' ? 'text-emerald-600' : it.condition === 'DAMAGED' ? 'text-pink-600' : 'text-amber-600'
                        }`}>Kondisi: {it.condition === 'GOOD' ? 'BAGUS (Lolos)' : it.condition === 'DAMAGED' ? 'RUSAK' : 'EXPIRED'}</span>
                      </div>
                      <strong className="text-slate-800 font-mono shrink-0">{it.qty} pcs</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Audit Inspector panel */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs h-fit sticky top-4">
          <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs mb-0.5">Pemeriksa Klaim Kualitas (QC)</h3>
          <p className="text-[11px] text-slate-500 mb-3">Pilih tiket retur di sebelah kiri untuk melakukan evaluasi fisik item kosmetik.</p>

          {!selectedReturn ? (
            <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50/50">
              <ShieldAlert className="h-6 w-6 text-slate-300 mx-auto mb-1" />
              <p className="text-xs font-semibold text-slate-600">Menunggu Pemilihan Tiket</p>
              <p className="text-[9px] px-2 mt-0.5">Klik salah satu tiket klaim retur untuk mengaktifkan audit verifikasi.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Ticket info */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                <div className="flex justify-between font-mono text-[9px] text-slate-400">
                  <span>Tiket: {selectedReturn.id}</span>
                  <span>{selectedReturn.date}</span>
                </div>
                <p className="font-bold text-slate-800">Dari: {selectedReturn.returnFrom}</p>
                <p className="text-slate-600 font-semibold">Alasan: {getReasonLabel(selectedReturn.reason)}</p>
                {selectedReturn.notes && (
                  <p className="text-[9px] text-slate-400 italic mt-1 bg-white p-1.5 rounded border border-slate-100">Ket: {selectedReturn.notes}</p>
                )}
              </div>

              {/* Inspector action history */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Langkah Evaluasi QC</p>
                
                {/* Step 1: PENDING -> INSPECTED */}
                <div className="flex gap-3 items-start">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedReturn.status !== 'PENDING' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 border'
                  }`}>1</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Cek Fisik Formula & Botol</h4>
                    <p className="text-[10px] text-slate-400">Periksa isi cairan, segel botol, bocor, atau kemasan retak.</p>
                    {selectedReturn.status === 'PENDING' && (
                      <button
                        onClick={() => handleInspectReturn(selectedReturn, 'INSPECT')}
                        className="mt-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded transition-all cursor-pointer shadow-2xs"
                      >
                        Konfirmasi Selesai Cek Fisik
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 2: INSPECTED -> APPROVE / REJECT */}
                <div className="flex gap-2.5 items-start">
                  <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedReturn.status === 'APPROVED' || selectedReturn.status === 'COMPLETED' 
                      ? 'bg-emerald-500 text-white' 
                      : selectedReturn.status === 'REJECTED' 
                        ? 'bg-pink-500 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-250'
                  }`}>2</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Keputusan Klaim</h4>
                    <p className="text-[10px] text-slate-400">Setujui untuk diganti rugi atau tolak klaim apabila cacat disebabkan kelalaian kurir/toko.</p>
                    {selectedReturn.status === 'INSPECTED' && (
                      <div className="mt-1.5 flex gap-2">
                        <button
                          onClick={() => handleInspectReturn(selectedReturn, 'APPROVE')}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] rounded transition-all cursor-pointer shadow-2xs"
                        >
                          Setujui Klaim
                        </button>
                        <button
                          onClick={() => handleInspectReturn(selectedReturn, 'REJECT')}
                          className="px-2.5 py-1 bg-pink-500 hover:bg-pink-600 text-white font-bold text-[10px] rounded transition-all cursor-pointer shadow-2xs"
                        >
                          Tolak Klaim
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: APPROVED -> COMPLETED */}
                <div className="flex gap-2.5 items-start">
                  <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedReturn.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 border border-slate-250'
                  }`}>3</div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Restorasi Stok & Disposal</h4>
                    <p className="text-[10px] text-slate-400">Masukkan kembali barang mulus (GOOD) ke rak, buang barang hancur/expired.</p>
                    {selectedReturn.status === 'APPROVED' && (
                      <button
                        onClick={() => handleInspectReturn(selectedReturn, 'COMPLETE')}
                        className="mt-1.5 px-2.5 py-1 bg-pink-500 hover:bg-pink-600 text-white font-bold text-[10px] rounded transition-all shadow-2xs cursor-pointer"
                      >
                        Selesaikan Restorasi Stok
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Completed Status Summary Banner */}
              {selectedReturn.status === 'COMPLETED' && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-xs space-y-0.5 shadow-2xs">
                  <p className="font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Klaim Selesai & Terarsip
                  </p>
                  <p className="text-[10px] text-emerald-700">Barang dalam kondisi <strong>BAGUS (GOOD)</strong> telah dikembalikan secara otomatis ke dalam kapasitas rak penjualan aktif.</p>
                </div>
              )}

              {selectedReturn.status === 'REJECTED' && (
                <div className="p-2.5 bg-pink-50 text-pink-800 rounded border border-pink-100 text-xs shadow-2xs">
                  <p className="font-bold flex items-center gap-1 text-[11px]">
                    <HeartCrack className="h-4 w-4 text-pink-500" />
                    Klaim Resmi Ditolak
                  </p>
                  <p className="text-[10px] text-pink-700 mt-0.5">Tiket ditutup dengan penolakan klaim pengganti. Tidak ada barang yang direstorasi.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Register Customer Return Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-slate-200 w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Registrasi Retur Pelanggan Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-slate-200 text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleRegisterSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dikirim oleh (Pelanggan)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Toko Glow Bandung, Shopee Customer"
                    value={returnFrom}
                    onChange={(e) => setReturnFrom(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alasan Pengembalian</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReturnReason)}
                    className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                  >
                    <option value="WRONG_ITEM">Salah Kirim Item (Toko)</option>
                    <option value="DAMAGED">Kemasan Cacat / Rusak</option>
                    <option value="EXPIRED">Kedaluwarsa (Expired)</option>
                    <option value="QUALITY_ISSUE">Formula Berubah / Isu Mutu</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Input Mode Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('SINGLE')}
                  className={`flex-1 py-1.5 text-center text-xs font-bold transition-all border-b-2 ${
                    activeInputMode === 'SINGLE'
                      ? 'text-pink-600 border-pink-500'
                      : 'text-slate-400 hover:text-slate-600 border-transparent'
                  }`}
                >
                  Pilih Manual (Satu-Satu)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('BULK')}
                  className={`flex-1 py-1.5 text-center text-xs font-bold transition-all border-b-2 ${
                    activeInputMode === 'BULK'
                      ? 'text-pink-600 border-pink-500'
                      : 'text-slate-400 hover:text-slate-600 border-transparent'
                  }`}
                >
                  ⚡ Input Massal & Scanner
                </button>
              </div>

              {activeInputMode === 'SINGLE' ? (
                /* Add item builder (Manual Single Mode) */
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Tambah Item Retur (Manual)</span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Pilih SKU Produk</label>
                      <select
                        value={selectedSku}
                        onChange={(e) => setSelectedSku(e.target.value)}
                        className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700"
                      >
                        <option value="">-- Pilih SKU --</option>
                        {inventory.map(item => (
                          <option key={item.id} value={item.skuId}>{item.skuId} — {item.skuName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Kuantitas (pcs)</label>
                      <input
                        type="number"
                        value={selectedQty}
                        onChange={(e) => setSelectedQty(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Kondisi Kemasan</label>
                      <select
                        value={selectedCondition}
                        onChange={(e) => setSelectedCondition(e.target.value as any)}
                        className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700"
                      >
                        <option value="GOOD">BAGUS (GOOD) — Bisa Dijual Kembali</option>
                        <option value="DAMAGED">RUSAK (DAMAGED) — Butuh Pembuangan</option>
                        <option value="EXPIRED">KEDALUWARSA — Butuh Pembuangan</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToReturn}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded shadow-2xs cursor-pointer"
                  >
                    Masukkan ke Keranjang Retur
                  </button>
                </div>
              ) : (
                /* Input Massal & Barcode Scanner Mode */
                <div className="space-y-3">
                  {/* Scanner Field */}
                  <div className="p-2.5 bg-slate-900 text-white rounded border border-slate-950 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        SCANNER MODE AKTIF
                      </span>
                      <span className="text-[8px] text-slate-400 font-medium font-mono">Set Kondisi: {selectedCondition}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="col-span-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                          <Barcode className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={returnScanText}
                          onChange={(e) => setReturnScanText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleReturnScanSubmit(e);
                            }
                          }}
                          placeholder="Tembak barcode / ketik SKU lalu Enter..."
                          className="w-full pl-8 pr-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <select
                          value={selectedCondition}
                          onChange={(e) => setSelectedCondition(e.target.value as any)}
                          className="w-full p-1 bg-slate-800 border border-slate-700 rounded text-[10px] text-white font-semibold"
                        >
                          <option value="GOOD">BAGUS (GOOD)</option>
                          <option value="DAMAGED">RUSAK</option>
                          <option value="EXPIRED">EXPIRED</option>
                        </select>
                      </div>
                    </div>

                    {returnScanFeedback && (
                      <p className="text-[9px] text-emerald-400 font-medium">{returnScanFeedback.message}</p>
                    )}
                  </div>

                  {/* Excel Upload and Template Download */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-emerald-800 uppercase block flex items-center gap-1">
                        <Upload className="h-3 w-3 text-emerald-600" /> Upload File Excel (.xlsx)
                      </span>
                      <button
                        type="button"
                        onClick={downloadReturnTemplate}
                        className="text-[9px] text-pink-600 font-extrabold hover:underline flex items-center gap-0.5"
                      >
                        <Download className="h-3 w-3" /> Unduh Form Template
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportReturnExcel}
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs transition-all animate-pulse"
                    >
                      Pilih & Upload File Retur
                    </button>
                  </div>

                  {/* Bulk Textarea */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Ketik Massal Retur</span>
                      <button
                        type="button"
                        onClick={() => setBulkInputText('FIN028 2 GOOD\nSOU026 5 DAMAGED\nSKI121 1 EXPIRED')}
                        className="text-[9px] text-pink-600 font-extrabold hover:underline"
                      >
                        Muat Contoh
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={bulkInputText}
                      onChange={(e) => setBulkInputText(e.target.value)}
                      placeholder="Format: SKU_ID Kuantitas Kondisi (satu baris per item)&#10;Pilihan Kondisi: GOOD / DAMAGED / EXPIRED&#10;Contoh: FIN028 5 DAMAGED"
                      className="w-full p-2 border border-slate-200 rounded text-[11px] font-mono bg-white text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={handleProcessBulkReturn}
                      disabled={!bulkInputText.trim()}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-[10px] rounded cursor-pointer"
                    >
                      Proses & Tambahkan Semua
                    </button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Daftar Item Retur ({returnItems.length})</label>
                {returnItems.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-3 border border-dashed border-slate-200 rounded">Belum ada item retur ditambahkan.</p>
                ) : (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {returnItems.map((item, index) => {
                      const invItem = inventory.find(i => i.skuId === item.skuId);
                      return (
                        <div key={index} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded text-xs">
                          <div>
                            <span className="font-bold text-slate-800 font-mono text-[10px]">{item.skuId}</span>
                            <span className="text-[8px] bg-slate-250 text-slate-600 px-1 rounded ml-1.5 uppercase">{item.condition}</span>
                            <p className="text-slate-500 text-[10px] truncate max-w-[200px] mt-0.5">{invItem?.skuName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-slate-700 text-[11px]">{item.qty} pcs</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-pink-600 hover:text-pink-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Catatan Khusus Pelanggan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan keluhan, kompensasi kupon, bukti video unboxing, dsb..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={returnItems.length === 0}
                  className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  Simpan Klaim Retur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
