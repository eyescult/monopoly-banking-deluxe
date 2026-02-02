import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * Kullanıcı adı belirleme sayfası.
 * Yeni kayıt olan veya misafir girişi yapan kullanıcıların görünen adını belirlemesini sağlar.
 */
export default function SetUsernamePage() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUsername: updateUsername, user } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    // İşlem sonrası dönülecek sayfa
    const from = location.state?.from?.pathname || '/';

    /**
     * Kullanıcı adını kaydeder ve ana sayfaya yönlendirir.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validasyonlar
        if (!name.trim()) {
            toast.error(t('enter_name'));
            return;
        }

        if (name.length < 2) {
            toast.error(t('name_min_length'));
            return;
        }

        if (name.length > 30) {
            toast.error(t('name_max_length'));
            return;
        }

        setLoading(true);
        const result = await updateUsername(name.trim());
        setLoading(false);

        if (result.success) {
            toast.success(t('welcome_back', { name: name.trim() }));
            navigate(from);
        } else {
            toast.error(result.error || t('name_set_error'));
        }
    };

    return (
        <div className="username-page">
            <div className="username-container fade-in">
                <div className="username-icon">
                    <User size={48} />
                </div>

                <h1 className="username-title">
                    {user?.name ? t('set_name_title_change') : t('set_name_title_enter')}
                </h1>
                <p className="username-subtitle">
                    {t('set_name_subtitle')}
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-input username-input"
                            placeholder={t('name_placeholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={30}
                            autoFocus
                            disabled={loading}
                        />
                        <div className="username-hint">
                            {name.length}/30
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-large"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                        ) : (
                            user?.name ? t('update') : t('continue')
                        )}
                    </button>
                </form>

                <p className="username-footer">
                    {t('later_note')}
                </p>
            </div>
        </div>
    );
}

