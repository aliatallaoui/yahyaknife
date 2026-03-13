import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LandingHeader from '../components/landing/LandingHeader';
import HeroSection from '../components/landing/HeroSection';
import StatsSection from '../components/landing/StatsSection';
import FeaturesBento from '../components/landing/FeaturesBento';
import ComparisonSection from '../components/landing/ComparisonSection';
import PricingSection from '../components/landing/PricingSection';
import CTASection from '../components/landing/CTASection';
import LandingFooter from '../components/landing/LandingFooter';

export default function LandingPage() {
    const { i18n } = useTranslation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const isRtl = i18n.language === 'ar';

    return (
        <div className={`min-h-screen bg-white text-gray-900 font-sans overflow-hidden ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
            <LandingHeader />

            <main>
                <HeroSection />
                <StatsSection />
                <FeaturesBento />
                <ComparisonSection />
                <PricingSection />
                <CTASection />
            </main>

            <LandingFooter />
        </div>
    );
}
