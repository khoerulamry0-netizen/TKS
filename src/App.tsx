import React, { useState, useEffect, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster, toast } from 'sonner';
import { 
  Menu, 
  Warehouse, 
  Bell, 
  Search,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Box,
  UserCircle
} from 'lucide-react';

// Types
import { 
  MenuType, 
  User, 
  InventoryItem, 
  OrderRecord, 
  InboundRecord, 
  ReturnRecord, 
  TransactionTask, 
  TransferRecord 
} from './types';

// Initial Mock Datasets & LocalStorage helpers
import { 
  initialUsers, 
  initialInventory, 
  initialOrders, 
  initialInbound, 
  initialReturns, 
  initialTasks, 
  getLocalStorageData, 
  setLocalStorageData 
} from './data/initialData';

// View Components
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import InboundView from './components/InboundView';
import ReturnView from './components/ReturnView';
import OrderInputView from './components/OrderInputView';
import PickingView from './components/PickingView';
import PackingView from './components/PackingView';
import OrderHistoryView from './components/OrderHistoryView';
import TransferStockView from './components/TransferStockView';
import AccountView from './components/AccountView';
import LoginView from './components/LoginView';
import WorkspaceView from './components/WorkspaceView';

export default function App() {
  // Mobile sidebar open/close state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Active Menu Router
  const [currentMenu, setCurrentMenu] = useState<MenuType>('DASHBOARD');

  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => 
    getLocalStorageData<boolean>('wms_is_logged_in', false)
  );

  const [authToken, setAuthToken] = useState<string>(() => 
    getLocalStorageData<string>('wms_auth_token', '')
  );

  // Core Reactive Databases
  const [users, setUsers] = useState<User[]>(() => 
    getLocalStorageData<User[]>('wms_users', initialUsers)
  );

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cachedUser = getLocalStorageData<User | null>('wms_current_user', initialUsers[0]);
    const existingUsers = getLocalStorageData<User[]>('wms_users', initialUsers);
    if (!cachedUser) return null;
    const found = existingUsers.find(u => u.id === cachedUser.id || u.username === cachedUser.username);
    return found || existingUsers[0] || initialUsers[0];
  });
  
  const [inventory, setInventory] = useState<InventoryItem[]>(() => 
    getLocalStorageData<InventoryItem[]>('wms_inventory', initialInventory)
  );

  const [orders, setOrders] = useState<OrderRecord[]>(() => 
    getLocalStorageData<OrderRecord[]>('wms_orders', initialOrders)
  );

  const [inbounds, setInbounds] = useState<InboundRecord[]>(() => 
    getLocalStorageData<InboundRecord[]>('wms_inbounds', initialInbound)
  );

  const [returns, setReturns] = useState<ReturnRecord[]>(() => 
    getLocalStorageData<ReturnRecord[]>('wms_returns', initialReturns)
  );

  const [tasks, setTasks] = useState<TransactionTask[]>(() => 
    getLocalStorageData<TransactionTask[]>('wms_tasks', initialTasks)
  );

  // Real-time Database Sync (Multi-Device & Redeployment Survival)
  const [lastUpdated, setLastUpdated] = useState<number>(() => 
    getLocalStorageData<number>('wms_last_updated', 1)
  );

  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('synced');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

  const isApplyingServerUpdate = useRef<boolean>(false);
  const hasFetchedFromServer = useRef<boolean>(false);
  const lastFetchedDbString = useRef<string>('');

  const fetchDb = async () => {
    if (!isLoggedIn || !authToken) return;
    setSyncStatus('syncing');
    try {
      const res = await fetch(`/api/db?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setIsLoggedIn(false);
          setAuthToken('');
        }
        setSyncStatus('error');
        return;
      }
      const db = await res.json();
      const serverLastUpdated = db.lastUpdated || 1;
      const localLastUpdated = getLocalStorageData<number>('wms_last_updated', 1);

      hasFetchedFromServer.current = true;

      if (serverLastUpdated > localLastUpdated) {
        // Server has newer data. Pull it.
        const dbString = JSON.stringify(db);
        lastFetchedDbString.current = dbString;
        isApplyingServerUpdate.current = true;

        if (db.users) setUsers(db.users);
        if (db.inventory) setInventory(db.inventory);
        if (db.orders) setOrders(db.orders);
        if (db.inbounds) setInbounds(db.inbounds);
        if (db.returns) setReturns(db.returns);
        if (db.tasks) setTasks(db.tasks);
        setLastUpdated(serverLastUpdated);

        setTimeout(() => {
          isApplyingServerUpdate.current = false;
        }, 100);
      } else if (localLastUpdated > serverLastUpdated) {
        // Local has newer data (e.g. server was reset/rebuilt). Push it to restore the server.
        const currentDb = {
          users: getLocalStorageData<User[]>('wms_users', initialUsers),
          inventory: getLocalStorageData<InventoryItem[]>('wms_inventory', initialInventory),
          orders: getLocalStorageData<OrderRecord[]>('wms_orders', initialOrders),
          inbounds: getLocalStorageData<InboundRecord[]>('wms_inbounds', initialInbound),
          returns: getLocalStorageData<ReturnRecord[]>('wms_returns', initialReturns),
          tasks: getLocalStorageData<TransactionTask[]>('wms_tasks', initialTasks),
          lastUpdated: localLastUpdated
        };
        fetch('/api/db', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(currentDb)
        }).catch(err => console.error('Error restoring server data:', err));
      } else {
        // Equal, but check if contents changed (e.g. initial load or minor sync)
        const dbString = JSON.stringify(db);
        if (dbString !== lastFetchedDbString.current) {
          lastFetchedDbString.current = dbString;
          isApplyingServerUpdate.current = true;
          if (db.users) setUsers(db.users);
          if (db.inventory) setInventory(db.inventory);
          if (db.orders) setOrders(db.orders);
          if (db.inbounds) setInbounds(db.inbounds);
          if (db.returns) setReturns(db.returns);
          if (db.tasks) setTasks(db.tasks);
          setTimeout(() => {
            isApplyingServerUpdate.current = false;
          }, 100);
        }
      }
      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (error) {
      console.warn('Sync status: server transiently offline or restarting. Retrying soon...', error);
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchDb();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchDb();
    
    // Poll every 5 seconds for cross-device sync
    const interval = setInterval(fetchDb, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, authToken]);

  // Update lastUpdated and push to server whenever any state is modified locally
  useEffect(() => {
    if (!hasFetchedFromServer.current) return;
    if (isApplyingServerUpdate.current) return;

    const nextTimestamp = Date.now();
    setLastUpdated(nextTimestamp);
    setLocalStorageData('wms_last_updated', nextTimestamp);

    const currentDb = {
      users,
      inventory,
      orders,
      inbounds,
      returns,
      tasks,
      lastUpdated: nextTimestamp
    };

    fetch('/api/db', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(currentDb)
    }).catch(err => {
      console.warn('Sync status: failed to push updates to server. Will retry on next auto-sync.', err);
    });
  }, [users, inventory, orders, inbounds, returns, tasks]);

  // Persistence Synchronizers
  useEffect(() => {
    setLocalStorageData('wms_last_updated', lastUpdated);
  }, [lastUpdated]);

  useEffect(() => {
    setLocalStorageData('wms_users', users);
  }, [users]);

  useEffect(() => {
    setLocalStorageData('wms_current_user', currentUser);
  }, [currentUser]);

  useEffect(() => {
    setLocalStorageData('wms_inventory', inventory);
  }, [inventory]);

  useEffect(() => {
    setLocalStorageData('wms_orders', orders);
  }, [orders]);

  useEffect(() => {
    setLocalStorageData('wms_inbounds', inbounds);
  }, [inbounds]);

  useEffect(() => {
    setLocalStorageData('wms_returns', returns);
  }, [returns]);

  useEffect(() => {
    setLocalStorageData('wms_tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    setLocalStorageData('wms_is_logged_in', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    setLocalStorageData('wms_auth_token', authToken);
  }, [authToken]);

  // Redirect to Dashboard if user does not have permission for the selected menu
  useEffect(() => {
    const menuPermissions: Record<MenuType, string[]> = {
      'DASHBOARD': ['ADMIN', 'PICKER', 'PACKER', 'STAFF_WAREHOUSE'],
      'STOK_BARANG': ['ADMIN', 'PICKER', 'PACKER', 'STAFF_WAREHOUSE'],
      'INBOUND': ['ADMIN', 'STAFF_WAREHOUSE'],
      'RETURN': ['ADMIN', 'STAFF_WAREHOUSE'],
      'INPUT_ORDER': ['ADMIN'],
      'PROSES_PICKING': ['ADMIN', 'PICKER'],
      'PROSES_PACKING': ['ADMIN', 'PACKER'],
      'HISTORY_ORDER': ['ADMIN'],
      'TRANSFER_STOK': ['ADMIN'],
      'GOOGLE_WORKSPACE': ['ADMIN', 'STAFF_WAREHOUSE', 'PICKER', 'PACKER'],
      'AKUN': ['ADMIN'],
    };

    if (isLoggedIn && currentUser) {
      const allowedRoles = menuPermissions[currentMenu] || [];
      const hasRole = allowedRoles.includes(currentUser.role);
      
      if (!hasRole) {
        setCurrentMenu('DASHBOARD');
      }
    }
  }, [currentMenu, currentUser, isLoggedIn]);

  // Operational State Callback Handlers
  
  // 1. Replenish Low Stock Item
  const handleReplenish = (skuId: string, amount: number) => {
    setInventory(prev => prev.map(item => 
      item.skuId === skuId ? { ...item, qty: item.qty + amount } : item
    ));
    
    // Log the adjustment task
    const logTask: TransactionTask = {
      id: `TSK-REPL-${Date.now().toString().slice(-4)}`,
      type: 'INBOUND',
      skuId: skuId,
      skuName: inventory.find(i => i.skuId === skuId)?.skuName || 'Replenishment',
      barcode: inventory.find(i => i.skuId === skuId)?.barcode || '',
      qty: amount,
      qtyHandled: amount,
      location: inventory.find(i => i.skuId === skuId)?.location || 'AC-01-01-01',
      warehouse: inventory.find(i => i.skuId === skuId)?.warehouse || 'Gudang Utama',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Melakukan Restok Cepat (Replenishment) sejumlah +${amount} pcs`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  // 2. Add New Catalog SKU (Inventory Item)
  const handleAddItem = (item: InventoryItem) => {
    setInventory(prev => [...prev, item]);
  };

  // 2b. Import catalog SKU items in bulk with smart merge
  const handleImportItems = (items: InventoryItem[]) => {
    setInventory(prev => {
      const cloned = [...prev];
      items.forEach(newItem => {
        const existingIdx = cloned.findIndex(item => 
          item.skuId.toUpperCase() === newItem.skuId.toUpperCase() && 
          item.location.toUpperCase() === newItem.location.toUpperCase()
        );
        if (existingIdx !== -1) {
          cloned[existingIdx] = {
            ...cloned[existingIdx],
            qty: cloned[existingIdx].qty + newItem.qty,
            brand: cloned[existingIdx].brand || newItem.brand,
            skuName: cloned[existingIdx].skuName || newItem.skuName,
            expiredDate: newItem.expiredDate !== '31/12/2028' ? newItem.expiredDate : cloned[existingIdx].expiredDate
          };
        } else {
          cloned.push(newItem);
        }
      });
      return cloned;
    });
  };

  // 3. Edit SKU details / Qty adjustments
  const handleUpdateItem = (updated: InventoryItem) => {
    setInventory(prev => prev.map(item => item.id === updated.id ? updated : item));
  };

  // 4. Delete SKU from Catalog
  const handleDeleteItem = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus SKU ini dari katalog sistem?')) {
      setInventory(prev => prev.filter(item => item.id !== id));
    }
  };

  // 4b. Clear all items from Inventory
  const handleClearInventory = () => {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data katalog dan stok barang? Semua data stok akan dikosongkan. Tindakan ini tidak dapat dibatalkan.')) {
      setInventory([]);
    }
  };

  // 5. Save physical Stock Opname audits
  const handleSaveOpname = (session: any) => {
    // Audit actions are recorded by editing the item directly. Let's record the opname details in tasks queue for general logging.
    const opDetail = session.details[0];
    const logTask: TransactionTask = {
      id: session.id,
      type: 'RETURN', // Audits logged under returns/adj category
      skuId: opDetail.skuId,
      skuName: opDetail.skuName,
      barcode: opDetail.barcode,
      qty: Math.abs(opDetail.discrepancy),
      qtyHandled: Math.abs(opDetail.discrepancy),
      location: inventory.find(i => i.skuId === opDetail.skuId)?.location || 'UT-01',
      warehouse: session.warehouse,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Audit Fisik (Stock Opname) selesai. Hasil aktual: ${opDetail.actualQty} pcs (Selisih: ${opDetail.discrepancy} pcs).`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  // 6. Inbound receiving additions
  const handleAddInbound = (record: InboundRecord) => {
    setInbounds(prev => [record, ...prev]);
  };

  const handleUpdateInbound = (record: InboundRecord) => {
    setInbounds(prev => prev.map(r => r.id === record.id ? record : r));
    
    // Log step progress inside general tasks too!
    const logTask: TransactionTask = {
      id: `TSK-${record.id.slice(-6)}`,
      type: 'INBOUND',
      skuId: record.items[0]?.skuId || 'MULTI',
      skuName: record.items[0]?.skuName || 'Inbound Shipment',
      barcode: record.items[0]?.barcode || '',
      qty: record.items.reduce((s, i) => s + i.qty, 0),
      qtyHandled: record.status === 'COMPLETED' ? record.items.reduce((s, i) => s + i.qty, 0) : 0,
      location: record.items[0]?.location || 'UT-01',
      warehouse: inventory.find(i => i.skuId === record.items[0]?.skuId)?.warehouse || 'Gudang Utama',
      status: record.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Mengupdate status Inbound menjadi: ${record.status}`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  const handleDeleteInbound = (id: string) => {
    setInbounds(prev => prev.filter(r => r.id !== id));
  };

  // Add stock to inventory upon final putaway completion
  const handlePutawayComplete = (items: { skuId: string; qty: number }[]) => {
    setInventory(prev => prev.map(invItem => {
      const match = items.find(it => it.skuId === invItem.skuId);
      if (match) {
        return {
          ...invItem,
          qty: invItem.qty + match.qty
        };
      }
      return invItem;
    }));
  };

  // 7. Customer Returns registrations
  const handleAddReturn = (record: ReturnRecord) => {
    setReturns(prev => [record, ...prev]);
  };

  const handleUpdateReturn = (record: ReturnRecord) => {
    setReturns(prev => prev.map(r => r.id === record.id ? record : r));
    
    // Log returning activity
    const logTask: TransactionTask = {
      id: `TSK-${record.id.slice(-6)}`,
      type: 'RETURN',
      skuId: record.items[0]?.skuId || 'MULTI',
      skuName: record.items[0]?.skuName || 'Klaim Retur',
      barcode: record.items[0]?.barcode || '',
      qty: record.items.reduce((s, i) => s + i.qty, 0),
      qtyHandled: record.status === 'COMPLETED' ? record.items.reduce((s, i) => s + i.qty, 0) : 0,
      location: record.items[0]?.location || 'UT-01',
      warehouse: inventory.find(i => i.skuId === record.items[0]?.skuId)?.warehouse || 'Gudang Utama',
      status: record.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Memproses status klaim retur pelanggan menjadi: ${record.status}`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  const handleDeleteReturn = (id: string) => {
    setReturns(prev => prev.filter(r => r.id !== id));
  };

  // Restore Good items back to active stock
  const handleRestoreGoodStock = (skuId: string, qty: number) => {
    setInventory(prev => prev.map(invItem => 
      invItem.skuId === skuId ? { ...invItem, qty: invItem.qty + qty } : invItem
    ));
  };

  // 8. Create Outbound Sales Order
  const handleCreateOrder = (order: OrderRecord, pickingTasks: TransactionTask[]) => {
    setOrders(prev => [order, ...prev]);
    setTasks(prev => [...pickingTasks, ...prev]);

    // Subtract reserved quantities from active catalog IMMEDIATELY!
    setInventory(prev => prev.map(invItem => {
      // Match by both skuId and location to support split allocations (FIFO)
      const matches = order.items.filter(it => it.skuId === invItem.skuId && it.location === invItem.location);
      if (matches.length > 0) {
        const totalDeduction = matches.reduce((sum, m) => sum + m.qty, 0);
        return {
          ...invItem,
          qty: Math.max(0, invItem.qty - totalDeduction) // deduct
        };
      }
      return invItem;
    }));
  };

  // 9. Update Outbound Picking Task Progress (Picker terminal updates)
  const handleUpdateTask = (updatedTask: TransactionTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  // 10. Update Outbound Order status upon Packing completion
  const handleUpdateOrder = (updatedOrder: OrderRecord) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  // 10b. Delete Outbound Order (Cancel) and return stock to active inventory
  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    // 1. Remove the order from list
    setOrders(prev => prev.filter(o => o.id !== orderId));

    // 2. Remove associated tasks
    if (orderToDelete.orderNumber) {
      setTasks(prev => prev.filter(t => t.orderNumber !== orderToDelete.orderNumber));
    }

    // 3. Return the stock back to the original SKU & Location in inventory
    setInventory(prev => prev.map(invItem => {
      const match = orderToDelete.items.find(it => it.skuId === invItem.skuId && it.location === invItem.location);
      if (match) {
        return {
          ...invItem,
          qty: invItem.qty + match.qty
        };
      }
      return invItem;
    }));

    // 4. Log the cancelation as an audit task
    const logTask: TransactionTask = {
      id: `TSK-DEL-${orderToDelete.orderNumber.slice(-6)}`,
      type: 'OUTBOUND',
      skuId: orderToDelete.items[0]?.skuId || 'MULTI',
      skuName: `Batal Order: ${orderToDelete.orderNumber}`,
      barcode: '',
      qty: orderToDelete.items.reduce((sum, item) => sum + item.qty, 0),
      qtyHandled: 0,
      location: 'N/A',
      warehouse: 'Gudang Utama',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Membatalkan Order ${orderToDelete.orderNumber}. Stok ${orderToDelete.items.reduce((sum, item) => sum + item.qty, 0)} pcs dikembalikan ke lokasi.`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  // 11. Location Mutasi / Bin Transfers
  const handleTransferStock = (transfer: TransferRecord, updatedInventory: InventoryItem[]) => {
    setInventory(updatedInventory);
    
    // Log the transfer
    const logTask: TransactionTask = {
      id: transfer.id,
      type: 'OUTBOUND', // logged under active movements
      skuId: transfer.items[0].skuId,
      skuName: transfer.items[0].skuName,
      barcode: transfer.items[0].barcode,
      qty: transfer.items[0].qty,
      qtyHandled: transfer.items[0].qty,
      location: transfer.items[0].fromLocation,
      warehouse: inventory.find(i => i.skuId === transfer.items[0].skuId)?.warehouse || 'Gudang Utama',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      operatorLogs: [{
        role: currentUser.role,
        operatorName: currentUser.name,
        action: `Memindahkan ${transfer.items[0].qty} pcs ke lokasi baru: ${transfer.items[0].toLocation}`,
        timestamp: new Date().toISOString()
      }]
    };
    setTasks(prev => [logTask, ...prev]);
  };

  // 12. Full Database Restore from Google Drive Backup file
  const handleRestoreFullDatabase = (dbData: {
    inventory?: InventoryItem[];
    orders?: OrderRecord[];
    inbounds?: InboundRecord[];
    returns?: ReturnRecord[];
    tasks?: TransactionTask[];
  }) => {
    if (dbData.inventory) setInventory(dbData.inventory);
    if (dbData.orders) setOrders(dbData.orders);
    if (dbData.inbounds) setInbounds(dbData.inbounds);
    if (dbData.returns) setReturns(dbData.returns);
    if (dbData.tasks) setTasks(dbData.tasks);
  };

  // Render the current active view component based on router
  const renderActiveView = () => {
    switch (currentMenu) {
      case 'DASHBOARD':
        return (
          <DashboardView 
            inventory={inventory}
            orders={orders}
            inbounds={inbounds}
            returns={returns}
            tasks={tasks}
            onReplenish={handleReplenish}
            setCurrentMenu={setCurrentMenu}
          />
        );
      case 'STOK_BARANG':
        return (
          <InventoryView 
            inventory={inventory}
            currentUser={currentUser}
            onAddItem={handleAddItem}
            onImportItems={handleImportItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onClearInventory={handleClearInventory}
            onSaveOpname={handleSaveOpname}
            tasks={tasks}
            allUsers={users}
            onAddTask={(task) => setTasks(prev => [task, ...prev])}
            onUpdateTask={handleUpdateTask}
            onUpdateInventory={setInventory}
          />
        );
      case 'INBOUND':
        return (
          <InboundView 
            inbounds={inbounds}
            inventory={inventory}
            currentUser={currentUser}
            onAddInbound={handleAddInbound}
            onUpdateInbound={handleUpdateInbound}
            onPutawayComplete={handlePutawayComplete}
            onDeleteInbound={handleDeleteInbound}
          />
        );
      case 'RETURN':
        return (
          <ReturnView 
            returns={returns}
            inventory={inventory}
            currentUser={currentUser}
            onAddReturn={handleAddReturn}
            onUpdateReturn={handleUpdateReturn}
            onRestoreGoodStock={handleRestoreGoodStock}
            onDeleteReturn={handleDeleteReturn}
          />
        );
      case 'INPUT_ORDER':
        return (
          <OrderInputView 
            inventory={inventory}
            currentUser={currentUser}
            onCreateOrder={handleCreateOrder}
          />
        );
      case 'PROSES_PICKING':
        return (
          <PickingView 
            tasks={tasks}
            currentUser={currentUser}
            onUpdateTask={handleUpdateTask}
            inventory={inventory}
          />
        );
      case 'PROSES_PACKING':
        return (
          <PackingView 
            tasks={tasks}
            orders={orders}
            inventory={inventory}
            currentUser={currentUser}
            onUpdateTask={handleUpdateTask}
            onUpdateOrder={handleUpdateOrder}
          />
        );
      case 'HISTORY_ORDER':
        return (
          <OrderHistoryView 
            orders={orders}
            inventory={inventory}
            currentUser={currentUser}
            onDeleteOrder={handleDeleteOrder}
          />
        );
      case 'TRANSFER_STOK':
        return (
          <TransferStockView 
            inventory={inventory}
            currentUser={currentUser}
            onTransferStock={handleTransferStock}
          />
        );
      case 'AKUN':
        return (
          <AccountView 
            currentUser={currentUser}
            allUsers={users}
            onSwitchUser={setCurrentUser}
            onUpdateUsers={setUsers}
          />
        );
      case 'GOOGLE_WORKSPACE':
        return (
          <WorkspaceView 
            inventory={inventory}
            orders={orders}
            inbounds={inbounds}
            returns={returns}
            tasks={tasks}
            onImportItems={handleImportItems}
            onRestoreFullDatabase={handleRestoreFullDatabase}
          />
        );
      default:
        return <div className="p-6 text-center text-slate-500 font-bold">Menu tidak ditemukan.</div>;
    }
  };

  if (!isLoggedIn || !currentUser) {
    return (
      <LoginView 
        allUsers={users}
        onLogin={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-600">
      <Toaster position="top-right" richColors />
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentMenu={currentMenu}
        setCurrentMenu={setCurrentMenu}
        currentUser={currentUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={() => {
          setIsLoggedIn(false);
          setAuthToken('');
          setCurrentUser(null);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 animate-none"
            >
              <Menu className="h-6.5 w-6.5" />
            </button>
            
            {/* Active view breadcrumbs */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="hover:text-slate-600 cursor-pointer" onClick={() => setCurrentMenu('DASHBOARD')}>WAREHOUSE TKS</span>
              <span>/</span>
              <span className="text-slate-800 font-bold capitalize">{currentMenu.toLowerCase().replace('_', ' ')}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Connection & Sync Widget */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/65 rounded-full px-2.5 py-1 text-[11px] font-bold">
              {/* Online/Offline indicator */}
              {!isOnline ? (
                <span className="flex items-center gap-1 text-amber-600 font-extrabold animate-pulse">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <Wifi className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Online</span>
                </span>
              )}

              <span className="w-[1px] h-3 bg-slate-200 shrink-0" />

              {/* Sync status button */}
              <button
                onClick={() => isOnline && fetchDb()}
                disabled={syncStatus === 'syncing' || !isOnline}
                className={`flex items-center gap-1 transition-all select-none font-mono font-bold shrink-0 ${
                  syncStatus === 'syncing' 
                    ? 'text-pink-600 cursor-wait' 
                    : syncStatus === 'error'
                    ? 'text-rose-600'
                    : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                }`}
                title="Refresh sinkronisasi data"
              >
                <RefreshCw className={`h-3 w-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  {syncStatus === 'syncing' 
                    ? 'Sync...' 
                    : lastSyncTime 
                    ? `${lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Unsynced'
                  }
                </span>
              </button>
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.name}</p>
              <span className="text-[10px] text-slate-400 font-mono">Peran: {currentUser.role}</span>
            </div>

            {/* Quick action profile link */}
            <button 
              onClick={() => setCurrentMenu('AKUN')}
              className="p-1 rounded-full border border-slate-200 hover:border-slate-300 ring-2 ring-slate-100 shrink-0 overflow-hidden"
              title="Ganti Peran Operator"
            >
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          </div>
        </header>

        {/* Inner Content Scroller */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 max-w-7xl w-full mx-auto pb-24 lg:pb-6">
          <ErrorBoundary fallbackRender={({ error }) => (
            <div className="p-4 m-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-200">
              <div>
                <h3 className="font-semibold">Terjadi Kesalahan</h3>
                <p className="text-sm mt-1">{error.message}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
                >
                  Muat Ulang
                </button>
              </div>
            </div>
          )}>
            {renderActiveView()}
          </ErrorBoundary>
        </main>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <nav className="lg:hidden shrink-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe shadow-lg z-40">
          <button
            onClick={() => setCurrentMenu('DASHBOARD')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
              currentMenu === 'DASHBOARD' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentMenu('STOK_BARANG')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
              currentMenu === 'STOK_BARANG' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Package className="h-5 w-5" />
            <span>Stok</span>
          </button>

          {/* Show Picking to picker/admin, otherwise show Inbound */}
          {(currentUser.role === 'ADMIN' || currentUser.role === 'PICKER') ? (
            <button
              onClick={() => setCurrentMenu('PROSES_PICKING')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
                currentMenu === 'PROSES_PICKING' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardCheck className="h-5 w-5" />
              <span>Picking</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentMenu('INBOUND')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
                currentMenu === 'INBOUND' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Warehouse className="h-5 w-5" />
              <span>Inbound</span>
            </button>
          )}

          {/* Show Packing to packer/admin, otherwise show Return */}
          {(currentUser.role === 'ADMIN' || currentUser.role === 'PACKER') ? (
            <button
              onClick={() => setCurrentMenu('PROSES_PACKING')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
                currentMenu === 'PROSES_PACKING' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Box className="h-5 w-5" />
              <span>Packing</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentMenu('RETURN')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
                currentMenu === 'RETURN' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Box className="h-5 w-5" />
              <span>Return</span>
            </button>
          )}

          <button
            onClick={() => setCurrentMenu('AKUN')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] font-extrabold transition-all cursor-pointer ${
              currentMenu === 'AKUN' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserCircle className="h-5 w-5" />
            <span>Akun</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
