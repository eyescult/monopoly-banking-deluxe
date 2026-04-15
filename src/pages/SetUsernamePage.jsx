import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Avatar from '../components/Avatar';

/**
 * Kullanıcı adı belirleme sayfası.
 * Yeni kayıt olan veya misafir girişi yapan kullanıcıların görünen adını belirlemesini sağlar.
 */
export default function SetUsernamePage() {
    const updateUsername = useAuthStore(state => state.setUsername);
    const updateAvatar = useAuthStore(state => state.updateAvatar);
    const user = useAuthStore(state => state.user);
    const [name, setName] = useState(user?.name || '');
    const [loading, setLoading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(user?.photo_url || '');
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    // İşlem sonrası dönülecek sayfa
    const from = location.state?.from?.pathname || '/';

    /**
     * Resim Seçme ve Sıkıştırma (Base64)
     */
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(t('invalid_image_type') || 'Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 256;
                const MAX_HEIGHT = 256;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG olarak sıkıştır
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setAvatarPreview(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    /**
     * Kullanıcı adını ve avatarını kaydeder ve ana sayfaya yönlendirir.
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
        
        let allSuccess = true;
        
        if (name.trim() !== user?.name) {
            const nameResult = await updateUsername(name.trim());
            if (!nameResult.success) {
                toast.error(nameResult.error || t('name_set_error'));
                allSuccess = false;
            }
        }

        if (avatarPreview && avatarPreview !== user?.photo_url) {
            const avatarResult = await updateAvatar(avatarPreview);
            if (!avatarResult.success) {
                toast.error(avatarResult.error || 'Avatar update failed');
                allSuccess = false;
            }
        }

        setLoading(false);

        if (allSuccess) {
            toast.success(t('welcome_back', { name: name.trim() }));
            navigate(from);
        }
    };

    return (
        <div className="username-page premium-bg">
            <div className="username-container fade-in premium-glass-card" style={{ padding: '2rem', border: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.getElementById('avatar-upload').click()}>
                        {avatarPreview ? (
                            <div className="avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)' }}>
                                <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        ) : (
                            <div className="username-icon" style={{ margin: 0, width: '80px', height: '80px', borderRadius: '50%' }}>
                                <User size={48} />
                            </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', color: 'white', borderRadius: '50%', padding: '6px', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justify: 'center' }}>
                            <Camera size={16} />
                        </div>
                    </div>
                    <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                    />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {t('change_avatar')}
                    </div>
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

