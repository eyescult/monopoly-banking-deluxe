import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { Plus, LogIn as LoginIcon, LogOut, User, Trophy, Clock, Gamepad2, Users, Menu, X, Info, Edit3, Globe, Coffee } from 'lucide-react';
import toast from 'react-hot-toast';
import CreateGameModal from '../components/CreateGameModal';
import JoinGameModal from '../components/JoinGameModal';
import AboutModal from '../components/AboutModal';
import Avatar from '../components/Avatar';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import { useTranslation } from 'react-i18next';

/**
 * Uygulamanın ana sayfa bileşeni.
 * Kullanıcı istatistiklerini gösterir, yeni oyun oluşturma ve katılma işlemlerini yönetir.
 */
export default function HomePage() {
    // Stores ve hooks
    const user = useAuthStore(state => state.user);
    const signOut = useAuthStore(state => state.signOut);
    const getRecentGames = useGameStore(state => state.getRecentGames);
    const getUserStats = useGameStore(state => state.getUserStats);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    // UI state yönetimi
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

    // Veri state yönetimi
    const [recentGames, setRecentGames] = useState([]);
    const [stats, setStats] = useState({
        totalGames: 0,
        wonGames: 0,
        totalPlayTime: 0
    });

    /**
     * Son tamamlanan oyunları veritabanından çeker.
     */
    const loadRecentGames = useCallback(async () => {
        const result = await getRecentGames(10);
        if (result.success) {
            setRecentGames(result.games);
        }
    }, [getRecentGames]);

    /**
     * Kullanıcının genel performans istatistiklerini hesaplar.
     */
    const loadUserStats = useCallback(async () => {
        if (!user?.id) return;
        const result = await getUserStats(user.id);
        if (result.success) {
            setStats(result.stats);
        }
    }, [user, getUserStats]);

    /**
     * Kullanıcı durumu değiştiğinde veya sayfa yüklendiğinde çalışır.
     * Aktif oyun kontrolü ve istatistik yükleme işlemlerini yapar.
     */
    useEffect(() => {
        if (user?.current_game_id) {
            navigate(`/game/${user.current_game_id}`);
        }
        if (user?.id) {
            // These are async data fetching operations, which is a valid useEffect pattern
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadRecentGames();
            loadUserStats();
        }
    }, [user, navigate, loadRecentGames, loadUserStats]);

    /**
     * Çıkış yapma işlemini yönetir.
     * Anonim kullanıcılar için onay mekanizması içerir.
     */
    const handleSignOut = async () => {
        if (user?.is_anonymous) {
            setShowSignOutConfirm(true);
            return;
        }
        const result = await signOut({ deleteGuestData: true });
        if (result.success) {
            navigate('/login');
        } else {
            toast.error(t('signout_error'), { id: 'signout-error' });
        }
    };

    /**
     * Çıkış işlemini onaylayan yardımcı fonksiyon.
     */
    const confirmSignOut = async () => {
        setShowSignOutConfirm(false);
        setShowSidebar(false);

        const result = await signOut({ deleteGuestData: true });
        if (result.success) {
            navigate('/login');
        } else {
            toast.error(t('signout_error'), { id: 'signout-error' });
        }
    };

    const handleChangeUsername = () => {
        setShowSidebar(false);
        navigate('/set-username');
    };

    const handleAbout = () => {
        setShowSidebar(false);
        setShowAboutModal(true);
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    /**
     * Oyun süresini okunabilir formata çevirir.
     */
    const formatDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return `0${t('minutes_short')}`;

        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;

        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}${t('hours')} ${minutes}${t('minutes')}`;
        }
        return `${minutes}${t('minutes')}`;
    };

    /**
     * Toplam oyun süresini formatlar.
     */
    const formatTotalDuration = (ms) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}${t('hours')} ${minutes}${t('minutes')}`;
        }
        return `${minutes}${t('minutes')}`;
    };

    return (
        <div className="home-page premium-bg">
            {/* Sidebar ve Overlay */}
            {showSidebar && (
                <div className="sidebar-overlay" onClick={() => setShowSidebar(false)}></div>
            )}

            <div className={`sidebar ${showSidebar ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <button className="sidebar-close" onClick={() => setShowSidebar(false)}>
                        <X size={24} />
                    </button>
                </div>

                <div className="sidebar-user">
                    <Avatar user={user} size={56} />
                    <div className="sidebar-user-info">
                        <div className="sidebar-username">{user?.name}</div>
                        <div className="sidebar-user-email">Kullanıcı</div>
                    </div>
                </div>

                <div className="sidebar-divider"></div>

                <nav className="sidebar-nav">
                    <button className="sidebar-item" onClick={handleChangeUsername}>
                        <Edit3 size={20} />
                        <span>{t('change_name')}</span>
                    </button>
                    <button className="sidebar-item" onClick={handleAbout}>
                        <Info size={20} />
                        <span>{t('about_app')}</span>
                    </button>
                    <a href="https://buymeacoffee.com/tnyligokhan" target="_blank" rel="noreferrer" className="sidebar-item" style={{ color: '#FFDD00' }}>
                        <Coffee size={20} />
                        <span>{t('buy_me_coffee') || (i18n.language === 'tr' ? 'Kahve Ismarla' : 'Buy Me a Coffee')}</span>
                    </a>

                    <div className="sidebar-item-group">
                        <div className="sidebar-item-header">
                            <Globe size={20} />
                            <span>{t('language')}</span>
                        </div>
                        <div className="language-options" style={{ paddingLeft: '44px', display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            <button
                                className={`btn btn-small ${i18n.language === 'de' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => changeLanguage('de')}
                                style={{ flex: 1 }}
                            >
                                {t('german')}
                            </button>
                            <button
                                className={`btn btn-small ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => changeLanguage('en')}
                                style={{ flex: 1 }}
                            >
                                {t('english')}
                            </button>
                            <button
                                className={`btn btn-small ${i18n.language === 'tr' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => changeLanguage('tr')}
                                style={{ flex: 1 }}
                            >
                                {t('turkish')}
                            </button>
                        </div>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <button className="sidebar-item danger" onClick={handleSignOut}>
                        <LogOut size={20} />
                        <span>{t('sign_out')}</span>
                    </button>
                </div>
            </div>

            {/* Sayfa Üst Bilgisi */}
            <div className="home-header">
                <div className="container">
                    <div className="header-content">
                        <div className="header-left">
                            <div className="header-logo-container">
                                <img src={logo} alt="Monopoly --Banking Deluxe-" className="header-logo light-mode-logo" />
                                <img src={logoDark} alt="Monopoly --Banking Deluxe-" className="header-logo dark-mode-logo" />
                            </div>
                        </div>
                        <div className="header-right">
                            <button className="menu-btn" onClick={() => setShowSidebar(true)}>
                                <Menu size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container">
                <div className="home-content fade-in">

                    {/* Hoşgeldiniz Bölümü */}
                    <div className="welcome-section">
                        <h2 className="welcome-title">{t('welcome_back', { name: user?.name })}</h2>
                        <p className="welcome-subtitle">{t('welcome_subtitle')}</p>
                    </div>

                    {/* İstatistik Kartları */}
                    <div className="stats-grid">
                        <div className="stat-card premium-glass-card" style={{ border: 'none' }}>
                            <div className="stat-icon">
                                <Gamepad2 size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.totalGames}</div>
                                <div className="stat-label">{t('total_games')}</div>
                            </div>
                        </div>

                        <div className="stat-card premium-glass-card" style={{ border: 'none' }}>
                            <div className="stat-icon stat-icon-success">
                                <Trophy size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.wonGames}</div>
                                <div className="stat-label">{t('won_games')}</div>
                            </div>
                        </div>

                        <div className="stat-card premium-glass-card" style={{ border: 'none' }}>
                            <div className="stat-icon stat-icon-warning">
                                <Clock size={24} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-value">{formatTotalDuration(stats.totalPlayTime)}</div>
                                <div className="stat-label">{t('total_time')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Oyun İşlemleri Butonları */}
                    <div className="game-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <button
                            className="premium-action-btn success-btn"
                            style={{ padding: '24px', flexDirection: 'row', justifyContent: 'flex-start' }}
                            onClick={() => setShowCreateModal(true)}
                        >
                            <div className="premium-action-icon" style={{ marginBottom: 0, marginRight: '16px', flexShrink: 0 }}>
                                <Plus size={24} />
                            </div>
                            <div className="action-content" style={{ textAlign: 'left' }}>
                                <div className="action-title">{t('create_game')}</div>
                                <div className="action-subtitle">{t('create_game_subtitle')}</div>
                            </div>
                        </button>

                        <button
                            className="premium-action-btn info-btn"
                            style={{ padding: '24px', flexDirection: 'row', justifyContent: 'flex-start' }}
                            onClick={() => setShowJoinModal(true)}
                        >
                            <div className="premium-action-icon" style={{ marginBottom: 0, marginRight: '16px', flexShrink: 0 }}>
                                <LoginIcon size={24} />
                            </div>
                            <div className="action-content" style={{ textAlign: 'left' }}>
                                <div className="action-title">{t('join_game')}</div>
                                <div className="action-subtitle">{t('join_game_subtitle')}</div>
                            </div>
                        </button>
                    </div>

                    {/* Son Oyunlar Listesi */}
                    {recentGames && recentGames.length > 0 && (
                        <div className="recent-games">
                            <h2 className="section-title">{t('recent_games')}</h2>
                            <div className="games-list">
                                {recentGames.map((game) => {
                                    const winner = game.players.find(p => p.user_id === game.winner_id);
                                    const playerNames = game.players.map(p => p.name).join(', ');
                                    const duration = formatDuration(game.starting_timestamp, game.ending_timestamp);

                                    return (
                                        <div key={game.id} className="game-card premium-glass-card" style={{ border: 'none' }}>
                                            <div className="game-card-header">
                                                <span className="game-id">#{game.id}</span>
                                                <Trophy size={16} color="var(--warning)" />
                                            </div>
                                            <div className="game-card-body">
                                                <div className="game-stat">
                                                    <span className="game-stat-label">{t('winner')}:</span>
                                                    <span className="game-stat-value">{winner?.name || t('unknown')}</span>
                                                </div>
                                                <div className="game-stat">
                                                    <span className="game-stat-label">{t('players')}:</span>
                                                    <span className="game-stat-value" style={{ fontSize: '0.75rem' }}>
                                                        {playerNames}
                                                    </span>
                                                </div>
                                                <div className="game-stat">
                                                    <span className="game-stat-label">{t('duration')}:</span>
                                                    <span className="game-stat-value">{duration}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modallar */}
            {showCreateModal && (
                <CreateGameModal onClose={() => setShowCreateModal(false)} />
            )}

            {showJoinModal && (
                <JoinGameModal onClose={() => setShowJoinModal(false)} />
            )}

            {showAboutModal && (
                <AboutModal onClose={() => setShowAboutModal(false)} />
            )}

            {showSignOutConfirm && (
                <div className="modal-overlay" onClick={() => setShowSignOutConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('signout_confirm_title')}</h2>
                        </div>

                        <div className="modal-body">
                            <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                                {t('signout_confirm_text1')}
                            </p>
                            <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                                {t('signout_confirm_text2')}
                            </p>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                {t('signout_confirm_text3')}
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowSignOutConfirm(false)}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={confirmSignOut}
                            >
                                {t('sign_out')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


