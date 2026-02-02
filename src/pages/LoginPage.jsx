import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogIn, Mail, Lock, User as UserIcon, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { useTranslation } from 'react-i18next';

/**
 * Giriş ve Kayıt sayfası.
 * Anonim giriş, e-posta/şifre ile giriş ve kayıt işlemlerini yönetir.
 */
export default function LoginPage() {
    // UI State yönetimi
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // Form State yönetimi
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    // Stores ve hooks
    const { signInAnonymously, signInWithEmail, signUpWithEmail } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    // Giriş yapıldıktan sonra yönlendirilecek sayfa (varsayılan: ana sayfa)
    const from = location.state?.from?.pathname || '/';

    /**
     * Misafir oyuncu olarak hızlı giriş yapar.
     */
    const handleAnonymousSignIn = async () => {
        setLoading(true);
        const result = await signInAnonymously();

        if (result.success) {
            // Küçük bir gecikme ile kullanıcı adı belirleme sayfasına yönlendir
            await new Promise(resolve => setTimeout(resolve, 100));
            navigate('/set-username', { state: { from: location.state?.from } });
        } else {
            toast.error(result.error || t('login_error'));
        }

        setLoading(false);
    };

    /**
     * E-posta ve şifre ile giriş veya kayıt işlemini yönetir.
     */
    const handleEmailAuth = async (e) => {
        e.preventDefault();

        // Validasyonlar
        if (!email || !password) {
            toast.error(t('fill_all_fields'), { id: 'login-missing-fields' });
            return;
        }

        if (isSignUp && (!firstName || !lastName)) {
            toast.error(t('enter_name_surname'));
            return;
        }

        if (password.length < 6) {
            toast.error(t('password_min_length'));
            return;
        }

        setLoading(true);

        if (isSignUp) {
            // Kayıt olma işlemi
            const fullName = `${firstName.trim()} ${lastName.trim()}`;
            const result = await signUpWithEmail(email, password, fullName);
            setLoading(false);

            if (result.success) {
                toast.success(t('signup_success'), { id: 'signup-success' });
                setIsSignUp(false);
                // Formu temizle
                setEmail('');
                setPassword('');
                setFirstName('');
                setLastName('');
            } else {
                toast.error(result.error || t('signup_error'));
            }
        } else {
            // Giriş yapma işlemi
            const result = await signInWithEmail(email, password);
            setLoading(false);

            if (result.success) {
                navigate(from);
            } else {
                toast.error(result.error || t('login_error'), { id: 'login-error' });
            }
        }
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="login-page">
            <div className="language-switcher" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
                <button
                    className={`btn btn-small ${i18n.language === 'tr' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => changeLanguage('tr')}
                    style={{ marginRight: '8px' }}
                >
                    TR
                </button>
                <button
                    className={`btn btn-small ${i18n.language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => changeLanguage('en')}
                >
                    EN
                </button>
            </div>

            <div className="login-container fade-in">
                <div className="login-logo">
                    <img src={logo} alt="Monopoly Digital Bank" className="app-logo light-mode-logo" />
                    <img src={logoDark} alt="Monopoly Digital Bank" className="app-logo dark-mode-logo" />
                </div>

                <p className="login-subtitle">
                    {isSignUp ? t('login_subtitle_signup') : t('login_subtitle_login')}
                </p>

                <form onSubmit={handleEmailAuth} className="login-buttons">
                    {/* Kayıt Modu Alanları */}
                    {isSignUp && (
                        <>
                            <div className="form-group">
                                <div className="input-with-icon">
                                    <UserIcon size={20} className="input-icon" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('first_name')}
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="input-with-icon">
                                    <UserIcon size={20} className="input-icon" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('last_name')}
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Ortak Alanlar */}
                    <div className="form-group">
                        <div className="input-with-icon">
                            <Mail size={20} className="input-icon" />
                            <input
                                type="email"
                                className="form-input"
                                placeholder={t('email')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="input-with-icon">
                            <Lock size={20} className="input-icon" />
                            <input
                                type="password"
                                className="form-input"
                                placeholder={t('password')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-large"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                        ) : (
                            <>
                                <Mail size={20} />
                                {isSignUp ? t('register') : t('login')}
                            </>
                        )}
                    </button>

                    {/* Mod Değiştirme Butonu */}
                    <button
                        type="button"
                        className="btn btn-ghost btn-large"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setEmail('');
                            setPassword('');
                            setFirstName('');
                            setLastName('');
                        }}
                        disabled={loading}
                    >
                        {isSignUp ? t('have_account') : t('no_account')}
                    </button>

                    <div className="divider">
                        <span>{t('or')}</span>
                    </div>

                    {/* Misafir Girişi */}
                    <button
                        type="button"
                        className="btn btn-outline btn-large"
                        onClick={handleAnonymousSignIn}
                        disabled={loading}
                    >
                        <LogIn size={20} />
                        {t('continue_as_guest')}
                    </button>
                </form>

                <div className="login-footer">
                    {isSignUp ? (
                        <p>{t('email_verification_note')}</p>
                    ) : (
                        <p>{t('guest_warning')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

