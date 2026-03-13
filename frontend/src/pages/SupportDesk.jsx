import { useState, useEffect, useRef } from 'react';
import { Search, Filter, MessageSquare, Send, Clock, CheckCircle2, AlertCircle, X, ShieldAlert, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { useContext } from 'react';
import { useHotkey } from '../hooks/useHotkey';

export default function SupportDesk() {
    const { t } = useTranslation();
    const { hasPermission, token } = useContext(AuthContext);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [replyError, setReplyError] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);
    useHotkey('/', () => { searchRef.current?.focus(); searchRef.current?.select(); }, { preventDefault: true });
    useHotkey('escape', () => { if (document.activeElement === searchRef.current) { setSearchQuery(''); searchRef.current?.blur(); } });

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/support`);
            const json = await res.json();
            const data = Array.isArray(json) ? json : (json.data ?? []);
            setTickets(data);
        } catch (error) {
            setFetchError(t('support.fetchError', 'Failed to load support tickets. Please refresh.'));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTicket = async (ticket) => {
        try {
            // Fetch populated ticket
            const res = await apiFetch(`/api/support/${ticket._id}`);
            const json = await res.json();
            setSelectedTicket(json.data ?? json);
        } catch (error) {
            setReplyError(t('support.ticketLoadError', 'Failed to load ticket details.'));
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedTicket) return;

        try {
            const res = await apiFetch(`/api/support/${selectedTicket._id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: replyText,
                    sender: 'Agent'
                })
            });

            if (res.ok) {
                const json = await res.json();
                const updatedTicket = json.data ?? json;
                setSelectedTicket(updatedTicket);
                setTickets(tickets.map(t => t._id === updatedTicket._id ? updatedTicket : t));
                setReplyText('');
                setReplyError(null);
            } else {
                const data = await res.json().catch(() => ({}));
                setReplyError(data.message || t('support.replyError', 'Failed to send reply.'));
            }
        } catch (error) {
            setReplyError(t('support.replyError', 'Failed to send reply.'));
        }
    };

    const handleUpdateStatus = async (status) => {
        if (!selectedTicket) return;
        try {
            const res = await apiFetch(`/api/support/${selectedTicket._id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                const json = await res.json();
                const updatedTicket = json.data ?? json;
                setSelectedTicket(updatedTicket);
                setTickets(tickets.map(t => t._id === updatedTicket._id ? updatedTicket : t));
                setReplyError(null);
            } else {
                const data = await res.json().catch(() => ({}));
                setReplyError(data.message || t('support.statusError', 'Failed to update ticket status.'));
            }
        } catch (error) {
            setReplyError(t('support.statusError', 'Failed to update ticket status.'));
        }
    };

    const filteredTickets = tickets.filter(t => {
        if (filter !== 'All') {
            if (filter === 'Open' && t.status !== 'Open' && t.status !== 'In Progress') return false;
            if (filter !== 'Open' && t.status !== filter) return false;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = t.customerId?.name?.toLowerCase().includes(q);
            const matchSubject = t.subject?.toLowerCase().includes(q);
            const matchNumber = t.ticketNumber?.toLowerCase().includes(q);
            if (!matchName && !matchSubject && !matchNumber) return false;
        }
        return true;
    });

    const getPriorityColor = (p) => {
        switch (p) {
            case 'Urgent': return 'text-rose-600 bg-rose-50 border-rose-200';
            case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
            default: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        }
    };

    const getStatusColor = (s) => {
        switch (s) {
            case 'Open': return 'bg-rose-500';
            case 'In Progress': return 'bg-indigo-500';
            case 'Waiting on Customer': return 'bg-amber-500';
            case 'Resolved': return 'bg-emerald-500';
            case 'Closed': return 'bg-gray-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-6rem)] sm:h-[calc(100vh-6.5rem)]">
            <PageHeader
                title={t('crm.helpdeskInbox', 'Support Desk')}
                subtitle={t('crm.subtitle', 'Live customer communication and issue resolution center.')}
                variant="customers"
                actions={
                    hasPermission('support.create_ticket') && (
                        <button className="flex items-center gap-2 px-6 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 leading-none">
                            <Plus className="w-5 h-5" /> {t('crm.newTicket', 'Manual Ticket')}
                        </button>
                    )
                }
            />

            {fetchError && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => { setFetchError(null); fetchTickets(); }} className="text-red-600 underline hover:no-underline text-xs font-bold">{t('common.retry', 'Retry')}</button>
                    <button onClick={() => setFetchError(null)} className="ml-2 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-[3px] border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-sm text-gray-400 font-medium">{t('common.loading', 'Loading...')}</span>
                    </div>
                </div>
            ) : (
            <div className="flex flex-col md:flex-row flex-1 bg-white overflow-hidden font-sans border border-gray-100 rounded-3xl shadow-sm">
                {/* Sidebar List */}
                <div className={clsx(
                    "w-full md:w-[340px] lg:w-[400px] bg-white border-b md:border-b-0 md:border-e border-gray-100 flex flex-col z-10 relative shrink-0",
                    selectedTicket ? "hidden md:flex md:h-full" : "h-full md:h-full"
                )}>
                    <div className="p-5 border-b border-gray-100 bg-white/50 backdrop-blur-md sticky top-0">
                        <div className="relative mb-4">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={t('crm.searchTicket', "Search tickets... (Press / to focus)")}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {[
                                { label: t('crm.filterAll', 'All'), value: 'All',
                                  count: tickets.length },
                                { label: t('crm.filterOpen', 'Open'), value: 'Open',
                                  count: tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length },
                                { label: t('crm.filterWaiting', 'Waiting'), value: 'Waiting on Customer',
                                  count: tickets.filter(t => t.status === 'Waiting on Customer').length },
                                { label: t('crm.filterResolved', 'Resolved'), value: 'Resolved',
                                  count: tickets.filter(t => t.status === 'Resolved').length }
                            ].map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setFilter(f.value)}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                        filter === f.value
                                            ? "bg-indigo-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    )}
                                >
                                    {f.label}
                                    {f.count > 0 && (
                                        <span className={clsx(
                                            "text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none",
                                            filter === f.value ? "bg-white/30 text-white" : "bg-white text-gray-600"
                                        )}>{f.count}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">{t('crm.loadingTickets', 'Loading tickets...')}</div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-300 mb-2" />
                                <p className="font-medium text-sm">{t('crm.inboxZero', 'Inbox Zero')}</p>
                            </div>
                        ) : (
                            filteredTickets.map(ticket => (
                                <button
                                    key={ticket._id}
                                    onClick={() => handleSelectTicket(ticket)}
                                    className={clsx(
                                        "w-full text-start p-4 rounded-xl transition-all duration-200 group relative mb-1",
                                        selectedTicket?._id === ticket._id
                                            ? "bg-indigo-50 border border-indigo-100 shadow-sm"
                                            : "hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={clsx("w-2 h-2 rounded-full", getStatusColor(ticket.status))} />
                                            <span className="font-bold text-gray-900 truncate pe-2">{ticket.customerId?.name || 'Unknown'}</span>
                                        </div>
                                        <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                                            {moment(ticket.createdAt).fromNow(true)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700 truncate pe-8 mb-2">
                                        {ticket.subject}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", getPriorityColor(ticket.priority))}>
                                            {ticket.priority}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">
                                            {ticket.ticketNumber}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Conversation View */}
                <div className={clsx(
                    "flex-1 flex flex-col bg-white h-full relative",
                    !selectedTicket && "hidden md:flex"
                )}>
                    {selectedTicket ? (
                        <>
                            {/* Header Details */}
                            <div className="p-4 sm:p-6 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between items-start shadow-sm z-10 shrink-0 gap-3 sm:gap-4">
                                <div className="min-w-0 w-full">
                                    <div className="flex items-start gap-2 mb-2">
                                        <button onClick={() => setSelectedTicket(null)} className="md:hidden p-1 -ms-1 text-gray-400 hover:text-gray-600 shrink-0 mt-1">
                                            <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <h2 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate">{selectedTicket.subject}</h2>
                                        <span className={clsx("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border whitespace-nowrap", getPriorityColor(selectedTicket.priority))}>
                                            {selectedTicket.priority} {t('crm.priorityLevel', 'Priority')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
                                        <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {selectedTicket.ticketNumber}</span>
                                        <span>•</span>
                                        <span className="text-gray-900 font-bold">{selectedTicket.customerId?.name}</span>
                                        <span>•</span>
                                        <span>{selectedTicket.type}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => handleUpdateStatus(status)}
                                            disabled={!hasPermission('support.update_status')}
                                            className={clsx(
                                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                                selectedTicket.status === status
                                                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
                                                !hasPermission('support.update_status') && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Thread */}
                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                                    {selectedTicket.messages.map((msg, idx) => {
                                        const isAgent = msg.sender === 'Agent';
                                        const isSystem = msg.sender === 'System';

                                        if (isSystem) {
                                            return (
                                                <div key={idx} className="flex justify-center my-4">
                                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                                        {msg.message}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={idx} className={clsx("flex gap-4 max-w-[85%]", isAgent ? "mis-auto flex-row-reverse" : "")}>
                                                <div className="shrink-0">
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm border",
                                                        isAgent ? "bg-indigo-600 text-white border-indigo-700" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                    )}>
                                                        {isAgent ? 'A' : selectedTicket.customerId?.name?.charAt(0) || 'C'}
                                                    </div>
                                                </div>
                                                <div className={clsx("flex flex-col gap-1", isAgent ? "items-end" : "items-start")}>
                                                    <span className="text-xs font-bold text-gray-500 px-1">
                                                        {isAgent ? t('crm.agentSender', 'Support Agent') : selectedTicket.customerId?.name} • {moment(msg.timestamp).format('MMM DD, HH:mm')}
                                                    </span>
                                                    <div className={clsx(
                                                        "p-4 rounded-2xl text-sm leading-relaxed shadow-sm w-full",
                                                        isAgent
                                                            ? "bg-indigo-600 text-white rounded-tr-sm rtl:rounded-tr-2xl rtl:rounded-tl-sm"
                                                            : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm rtl:rounded-tl-2xl rtl:rounded-tr-sm"
                                                    )}>
                                                        {msg.message}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Composer Bottom */}
                            <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                                {replyError && (
                                    <div className="mb-3 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span className="flex-1">{replyError}</span>
                                        <button onClick={() => setReplyError(null)} className="opacity-60 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                                    </div>
                                )}
                                <div className="max-w-3xl mx-auto border border-gray-200 rounded-2xl shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all bg-white relative overflow-hidden flex flex-col">
                                    <textarea
                                        className="w-full p-4 text-sm resize-none outline-none bg-transparent min-h-[120px]"
                                        placeholder={t('crm.replyPlaceholder', "Type your reply to the customer...")}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center mt-auto flex-wrap gap-2">
                                        <div className="flex gap-2">
                                            <button disabled={!hasPermission('support.send_reply')} className="text-xs font-bold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                                {t('crm.btnInsertTemplate', 'Insert Template')}
                                            </button>
                                            {selectedTicket.orderId && hasPermission('support.process_rma') && (
                                                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                                                    <ShieldAlert className="w-3.5 h-3.5" /> {t('crm.btnRmaOptions', 'RMA Options')}
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleSendReply}
                                            disabled={!replyText.trim() || !hasPermission('support.send_reply')}
                                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            {t('crm.btnSendReply', 'Send Reply')} <Send className="w-4 h-4 rtl:-scale-x-100" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                            <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
                            <p className="font-medium text-center px-4">{t('crm.selectTicketPrompt', 'Select a ticket from the inbox to start replying.')}</p>
                        </div>
                    )}
                </div>
            </div>
            )}
        </div>
    );
}
