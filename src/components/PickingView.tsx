import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  MapPin, 
  AlertCircle, 
  X, 
  Clock, 
  ArrowLeft, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Sparkles,
  ChevronRight,
  Printer,
  Boxes,
  Camera,
  Calendar
} from 'lucide-react';
import { TransactionTask, User, OrderRecord, InventoryItem } from '../types';
import CameraScanner from './CameraScanner';

interface PickingViewProps {
  tasks: TransactionTask[];
  currentUser: User;
  onUpdateTask: (task: TransactionTask) => void;
  inventory?: InventoryItem[];
}

// Local interface representing the state of a SKU's picking line in the session editor
interface ActivePickState {
  taskId: string;
  skuId: string;
  skuName: string;
  barcode: string;
  targetQty: number;
  allocations: {
    id: string; // unique split row key
    inventoryItemId: string; // ID of inventory item
    location: string;
    expiredDate: string;
    batchNumber: string;
    warehouse: string;
    qtyPicked: number;
    confirmed: boolean;
  }[];
}

export default function PickingView({
  tasks,
  currentUser,
  onUpdateTask,
  inventory = [],
}: PickingViewProps) {
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);

  // Active document ID being picked (full screen session)
  const [activePickingOrderId, setActivePickingOrderId] = useState<string | null>(null);

  // Active pick state list
  const [pickStates, setPickStates] = useState<ActivePickState[]>([]);

  // Filter & Toggle states
  const [hideCompleted, setHideCompleted] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Handle scanned barcode / SKU
  const handleBarcodeScan = (scannedCode: string) => {
    const code = scannedCode.trim().toUpperCase();
    if (!code) return;

    // Find first matching unconfirmed item in active picking states
    const matchedIdx = pickStates.findIndex(item => 
      (item.barcode && item.barcode === scannedCode) || 
      item.skuId.toUpperCase() === code
    );

    if (matchedIdx !== -1) {
      const matchedItem = pickStates[matchedIdx];
      
      // Auto confirm the first unconfirmed allocation for this SKU
      setPickStates(prev => prev.map(pState => {
        if (pState.taskId !== matchedItem.taskId) return pState;
        
        return {
          ...pState,
          allocations: pState.allocations.map(alloc => ({
            ...alloc,
            confirmed: true
          }))
        };
      }));
      
      toast.success(`VERIFIKASI SUKSES: ${matchedItem.skuName} (${matchedItem.skuId})`);
    } else {
      toast.error(`Scan Error: Produk "${scannedCode}" tidak ada dalam order ini.`);
    }
  };

  // Active picking tasks (outbound tasks that are PENDING or PICKING)
  const activePickingTasks = tasks.filter(task => 
    task.type === 'OUTBOUND' && (task.status === 'PENDING' || task.status === 'PICKING')
  );

  // Group active tasks by orderNumber for the queue view
  const uniqueOrderNumbers = Array.from(new Set(activePickingTasks.map(t => t.orderNumber).filter(Boolean))) as string[];

  // Play voice synthesis and chime for "FINISH"
  const playFinishSound = () => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // stop any current speaking
        const utterance = new SpeechSynthesisUtterance('FINISH');
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      }
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (err) {
      console.error('Audio play failed', err);
    }
  };

  // When activePickingOrderId changes, initialize the state of the session
  useEffect(() => {
    if (activePickingOrderId) {
      const orderTasks = activePickingTasks.filter(t => t.orderNumber === activePickingOrderId);
      
      const initialStates: ActivePickState[] = orderTasks.map(task => {
        // Look up corresponding item in inventory to get default expired date
        const matchItem = inventory?.find(i => i.skuId === task.skuId && i.location === task.location) || inventory?.find(i => i.skuId === task.skuId);
        const defaultExpiredDate = matchItem?.expiredDate || '';

        return {
          taskId: task.id,
          skuId: task.skuId,
          skuName: task.skuName,
          barcode: task.barcode,
          targetQty: task.qty,
          allocations: [{
            id: `${task.id}-0`,
            inventoryItemId: matchItem?.id || '', // filled if adjusted
            location: task.location,
            expiredDate: defaultExpiredDate,
            batchNumber: matchItem?.batchNumber || '',
            warehouse: task.warehouse,
            qtyPicked: task.qty, // prefill actual target quantity
            confirmed: false
          }]
        };
      });
      setPickStates(initialStates);
    } else {
      setPickStates([]);
    }
  }, [activePickingOrderId]);

  // Adjust picker allocation location inside picking session
  const handleSessionLocationChange = (taskId: string, allocId: string, locationStr: string) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      return {
        ...item,
        allocations: item.allocations.map(alloc => {
          if (alloc.id !== allocId) return alloc;
          return {
            ...alloc,
            location: locationStr
          };
        })
      };
    }));
  };

  // Adjust picker allocation expired date inside picking session
  const handleSessionExpiredDateChange = (taskId: string, allocId: string, expiredDateStr: string) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      return {
        ...item,
        allocations: item.allocations.map(alloc => {
          if (alloc.id !== allocId) return alloc;
          return {
            ...alloc,
            expiredDate: expiredDateStr
          };
        })
      };
    }));
  };

  // Adjust picker actual quantity with plus / minus buttons
  const handleSessionQtyChange = (taskId: string, allocId: string, value: number) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      return {
        ...item,
        allocations: item.allocations.map(alloc => {
          if (alloc.id !== allocId) return alloc;
          return {
            ...alloc,
            qtyPicked: Math.max(0, value)
          };
        })
      };
    }));
  };

  // Add a split location inside session
  const handleSessionAddSplit = (taskId: string) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      const sampleAlloc = item.allocations[0];
      return {
        ...item,
        allocations: [
          ...item.allocations,
          {
            id: `pick-split-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            inventoryItemId: '',
            location: sampleAlloc?.location || 'Rak A1',
            expiredDate: '',
            batchNumber: '',
            warehouse: sampleAlloc?.warehouse || 'Gudang Utama',
            qtyPicked: 0,
            confirmed: false
          }
        ]
      };
    }));
  };

  // Remove split location row
  const handleSessionRemoveSplit = (taskId: string, allocId: string) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      return {
        ...item,
        allocations: item.allocations.filter(a => a.id !== allocId)
      };
    }));
  };

  // Toggle OK Confirmation status for a single SKU
  const handleToggleConfirmSKU = (taskId: string, allocId: string) => {
    setPickStates(prev => prev.map(item => {
      if (item.taskId !== taskId) return item;
      return {
        ...item,
        allocations: item.allocations.map(alloc => {
          if (alloc.id !== allocId) return alloc;
          return {
            ...alloc,
            confirmed: !alloc.confirmed
          };
        })
      };
    }));
  };

  // Selesaikan picking session, update status tasks, and notify packer
  const handleCompletePickingSession = () => {
    if (!activePickingOrderId) return;

    // Validate that all quantities match target and all rows are confirmed OK
    const isAllConfirmed = pickStates.every(item => 
      item.allocations.every(a => a.confirmed) && 
      item.allocations.reduce((sum, a) => sum + a.qtyPicked, 0) === item.targetQty
    );

    if (!isAllConfirmed) {
      toast.error('⚠️ Mohon konfirmasi [KONFIRMASI OK] semua item terlebih dahulu dengan kuantitas yang sesuai target.');
      return;
    }

    // Process & submit updates for each taskBelonging to this Order
    const orderTasks = activePickingTasks.filter(t => t.orderNumber === activePickingOrderId);

    orderTasks.forEach(task => {
      const matchState = pickStates.find(ps => ps.taskId === task.id);
      if (!matchState) return;

      const totalPicked = matchState.allocations.reduce((sum, a) => sum + a.qtyPicked, 0);
      const chosenLocations = matchState.allocations.map(a => `${a.location} (${a.qtyPicked} pcs, Exp: ${a.expiredDate || 'N/A'})`).join(', ');

      // Extract custom validation toggle saved inside task (defaults to true)
      const needsPacking = (task as any).needsPacking !== false;

      const updated: TransactionTask = {
        ...task,
        status: needsPacking ? 'CHECKING' : 'COMPLETED',
        qtyHandled: totalPicked,
        completedAt: new Date().toISOString(),
        assignedPickerId: currentUser.id,
        location: matchState.allocations[0]?.location || task.location, // save primary picked location
        expiredDate: matchState.allocations[0]?.expiredDate || '', // save primary picked expired date
        operatorLogs: [
          ...task.operatorLogs,
          {
            role: currentUser.role,
            operatorName: currentUser.name,
            action: `Selesai mengambil ${totalPicked} pcs dari lokasi rak: [ ${chosenLocations} ]. Status: ${needsPacking ? 'Menunggu Packing' : 'Siap Dikirim'}.`,
            timestamp: new Date().toISOString()
          }
        ]
      };

      onUpdateTask(updated);
    });

    playFinishSound();
    
    setFeedback({
      type: 'success',
      message: `Berhasil! Dokumen Picking ${activePickingOrderId} selesai diambil (Picked) dan berhasil dikirim ke Packer.`
    });

    // Close session and return to order list
    setActivePickingOrderId(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Boxes className="h-5 w-5 text-pink-500" />
            Terminal Pengambilan Barang (Picker)
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">Lakukan pengambilan barang fisik berdasarkan instruksi lokasi rak & simulasikan konfirmasi secara instan.</p>
        </div>
        <div className="text-[10px] font-mono text-pink-600 font-bold bg-pink-50 border border-pink-100 px-2.5 py-1 rounded">
          Tugas Aktif Antrean: {activePickingTasks.length} Ambilan
        </div>
      </div>

      {currentUser.role !== 'PICKER' && currentUser.role !== 'ADMIN' && (
        <div className="p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" />
          <p className="leading-relaxed font-medium">
            <strong>Akses Terbatas:</strong> Anda login sebagai <strong className="text-pink-600">{currentUser.role}</strong>. Untuk memproses dan mensimulasikan tugas pengambilan barang di rak, disarankan masuk sebagai peran <strong>PICKER</strong> atau <strong>ADMIN</strong> melalui menu <strong>Akun & Peran</strong>.
          </p>
        </div>
      )}

      {/* Inline Feedback Notification */}
      {feedback && (
        <div className={`p-3.5 rounded-lg border text-xs flex justify-between items-start transition-all ${
          feedback.type === 'error' 
            ? 'bg-pink-50 text-pink-900 border-pink-200' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="font-extrabold leading-normal">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RENDER VIEW: Queue Screen vs Session Screen */}
      {!activePickingOrderId ? (
        
        // ==========================================
        // SCREEN 2: ANTIREAN PICKING QUEUE LIST
        // ==========================================
        <div className="space-y-4">
          <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Antrean Picking & Pengambilan Barang
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Daftar order outbound yang memerlukan pengambilan fisik barang dari rak/lokasi gudang. Pilih order untuk menentukan atau menyesuaikan lokasi pengambilan beserta kuantitas aktual.
            </p>
          </div>

          {uniqueOrderNumbers.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
              <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Antrean Picking Bersih</p>
              <p className="text-[10px] mt-1 max-w-sm mx-auto">Tidak ada tugas pengambilan barang (picking) aktif saat ini. Semua order telah berhasil diambil!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueOrderNumbers.map(orderNum => {
                const orderTasks = activePickingTasks.filter(t => t.orderNumber === orderNum);
                const sampleTask = orderTasks[0];
                const totalQty = orderTasks.reduce((sum, t) => sum + t.qty, 0);
                
                // Overall status logic for order card (Belum dipicking / Sedang dipicking)
                const isAnyPicking = orderTasks.some(t => t.status === 'PICKING');
                const statusLabel = isAnyPicking ? 'SEDANG DIPICKING' : 'BELUM DIPICKING';
                
                return (
                  <div 
                    key={orderNum}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-3xs flex flex-col justify-between hover:border-pink-300 hover:shadow-2xs transition-all"
                  >
                    <div>
                      {/* Card header */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-emerald-600 border border-slate-200 font-mono font-black text-[10px] rounded-lg">
                          {orderNum}
                        </span>
                        <span className={`text-[8px] font-black tracking-widest px-2 py-1 rounded-full ${
                          isAnyPicking 
                            ? 'text-pink-600 bg-pink-50' 
                            : 'text-amber-600 bg-amber-50'
                        }`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Card main body */}
                      <div className="space-y-1.5 text-xs text-slate-600 border-b border-slate-100 pb-3 mb-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Customer:</span>
                          <span className="font-bold text-slate-800">{sampleTask?.customerOrSupplier || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Waktu Order:</span>
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            {sampleTask?.createdAt ? new Date(sampleTask.createdAt).toLocaleString('id-ID') : '17/7/2026, 04.56.40'}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Detail Item:</span>
                          <span className="font-black text-slate-800 text-[11px]">
                            {orderTasks.length} Line Item • {totalQty} Pcs
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        // Mark all tasks of this order as PICKING in parent state if PENDING
                        orderTasks.forEach(task => {
                          if (task.status === 'PENDING') {
                            onUpdateTask({
                              ...task,
                              status: 'PICKING',
                              assignedPickerId: currentUser.id
                            });
                          }
                        });
                        setActivePickingOrderId(orderNum);
                      }}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-lg shadow-3xs hover:shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Mulai Pengambilan (Picking)
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (

        // ==========================================
        // SCREEN 3: ACTIVE PICKING SESSION SCREEN
        // ==========================================
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Header Row Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-3xs">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setActivePickingOrderId(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border border-slate-250"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>

              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 active:scale-95 text-white font-extrabold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Camera className="h-4 w-4" />
                Scan Kamera HP
              </button>

              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <input
                  id="hideCompletedCheckbox"
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="hideCompletedCheckbox" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                  Sembunyikan Selesai (OK)
                </label>
              </div>
            </div>

            <div className="text-right flex items-center justify-between sm:justify-end gap-3 font-mono font-black text-xs text-slate-800 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg shrink-0">
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Sesi Dokumen Picking:</span>
              <span className="text-[11px] font-black text-slate-800">{activePickingOrderId}</span>
            </div>
          </div>

          {/* Core Session Workspace Grid: Left picker lines vs Right sticky summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Left Workspace (Grid Span 8) */}
            <div className="lg:col-span-8 space-y-3">
              {pickStates
                .filter(item => {
                  if (!hideCompleted) return true;
                  // Hide SKU if all allocations of this SKU are confirmed OK
                  return !item.allocations.every(a => a.confirmed);
                })
                .map((item, idx) => {
                  return (
                    <div 
                      key={item.taskId}
                      className="p-4 bg-white border border-slate-200 rounded-xl shadow-3xs space-y-3 hover:border-pink-200/50 transition-all"
                    >
                      {/* SKU Row Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-2 py-0.5 bg-slate-900 text-emerald-400 font-mono font-black text-[10px] rounded border border-slate-800 uppercase shadow-3xs">
                            {item.skuId}
                          </span>
                          <h4 className="font-black text-slate-900 text-xs sm:text-sm">{item.skuName}</h4>
                          
                          {/* Large Prominent Barcode Next to SKU name */}
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border-2 border-amber-300 text-amber-950 font-mono font-black text-xs rounded-lg shadow-sm">
                            <span className="text-[9px] text-amber-700 font-sans uppercase font-black tracking-wider">BARCODE ACUAN:</span>
                            <span className="text-sm font-black text-slate-900 tracking-wider font-mono">{item.barcode || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowScanner(true);
                            }}
                            className="text-[9px] text-emerald-600 hover:text-emerald-750 font-black flex items-center gap-1 border border-emerald-100 bg-emerald-50 px-2 py-1 rounded cursor-pointer transition-all"
                            title="Pindai barcode produk ini"
                          >
                            <Camera className="h-3 w-3" /> Scan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSessionAddSplit(item.taskId)}
                            className="text-[9px] text-pink-600 hover:text-pink-700 font-black flex items-center gap-0.5 border border-pink-100 bg-pink-50/50 px-2 py-1 rounded cursor-pointer transition-all"
                          >
                            + Split Lokasi
                          </button>
                        </div>
                      </div>

                      {/* Locations lists under this SKU */}
                      <div className="space-y-3">
                        {item.allocations.map((alloc, aIdx) => {
                          const totalItemPicked = item.allocations.reduce((sum, a) => sum + a.qtyPicked, 0);
                          
                          return (
                            <div 
                              key={alloc.id}
                              className={`p-3 rounded-lg border transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-3 ${
                                alloc.confirmed 
                                  ? 'bg-emerald-50/20 border-emerald-200' 
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              {/* Location selection input */}
                              <div className="flex-1 min-w-[150px] space-y-1">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">LOKASI RAK GUDANG AMBIL:</label>
                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1">
                                  <MapPin className="h-4.5 w-4.5 text-pink-500 shrink-0" />
                                  <input
                                    type="text"
                                    value={alloc.location}
                                    onChange={(e) => handleSessionLocationChange(item.taskId, alloc.id, e.target.value)}
                                    className="w-full text-xs font-bold text-slate-700 outline-none bg-transparent"
                                    placeholder="Contoh: Rak E2-01-01"
                                  />
                                </div>
                              </div>

                              {/* Expired Date selection input & quick selections */}
                              <div className="flex-1 min-w-[200px] space-y-1">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">PILIH EXPIRED DATE BARANG:</label>
                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1">
                                  <Calendar className="h-4.5 w-4.5 text-pink-500 shrink-0" />
                                  <input
                                    type="text"
                                    value={alloc.expiredDate}
                                    onChange={(e) => handleSessionExpiredDateChange(item.taskId, alloc.id, e.target.value)}
                                    className="w-full text-xs font-bold text-slate-700 outline-none bg-transparent"
                                    placeholder="Contoh: DD/MM/YYYY"
                                  />
                                </div>
                                {/* Quick selects of available expired dates from inventory */}
                                {(() => {
                                  const skuInventory = inventory?.filter(inv => inv.skuId === item.skuId) || [];
                                  const availableDates = Array.from(new Set(skuInventory.map(inv => inv.expiredDate).filter(Boolean)));
                                  if (availableDates.length > 0) {
                                    return (
                                      <div className="flex items-center gap-1 flex-wrap mt-1">
                                        <span className="text-[8px] font-bold text-slate-400">STOK EXP:</span>
                                        {availableDates.map(date => (
                                          <button
                                            key={date}
                                            type="button"
                                            onClick={() => handleSessionExpiredDateChange(item.taskId, alloc.id, date)}
                                            className={`px-1 py-0.5 rounded text-[8px] font-black transition-all cursor-pointer ${
                                              alloc.expiredDate === date
                                                ? 'bg-pink-600 text-white border border-pink-600'
                                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}
                                          >
                                            {date}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              {/* Pick Quantity Modifier */}
                              <div className="shrink-0 space-y-1">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">KUANTITAS DIAMBIL (PCS):</label>
                                <div className="flex items-center bg-white border border-slate-200 rounded py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSessionQtyChange(item.taskId, alloc.id, alloc.qtyPicked - 1)}
                                    disabled={alloc.confirmed}
                                    className="px-2.5 py-0.5 text-slate-500 hover:bg-slate-100 font-black text-xs disabled:opacity-50"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={alloc.confirmed}
                                    value={alloc.qtyPicked}
                                    onChange={(e) => handleSessionQtyChange(item.taskId, alloc.id, parseInt(e.target.value, 10) || 0)}
                                    className="w-10 text-center text-xs font-bold font-mono text-slate-700 outline-none bg-transparent"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSessionQtyChange(item.taskId, alloc.id, alloc.qtyPicked + 1)}
                                    disabled={alloc.confirmed}
                                    className="px-2.5 py-0.5 text-slate-500 hover:bg-slate-100 font-black text-xs disabled:opacity-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Confirmation Checklist Action */}
                              <div className="shrink-0 flex items-end justify-between md:justify-end gap-2 border-t md:border-t-0 border-slate-100 pt-2.5 md:pt-0">
                                {item.allocations.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSessionRemoveSplit(item.taskId, alloc.id)}
                                    className="p-1.5 hover:bg-pink-50 border border-slate-200 text-slate-400 hover:text-pink-600 rounded transition-all cursor-pointer"
                                    title="Hapus split"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleToggleConfirmSKU(item.taskId, alloc.id)}
                                  className={`px-3 py-1.5 font-bold text-[10px] uppercase rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                    alloc.confirmed
                                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-3xs'
                                      : 'bg-white border-slate-250 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <CheckCircle2 className={`h-3.5 w-3.5 ${alloc.confirmed ? 'text-white' : 'text-slate-400'}`} />
                                  KONFIRMASI OK
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {pickStates.filter(item => {
                if (!hideCompleted) return true;
                return !item.allocations.every(a => a.confirmed);
              }).length === 0 && (
                <div className="py-24 text-center bg-white border border-slate-200 rounded-xl">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-extrabold text-slate-800">Semua Item Selesai Dikonfirmasi</p>
                  <p className="text-[10px] mt-1 text-slate-400">Tekan tombol hijau di sebelah kanan untuk menyelesaikan dokumen picking ini.</p>
                </div>
              )}
            </div>

            {/* Right Sticky Summary (Grid Span 4) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 p-4 rounded-xl shadow-3xs h-fit sticky top-4 flex flex-col justify-between min-h-[400px]">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-3">
                  RINGKASAN TARGET VS HASIL PICK
                </h3>
                <p className="text-[10px] text-slate-400 leading-normal mb-4 font-medium">
                  Semua SKU harus diambil sesuai dengan jumlah total target order sebelum mengonfirmasi.
                </p>

                {/* SKU Progress list items */}
                <div className="space-y-3">
                  {pickStates.map(state => {
                    const totalPicked = state.allocations.reduce((sum, a) => sum + a.qtyPicked, 0);
                    const isEnough = totalPicked === state.targetQty;
                    const isAllAllocationsConfirmed = state.allocations.every(a => a.confirmed);

                    return (
                      <div key={state.taskId} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100/60">
                        <div className="space-y-0.5">
                          <span className="font-mono font-black text-[10px] text-slate-800 block">{state.skuId}</span>
                          <span className="text-[9px] text-slate-400 truncate block max-w-[150px] font-medium">{state.skuName}</span>
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-700">
                            {totalPicked} / {state.targetQty} Pcs
                          </span>
                          {isEnough && isAllAllocationsConfirmed ? (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded">
                              CUKUP
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-pink-50 text-pink-500 border border-pink-100 px-1.5 py-0.5 rounded">
                              PROSES
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selesaikan button and summary stats */}
              <div className="border-t border-slate-100 pt-4 space-y-4 mt-6">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">PROGRESS KONFIRMASI SKU OK:</span>
                  <span className="font-mono font-black text-slate-800">
                    {pickStates.filter(ps => ps.allocations.every(a => a.confirmed) && ps.allocations.reduce((sum, a) => sum + a.qtyPicked, 0) === ps.targetQty).length} / {pickStates.length} SKU
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCompletePickingSession}
                  disabled={!pickStates.every(item => 
                    item.allocations.every(a => a.confirmed) && 
                    item.allocations.reduce((sum, a) => sum + a.qtyPicked, 0) === item.targetQty
                  )}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white font-extrabold text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  SELESAIKAN PICKING & KIRIM KE PACKER
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {showScanner && (
        <CameraScanner 
          onScan={(code) => {
            handleBarcodeScan(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
          title={`Pindai Item PO: ${activePickingOrderId}`}
        />
      )}
    </div>
  );
}
