import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * Yeni bir oyun oturumu başlatmak için kullanılan modal.
 * Başlangıç parası, maaş ve otopark gibi oyun kurallarını belirler.
 */
export default function CreateGameModal({ onClose }) {
    const { user } = useAuthStore();
    const { createGame } = useGameStore();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Varsayılan oyun ayarları
    const [settings, setSettings] = useState({
        startingCapital: 15000000,
        salary: 2000000,
        enableFreeParking: false,
        timeLimit: 0
    });
    const [loading, setLoading] = useState(false);

    /**
     * Oyun oluşturma işlemini başlatır.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        const result = await createGame(settings, user.id);
        setLoading(false);

        if (result.success) {
            toast.success(t('game_created'));
            // Oluşturulan oyunun sayfasına yönlendir
            navigate(`/game/${result.gameId}`);
        } else {
            toast.error(result.error || t('create_error'));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{t('new_game_title')}</h2>
                    <button onClick={onClose} className="btn btn-small btn-ghost">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Başlangıç Sermayesi Ayarı */}
                    <div className="form-group">
                        <label className="form-label">{t('starting_capital')}</label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.startingCapital}
                            onChange={(e) => setSettings({ ...settings, startingCapital: parseInt(e.target.value) })}
                            min="100000"
                            step="100000"
                            required
                        />
                    </div>

                    {/* Maaş Ayarı */}
                    <div className="form-group">
                        <label className="form-label">{t('salary')}</label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.salary}
                            onChange={(e) => setSettings({ ...settings, salary: parseInt(e.target.value) })}
                            min="100000"
                            step="100000"
                            required
                        />
                    </div>

                    {/* Zaman Sınırı Ayarı */}
                    <div className="form-group">
                        <label className="form-label">{t('time_limit')}</label>
                        <select
                            className="form-input"
                            value={settings.timeLimit}
                            onChange={(e) => setSettings({ ...settings, timeLimit: parseInt(e.target.value) })}
                        >
                            <option value={0}>{t('time_limit_unlimited')}</option>
                            <option value={30}>{t('time_limit_mins', { amount: 30 })}</option>
                            <option value={45}>{t('time_limit_mins', { amount: 45 })}</option>
                            <option value={60}>{t('time_limit_mins', { amount: 60 })}</option>
                            <option value={90}>{t('time_limit_mins', { amount: 90 })}</option>
                            <option value={120}>{t('time_limit_mins', { amount: 120 })}</option>
                        </select>
                    </div>

                    {/* Otopark Kuralı Ayarı */}
                    <div className="form-group">
                        <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.enableFreeParking}
                                onChange={(e) => setSettings({ ...settings, enableFreeParking: e.target.checked })}
                            />
                            <span>{t('free_parking_enable')}</span>
                        </label>
                        <p className="text-sm text-secondary mt-1">
                            {t('free_parking_desc')}
                        </p>
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-outline flex-1"
                            onClick={onClose}
                            disabled={loading}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary flex-1"
                            disabled={loading}
                        >
                            {loading ? t('creating') : t('create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

