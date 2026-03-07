import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Users, Shield, Edit2, Trash2, CheckCircle, XCircle, UserPlus, Key } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function SettingsUsers() {
    const { t, i18n } = useTranslation('settingsUsers');
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

    const rolesAvailable = [
        'Super Admin',
        'HR Manager',
        'Finance Controller',
        'Sales Representative',
        'Warehouse Supervisor',
        'Production Lead',
        'user'
    ];

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            } else {
                setError('Failed to load users. You may not have permission.');
            }
        } catch (err) {
            setError('Network error loading users.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchUsers();
    }, [token]);

    const handleOpenEdit = (user) => {
        setEditUser(user);
        setModalData({
            name: user.name,
            email: user.email,
            password: '', // Hidden by default, only for new users or forced reset
            role: user.role,
            isActive: user.isActive
        });
        setIsModalOpen(true);
    };

    const handleOpenCreate = () => {
        setEditUser(null);
        setModalData({
            name: '',
            email: '',
            password: '',
            role: 'user',
            isActive: true
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editUser) {
                // Update specific RBAC fields
                const res = await fetch(`http://localhost:5000/api/users/${editUser._id}`, {
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
                    fetchUsers();
                    setIsModalOpen(false);
                } else {
                    const errorData = await res.json();
                    alert(errorData.message || t('errUpdate'));
                }
            } else {
                // Create new user (Hits auth endpoint since we don't have a rigid create user in standard userController yet, usually auth handles registration)
                const res = await fetch(`http://localhost:5000/api/auth/register`, {
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
                    fetchUsers();
                    setIsModalOpen(false);
                } else {
                    const errorData = await res.json();
                    alert(errorData.message || t('errCreate'));
                }
            }
        } catch (err) {
            alert('A network error occurred.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('confirmDelete'))) return;
        try {
            const res = await fetch(`http://localhost:5000/api/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(users.filter(u => u._id !== id));
            } else {
                const errorData = await res.json();
                alert(errorData.message || t('errDelete'));
            }
        } catch (err) {
            alert('A network error occurred.');
        }
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
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="w-6 h-6 text-indigo-500" />
                        {t('title')}
                    </h1>
                    <p className="text-gray-500 mt-2">{t('subtitle')}</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <UserPlus className="w-5 h-5" />
                    {t('invite')}
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                            <th className={clsx("p-4 font-semibold", isAr ? "pr-6 text-right" : "pl-6 text-left")}>{t('thColIdentity')}</th>
                            <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thColRole')}</th>
                            <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thColStatus')}</th>
                            <th className={clsx("p-4 font-semibold", isAr ? "text-right" : "text-left")}>{t('thColDate')}</th>
                            <th className={clsx("p-4 font-semibold", isAr ? "text-left pl-6" : "text-right pr-6")}>{t('thColManage')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                        {users.map((userObj) => (
                            <tr key={userObj._id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className={clsx("p-4", isAr ? "pr-6" : "pl-6")}>
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
                                <td className="p-4">
                                    <span className={clsx(
                                        "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1 w-max",
                                        userObj.role === 'Super Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            userObj.role === 'Finance Controller' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                userObj.role === 'HR Manager' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-gray-50 text-gray-700 border-gray-200'
                                    )}>
                                        {userObj.role === 'Super Admin' && <Key className="w-3 h-3" />}
                                        {t(`role${userObj.role.replace(' ', '')}`)}
                                    </span>
                                </td>
                                <td className="p-4">
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
                                <td className="p-4 text-gray-500 font-medium">
                                    {moment(userObj.createdAt).format('MMM DD, YYYY')}
                                </td>
                                <td className={clsx("p-4", isAr ? "text-left pl-6" : "text-right pr-6")}>
                                    <div className={clsx("flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity", isAr ? "justify-start" : "justify-end")}>
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
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblEmail')}</label>
                                        <input
                                            type="email"
                                            value={modalData.email}
                                            onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder="john@company.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{t('lblPassword')}</label>
                                        <input
                                            type="password"
                                            value={modalData.password}
                                            onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none rounded-xl px-4 py-2.5 font-medium transition-all"
                                            placeholder="Temporary vault key"
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
                                        <option key={r} value={r}>{t(`role${r.replace(' ', '')}`)}</option>
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
