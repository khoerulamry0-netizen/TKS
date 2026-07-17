import React, { useState } from 'react';
import { 
  UserCircle, 
  Shield, 
  Briefcase, 
  Mail, 
  Phone, 
  LogIn, 
  CheckCircle2, 
  Award,
  Key,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  Lock,
  X,
  Save,
  AlertTriangle
} from 'lucide-react';
import { User, UserRole } from '../types';

interface AccountViewProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (user: User) => void;
  onUpdateUsers?: (users: User[]) => void;
}

const AVATAR_PRESETS = [
  { name: 'Kucing Oranye', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80' },
  { name: 'Anjing Shiba', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80' },
  { name: 'Kelinci Putih', url: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=150&auto=format&fit=crop&q=80' },
  { name: 'Panda Lucu', url: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=150&auto=format&fit=crop&q=80' },
  { name: 'Rubah Cantik', url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=150&auto=format&fit=crop&q=80' },
  { name: 'Kucing Kupu', url: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=150&auto=format&fit=crop&q=80' }
];

export default function AccountView({
  currentUser,
  allUsers,
  onSwitchUser,
  onUpdateUsers,
}: AccountViewProps) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    role: 'STAFF_WAREHOUSE' as UserRole,
    password: '',
    avatar: AVATAR_PRESETS[0].url
  });
  const [formError, setFormError] = useState('');

  const isAdmin = currentUser.role === 'ADMIN';
  const isMasterAdmin = currentUser.role === 'ADMIN' && currentUser.username === 'admin';

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return <Shield className="h-4 w-4 text-pink-500" />;
      case 'STAFF_WAREHOUSE': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'PICKER': return <Briefcase className="h-4 w-4 text-amber-500" />;
      case 'PACKER': return <Award className="h-4 w-4 text-sky-500" />;
    }
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'STAFF_WAREHOUSE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PICKER': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PACKER': return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  const getRoleDescription = (role: UserRole, username?: string) => {
    switch (role) {
      case 'ADMIN': 
        if (username === 'admin') {
          return 'Admin Utama. Hak istimewa tertinggi penuh. Berwenang mutlak untuk mendaftarkan akun baru, mengedit peran, menghapus akun operator, serta mengelola rencana Inbound, Outbound, Return, Stock Opname, dan Transfer.';
        } else {
          return 'Admin Gudang. Hak istimewa administratif operasional. Berwenang mengelola rencana Inbound, mendaftarkan order Outbound, menyetujui Return, mengelola Stock Opname, dan Transfer Stok, tetapi tidak memiliki izin membuat atau menghapus akun.';
        }
      case 'STAFF_WAREHOUSE':
        return 'Spesialis logistik gudang. Bertanggung jawab penuh atas manajemen barang masuk (Inbound) dan klaim retur barang (Return), mencocokkan stok fisik, dan menyetujui dokumen gudang.';
      case 'PICKER': 
        return 'Fokus pada logistik lapangan. Bertugas mengambil barang di rak lokasi penyimpanan fisik sesuai instruksi scanner digital, mencocokkan barcode varian, dan memindahkan ke area packing.';
      case 'PACKER': 
        return 'Fokus pada kontrol kualitas akhir. Bertanggung jawab memeriksa kesesuaian fisik produk, memilih ukuran box karton kemasan kosmetik, membungkus dengan bubble wrap, dan mencetak label resi pengiriman.';
    }
  };

  const formatRoleLabel = (role: UserRole, username?: string) => {
    if (role === 'ADMIN') {
      return username === 'admin' ? 'ADMIN UTAMA' : 'ADMIN GUDANG';
    }
    return role.replace('_', ' ');
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const openAddModal = () => {
    if (!isMasterAdmin) return;
    setEditingUser(null);
    setFormData({
      username: '',
      name: '',
      email: '',
      phone: '',
      role: 'STAFF_WAREHOUSE',
      password: '',
      avatar: AVATAR_PRESETS[0].url
    });
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (user: User) => {
    const isEditingSelf = user.id === currentUser.id;
    if (!isMasterAdmin && !isEditingSelf) return;
    setEditingUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      password: user.password || '',
      avatar: user.avatar || AVATAR_PRESETS[0].url
    });
    setFormError('');
    setShowFormModal(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (!isMasterAdmin) return;
    if (userId === currentUser.id) {
      setAlertMessage('Anda tidak bisa menghapus akun Anda sendiri yang sedang aktif digunakan.');
      return;
    }

    const target = allUsers.find(u => u.id === userId);
    if (!target) return;

    setDeleteConfirmId(userId);
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    if (onUpdateUsers) {
      const updated = allUsers.filter(u => u.id !== deleteConfirmId);
      onUpdateUsers(updated);
    }
    setDeleteConfirmId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanUsername = (formData.username || '').trim().toLowerCase();
    const cleanName = (formData.name || '').trim();
    const cleanEmail = (formData.email || '').trim();
    const cleanPhone = (formData.phone || '').trim();
    const cleanPassword = formData.password;

    if (!cleanUsername || !cleanName || !cleanPassword) {
      setFormError('ID Akun (Username), Nama Lengkap, dan Password wajib diisi.');
      return;
    }

    // Check duplicate username (exclude currently editing user)
    const isDuplicate = allUsers.some(u => 
      u.username.toLowerCase() === cleanUsername && 
      (!editingUser || u.id !== editingUser.id)
    );

    if (isDuplicate) {
      setFormError(`Username @${cleanUsername} sudah digunakan oleh akun lain.`);
      return;
    }

    if (editingUser) {
      // Edit mode
      const updatedList = allUsers.map(u => {
        if (u.id === editingUser.id) {
          const updatedUser = {
            ...u,
            username: cleanUsername,
            name: cleanName,
            email: cleanEmail || `${cleanUsername}@beautywms.id`,
            phone: cleanPhone || '+62 811-0000-0000',
            role: formData.role,
            password: cleanPassword,
            avatar: formData.avatar
          };
          
          // If editing active user, update currentUser in App.tsx session as well
          if (u.id === currentUser.id) {
            setTimeout(() => onSwitchUser(updatedUser), 10);
          }
          return updatedUser;
        }
        return u;
      });

      if (onUpdateUsers) {
        onUpdateUsers(updatedList);
      }
    } else {
      // Add mode
      const newUser: User = {
        id: `USR-${Date.now().toString().slice(-3)}`,
        username: cleanUsername,
        name: cleanName,
        email: cleanEmail || `${cleanUsername}@beautywms.id`,
        phone: cleanPhone || '+62 811-0000-0000',
        role: formData.role,
        password: cleanPassword,
        avatar: formData.avatar,
        lastLogin: '-'
      };

      if (onUpdateUsers) {
        onUpdateUsers([...allUsers, newUser]);
      }
    }

    setShowFormModal(false);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Key className="h-5 w-5 text-pink-500 animate-pulse" />
            Kelola Akun & Hak Akses
          </h2>
          <p className="text-[11px] text-slate-500">
            Daftar operator gudang, kata sandi, dan role operasional sistem WAREHOUSE TKS.
          </p>
        </div>
        
        {isMasterAdmin ? (
          <button
            onClick={openAddModal}
            className="px-3.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Akun Baru
          </button>
        ) : (
          <div className="text-[10px] font-bold bg-amber-50 text-amber-600 px-3 py-1.5 rounded border border-amber-200/50 flex items-center gap-1.5 max-w-sm">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Mode Terbatas: Hanya Admin Utama yang mempunyai hak akses pengelolaan akun.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column: Active User Profile Card */}
        <div className="lg:col-span-1 bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-4 text-center h-fit">
          <div className="space-y-2">
            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Sesi Saat Ini</span>
            <div className="relative inline-block mt-2">
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-20 h-20 rounded-full object-cover mx-auto ring-4 ring-pink-500/10"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-1 p-1 bg-slate-900 text-white rounded-full border border-white shadow-sm">
                {getRoleIcon(currentUser.role)}
              </span>
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-slate-800">{currentUser.name}</h3>
              <p className="text-[10px] text-slate-400 font-mono">@{currentUser.username}</p>
            </div>
          </div>

          <div className="border-t border-b border-slate-100 py-3 text-xs text-left space-y-2 text-slate-600">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate text-[11px] font-mono">{currentUser.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-mono">{currentUser.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px]">Login: <strong className="font-mono text-slate-700">{currentUser.lastLogin || '-'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px]">Sandi: <strong className="font-mono text-pink-600">{currentUser.password || '●●●●●●'}</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded text-left border border-slate-200/50">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Panduan Hak Akses ({formatRoleLabel(currentUser.role, currentUser.username)})</span>
            <p className="text-[10px] text-slate-600 leading-relaxed font-medium">{getRoleDescription(currentUser.role, currentUser.username)}</p>
          </div>
        </div>

        {/* Right Column: Account Management Table / Grid */}
        <div className="lg:col-span-3 bg-white rounded border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Daftar Akun Operator</h3>
                <p className="text-[11px] text-slate-500">Daftar Akun ID, Hak Akses, Kata Sandi, dan Simulasi Sesi.</p>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border">
                {allUsers.length} Akun Terdaftar
              </span>
            </div>

            {/* Account List Layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-250/50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="p-3">Nama Operator</th>
                    <th className="p-3">Akun ID (Username)</th>
                    <th className="p-3">Peran / Role</th>
                    <th className="p-3">Password / Sandi</th>
                    <th className="p-3 text-right">Aksi & Simulasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {allUsers.map((user) => {
                    const isActive = user.id === currentUser.id;
                    const isPwdRevealed = !!revealedPasswords[user.id];
                    
                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isActive ? 'bg-pink-50/10' : ''
                        }`}
                      >
                        {/* Operator (Avatar & Name & Contact) */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img 
                              src={user.avatar} 
                              alt={user.name} 
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-bold text-slate-800">{user.name}</p>
                              <p className="text-[9px] text-slate-400 leading-tight">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Akun ID */}
                        <td className="p-3">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200/50 font-semibold">
                            @{user.username}
                          </span>
                        </td>

                        {/* Peran / Role Badge */}
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getRoleBadgeClass(user.role)}`}>
                            {getRoleIcon(user.role)}
                            {formatRoleLabel(user.role, user.username)}
                          </span>
                        </td>

                        {/* Password / Sandi */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded border border-slate-200/50 tracking-wide font-bold min-w-[70px] inline-block">
                              {isPwdRevealed ? (user.password || 'password123') : '••••••••'}
                            </span>
                            <button
                              title={isPwdRevealed ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            >
                              {isPwdRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Simulator login trigger */}
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-bold">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                Sesi Aktif
                              </span>
                            ) : (
                              <button
                                onClick={() => onSwitchUser(user)}
                                title="Simulasi masuk menggunakan akun ini"
                                className="px-2 py-1 bg-slate-100 hover:bg-pink-500 text-slate-600 hover:text-white border border-slate-200 hover:border-pink-500 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <LogIn className="h-3 w-3" />
                                Masuk
                              </button>
                            )}

                            {/* Edit & Delete */}
                            {(isMasterAdmin || isActive) && (
                              <div className="flex items-center gap-1 ml-1 border-l border-slate-100 pl-1.5">
                                <button
                                  onClick={() => openEditModal(user)}
                                  title="Edit detail akun ini"
                                  className="p-1 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                {isMasterAdmin && (
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={isActive}
                                    title={isActive ? 'Tidak dapat menghapus sesi aktif Anda' : 'Hapus akun ini'}
                                    className={`p-1 rounded transition-colors ${
                                      isActive 
                                        ? 'text-slate-200 cursor-not-allowed' 
                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                    }`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between gap-3 text-[11px] text-slate-500 leading-relaxed">
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-slate-700 shrink-0">📌 Catatan Simulasi:</span>
              <p>Anda dapat mengklik tombol <span className="font-bold text-slate-700">"Masuk"</span> pada salah satu akun operator di atas untuk mensimulasikan alur kerja pergudangan dari peran tersebut (misalnya, mengakses menu khusus Staff Gudang, Picker, atau Packer).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over / Modal Form (Add & Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-pink-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingUser ? 'Edit Detail Akun' : 'Tambah Akun Operator Baru'}
                </h3>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  {formError}
                </div>
              )}

              {/* ID Akun (Username) */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                  Akun ID (Username) <span className="text-pink-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-mono text-xs font-semibold select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser /* Disable changing username in edit mode to preserve references */}
                    placeholder="misal: deni.staff"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-6 pr-3 py-1.5 bg-slate-50 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-mono font-bold disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5">Digunakan sebagai ID unik login operator gudang.</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                  Kata Sandi / Password <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="masukkan kata sandi akun"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-mono font-semibold"
                />
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                  Nama Lengkap Operator <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Deni Staff Gudang"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-semibold text-slate-800"
                />
              </div>

              {/* Peran / Role Dropdown */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                  Peran / Hak Akses Sistem <span className="text-pink-500">*</span>
                </label>
                <select
                  disabled={!isMasterAdmin}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className={`w-full px-3 py-1.5 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-bold text-slate-700 ${
                    !isMasterAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'
                  }`}
                >
                  <option value="ADMIN">ADMIN GUDANG (Akses Operasional Penuh)</option>
                  <option value="STAFF_WAREHOUSE">STAFF WAREHOUSE (Kelola Inbound & Return)</option>
                  <option value="PICKER">PICKER (Proses Keluar & Ambil Rak)</option>
                  <option value="PACKER">PACKER (Proses Kemas & Resi Kirim)</option>
                </select>
                {!isMasterAdmin && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1">
                    ⚠️ Hanya Admin Utama yang dapat mengubah peran / hak akses.
                  </p>
                )}
                <p className="text-[9px] text-emerald-600 font-medium mt-1">
                  💡 {getRoleDescription(formData.role, formData.username)}
                </p>
              </div>

              {/* Kontak Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                    Email Kontak
                  </label>
                  <input
                    type="email"
                    placeholder="opsional"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1 font-mono">
                    Nomor HP
                  </label>
                  <input
                    type="text"
                    placeholder="opsional"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-250 rounded text-xs focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Avatar Preset Picker */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1.5 font-mono">
                  Pilih Avatar Profil
                </label>
                <div className="flex gap-2.5 items-center bg-slate-50 p-2 rounded border border-slate-200">
                  <img 
                    src={formData.avatar} 
                    alt="Pratinjau" 
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-500/20 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar: preset.url })}
                        className={`p-0.5 rounded-full ring-2 transition-all ${
                          formData.avatar === preset.url 
                            ? 'ring-pink-500' 
                            : 'ring-transparent hover:ring-slate-300'
                        }`}
                      >
                        <img 
                          src={preset.url} 
                          alt={preset.name} 
                          className="w-6 h-6 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5 mt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs rounded shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-xs uppercase tracking-wider">Konfirmasi Hapus Akun</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus akun <strong>@{allUsers.find(u => u.id === deleteConfirmId)?.username}</strong> ({allUsers.find(u => u.id === deleteConfirmId)?.name})? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Hapus Akun
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-white">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-xs uppercase tracking-wider">Peringatan</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">{alertMessage}</p>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlertMessage(null)}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded transition-all cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
