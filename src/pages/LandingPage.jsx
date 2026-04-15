import { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Globe, Shield, Smartphone, Zap, Play, ChevronDown, Check } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import '../styles/LandingPage.css';

const LandingPage = () => {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore(state => state.user);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef(null);

    // Determine language based on path
    const isGerman  = location.pathname === '/de' || (location.pathname === '/' && i18n.language && i18n.language.startsWith('de'));
    const isTurkish = location.pathname === '/tr' || (location.pathname === '/' && !isGerman && i18n.language && i18n.language.startsWith('tr'));

    useEffect(() => {
        // Redirect from root to detected language
        if (location.pathname === '/') {
            const detectedLang = i18n.language?.startsWith('de') ? 'de' : i18n.language?.startsWith('tr') ? 'tr' : 'en';
            navigate(`/${detectedLang}`, { replace: true });
            return;
        }

        if (location.pathname === '/tr') {
            i18n.changeLanguage('tr');
        } else if (location.pathname === '/de') {
            i18n.changeLanguage('de');
        } else if (location.pathname === '/en') {
            i18n.changeLanguage('en');
        }
    }, [location.pathname, i18n, navigate]);

    // Handle clicking outside of language switcher
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langRef.current && !langRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePlayNow = () => {
        if (user) {
            navigate('/app');
        } else {
            navigate('/login');
        }
    };

    const changeLanguage = (lang) => {
        navigate(`/${lang}`);
        setIsLangOpen(false);
    };

    const currentLang = isTurkish ? 'tr' : isGerman ? 'de' : 'en';

    return (
        <div className="lp-wrapper">
            <Helmet>
                <title>{isTurkish ? 'Monopoly --Banking Deluxe-' : 'Monopoly --Banking Deluxe-'}</title>
                <meta name="description" content={isTurkish
                    ? "Monopoly oyunlarınızı dijitalleştirin! Kağıt paraları unutun, hızlı ve güvenli para transferi ile oyun keyfini katlayın. Ücretsiz hemen başlayın."
                    : "Digitize your Monopoly games! Forget paper money, enjoy fast and secure money transfers. Start for free now."}
                />
                <link rel="canonical" href={`https://monopoly-digital-banking.vercel.app${location.pathname}`} />
                <link rel="alternate" hrefLang="tr" href="https://monopoly-digital-banking.vercel.app/tr" />
                <link rel="alternate" hrefLang="en" href="https://monopoly-digital-banking.vercel.app/en" />
                <link rel="alternate" hrefLang="x-default" href="https://monopoly-digital-banking.vercel.app/" />
                <meta property="og:title" content={isTurkish ? 'Monopoly --Banking Deluxe-' : 'Monopoly --Banking Deluxe-'} />
                <meta property="og:description" content={isTurkish ? 'Arkadaşlarınızla Monopoly oynarken parayı dijital yönetin.' : 'Manage money digitally while playing Monopoly with friends.'} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`https://monopoly-digital-banking.vercel.app${location.pathname}`} />
                <meta name="robots" content="index, follow" />
                <meta name="google-site-verification" content="Fer3arlmkb0QuXaZJeA9gWnEz7XtsjSraMlQEBF8D8g" />
                <html lang={currentLang} />
            </Helmet>

            <div className="lp-glow-1"></div>
            <div className="lp-glow-2"></div>

            {/* Navbar */}
            <nav className="lp-nav">
                <div className="lp-container">
                    <Link to={isTurkish ? "/tr" : "/en"} className="lp-logo">
                        <img src={logo} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-light" />
                        <img src={logoDark} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-dark" />
                    </Link>

                    <div className="lp-nav-actions">
                        {/* Language Switcher */}
                        <div className={`lp-lang-switcher ${isLangOpen ? 'active' : ''}`} ref={langRef}>
                            <button className="lp-lang-btn" onClick={() => setIsLangOpen(!isLangOpen)}>
                                <Globe size={16} />
                                <span>{isTurkish ? 'Türkçe' : isGerman ? 'Deutsch' : 'English'}</span>
                                <ChevronDown size={14} style={{ transform: isLangOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                            </button>
                            <div className="lp-lang-dropdown">
                                <div className="lp-lang-option" onClick={() => changeLanguage('de')}>
                                    <span>Deutsch</span>
                                    {isGerman && <Check size={14} color="var(--lp-primary)" />}
                                </div>
                                <div className="lp-lang-option" onClick={() => changeLanguage('en')}>
                                    <span>English</span>
                                    {!isTurkish && !isGerman && <Check size={14} color="var(--lp-primary)" />}
                                </div>
                                <div className="lp-lang-option" onClick={() => changeLanguage('tr')}>
                                    <span>Türkçe</span>
                                    {isTurkish && <Check size={14} color="var(--lp-primary)" />}
                                </div>
                            </div>
                        </div>

                        <button onClick={handlePlayNow} className="lp-btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}>
                            {isTurkish ? 'Hemen Oyna' : 'Play Now'}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main>
                <div className="lp-container">
                    <section className="lp-hero">

                        <h1 className="lp-title animate-up delay-2">
                            {isTurkish ? (
                                <>Monopoly Oyununu <span>Dijitalleştir</span></>
                            ) : (
                                <>Digitize Your <span>Monopoly</span> Game</>
                            )}
                        </h1>

                        <p className="lp-subtitle animate-up delay-3">
                            {isTurkish
                                ? 'Kağıt paralarla vakit kaybetmeyin. Modern bankacılık deneyimi ile oyunun keyfini çıkarın.'
                                : 'Stop struggling with paper money. Enjoy the game with a modern banking experience.'}
                        </p>

                        <div className="lp-hero-btns animate-up delay-4">
                            <button onClick={handlePlayNow} className="lp-btn-primary flex items-center gap-3">
                                <Play size={20} fill="currentColor" />
                                {isTurkish ? 'Hemen Oyna' : 'Play Now'}
                            </button>
                        </div>

                        {/* Feature Cards */}
                        <div className="lp-features">
                            <FeatureCard
                                index={1}
                                icon={<Zap size={32} />}
                                title={isTurkish ? 'Hızlı Transfer' : 'Instant Transfer'}
                                desc={isTurkish ? 'Saniyeler içinde para gönderip alın, oyuna ara vermeyin.' : 'Send and receive money in seconds, never stop the game.'}
                            />
                            <FeatureCard
                                index={2}
                                icon={<Shield size={32} />}
                                title={isTurkish ? 'Güvenli Altyapı' : 'Secure Infrastructure'}
                                desc={isTurkish ? 'Tüm işlemler kayıt altında, bankacı hilesine son!' : 'All transactions are recorded, no more banker cheating!'}
                            />
                            <FeatureCard
                                index={3}
                                icon={<Smartphone size={32} />}
                                title={isTurkish ? 'Mobil Uyumlu' : 'Mobile First'}
                                desc={isTurkish ? 'Herhangi bir mobil cihazdan saniyeler içinde bağlanın.' : 'Connect from any mobile device in seconds.'}
                            />
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="lp-footer">
                <div className="lp-footer-content">
                    <div className="lp-footer-left">
                        <Link to={isTurkish ? "/tr" : "/en"} className="lp-logo">
                            <img src={logo} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-light" style={{ height: '24px' }} />
                            <img src={logoDark} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-dark" style={{ height: '24px' }} />
                        </Link>
                        <p className="lp-copyright">
                            © 2025. {isTurkish ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
                        </p>
                    </div>
                    <div className="lp-footer-links">
                        <Link to={isTurkish ? "/tr" : "/en"} className="lp-footer-link">{isTurkish ? 'Ana Sayfa' : 'Home'}</Link>
                        <a href="https://buymeacoffee.com/tnyligokhan" target="_blank" rel="noreferrer" className="lp-footer-link" style={{ color: '#FFDD00' }}>{isTurkish ? 'Kahve Ismarla' : 'Buy Me a Coffee'}</a>
                        <a href="#" className="lp-footer-link">{isTurkish ? 'Kullanım Koşulları' : 'Terms'}</a>
                        <a href="https://github.com/tnyligokhan/monopoly-digital-bank" target="_blank" rel="noreferrer" className="lp-footer-link">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, index }) => (
    <div className={`lp-feature-card animate-up`} style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
        <div className="lp-feature-icon">
            {icon}
        </div>
        <h3 className="lp-feature-title">{title}</h3>
        <p className="lp-feature-desc">{desc}</p>
    </div>
);

export default LandingPage;


