import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useStore } from '../store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useTour = () => {
    const { user } = useStore();

    useEffect(() => {
        if (!user || user.onboardingCompleted) return;

        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: false,
            doneBtnText: "C'est parti !",
            nextBtnText: "Suivant",
            prevBtnText: "Précédent",
            progressText: "{{current}} sur {{total}}",
            steps: [
                {
                    element: '[data-tour="dashboard"]',
                    popover: {
                        title: 'Bienvenue sur Sentinel GRC',
                        description: 'Prenons une minute pour découvrir votre nouveau centre de commandement Cyber & Conformité.',
                        side: "left",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="sidebar-nav"]',
                    popover: {
                        title: 'Navigation Principale',
                        description: 'Accédez ici à tous les modules : Risques, Actifs, Conformité, Projets et plus encore.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="quick-actions"]',
                    popover: {
                        title: 'Actions Rapides',
                        description: 'Créez un incident, lancez un audit ou ajoutez un risque en un clic.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="header-profile"]',
                    popover: {
                        title: 'Votre Profil',
                        description: 'Gérez vos préférences, notifications et le thème de l\'application ici.',
                        side: "left",
                        align: 'start'
                    }
                }
            ],
            onDestroyed: async () => {
                if (user?.uid) {
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, {
                            onboardingCompleted: true
                        });
                        // User store update will happen via onSnapshot in AuthContext essentially
                        // But we can force a local update if needed, though AuthContext should handle it.
                    } catch (error) {
                        console.error("Failed to mark onboarding as completed", error);
                    }
                }
            }
        });

        // Small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            driverObj.drive();
        }, 1500);

        return () => clearTimeout(timer);
    }, [user?.uid, user?.onboardingCompleted, user]);
};
