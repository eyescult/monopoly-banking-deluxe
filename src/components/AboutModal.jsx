import { X, Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AboutModal({ onClose }) {
    const { t } = useTranslation();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{t('about_title')}</h2>
                    <button onClick={onClose} className="btn btn-small btn-ghost">
                        <X size={24} />
                    </button>
                </div>

                <div className="about-content">
                    <div className="about-hero">
                        <h1 className="about-app-title">Monopoly Digital Banking</h1>
                        <div className="about-version">{t('version')} 1.2.1</div>
                    </div>

                    <div className="about-developer">
                        <p className="about-made-by">{t('developer')}</p>
                        <p className="about-developer-name">Gökhan Ton</p>
                    </div>

                    <div className="about-section">
                        <p className="about-description">
                            {t('about_desc_1')}
                        </p>
                        <p className="about-description">
                            {t('about_desc_2')}
                        </p>
                    </div>

                    <div className="about-section">
                        <h3 className="about-subtitle">{t('how_to_use')}</h3>
                        <ol className="about-list">
                            <li>{t('step_1')}</li>
                            <li>{t('step_2')}</li>
                            <li>{t('step_3')}</li>
                            <li>{t('step_4')}</li>
                            <li>{t('step_5')}</li>
                        </ol>
                    </div>

                    <div className="about-section">
                        <h3 className="about-subtitle">{t('features')}</h3>
                        <ul className="about-list">
                            <li>{t('feature_1')}</li>
                            <li>{t('feature_2')}</li>
                            <li>{t('feature_3')}</li>
                            <li>{t('feature_4')}</li>
                            <li>{t('feature_5')}</li>
                            <li>{t('feature_6')}</li>
                            <li>{t('feature_7')}</li>
                            <li>{t('feature_8')}</li>
                            <li>{t('feature_9')}</li>
                        </ul>
                    </div>

                    <div className="about-section">
                        <h3 className="about-subtitle">{t('why_monopoly_bank')}</h3>
                        <ul className="about-list">
                            <li>{t('reason_1')}</li>
                            <li>{t('reason_2')}</li>
                            <li>{t('reason_3')}</li>
                            <li>{t('reason_4')}</li>
                            <li>{t('reason_5')}</li>
                        </ul>
                    </div>

                    <div className="about-footer">
                        <p className="about-note">
                            {t('tip')}
                        </p>
                        <div className="about-credits">
                            <p className="about-year">{t('copyright')}</p>
                        </div>
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <a href="https://buymeacoffee.com/tnyligokhan" target="_blank" rel="noreferrer">
                                <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=tnyligokhan&button_color=FFDD00&font_color=000000&font_family=Cookie&outline_color=000000&coffee_color=ffffff" alt="Buy me a coffee" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

