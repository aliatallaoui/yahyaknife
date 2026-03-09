import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { KeyRound, Mail, User, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { register } = useContext(AuthContext);
    const { t, i18n } = useTranslation('translation', { keyPrefix: 'auth' });
    const isAr = i18n.language === 'ar';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await register(name, email, password);
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <div className="mx-auto h-12 w-12 bg-indigo-100 flex items-center justify-center rounded-full">
                        <User className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {t('registerTitle')}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {t('registerAlreadyHave')}{' '}
                        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            {t('registerSignInHere')}
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label className={clsx("block text-sm font-medium text-gray-700", isAr ? "text-right" : "text-left")}>{t('fullName')}</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className={clsx("absolute inset-y-0 flex items-center pointer-events-none", isAr ? "right-0 pr-3" : "left-0 pl-3")}>
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className={clsx("focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 border", isAr ? "pr-10 text-right" : "pl-10 text-left")}
                                    placeholder={t('phName')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={clsx("block text-sm font-medium text-gray-700", isAr ? "text-right" : "text-left")}>{t('emailAddress')}</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className={clsx("absolute inset-y-0 flex items-center pointer-events-none", isAr ? "right-0 pr-3" : "left-0 pl-3")}>
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className={clsx("focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 border", isAr ? "pr-10 text-right" : "pl-10 text-left")}
                                    placeholder={t('phEmail')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={clsx("block text-sm font-medium text-gray-700", isAr ? "text-right" : "text-left")}>{t('password')}</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className={clsx("absolute inset-y-0 flex items-center pointer-events-none", isAr ? "right-0 pr-3" : "left-0 pl-3")}>
                                    <KeyRound className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    minLength="6"
                                    className={clsx("focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 border", isAr ? "pr-10" : "pl-10")}
                                    placeholder={t('phWait')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin h-5 w-5 text-white" />
                            ) : (
                                <>
                                    {t('createAccount')}
                                    <ArrowRight className={clsx("h-5 w-5 transition-transform", isAr ? "mr-2 rotate-180 group-hover:-translate-x-1" : "ml-2 group-hover:translate-x-1")} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
