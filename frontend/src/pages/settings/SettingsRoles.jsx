import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Save, X } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export default function SettingsRoles() {
    const { token, hasPermission } = useContext(AuthContext);
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [catalog, setCatalog] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', description: '', permissions: [] });
    const [error, setError] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rolesRes, catalogRes] = await Promise.all([
                axios.get(`${API_URL}/api/roles`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/roles/catalog`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setRoles(rolesRes.data);
            setCatalog(catalogRes.data);
        } catch (err) {
            console.error("Failed to fetch roles/catalog", err);
            setError(t('rbac.loadError', 'Failed to load RBAC data'));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRole = (role) => {
        setSelectedRole(role);
        setEditForm({ name: role.name, description: role.description, permissions: [...role.permissions] });
        setIsEditing(false);
        setError('');
    };

    const handleCreateNew = () => {
        setSelectedRole(null);
        setEditForm({ name: '', description: '', permissions: [] });
        setIsEditing(true);
        setError('');
    };

    const handleTogglePermission = (permission) => {
        if (!isEditing) return;
        setEditForm(prev => {
            const hasPerm = prev.permissions.includes(permission);
            if (hasPerm) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== permission) };
            } else {
                return { ...prev, permissions: [...prev.permissions, permission] };
            }
        });
    };

    const handleSave = async () => {
        try {
            setError('');
            if (selectedRole) {
                await axios.put(`${API_URL}/api/roles/${selectedRole._id}`, editForm, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/api/roles`, editForm, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            await fetchData();
            setIsEditing(false);
            if (!selectedRole) setSelectedRole(roles.find(r => r.name === editForm.name)); // Optimistic select
        } catch (err) {
            setError(err.response?.data?.message || t('rbac.saveRoleError', 'Failed to save role'));
        }
    };

    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = () => {
        if (!selectedRole || selectedRole.isSystemRole) return;
        setConfirmDelete(true);
    };

    const confirmDeleteRole = async () => {
        setConfirmDelete(false);
        try {
            await axios.delete(`${API_URL}/api/roles/${selectedRole._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedRole(null);
            await fetchData();
        } catch (err) {
            setError(err.response?.data?.message || t('rbac.deleteRoleError', 'Failed to delete role'));
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>;

    if (!hasPermission('users.read')) {
        return <div className="p-8 text-center text-red-500">{t('common.noPermission', 'You do not have permission to view this page.')}</div>;
    }

    return (
        <>
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 inline-block pb-1 pr-4">{t('rbac.roles_title', 'Roles & Permissions')}</h3>
                    <p className="text-sm text-gray-500 mt-2">{t('rbac.roles_desc', 'Manage access control profiles across the organization.')}</p>
                </div>
                {hasPermission('users.manage_permissions') && (
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        {t('rbac.roles_create', 'Create Custom Role')}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Roles List */}
                <div className="lg:col-span-1 bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-2">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-2 px-2">{t('rbac.roles_system', 'System Roles')}</h4>
                    {roles.filter(r => r.isSystemRole).map(role => (
                        <button
                            key={role._id}
                            onClick={() => handleSelectRole(role)}
                            className={clsx(
                                "flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all",
                                selectedRole?._id === role._id ? "bg-white shadow-sm border border-indigo-200" : "hover:bg-gray-100 border border-transparent"
                            )}
                        >
                            <span className={clsx("font-semibold text-sm", selectedRole?._id === role._id ? "text-indigo-700" : "text-gray-800")}>{role.name}</span>
                            <span className="text-xs text-gray-500 truncate w-full">{role.permissions.length} {t('rbac.roles_permissions_count', 'permissions')}</span>
                        </button>
                    ))}

                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest mt-4 mb-2 px-2">{t('rbac.roles_custom', 'Custom Roles')}</h4>
                    {roles.filter(r => !r.isSystemRole).map(role => (
                        <button
                            key={role._id}
                            onClick={() => handleSelectRole(role)}
                            className={clsx(
                                "flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all",
                                selectedRole?._id === role._id ? "bg-white shadow-sm border border-indigo-200" : "hover:bg-gray-100 border border-transparent"
                            )}
                        >
                            <span className={clsx("font-semibold text-sm", selectedRole?._id === role._id ? "text-indigo-700" : "text-gray-800")}>{role.name}</span>
                            <span className="text-xs text-gray-500 truncate w-full">{role.permissions.length} {t('rbac.roles_permissions_count', 'permissions')}</span>
                        </button>
                    ))}
                    {roles.filter(r => !r.isSystemRole).length === 0 && (
                        <p className="text-xs text-gray-400 italic px-2">{t('rbac.roles_no_custom', 'No custom roles yet.')}</p>
                    )}
                </div>

                {/* Role Details and Matrix */}
                <div className="lg:col-span-3">
                    {selectedRole || isEditing ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Role Header */}
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                                {isEditing ? (
                                    <div className="flex-1 max-w-lg">
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            placeholder={t('rbac.roles_name_placeholder', 'Role Name (e.g., Marketing Lead)')}
                                            className="w-full font-bold text-xl text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                                        />
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            placeholder={t('rbac.roles_desc_placeholder', 'Description of what this role can do')}
                                            className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-20 resize-none"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedRole.name}</h2>
                                            {selectedRole.isSystemRole && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] uppercase font-bold tracking-wider">{t('rbac.roles_system_default', 'System Default')}</span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 text-sm mt-1">{selectedRole.description}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <>
                                            <button onClick={() => { setIsEditing(false); if (!selectedRole) handleSelectRole(roles[0]); else handleSelectRole(selectedRole); }} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"><X className="w-5 h-5" /></button>
                                            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm font-bold text-sm transition"><Save className="w-4 h-4" /> {t('rbac.roles_save', 'Save Role')}</button>
                                        </>
                                    ) : (
                                        hasPermission('users.manage_permissions') && (
                                            <>
                                                {!selectedRole.isSystemRole && (
                                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"><Edit2 className="w-4 h-4" /> {t('rbac.roles_edit', 'Edit')}</button>
                                                )}
                                                {!selectedRole.isSystemRole && (
                                                    <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-5 h-5" /></button>
                                                )}
                                            </>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Matrix */}
                            <div className="p-6">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-500" /> {t('rbac.roles_matrix', 'Permission Matrix')}</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {catalog && Object.entries(catalog).map(([moduleName, permissionsList]) => (
                                        <div key={moduleName} className="border border-gray-100 rounded-xl p-4 bg-white/50 shadow-sm">
                                            <h5 className="font-bold text-gray-800 mb-3 capitalize text-sm border-b pb-2">{t(`modules.${moduleName}`, moduleName)}</h5>
                                            <div className="space-y-2.5">
                                                {Array.isArray(permissionsList) && permissionsList.map((permKey) => {
                                                    const hasPerm = (isEditing ? editForm.permissions : selectedRole.permissions).includes(permKey);
                                                    const formattedLabel = permKey.split('.')[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                                    return (
                                                        <label key={permKey} className={clsx("flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer", isEditing ? "hover:bg-gray-50" : "", hasPerm ? "bg-indigo-50/30" : "")}>
                                                            <div className="mt-0.5 relative flex items-center justify-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={hasPerm}
                                                                    onChange={() => handleTogglePermission(permKey)}
                                                                    disabled={!isEditing}
                                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className={clsx("text-sm font-semibold", hasPerm ? "text-indigo-900" : "text-gray-700")}>{t(`permissions.${permKey.replace('.', '_')}`, formattedLabel)}</p>
                                                                <p className="text-xs text-gray-500 max-w-xs">{permKey}</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-12">
                            <Shield className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-600">{t('rbac.roles_select_prompt', 'Select a role to view permissions')}</p>
                            <p className="text-sm">{t('rbac.roles_or_create', 'Or create a new custom role')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {confirmDelete && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{t('rbac.delete_role_title', 'Delete this role?')}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{selectedRole?.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button onClick={confirmDeleteRole} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                            {t('common.delete', 'Delete')}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
