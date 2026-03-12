import { useState, useEffect, useContext, useRef } from 'react';
import { useHotkey } from '../../hooks/useHotkey';
import { AuthContext } from '../../context/AuthContext';
import { Users, Shield, Edit2, Trash2, CheckCircle, XCircle, UserPlus, Key, AlertTriangle, Search } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function SettingsUsers() {
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'settingsUsers' });
    const isAr = i18n.language === 'ar';
    const { token, user: currentUser } = useContext(AuthContext);
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
        role: 'user',
        isActive: true
    });

    const [rolesAvailable, setRolesAvailable] = useState([]);
    const [modalError, setModalError] = useState('');
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [pageError, setPageError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchTerm(''); searchRef.current?.blur(); } });

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/roles`, { headers: { Authorization: `Bearer ${token}` } })
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

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const handleOpenEdit = (user) => {
        setModalError('');
        setEditUser(user);
        setModalData({
            name: user.name,
            email: user.email,
            password: '', // Hidden by default, only for new users or forced reset
            role: user.role?._id || user.role, // Handle populated role or string ID
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
            role: rolesAvailable.length > 0 ? rolesAvailable[0]._id : 'user',
            isActive: true
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editUser) {
                // Update specific RBAC fields
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${editUser._id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        role: modalData.role,
                        isActive: modalData.isActive
                    })
                });

                if (res.ok) {
                    fetchData();
                    setIsModalOpen(false);
                } else {
                    const errorData = await res.json();
                    setModalError(errorData.message || t('errUpdate'));
                }
            } else {
                // Create new user (Hits auth endpoint since we don't have a rigid create user in standard userController yet, usually auth handles registration)
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: modalData.name,
                        email: modalData.email,
                        password: modalData.password,
                        role: modalData.role
                    })
                });

                if (res.ok) {
                    fetchData();
                    setIsModalOpen(false);
                } else {
                    const errorData = await res.json();
                    setModalError(errorData.message || t('errCreate'));
                }
            }
        } catch (err) {
            setModalError('A network error occurred.');
        }
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            title: t('confirmDelete', 'Remove this user?'),
            body: t('confirmDeleteBody', 'This will revoke their access permanently.'),
            onConfirm: async () => {
                try {
                    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        setUsers(prev => prev.filter(u => u._id !== id));
                    } else {
                        const errorData = await res.json();
                        setPageError(errorData.message || t('errDelete'));
                    }
                } catch {
                    setPageError('A network error occurred.');
                }
            }
        });
    };

    if (loading) return <div className="p-8 text-gray-500 font-medium">{t('loading')}</div>;

    if (error) return (
        <div className="p-10 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('accessDenied')}</h2>
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
                    <button onClick={() => setPageError('')} className="text-red-400 hover:text-red-700"><XCircle className="w-4 h-4" /></button>
                </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Unified Table Header */}
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Users className="w-5 h-5 shrink-0" />
                            </div>
                            {t('title')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1.5">{t('subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('search', 'Search users... (Press /)')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64 font-medium"
                            />
                        </div>
                        <button
                            onClick={handleOpenCreate}
                            className="flex w-full sm:w-auto justify-center items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <UserPlus className="w-4 h-4" />
                            {t('invite')}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold text-start px-6">{t('thColIdentity')}</th>
                                <th className="p-4 font-semibold text-start">{t('thColRole')}</th>
                                <th className="p-4 font-semibold text-start">{t('thColStatus')}</th>
                                <th className="p-4 font-semibold text-start">{t('thColDate')}</th>
                                <th className="p-4 font-semibold text-end px-6">{t('thColManage')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {(searchTerm.trim() ? users.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())) : users).map((userObj) => (
                                <tr key={userObj._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 px-6 text-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-bold text-indigo-700">
                                                {userObj.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{userObj.name}</p>
                                                <p className="text-xs font-semibold text-gray-400">{userObj.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-start">
                                        <span className={clsx(
                                            "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1 w-max",
                                            userObj.role?.name === 'Super Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                userObj.role?.isSystemRole ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    'bg-gray-50 text-gray-700 border-gray-200'
                                        )}>
                                            {userObj.role?.name === 'Super Admin' && <Key className="w-3 h-3" />}
                                            {userObj.role?.name || t(`role${(userObj.role || 'user').replace(' ', '')}`)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-start">
                                        {userObj.isActive ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md w-max">
                                                <CheckCircle className="w-4 h-4" /> {t('lblActive')}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded-md w-max">
                                                <XCircle className="w-4 h-4" /> {t('lblRestricted')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-gray-500 font-medium text-start">
                                        {moment(userObj.createdAt).format('MMM DD, YYYY')}
                                    </td>
                                    <td className="p-4 px-6 text-end">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => handleOpenEdit(userObj)}
                                                className="p-2 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all font-medium text-xs flex items-center gap-1"
                                                disabled={userObj._id === currentUser._id}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> {t('btnModify')}
                                            </button>
                                            {userObj._id !== currentUser._id && (
                                                <button
                                                    onClick={() => handleDelete(userObj._id)}
                                                    className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirm Dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="font-bold text-gray-900">{confirmDialog.title}</h3>
                        </div>
                        {confirmDialog.body && <p className="text-sm text-gray-500 mb-5 ms-[52px]">{confirmDialog.body}</p>}
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">{t('btnCancel', 'Cancel')}</button>
                            <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors">{t('btnConfirm', 'Confirm')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-500" />
                                {editUser ? t('modalModTitle') : t('modalInvTitle')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {!editUser && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblName')}</label>
                                        <input
                                            type="text"
                                            value={modalData.name}
                                            onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderName', 'John Doe')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblEmail')}</label>
                                        <input
                                            type="email"
                                            value={modalData.email}
                                            onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderEmail', 'john@company.com')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblPassword')}</label>
                                        <input
                                            type="password"
                                            value={modalData.password}
                                            onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder={t('placeholderPassword', 'Temporary vault key')}
                                        />
                                    </div>
                                </>
                            )}

                            {editUser && (
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
                                    <p className="font-bold text-indigo-900">{modalData.name}</p>
                                    <p className="text-sm font-medium text-indigo-700">{modalData.email}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblRole')}</label>
                                <select
                                    value={modalData.role}
                                    onChange={(e) => setModalData({ ...modalData, role: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all text-gray-700"
                                >
                                    {rolesAvailable.map(r => (
                                        <option key={r._id} value={r._id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {editUser && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblLoginStatus')}</label>
                                    <div className="flex gap-3 mt-2">
                                        <button
                                            onClick={() => setModalData({ ...modalData, isActive: true })}
                                            className={clsx(
                                                "flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border",
                                                modalData.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <CheckCircle className="w-4 h-4" /> {t('lblActive')}
                                        </button>
                                        <button
                                            onClick={() => setModalData({ ...modalData, isActive: false })}
                                            className={clsx(
                                                "flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border",
                                                !modalData.isActive ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <XCircle className="w-4 h-4" /> {t('lblRestrictedLocked')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {modalError && (
                            <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="flex-1">{modalError}</span>
                                <button onClick={() => setModalError('')} className="text-red-400 hover:text-red-700">✕</button>
                            </div>
                        )}
                        <div className={clsx("px-6 py-4 bg-gray-50 flex gap-3 border-t border-gray-100", isAr ? "justify-start" : "justify-end")}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                {t('btnCancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                {editUser ? t('btnSaveMod') : t('btnSaveInv')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
