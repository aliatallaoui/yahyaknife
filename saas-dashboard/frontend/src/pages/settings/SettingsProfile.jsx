import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Camera, Mail, Phone, Building, Briefcase } from 'lucide-react';

export default function SettingsProfile() {
    const { user } = useContext(AuthContext);

    return (
        <div className="p-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Public Profile</h3>

            <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-3xl border-4 border-white shadow-md">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full border border-gray-200 shadow-sm text-gray-500 hover:text-indigo-600 transition-colors">
                        <Camera className="w-4 h-4" />
                    </button>
                </div>
                <div>
                    <h4 className="text-lg font-bold text-gray-900">{user?.name || 'User'}</h4>
                    <p className="text-sm text-gray-500 capitalize">{user?.role || 'Standard User'}</p>
                    <button className="mt-2 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">Change Photo</button>
                </div>
            </div>

            <form className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                        <input type="text" defaultValue={user?.name} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Display Name (Optional)</label>
                        <input type="text" placeholder="How you appear to others" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email Address</label>
                        <input type="email" disabled defaultValue={user?.email} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-gray-500 bg-gray-100 cursor-not-allowed" />
                        <p className="text-[10px] text-gray-400 mt-1">Contact your admin to change your primary login email.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone Number</label>
                        <input type="tel" placeholder="+1 (555) 000-0000" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Building className="w-3.5 h-3.5" /> Department</label>
                        <input type="text" disabled defaultValue={user?.department || 'Operations'} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-gray-500 bg-gray-100 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> Job Title</label>
                        <input type="text" placeholder="e.g. Senior Logistics Coordinator" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-gray-50/50" />
                    </div>
                </div>

                <div className="pt-6 flex justify-end gap-3">
                    <button type="button" className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200">Discard</button>
                    <button type="button" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700">Save Changes</button>
                </div>
            </form>
        </div>
    );
}
