import React, { useState } from 'react';
import { toast } from 'sonner';
import { 
  Download, 
  Plus, 
  Truck, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  X, 
  ArrowRight, 
  User, 
  Barcode,
  Calendar,
  Layers,
  Trash2,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InboundRecord, InventoryItem, User as UserType, InboundStatus } from '../types';
import { downloadInboundTemplate } from '../utils/excelTemplates';

interface InboundViewProps {
  inbounds: InboundRecord[];
  inventory: InventoryItem[];
  currentUser: UserType;
  onAddInbound: (record: InboundRecord) => void;
  onUpdateInbound: (record: InboundRecord) => void;
  onPutawayComplete: (items: { skuId: string; qty: number }[]) => void;
  onDeleteInbound: (id: string) => void;
}

export default function InboundView({
  inbounds,
  inventory,
  currentUser,
  onAddInbound,
  onUpdateInbound,
  onPutawayComplete,
  onDeleteInbound,
}: InboundViewProps) {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [activeTab, setActiveTab] = useState<InboundStatus | 'ALL'>('ALL');

  // New Plan form states
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedQty, setSelectedQty] = useState(50);
  const [planItems, setPlanItems] = useState<{ skuId: string; qty: number }[]>([]);

  // Input Massal & Barcode Scanner states for Inbound Planning
  const [activeInputMode, setActiveInputMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [bulkInputText, setBulkInputText] = useState('');
  const [inboundScanText, setInboundScanText] = useState('');
  const [inboundScanFeedback, setInboundScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportInboundExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const newItems: { skuId: string; qty: number }[] = [...planItems];
        let importedCount = 0;

        jsonData.forEach(row => {
          const getValueByKeys = (item: any, keys: string[]): string => {
            const matchKey = Object.keys(item).find(k => keys.some(key => k.trim().toLowerCase() === key.toLowerCase()));
            return matchKey ? item[matchKey].toString().trim() : '';
          };

          const skuId = getValueByKeys(row, ['kode sku', 'sku id', 'sku_id', 'sku', 'kode barang', 'kode produk']).toUpperCase();
          const qtyVal = parseInt(getValueByKeys(row, ['qty rencana', 'qty', 'quantity', 'jumlah', 'stok']), 10);
          const supplierVal = getValueByKeys(row, ['supplier', 'vendor', 'pemasok']);

          if (supplierVal && !supplier) {
            setSupplier(supplierVal);
          }

          if (skuId && !isNaN(qtyVal) && qtyVal > 0) {
            const existsIdx = newItems.findIndex(item => item.skuId === skuId);
            if (existsIdx >= 0) {
              newItems[existsIdx].qty += qtyVal;
            } else {
              newItems.push({ skuId, qty: qtyVal });
            }
            importedCount++;
          }
        });

        if (importedCount > 0) {
          setPlanItems(newItems);
          toast.success(`Berhasil mengimpor ${importedCount} item rencana dari Excel.`);
          playBeep('success');
        } else {
          toast.error('Tidak ada data item valid dalam file Excel.');
        }
      } catch (err) {
        toast.error('Gagal membaca file Excel. Pastikan berformat .xlsx, .xls, atau .csv');
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

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

  const handleProcessBulkInput = () => {
    if (!bulkInputText.trim()) return;
    const lines = bulkInputText.split('\n');
    let addedCount = 0;
    const newItems = [...planItems];

    lines.forEach(line => {
      const parts = line.trim().replace(/\t/g, ' ').split(/\s+/);
      if (parts.length >= 1) {
        const code = parts[0].trim().toUpperCase();
        if (!code) return;

        let qty = 50;
        if (parts.length >= 2) {
          const parsedQty = parseInt(parts[1]);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = parsedQty;
          }
        }

        const match = inventory.find(i => i.skuId.toUpperCase() === code || i.barcode === parts[0]);
        const finalSkuId = match ? match.skuId : code;

        const existsIdx = newItems.findIndex(item => item.skuId === finalSkuId);
        if (existsIdx >= 0) {
          newItems[existsIdx].qty += qty;
        } else {
          newItems.push({ skuId: finalSkuId, qty });
        }
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setPlanItems(newItems);
      playBeep('success');
      setBulkInputText('');
    } else {
      playBeep('error');
      toast.error('Format tidak valid. Pastikan menulis format: SKU_ID JUMLAH (Contoh: FIN028 20)');
    }
  };

  const handleInboundScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = inboundScanText.trim();
    if (!code) return;

    const upperCode = code.toUpperCase();
    const match = inventory.find(i => i.skuId.toUpperCase() === upperCode || i.barcode === code);

    if (match) {
      const finalSkuId = match.skuId;
      setPlanItems(prev => {
        const exists = prev.some(item => item.skuId === finalSkuId);
        if (exists) {
          return prev.map(item => item.skuId === finalSkuId ? { ...item, qty: item.qty + 1 } : item);
        } else {
          return [...prev, { skuId: finalSkuId, qty: 1 }];
        }
      });
      playBeep('success');
      setInboundScanFeedback({
        type: 'success',
        message: `SCAN SUKSES: +1 ${match.skuName} (${match.skuId}) ditambahkan.`
      });
    } else {
      setPlanItems(prev => {
        const exists = prev.some(item => item.skuId === upperCode);
        if (exists) {
          return prev.map(item => item.skuId === upperCode ? { ...item, qty: item.qty + 1 } : item);
        } else {
          return [...prev, { skuId: upperCode, qty: 1 }];
        }
      });
      playBeep('success');
      setInboundScanFeedback({
        type: 'success',
        message: `SKU Baru Ditambahkan: +1 ${upperCode} (Belum ada di database).`
      });
    }

    setInboundScanText('');
  };

  // Selected Inbound for Interactive Stepper
  const [activeInbound, setActiveInbound] = useState<InboundRecord | null>(null);

  // Filter inbounds
  const filteredInbounds = inbounds.filter(record => {
    if (activeTab === 'ALL') return true;
    return record.status === activeTab;
  });

  // Auto-select first inbound if none is selected or if the selected one is no longer in the list
  React.useEffect(() => {
    if (filteredInbounds.length > 0) {
      const isStillAvailable = filteredInbounds.some(r => r.id === activeInbound?.id);
      if (!isStillAvailable) {
        setActiveInbound(filteredInbounds[0]);
      }
    } else {
      setActiveInbound(null);
    }
  }, [filteredInbounds, activeInbound]);

  // Handle Add Item to Plan
  const handleAddItemToPlan = () => {
    if (!selectedSku || selectedQty <= 0) return;
    
    // Check if SKU already in planItems
    const exists = planItems.some(item => item.skuId === selectedSku);
    if (exists) {
      setPlanItems(planItems.map(item => 
        item.skuId === selectedSku ? { ...item, qty: item.qty + selectedQty } : item
      ));
    } else {
      setPlanItems([...planItems, { skuId: selectedSku, qty: selectedQty }]);
    }
    
    setSelectedQty(50);
  };

  // Remove Item from Plan
  const handleRemoveItemFromPlan = (skuId: string) => {
    setPlanItems(planItems.filter(item => item.skuId !== skuId));
  };

  // Submit Inbound Plan
  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (planItems.length === 0 || !supplier) return;

    const mappedItems = planItems.map(p => {
      const invItem = inventory.find(i => i.skuId === p.skuId);
      return {
        skuId: p.skuId,
        skuName: invItem ? invItem.skuName : 'Produk Kosmetik Baru',
        brand: invItem ? invItem.brand : 'Cosmetics',
        barcode: invItem ? invItem.barcode : '899' + Math.floor(Math.random() * 10000000000),
        qty: p.qty,
        location: invItem ? invItem.location : 'UT-01-01-01',
        expiredDate: invItem ? invItem.expiredDate : '31/12/2028'
      };
    });

    const newPlan: InboundRecord = {
      id: `INB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`,
      date: new Date().toLocaleDateString('id-ID'),
      supplier: supplier.trim(),
      items: mappedItems,
      status: 'PENDING',
      receivedBy: '-',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    onAddInbound(newPlan);
    setShowPlanModal(false);
    resetPlanForm();
  };

  const resetPlanForm = () => {
    setSupplier('');
    setNotes('');
    setPlanItems([]);
    setSelectedSku('');
  };

  // Stepper Progression Logic
  const handleProgressInbound = (record: InboundRecord) => {
    if (record.status === 'PENDING') {
      // Move to RECEIVED
      const updated = {
        ...record,
        status: 'RECEIVED' as const,
        receivedBy: currentUser.name,
      };
      onUpdateInbound(updated);
      setActiveInbound(updated);
    } else if (record.status === 'RECEIVED') {
      // Move to CHECKED (QC completed)
      const updated = {
        ...record,
        status: 'CHECKED' as const,
      };
      onUpdateInbound(updated);
      setActiveInbound(updated);
    } else if (record.status === 'CHECKED') {
      // Move to COMPLETED and update global inventory stock!
      const updated = {
        ...record,
        status: 'COMPLETED' as const,
        completedAt: new Date().toISOString()
      };
      onUpdateInbound(updated);
      
      // Update inventory stock
      const putawayItems = record.items.map(item => ({
        skuId: item.skuId,
        qty: item.qty
      }));
      onPutawayComplete(putawayItems);
      
      setActiveInbound(null);
    }
  };

  const getStatusBadge = (status: InboundStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold rounded-full">Direncanakan</span>;
      case 'RECEIVED':
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-bold rounded-full">Diterima Dock</span>;
      case 'CHECKED':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold rounded-full">QC Terverifikasi</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold rounded-full">Putaway Selesai</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">Penerimaan Barang (Inbound)</h2>
          <p className="text-[11px] text-slate-500">Kelola dan proses pengiriman kosmetik masuk dari supplier/pabrik rekanan.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Buat Rencana Inbound
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        {(['ALL', 'PENDING', 'RECEIVED', 'CHECKED', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-bold transition-all relative shrink-0 ${
              activeTab === tab 
                ? 'text-pink-600 border-b-2 border-pink-500' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'ALL' && 'Semua Transaksi'}
            {tab === 'PENDING' && 'Rencana (Pending)'}
            {tab === 'RECEIVED' && 'Tiba di Dock'}
            {tab === 'CHECKED' && 'Sudah QC'}
            {tab === 'COMPLETED' && 'Selesai Putaway'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Side: Inbound List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredInbounds.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white border border-slate-200 rounded">
              <Truck className="h-8 w-8 text-slate-300 mx-auto mb-1" />
              <p className="font-bold text-slate-700">Tidak Ada Inbound</p>
              <p className="text-[10px] mt-0.5">Tidak ada record penerimaan barang untuk kategori ini.</p>
            </div>
          ) : (
            filteredInbounds.map((record) => (
              <div 
                key={record.id} 
                onClick={() => setActiveInbound(record)}
                className={`p-3.5 rounded border transition-all cursor-pointer bg-white ${
                  activeInbound?.id === record.id 
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
                    <p className="text-xs font-extrabold text-slate-700 mt-1.5">Supplier: {record.supplier}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Tanggal Rencana: {record.date}</p>
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
                          onDeleteInbound(record.id);
                          if (activeInbound?.id === record.id) {
                            setActiveInbound(null);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">Diterima oleh: {record.receivedBy}</p>
                  </div>
                </div>

                {/* Items preview */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  {record.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-150">
                      <span className="truncate max-w-[140px] text-slate-700 font-medium">{it.skuName}</span>
                      <strong className="text-slate-800 font-mono shrink-0">{it.qty} pcs</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Stepper Interactive Verification */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs h-fit sticky top-4">
          <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs mb-0.5">Verifikator Penerimaan Fisik</h3>
          <p className="text-[11px] text-slate-500 mb-3">Pilih salah satu transaksi inbound di samping untuk memproses barang masuk.</p>

          {!activeInbound ? (
            <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50/50">
              <Download className="h-6 w-6 text-slate-300 mx-auto mb-1" />
              <p className="text-[11px] font-semibold text-slate-600">Menunggu Pemilihan Transaksi</p>
              <p className="text-[9px] px-2 mt-0.5">Klik salah satu kartu di sebelah kiri untuk mengaktifkan workflow verifikasi fisik.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active info header */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-0.5">
                <div className="flex justify-between font-mono text-[9px] text-slate-400">
                  <span>ID: {activeInbound.id}</span>
                  <span>{activeInbound.date}</span>
                </div>
                <p className="font-extrabold text-slate-800">Supplier: {activeInbound.supplier}</p>
                {activeInbound.notes && (
                  <p className="text-[9px] text-slate-400 italic mt-0.5">Ket: {activeInbound.notes}</p>
                )}
              </div>

              {/* Status Stepper visualization */}
              <div className="relative pl-5 space-y-5 border-l-2 border-slate-200">
                {/* Step 1: PENDING */}
                <div className="relative">
                  <div className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 ${
                    activeInbound.status !== 'PENDING' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-amber-500'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-none">Rencana Terbuat</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Dokumen pre-alert inbound masuk dari supplier.</p>
                  </div>
                </div>

                {/* Step 2: RECEIVED */}
                <div className="relative">
                  <div className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 ${
                    activeInbound.status === 'CHECKED' || activeInbound.status === 'COMPLETED' 
                      ? 'bg-emerald-500 border-emerald-500' 
                      : activeInbound.status === 'RECEIVED' 
                        ? 'bg-white border-indigo-500' 
                        : 'bg-white border-slate-300'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-none">Tiba di Loading Dock</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Truk sampai, verifikasi muatan box luar.</p>
                    {activeInbound.status === 'RECEIVED' && (
                      <span className="inline-block mt-1.5 text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-mono">
                        Diproses oleh: {activeInbound.receivedBy}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 3: CHECKED */}
                <div className="relative">
                  <div className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 ${
                    activeInbound.status === 'COMPLETED' 
                      ? 'bg-emerald-500 border-emerald-500' 
                      : activeInbound.status === 'CHECKED' 
                        ? 'bg-white border-emerald-500' 
                        : 'bg-white border-slate-300'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-none">Pemeriksaan Kualitas (QC)</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Verifikasi kuantitas eceran, cek fisik kemasan kosmetik, cek barcode SKU.</p>
                  </div>
                </div>

                {/* Step 4: COMPLETED */}
                <div className="relative">
                  <div className={`absolute -left-[27px] top-0.5 w-3 h-3 rounded-full border-2 ${
                    activeInbound.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-none">Putaway Selesai</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Barang ditaruh di rak masing-masing sesuai kode lokasi.</p>
                  </div>
                </div>
              </div>

               {/* Action Button for Next Step */}
              {activeInbound.status !== 'COMPLETED' ? (
                <button
                  onClick={() => handleProgressInbound(activeInbound)}
                  className="w-full py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {activeInbound.status === 'PENDING' && 'Mulai Bongkar & Terima'}
                  {activeInbound.status === 'RECEIVED' && 'Konfirmasi Lulus QC'}
                  {activeInbound.status === 'CHECKED' && 'Selesaikan Putaway ke Rak'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-bold">Inbound Selesai!</p>
                    <p className="text-[10px] mt-0.5 text-emerald-700">Persediaan SKU telah otomatis ditambahkan ke inventaris rak.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
 
      {/* Plan Inbound Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-slate-200 w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Buat Rencana Inbound Baru</h3>
              <button onClick={() => setShowPlanModal(false)} className="p-1 rounded hover:bg-slate-200 text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handlePlanSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Supplier / Pabrik</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Cosmax Indonesia, Shiseido Lab"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                />
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

              {/* Excel template and file import widget */}
              <div className="flex gap-2 justify-between items-center p-2 bg-pink-50 border border-pink-100 rounded">
                <span className="text-[10px] font-bold text-pink-800">Impor Excel Rencana:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={downloadInboundTemplate}
                    className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[9px] rounded flex items-center gap-1 shadow-3xs cursor-pointer"
                  >
                    <Download className="h-2.5 w-2.5 text-pink-500" /> Unduh Template
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white font-bold text-[9px] rounded flex items-center gap-1 shadow-3xs cursor-pointer"
                  >
                    <Upload className="h-2.5 w-2.5" /> Unggah File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportInboundExcel}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                </div>
              </div>

              {activeInputMode === 'SINGLE' ? (
                /* Select SKU to add (Manual Mode) */
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Tambah Item Kosmetik (Manual)</span>
                  
                  <div className="grid grid-cols-3 gap-2.5 items-end">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Pilih SKU</label>
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
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Jumlah (Pcs)</label>
                      <input
                        type="number"
                        value={selectedQty}
                        onChange={(e) => setSelectedQty(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToPlan}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded shadow-2xs cursor-pointer"
                  >
                    Tambahkan ke Keranjang Rencana
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
                      <span className="text-[8px] text-slate-400 font-medium">Bisa pakai Scanner Gun</span>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                        <Barcode className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        value={inboundScanText}
                        onChange={(e) => setInboundScanText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleInboundScanSubmit(e);
                          }
                        }}
                        placeholder="Klik di sini & Tembak Barcode / ketik SKU lalu Enter..."
                        className="w-full pl-7 pr-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {inboundScanFeedback && (
                      <p className="text-[9px] text-emerald-400 font-medium">{inboundScanFeedback.message}</p>
                    )}
                  </div>

                  {/* Bulk Textarea */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Ketik Massal (Multi-Line)</span>
                      <button
                        type="button"
                        onClick={() => setBulkInputText('FIN028 100\nSOU026 50\nSKI121 200')}
                        className="text-[9px] text-pink-600 font-extrabold hover:underline"
                      >
                        Muat Contoh
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={bulkInputText}
                      onChange={(e) => setBulkInputText(e.target.value)}
                      placeholder="Format: SKU_ID Kuantitas (satu baris per item)&#10;Contoh:&#10;FIN028 100&#10;SOU026 50"
                      className="w-full p-2 border border-slate-200 rounded text-[11px] font-mono bg-white text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={handleProcessBulkInput}
                      disabled={!bulkInputText.trim()}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-[10px] rounded cursor-pointer"
                    >
                      Proses & Tambahkan Semua
                    </button>
                  </div>
                </div>
              )}
 
              {/* Items in plan list */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Daftar Barang dalam Rencana ({planItems.length})</label>
                {planItems.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-3 border border-dashed border-slate-200 rounded">Belum ada item ditambahkan.</p>
                ) : (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {planItems.map((item) => {
                      const invItem = inventory.find(i => i.skuId === item.skuId);
                      return (
                        <div key={item.skuId} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded text-xs">
                          <div className="truncate pr-2">
                            <span className="font-bold text-slate-800 font-mono text-[10px]">{item.skuId}</span>
                            <span className="text-slate-500 text-[10px] ml-1.5 truncate">— {invItem?.skuName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold font-mono text-slate-700 text-[11px]">{item.qty} pcs</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromPlan(item.skuId)}
                              className="text-pink-600 font-bold text-xs hover:text-pink-700 cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Instruksi Tambahan (Catatan)</label>
                <textarea
                  rows={2}
                  placeholder="Instruksi pembongkaran, nomor kontainer atau nomor surat jalan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 text-slate-700 bg-slate-50/50"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPlanModal(false); resetPlanForm(); }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={planItems.length === 0}
                  className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs rounded shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                >
                  Simpan Rencana
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
