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
    const isTurkish = location.pathname === '/tr' || (location.pathname === '/' && i18n.language && i18n.language.startsWith('tr'));

    useEffect(() => {
        // Redirect from root to detected language
        if (location.pathname === '/') {
            const detectedLang = (i18n.language && i18n.language.startsWith('tr')) ? 'tr' : 'en';
            navigate(`/${detectedLang}`, { replace: true });
            return;
        }

        if (location.pathname === '/tr') {
            i18n.changeLanguage('tr');
        } else if (location.pathname === '/en') {
            i18n.changeLanguage('en');
        }
    }, [location.pathname, i18n, navigate]);

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
        <div className="min-h-screen bg-background text-text-primary flex flex-col relative overflow-hidden">
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

            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary opacity-[0.08] blur-[120px] rounded-full z-0"></div>
            <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-info opacity-[0.08] blur-[100px] rounded-full z-0"></div>

            {/* Navbar */}
            <nav className="z-10 relative py-6">
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                            <Smartphone className="text-white" size={24} />
                        </div>
                        <span className="font-extrabold text-2xl tracking-tighter text-text-primary">
                            Monopoly<span className="text-primary">Bank</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link to={alternatePath} className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors flex items-center gap-2">
                            <Globe size={18} />
                            <span className="hidden sm:inline">{isTurkish ? 'English' : 'Türkçe'}</span>
                            <span className="inline sm:hidden">{isTurkish ? 'EN' : 'TR'}</span>
                        </Link>
                        <button onClick={handlePlayNow} className="btn btn-primary shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                            {isTurkish ? 'Giriş Yap' : 'Login'}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col z-10 relative">
                <section className="container pt-12 pb-20 md:pt-20 md:pb-32 text-center">
                    <div className="animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-primary/20">
                            <Zap size={14} className="fill-current" />
                            {isTurkish ? 'V 1.3.0 - ARTIK DAHA HIZLI' : 'V 1.3.0 - NOW FASTER'}
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold mb-8 leading-[1.1] tracking-tight text-text-primary max-w-4xl mx-auto">
                            {isTurkish ? (
                                <>Monopoly Oyununu <span className="text-primary italic">Dijitalleştir</span></>
                            ) : (
                                <>Digitize Your <span className="text-primary italic">Monopoly</span> Game</>
                            )}
                        </h1>

                        <p className="text-lg md:text-2xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
                            {isTurkish
                                ? 'Kağıt paralarla vakit kaybetmeyin. Modern bankacılık deneyimi ile oyunun keyfini çıkarın.'
                                : 'Stop struggling with paper money. Enjoy the game with a modern banking experience.'}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button onClick={handlePlayNow} className="btn btn-primary btn-large px-10 text-lg shadow-2xl shadow-primary/30 hover:scale-105 transition-all flex items-center gap-3">
                                <Play size={20} className="fill-current" />
                                {isTurkish ? 'Hemen Oyna' : 'Play Now'}
                            </button>
                            <div className="text-text-tertiary text-sm font-medium">
                                {isTurkish ? 'Zaten bir hesabın var mı?' : 'Already have an account?'} <span className="text-primary cursor-pointer hover:underline" onClick={handlePlayNow}>{isTurkish ? 'Giriş Yap' : 'Login'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 md:mt-32 max-w-5xl mx-auto px-4">
                        <FeatureCard
                            delay="0.4s"
                            icon={<Zap size={28} />}
                            iconBg="bg-yellow-500/10 text-yellow-500"
                            title={isTurkish ? 'Hızlı Transfer' : 'Instant Transfer'}
                            desc={isTurkish ? 'Saniyeler içinde para gönderip alın, oyuna ara vermeyin.' : 'Send and receive money in seconds, never stop the game.'}
                        />
                        <FeatureCard
                            delay="0.5s"
                            icon={<Shield size={28} />}
                            iconBg="bg-green-500/10 text-green-500"
                            title={isTurkish ? 'Güvenli Altyapı' : 'Secure Infrastructure'}
                            desc={isTurkish ? 'Tüm işlemler kayıt altında, bankacı hilesine son!' : 'All transactions are recorded, no more banker cheating!'}
                        />
                        <FeatureCard
                            delay="0.6s"
                            icon={<Smartphone size={28} />}
                            iconBg="bg-blue-500/10 text-blue-500"
                            title={isTurkish ? 'Mobil Uyumlu' : 'Mobile First'}
                            desc={isTurkish ? 'Herhangi bir mobil cihazdan saniyeler içinde bağlanın.' : 'Connect from any mobile device in seconds.'}
                        />
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-border/50 z-10 relative">
                <div className="container flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg tracking-tight">MonopolyBank</span>
                        <p className="text-text-tertiary text-sm ml-4 pl-4 border-l border-border">
                            © 2025. {isTurkish ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
                        </p>
                    </div>
                    <div className="flex gap-8 text-sm font-medium text-text-tertiary">
                        <Link to={isTurkish ? "/tr" : "/en"} className="hover:text-primary transition-all">
                            {isTurkish ? 'Ana Sayfa' : 'Home'}
                        </Link>
                        <a href="#" className="hover:text-primary transition-all">{isTurkish ? 'Kullanım Koşulları' : 'Terms'}</a>
                        <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-all">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, iconBg, title, desc, delay }) => (
    <div
        className="bg-surface p-8 rounded-3xl shadow-sm border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 flex flex-col items-center text-center group animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        <div className={`${iconBg} p-4 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-500`}>
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-3 text-text-primary">{title}</h3>
        <p className="text-text-secondary text-base leading-relaxed">{desc}</p>
    </div>
);

export default LandingPage;
