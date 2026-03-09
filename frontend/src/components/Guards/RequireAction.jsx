import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

/**
 * A wrapper component that conditionally renders its children
 * based on whether the current user has the specified permission.
 * 
 * @param {Object} props
 * @param {string} props.permission - The required permission key (e.g. 'financial.read')
 * @param {React.ReactNode} props.children - The content to render if authorized
 * @param {React.ReactNode} [props.fallback=null] - Optional content to render if unauthorized
 */
export default function RequireAction({ permission, children, fallback = null }) {
    const { hasPermission } = useContext(AuthContext);

    if (!hasPermission(permission)) {
        return fallback;
    }

    return <>{children}</>;
}
