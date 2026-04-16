import { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Globe, Shield, Smartphone, Zap, Play, ChevronDown, Check, DollarSign, Home } from 'lucide-react';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import '../styles/LandingPage.css';

const LandingPage = () => {
    const { t, i18n } = useTranslation();
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
                <title>Monopoly --Banking Deluxe-</title>
                <meta name="description" content={t('landing.hero_subtitle')} />
                <link rel="canonical" href={`https://monopoly-digital-banking.vercel.app${location.pathname}`} />
                <link rel="alternate" hrefLang="tr" href="https://monopoly-digital-banking.vercel.app/tr" />
                <link rel="alternate" hrefLang="en" href="https://monopoly-digital-banking.vercel.app/en" />
                <link rel="alternate" hrefLang="de" href="https://monopoly-digital-banking.vercel.app/de" />
                <link rel="alternate" hrefLang="x-default" href="https://monopoly-digital-banking.vercel.app/" />
                <meta property="og:title" content="Monopoly --Banking Deluxe-" />
                <meta property="og:description" content={t('landing.hero_subtitle')} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`https://monopoly-digital-banking.vercel.app${location.pathname}`} />
                <meta name="robots" content="index, follow" />
                <html lang={currentLang} />
            </Helmet>

            <div className="lp-glow-1"></div>
            <div className="lp-glow-2"></div>

            {/* Navbar */}
            <nav className="lp-nav">
                <div className="lp-container">
                    <Link to={isTurkish ? "/tr" : isGerman ? "/de" : "/en"} className="lp-logo">
                        <img src={logo} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-light" />
                        <img src={logoDark} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-dark" />
                    </Link>

                    <div className="lp-nav-actions">
                        {/* Language Switcher */}
                        <div className={`lp-lang-switcher ${isLangOpen ? 'active' : ''}`} ref={langRef}>
                            <button className="lp-lang-btn" onClick={() => setIsLangOpen(!isLangOpen)}>
                                <Globe size={16} />
                                <span className="lp-lang-text">{isTurkish ? 'Türkçe' : isGerman ? 'Deutsch' : 'English'}</span>
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

                        <button onClick={handlePlayNow} className="lp-btn-primary nav-btn">
                            {t('landing.play_now')}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main>
                <div className="lp-container">
                    <section className="lp-hero">

                        <h1 className="lp-title animate-up delay-2">
                            {t('landing.hero_title_1')} <span>{t('landing.hero_title_span')}</span> {t('landing.hero_title_2')}
                        </h1>

                        <p className="lp-subtitle animate-up delay-3">
                            {t('landing.hero_subtitle')}
                        </p>

                        <div className="lp-hero-btns animate-up delay-4">
                            <button onClick={handlePlayNow} className="lp-btn-primary flex items-center gap-3">
                                <Play size={20} fill="currentColor" />
                                {t('landing.play_now')}
                            </button>
                        </div>

                        {/* Feature Cards */}
                        <div className="lp-features">
                            <FeatureCard
                                index={1}
                                icon={<DollarSign size={32} />}
                                title={t('landing.features.banking_title')}
                                desc={t('landing.features.banking_desc')}
                            />
                            <FeatureCard
                                index={2}
                                icon={<Zap size={32} />}
                                title={t('landing.features.realtime_title')}
                                desc={t('landing.features.realtime_desc')}
                            />
                            <FeatureCard
                                index={3}
                                icon={<Globe size={32} />}
                                title={t('landing.features.lang_title')}
                                desc={t('landing.features.lang_desc')}
                            />
                            <FeatureCard
                                index={4}
                                icon={<Home size={32} />}
                                title={t('landing.features.properties_title')}
                                desc={t('landing.features.properties_desc')}
                            />
                            <FeatureCard
                                index={5}
                                icon={<Shield size={32} />}
                                title={t('landing.features.secure_title')}
                                desc={t('landing.features.secure_desc')}
                            />
                            <FeatureCard
                                index={6}
                                icon={<Smartphone size={32} />}
                                title={t('landing.features.mobile_title')}
                                desc={t('landing.features.mobile_desc')}
                            />
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="lp-footer">
                <div className="lp-footer-content">
                    <div className="lp-footer-left">
                        <Link to={isTurkish ? "/tr" : isGerman ? "/de" : "/en"} className="lp-logo">
                            <img src={logo} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-light" style={{ height: '24px' }} />
                            <img src={logoDark} alt="Monopoly --Banking Deluxe-" className="lp-logo-img lp-logo-dark" style={{ height: '24px' }} />
                        </Link>
                        <p className="lp-copyright">
                            © {new Date().getFullYear()}. {t('landing.footer_rights')}
                        </p>
                    </div>
                    <div className="lp-footer-links">
                        <Link to={isTurkish ? "/tr" : isGerman ? "/de" : "/en"} className="lp-footer-link">{t('landing.footer_home')}</Link>
                        <a href="https://buymeacoffee.com/tnyligokhan" target="_blank" rel="noreferrer" className="lp-footer-link" style={{ color: '#FFDD00' }}>{t('landing.footer_coffee')}</a>
                        <a href="#" className="lp-footer-link">{t('landing.footer_terms')}</a>
                        <a href="https://github.com/tnyligokhan/monopoly-digital-bank" target="_blank" rel="noreferrer" className="lp-footer-link">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, index }) => (
    <div className={`lp-feature-card animate-up premium-glass-card`} style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
        <div className="lp-feature-icon">
            {icon}
        </div>
        <h3 className="lp-feature-title">{title}</h3>
        <p className="lp-feature-desc">{desc}</p>
    </div>
);

export default LandingPage;
