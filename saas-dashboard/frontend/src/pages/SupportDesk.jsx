import { useState, useEffect } from 'react';
import { Search, Filter, MessageSquare, Send, Clock, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import moment from 'moment';
import { useTranslation } from 'react-i18next';

export default function SupportDesk() {
    const { t } = useTranslation();
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/support`);
            const data = await res.json();
            setTickets(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch tickets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTicket = async (ticket) => {
        try {
            // Fetch populated ticket
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/support/${ticket._id}`);
            const data = await res.json();
            setSelectedTicket(data);
        } catch (error) {
            console.error("Error fetching ticket", error);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedTicket) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/support/${selectedTicket._id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: replyText,
                    sender: 'Agent'
                })
            });

            if (res.ok) {
                const updatedTicket = await res.json();
                setSelectedTicket(updatedTicket);
                setTickets(tickets.map(t => t._id === updatedTicket._id ? updatedTicket : t));
                setReplyText('');
            }
        } catch (error) {
            console.error("Failed to send reply", error);
        }
    };

    const handleUpdateStatus = async (status) => {
        if (!selectedTicket) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/support/${selectedTicket._id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                const updatedTicket = await res.json();
                setSelectedTicket(updatedTicket);
                setTickets(tickets.map(t => t._id === updatedTicket._id ? updatedTicket : t));
            }
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const filteredTickets = tickets.filter(t => {
        if (filter === 'All') return true;
        if (filter === 'Open') return t.status === 'Open' || t.status === 'In Progress';
        return t.status === filter;
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
        <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] bg-gray-50 overflow-hidden font-sans border border-gray-100 rounded-3xl m-2 md:m-6 shadow-sm">
            {/* Sidebar List */}
            <div className="w-full md:w-[400px] bg-white border-b md:border-b-0 md:border-e border-gray-200 flex flex-col h-1/2 md:h-full z-10 shadow-sm relative shrink-0">
                <div className="p-5 border-b border-gray-100 bg-white/50 backdrop-blur-md sticky top-0">
                    <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                        {t('crm.helpdeskInbox', 'Helpdesk Inbox')}
                    </h2>

                    <div className="relative mb-4">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={t('crm.searchTicket', "Search tickets or customers...")}
                            className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {[
                            { label: t('crm.filterAll', 'All'), value: 'All' },
                            { label: t('crm.filterOpen', 'Open'), value: 'Open' },
                            { label: t('crm.filterWaiting', 'Waiting on Customer'), value: 'Waiting on Customer' },
                            { label: t('crm.filterResolved', 'Resolved'), value: 'Resolved' }
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setFilter(f.value)}
                                className={clsx(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                    filter === f.value
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                            >
                                {f.label}
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
            <div className="flex-1 flex flex-col bg-white h-full relative">
                {selectedTicket ? (
                    <>
                        {/* Header Details */}
                        <div className="p-6 border-b border-gray-100 bg-white flex flex-col md:flex-row justify-between items-start shadow-sm z-10 shrink-0 gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedTicket.subject}</h2>
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
                                        className={clsx(
                                            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                            selectedTicket.status === status
                                                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
                                        <button className="text-xs font-bold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                                            {t('crm.btnInsertTemplate', 'Insert Template')}
                                        </button>
                                        {selectedTicket.orderId && (
                                            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                                                <ShieldAlert className="w-3.5 h-3.5" /> {t('crm.btnRmaOptions', 'RMA Options')}
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!replyText.trim()}
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
    );
}
