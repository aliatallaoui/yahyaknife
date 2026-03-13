import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Users, Shield, Edit2, Trash2, CheckCircle, XCircle, UserPlus, Key, AlertTriangle, Search, Lock, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import useModalDismiss from '../../hooks/useModalDismiss';
import { apiFetch } from '../../utils/apiFetch';

export default function SettingsUsers() {
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'settingsUsers' });
    const isAr = i18n.language === 'ar';
    const { user: currentUser, hasPermission } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [modalData, setModalData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        isActive: true
    });

    const [rolesAvailable, setRolesAvailable] = useState([]);
    const [modalError, setModalError] = useState('');
    const [modalSaving, setModalSaving] = useState(false);
    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();
    const closeModal = useCallback(() => { setIsModalOpen(false); setModalError(''); }, []);
    const { backdropProps: modalBackdropProps, panelProps: modalPanelProps } = useModalDismiss(closeModal);
    const [pageError, setPageError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                apiFetch('/api/users'),
                apiFetch('/api/roles')
            ]);

            if (usersRes.ok && rolesRes.ok) {
                setUsers(await usersRes.json());
                setRolesAvailable(await rolesRes.json());
            } else {
                setError(t('loadError', 'Failed to load users or roles. You may not have permission.'));
            }
        } catch (err) {
            setError(t('networkError', 'Network error loading data.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenEdit = (user) => {
        setModalError('');
        setEditUser(user);
        setModalData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role?._id || '',
            isActive: user.isActive
        });
        setIsModalOpen(true);
    };

    const handleOpenCreate = () => {
        setModalError('');
        setEditUser(null);
        setModalData({
            name: '',
            email: '',
            password: '',
            role: rolesAvailable.length > 0 ? rolesAvailable[0]._id : '',
            isActive: true
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setModalError('');
            setModalSaving(true);

            if (editUser) {
                // Update role + active status
                const res = await apiFetch(`/api/users/${editUser._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: modalData.role || null,
                        isActive: modalData.isActive
                    })
                });

                if (res.ok) {
                    await fetchData();
                    closeModal();
                } else {
                    const errorData = await res.json();
                    setModalError(errorData.message || t('errUpdate', 'Failed to update user'));
                }
            } else {
                // Validate before sending
                if (!modalData.name.trim()) {
                    setModalError(t('errNameRequired', 'Name is required'));
                    return;
                }
                if (!modalData.email.trim()) {
                    setModalError(t('errEmailRequired', 'Email is required'));
                    return;
                }
                if (!modalData.password || modalData.password.length < 12) {
                    setModalError(t('errPasswordMin', 'Password must be at least 12 characters'));
                    return;
                }

                // Create user via dedicated admin endpoint
                const res = await apiFetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: modalData.name.trim(),
                        email: modalData.email.trim(),
                        password: modalData.password,
                        role: modalData.role || null
                    })
                });

                if (res.ok) {
                    await fetchData();
                    closeModal();
                } else {
                    const errorData = await res.json();
                    setModalError(errorData.message || t('errCreate', 'Failed to create user'));
                }
            }
        } catch (err) {
            setModalError(t('networkError', 'A network error occurred.'));
        } finally {
            setModalSaving(false);
        }
    };

    const handleDelete = (userObj) => {
        showConfirm({
            title: t('confirmDelete', 'Remove this user?'),
            body: `${userObj.name} (${userObj.email})`,
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await apiFetch(`/api/users/${userObj._id}`, { method: 'DELETE' });
                    if (res.ok) {
                        setUsers(prev => prev.filter(u => u._id !== userObj._id));
                    } else {
                        const errorData = await res.json();
                        setPageError(errorData.message || t('errDelete', 'Failed to delete user'));
                    }
                } catch {
                    setPageError(t('networkError', 'A network error occurred.'));
                }
            }
        });
    };

    const filteredUsers = searchTerm.trim()
        ? users.filter(u =>
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : users;

    if (loading) return (
        <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent mx-auto" />
        </div>
    );

    if (error) return (
        <div className="p-12 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('accessDenied', 'Access Denied')}</h2>
            <p className="text-gray-500">{error}</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto">
            {/* Page-level error toast */}
            {pageError && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{pageError}</span>
                    <button onClick={() => setPageError('')} className="text-red-400 hover:text-red-700"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Users className="w-5 h-5 shrink-0" />
                            </div>
                            {t('title', 'Team Members')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1.5">{t('subtitle', 'Manage user access and roles')}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('search', 'Search users...')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full sm:w-56 pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            />
                        </div>
                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-95 shrink-0"
                        >
                            <UserPlus className="w-4 h-4" />
                            {t('invite', 'Invite User')}
                        </button>
                    </div>
                </div>

                {/* Users count */}
                <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 text-xs font-medium text-gray-400">
                    {filteredUsers.length} {t('usersCount', 'user(s)')}
                    {searchTerm && ` — ${t('searchResults', 'filtered')}`}
                </div>

                <div className="overflow-x-auto">
                    <table className="cf-table min-w-[700px]">
                        <thead>
                            <tr>
                                <th className="text-start">{t('thColIdentity', 'User')}</th>
                                <th className="text-start">{t('thColRole', 'Role')}</th>
                                <th className="text-start">{t('thColStatus', 'Status')}</th>
                                <th className="text-start">{t('thColDate', 'Joined')}</th>
                                <th className="text-end">{t('thColManage', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((userObj) => {
                                const isSelf = userObj._id === currentUser?._id;
                                const isSuperAdmin = userObj.role?.name === 'Super Admin';

                                return (
                                    <tr key={userObj._id} className="group">
                                        <td className="p-4 px-6 text-start">
                                            <div className="flex items-center gap-3">
                                                <div className={clsx(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                                                    isSuperAdmin
                                                        ? "bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700"
                                                        : "bg-gradient-to-br from-gray-100 to-gray-50 text-gray-600"
                                                )}>
                                                    {userObj.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-gray-900 truncate">
                                                        {userObj.name}
                                                        {isSelf && <span className="text-xs font-medium text-gray-400 ms-2">({t('you', 'you')})</span>}
                                                    </p>
                                                    <p className="text-xs font-medium text-gray-400 truncate">{userObj.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-start">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border w-max",
                                                isSuperAdmin
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                    : userObj.role?.isSystemRole
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                        : userObj.role
                                                            ? 'bg-gray-50 text-gray-700 border-gray-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                            )}>
                                                {isSuperAdmin && <Key className="w-3 h-3" />}
                                                {userObj.role?.name || t('noRole', 'No Role')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-start">
                                            {userObj.isActive ? (
                                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-lg w-max border border-emerald-100">
                                                    <CheckCircle className="w-3.5 h-3.5" /> {t('lblActive', 'Active')}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-lg w-max border border-rose-100">
                                                    <XCircle className="w-3.5 h-3.5" /> {t('lblRestricted', 'Restricted')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-500 font-medium text-start text-xs">
                                            {userObj.createdAt ? new Date(userObj.createdAt).toLocaleDateString(isAr ? 'ar-DZ' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                        </td>
                                        <td className="p-4 px-6 text-end">
                                            {!isSelf && (
                                                <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenEdit(userObj)}
                                                        className="p-2 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all text-xs font-medium flex items-center gap-1"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" /> {t('btnModify', 'Edit')}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(userObj)}
                                                        className="p-2 bg-rose-50 text-rose-500 rounded-lg border border-rose-100 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400">
                                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium">{searchTerm ? t('noResults', 'No users match your search') : t('noUsers', 'No users yet')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {confirmDialogEl}

            {/* User Modal (Create / Edit) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" {...modalBackdropProps}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" {...modalPanelProps}>
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                                    {editUser ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                </div>
                                {editUser ? t('modalModTitle', 'Edit User Access') : t('modalInvTitle', 'Invite Team Member')}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-900 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Show user identity for edit mode */}
                            {editUser && (
                                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                    <p className="font-bold text-indigo-900">{editUser.name}</p>
                                    <p className="text-sm font-medium text-indigo-600">{editUser.email}</p>
                                </div>
                            )}

                            {/* Create mode fields */}
                            {!editUser && (
                                <>
                                    <div>
                                        <label htmlFor="usr-name" className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblName', 'Full Name')}</label>
                                        <input
                                            id="usr-name"
                                            type="text"
                                            autoComplete="name"
                                            value={modalData.name}
                                            onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderName', 'e.g., Ahmed Ben Ali')}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="usr-email" className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblEmail', 'Email Address')}</label>
                                        <input
                                            id="usr-email"
                                            type="email"
                                            autoComplete="email"
                                            value={modalData.email}
                                            onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderEmail', 'user@company.com')}
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="usr-password" className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblPassword', 'Password')}</label>
                                        <input
                                            id="usr-password"
                                            type="password"
                                            autoComplete="new-password"
                                            value={modalData.password}
                                            onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderPassword', 'Min 12 characters')}
                                        />
                                        <p className="text-[11px] text-gray-400 mt-1.5 font-medium">{t('passwordHint', 'Must be at least 12 characters')}</p>
                                    </div>
                                </>
                            )}

                            {/* Role selector */}
                            <div>
                                <label htmlFor="usr-role" className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblRole', 'Role')}</label>
                                <select
                                    id="usr-role"
                                    value={modalData.role}
                                    onChange={(e) => setModalData({ ...modalData, role: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all text-gray-700"
                                >
                                    <option value="">{t('selectRole', '— Select a role —')}</option>
                                    {rolesAvailable.map(r => (
                                        <option key={r._id} value={r._id}>
                                            {r.name}{r.isSystemRole ? ` (${t('system', 'System')})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Active/Restricted toggle (edit only) */}
                            {editUser && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{t('lblLoginStatus', 'Account Status')}</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setModalData({ ...modalData, isActive: true })}
                                            className={clsx(
                                                "flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border text-sm",
                                                modalData.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <CheckCircle className="w-4 h-4" /> {t('lblActive', 'Active')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setModalData({ ...modalData, isActive: false })}
                                            className={clsx(
                                                "flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border text-sm",
                                                !modalData.isActive ? "bg-rose-50 text-rose-700 border-rose-200 shadow-sm" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <XCircle className="w-4 h-4" /> {t('lblRestrictedLocked', 'Restricted')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Error */}
                        {modalError && (
                            <div className="mx-6 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="flex-1">{modalError}</span>
                                <button onClick={() => setModalError('')} className="text-red-400 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className={clsx("px-6 py-4 bg-gray-50 flex gap-3 border-t border-gray-100", isAr ? "justify-start" : "justify-end")}>
                            <button
                                onClick={closeModal}
                                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                {t('btnCancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={modalSaving}
                                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {modalSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editUser ? t('btnSaveMod', 'Save Changes') : t('btnSaveInv', 'Create User')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
