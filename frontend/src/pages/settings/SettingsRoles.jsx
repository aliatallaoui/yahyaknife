import { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../utils/axiosInstance';
import { Shield, Plus, Edit2, Trash2, Save, X, Copy, Search, Users, Lock } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useConfirmDialog } from '../../components/ConfirmDialog';

// Format a permission key like "orders.status.change" → "Status Change"
const formatPermLabel = (permKey) => {
    const parts = permKey.split('.');
    // Take everything after the domain (first segment)
    return parts.slice(1).join(' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function SettingsRoles() {
    const { hasPermission, user } = useContext(AuthContext);
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [catalog, setCatalog] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', description: '', permissions: [] });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [permSearch, setPermSearch] = useState('');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rolesRes, catalogRes] = await Promise.all([
                api.get('/api/roles'),
                api.get('/api/roles/catalog')
            ]);
            setRoles(rolesRes.data);
            setCatalog(catalogRes.data);
        } catch (err) {
            setError(t('rbac.loadError', 'Failed to load roles data'));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRole = (role) => {
        setSelectedRole(role);
        setEditForm({ name: role.name, description: role.description || '', permissions: [...role.permissions] });
        setIsEditing(false);
        setError('');
        setPermSearch('');
    };

    const handleCreateNew = () => {
        setSelectedRole(null);
        setEditForm({ name: '', description: '', permissions: [] });
        setIsEditing(true);
        setError('');
        setPermSearch('');
    };

    const handleDuplicate = () => {
        if (!selectedRole) return;
        setEditForm({
            name: `${selectedRole.name} (Copy)`,
            description: selectedRole.description || '',
            permissions: [...selectedRole.permissions]
        });
        setSelectedRole(null);
        setIsEditing(true);
        setError('');
    };

    const handleTogglePermission = (permission) => {
        if (!isEditing) return;
        setEditForm(prev => {
            const hasPerm = prev.permissions.includes(permission);
            return {
                ...prev,
                permissions: hasPerm
                    ? prev.permissions.filter(p => p !== permission)
                    : [...prev.permissions, permission]
            };
        });
    };

    const handleToggleModule = (moduleName, permissionsList) => {
        if (!isEditing) return;
        const allChecked = permissionsList.every(p => editForm.permissions.includes(p));
        setEditForm(prev => {
            if (allChecked) {
                return { ...prev, permissions: prev.permissions.filter(p => !permissionsList.includes(p)) };
            } else {
                const merged = new Set([...prev.permissions, ...permissionsList]);
                return { ...prev, permissions: [...merged] };
            }
        });
    };

    const handleCancel = () => {
        setIsEditing(false);
        setPermSearch('');
        if (!selectedRole && roles.length > 0) {
            handleSelectRole(roles[0]);
        } else if (selectedRole) {
            // Restore original values
            handleSelectRole(selectedRole);
        }
    };

    const handleSave = async () => {
        try {
            setError('');
            setSaving(true);
            if (!editForm.name.trim()) {
                setError(t('rbac.nameRequired', 'Role name is required'));
                return;
            }
            if (!editForm.description.trim()) {
                setError(t('rbac.descRequired', 'Role description is required'));
                return;
            }

            let savedRole;
            if (selectedRole) {
                const res = await api.put(`/api/roles/${selectedRole._id}`, editForm);
                savedRole = res.data;
            } else {
                const res = await api.post('/api/roles', editForm);
                savedRole = res.data;
            }

            await fetchData();
            setIsEditing(false);

            // Select the saved role after refresh
            if (savedRole?._id) {
                // fetchData updates roles state, but we need to wait for it
                // Use the savedRole directly
                setSelectedRole(savedRole);
                setEditForm({ name: savedRole.name, description: savedRole.description || '', permissions: [...savedRole.permissions] });
            }
        } catch (err) {
            setError(err.response?.data?.message || t('rbac.saveRoleError', 'Failed to save role'));
        } finally {
            setSaving(false);
        }
    };

    const { dialog: confirmDialogEl, confirm: showConfirm } = useConfirmDialog();

    const handleDelete = () => {
        if (!selectedRole) return;
        if (selectedRole.isSystemRole && !userIsSuperAdmin) return;
        showConfirm({
            title: t('rbac.delete_role_title', 'Delete this role?'),
            body: t('rbac.delete_role_body', 'Role "{{name}}" will be permanently removed. Users assigned to it must be reassigned first.').replace('{{name}}', selectedRole.name),
            danger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`/api/roles/${selectedRole._id}`);
                    setSelectedRole(null);
                    setIsEditing(false);
                    await fetchData();
                } catch (err) {
                    setError(err.response?.data?.message || t('rbac.deleteRoleError', 'Failed to delete role'));
                }
            },
        });
    };

    // Filter catalog modules by search
    const filteredCatalog = useMemo(() => {
        if (!permSearch.trim()) return catalog;
        const term = permSearch.toLowerCase();
        const filtered = {};
        for (const [mod, perms] of Object.entries(catalog)) {
            if (!Array.isArray(perms)) continue;
            if (mod.toLowerCase().includes(term)) {
                filtered[mod] = perms;
            } else {
                const matchingPerms = perms.filter(p =>
                    p.toLowerCase().includes(term) ||
                    formatPermLabel(p).toLowerCase().includes(term)
                );
                if (matchingPerms.length > 0) filtered[mod] = matchingPerms;
            }
        }
        return filtered;
    }, [catalog, permSearch]);

    const systemRoles = roles.filter(r => r.isSystemRole);
    const customRoles = roles.filter(r => !r.isSystemRole);

    const canManage = hasPermission('system.roles');
    const userIsSuperAdmin = user?.role === 'Super Admin' || user?.role?.name === 'Super Admin';

    if (loading) return (
        <div className="p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent mx-auto" />
        </div>
    );

    if (!canManage) {
        return (
            <div className="p-12 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('common.accessDenied', 'Access Denied')}</h2>
                <p className="text-gray-500">{t('common.noPermission', 'You do not have permission to view this page.')}</p>
            </div>
        );
    }

    return (
        <>
        <div className="p-6">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Shield className="w-5 h-5" />
                        </div>
                        {t('rbac.roles_title', 'Roles & Permissions')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1.5">{t('rbac.roles_desc', 'Manage access control profiles across the organization.')}</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 transition-all text-sm font-bold hover:shadow-md active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    {t('rbac.roles_create', 'Create Role')}
                </button>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                        <X className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="text-sm font-medium flex-1">{error}</p>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Roles Sidebar */}
                <div className="lg:col-span-1 flex flex-col gap-1">
                    {/* System Roles */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                            <Lock className="w-3 h-3" />
                            {t('rbac.roles_system', 'System Roles')}
                        </p>
                        {systemRoles.map(role => (
                            <button
                                key={role._id}
                                onClick={() => handleSelectRole(role)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                    selectedRole?._id === role._id
                                        ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                                        : "hover:bg-gray-50 border border-transparent"
                                )}
                            >
                                <div className={clsx(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                    selectedRole?._id === role._id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                                )}>
                                    {role.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className={clsx("font-semibold text-sm truncate", selectedRole?._id === role._id ? "text-indigo-700" : "text-gray-800")}>{role.name}</p>
                                    <p className="text-[11px] text-gray-400 tabular-nums">{role.permissions.length} {t('rbac.perms', 'perms')}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Custom Roles */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            {t('rbac.roles_custom', 'Custom Roles')}
                        </p>
                        {customRoles.length === 0 ? (
                            <p className="text-xs text-gray-400 px-2 py-3">{t('rbac.roles_no_custom', 'No custom roles yet.')}</p>
                        ) : customRoles.map(role => (
                            <button
                                key={role._id}
                                onClick={() => handleSelectRole(role)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                    selectedRole?._id === role._id
                                        ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                                        : "hover:bg-gray-50 border border-transparent"
                                )}
                            >
                                <div className={clsx(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                    selectedRole?._id === role._id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                                )}>
                                    {role.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className={clsx("font-semibold text-sm truncate", selectedRole?._id === role._id ? "text-indigo-700" : "text-gray-800")}>{role.name}</p>
                                    <p className="text-[11px] text-gray-400 tabular-nums">{role.permissions.length} {t('rbac.perms', 'perms')}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Role Details Panel */}
                <div className="lg:col-span-3">
                    {selectedRole || isEditing ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Role Header */}
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start gap-4">
                                {isEditing ? (
                                    <div className="flex-1 max-w-lg space-y-3">
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            placeholder={t('rbac.roles_name_placeholder', 'Role Name (e.g., Marketing Lead)')}
                                            className="w-full font-bold text-lg text-gray-900 border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            placeholder={t('rbac.roles_desc_placeholder', 'Description of what this role can do')}
                                            className="w-full text-sm text-gray-600 border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-20 resize-none"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-xl font-bold text-gray-900">{selectedRole.name}</h2>
                                            {selectedRole.isSystemRole && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] uppercase font-bold tracking-wider border border-blue-100">
                                                    {t('rbac.roles_system_default', 'System')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-sm mt-1">{selectedRole.description}</p>
                                        <p className="text-xs text-gray-400 mt-2 tabular-nums">
                                            {(isEditing ? editForm.permissions : selectedRole.permissions).length} {t('rbac.roles_permissions_count', 'permissions enabled')}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 shrink-0">
                                    {isEditing ? (
                                        <>
                                            <button onClick={handleCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                <Save className="w-4 h-4" /> {saving ? t('common.saving', 'Saving...') : t('rbac.roles_save', 'Save')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Duplicate (works for all roles including system) */}
                                            <button onClick={handleDuplicate} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors" title={t('rbac.duplicate', 'Duplicate')}>
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            {(!selectedRole.isSystemRole || userIsSuperAdmin) && (
                                                <>
                                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors">
                                                        <Edit2 className="w-4 h-4" /> {t('rbac.roles_edit', 'Edit')}
                                                    </button>
                                                    {!selectedRole.isSystemRole && (
                                                        <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Permission Search (only in edit mode) */}
                            {isEditing && (
                                <div className="px-6 pt-4">
                                    <div className="relative max-w-sm">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={permSearch}
                                            onChange={e => setPermSearch(e.target.value)}
                                            placeholder={t('rbac.searchPerms', 'Search permissions...')}
                                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Permission Matrix */}
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredCatalog && Object.entries(filteredCatalog).map(([moduleName, permissionsList]) => {
                                        if (!Array.isArray(permissionsList) || permissionsList.length === 0) return null;
                                        const activePerms = (isEditing ? editForm.permissions : selectedRole.permissions);
                                        const moduleCheckedCount = permissionsList.filter(p => activePerms.includes(p)).length;
                                        const allChecked = moduleCheckedCount === permissionsList.length;

                                        return (
                                            <div key={moduleName} className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                                {/* Module Header */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                                                    <div className="flex items-center gap-2">
                                                        {isEditing && (
                                                            <input
                                                                type="checkbox"
                                                                checked={allChecked}
                                                                onChange={() => handleToggleModule(moduleName, permissionsList)}
                                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                            />
                                                        )}
                                                        <h5 className="font-bold text-gray-800 capitalize text-sm">{t(`modules.${moduleName}`, moduleName)}</h5>
                                                    </div>
                                                    <span className={clsx(
                                                        "text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums",
                                                        moduleCheckedCount === permissionsList.length ? "bg-indigo-100 text-indigo-700" :
                                                        moduleCheckedCount > 0 ? "bg-amber-50 text-amber-700" :
                                                        "bg-gray-100 text-gray-400"
                                                    )}>
                                                        {moduleCheckedCount}/{permissionsList.length}
                                                    </span>
                                                </div>

                                                {/* Permissions List */}
                                                <div className="divide-y divide-gray-50">
                                                    {permissionsList.map((permKey) => {
                                                        const hasPerm = activePerms.includes(permKey);
                                                        return (
                                                            <label
                                                                key={permKey}
                                                                className={clsx(
                                                                    "flex items-center gap-3 px-4 py-2.5 transition-colors",
                                                                    isEditing ? "cursor-pointer hover:bg-gray-50" : "",
                                                                    hasPerm ? "bg-indigo-50/30" : ""
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={hasPerm}
                                                                    onChange={() => handleTogglePermission(permKey)}
                                                                    disabled={!isEditing}
                                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-40 shrink-0"
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className={clsx("text-sm font-medium", hasPerm ? "text-indigo-900" : "text-gray-700")}>
                                                                        {t(`permissions.${permKey.replace(/\./g, '_')}`, formatPermLabel(permKey))}
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-400 font-mono truncate">{permKey}</p>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {Object.keys(filteredCatalog).length === 0 && permSearch && (
                                    <p className="text-center text-gray-400 py-8 text-sm">{t('rbac.noPermsMatch', 'No permissions match your search.')}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-16">
                            <Shield className="w-14 h-14 mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-600">{t('rbac.roles_select_prompt', 'Select a role to view permissions')}</p>
                            <p className="text-sm text-gray-400 mt-1">{t('rbac.roles_or_create', 'Or create a new custom role')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {confirmDialogEl}
        </>
    );
}
