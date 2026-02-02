import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Globe, Shield, Smartphone, Zap, Play } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';

const LandingPage = () => {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();

    // Determine language based on path
    const isTurkish = location.pathname === '/tr' || (location.pathname === '/' && i18n.language.startsWith('tr'));

    useEffect(() => {
        if (location.pathname === '/tr') {
            i18n.changeLanguage('tr');
        } else if (location.pathname === '/en') {
            i18n.changeLanguage('en');
        }
    }, [location.pathname, i18n]);

    const handlePlayNow = () => {
        if (user) {
            navigate('/app');
        } else {
            navigate('/login');
        }
    };

    const currentLang = isTurkish ? 'tr' : 'en';

    const alternatePath = isTurkish ? '/en' : '/tr';

    return (
        <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans">
            <Helmet>
                <title>{isTurkish ? 'Monopoly Dijital Banka - Online Hesap Takip' : 'Monopoly Digital Bank - Online Tracker'}</title>
                <meta name="description" content={isTurkish
                    ? "Monopoly oyunlarınızı dijitalleştirin! Kağıt paraları unutun, hızlı ve güvenli para transferi ile oyun keyfini katlayın. Ücretsiz hemen başlayın."
                    : "Digitize your Monopoly games! Forget paper money, enjoy fast and secure money transfers. Start for free now."}
                />
                <link rel="canonical" href={`https://monopoly-app.com${location.pathname === '/' ? '' : location.pathname}`} />
                <meta property="og:title" content={isTurkish ? 'Monopoly Dijital Banka' : 'Monopoly Digital Bank'} />
                <meta property="og:description" content={isTurkish ? 'Arkadaşlarınızla Monopoly oynarken parayı dijital yönetin.' : 'Manage money digitally while playing Monopoly with friends.'} />
                <meta property="og:type" content="website" />
                <meta name="robots" content="index, follow" />
                <meta name="google-site-verification" content="Fer3arlmkb0QuXaZJeA9gWnEz7XtsjSraMlQEBF8D8g" />
                <html lang={currentLang} />
            </Helmet>

            {/* Navbar */}
            <nav className="container py-4 flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-2">
                    <img src={logo} alt="Monopoly Bank" className="h-10 w-auto light-mode-logo" />
                    <img src={logoDark} alt="Monopoly Bank" className="h-10 w-auto dark-mode-logo" />
                    <span className="font-bold text-xl tracking-tight hidden sm:block">MonopolyBank</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to={alternatePath} className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
                        <Globe size={16} />
                        {isTurkish ? 'English' : 'Türkçe'}
                    </Link>
                    <button onClick={handlePlayNow} className="btn btn-primary btn-small shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">
                        {isTurkish ? 'Giriş Yap' : 'Login'}
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="flex-1 flex flex-col justify-center items-center text-center px-4 relative overflow-hidden py-12 md:py-20">
                <div className="absolute inset-0 z-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)]"></div>

                <span className="badge badge-info mb-6 px-4 py-1.5 text-sm font-bold tracking-wide animate-fade-in-up">
                    {isTurkish ? 'V 1.3.0 - Artık Daha Hızlı' : 'V 1.3.0 - Now Faster'}
                </span>

                <h1 className="text-4xl md:text-6xl font-extrabold mb-6 max-w-4xl leading-tight bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    {isTurkish ? 'Monopoly Oyununu Dijitalleştir' : 'Digitize Your Monopoly Game'}
                </h1>

                <p className="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    {isTurkish
                        ? 'Kağıt paralarla uğraşmayın. Hızlı, güvenli ve modern bankacılık deneyimi ile oyunun tadını çıkarın.'
                        : 'Stop struggling with paper money. Enjoy the game with a fast, secure, and modern banking experience.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    <button onClick={handlePlayNow} className="btn btn-primary btn-large text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 group">
                        <Play size={20} className="fill-current mr-2" />
                        {isTurkish ? 'Hemen Oyna' : 'Play Now'}
                    </button>
                    {/* Add more buttons if needed */}
                </div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-6xl mx-auto w-full px-4 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                    <FeatureCard
                        icon={<Zap size={32} className="text-yellow-500" />}
                        title={isTurkish ? 'Hızlı Transfer' : 'Instant Transfer'}
                        desc={isTurkish ? 'Saniyeler içinde para gönderip alın.' : 'Send and receive money in seconds.'}
                    />
                    <FeatureCard
                        icon={<Shield size={32} className="text-green-500" />}
                        title={isTurkish ? 'Güvenli Altyapı' : 'Secure Infrastructure'}
                        desc={isTurkish ? 'Tüm işlemler kayıt altında, hile yok.' : 'All transactions are recorded, no cheating.'}
                    />
                    <FeatureCard
                        icon={<Smartphone size={32} className="text-blue-500" />}
                        title={isTurkish ? 'Mobil Uyumlu' : 'Mobile Friendly'}
                        desc={isTurkish ? 'Her cihazdan sorunsuz erişim.' : 'Seamless access from any device.'}
                    />
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 text-center text-text-tertiary text-sm border-t border-border mt-auto">
                <div className="container">
                    <p>© 2025 Monopoly Digital Bank. {isTurkish ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</p>
                    <div className="mt-2 space-x-4">
                        <Link to={isTurkish ? "/tr" : "/en"} className="hover:text-primary transition-colors">{isTurkish ? 'Ana Sayfa' : 'Home'}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="bg-surface p-6 rounded-2xl shadow-lg border border-border hover:border-primary/50 transition-colors flex flex-col items-center text-center">
        <div className="mb-4 bg-background p-3 rounded-full">{icon}</div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-text-secondary text-sm">{desc}</p>
    </div>
);

// Minimal animation styles injected locally for simplicity
const style = document.createElement('style');
style.innerHTML = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
        animation: fadeInUp 0.6s ease-out forwards;
        opacity: 0;
    }
`;
document.head.appendChild(style);

export default LandingPage;
