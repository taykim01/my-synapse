import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingModal } from '@/components/OnboardingModal';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { useAuth } from '@/hooks/useAuth';

const Onboarding = () => {
  const navigate = useNavigate();
  const gameState = useGalaxyStore(s => s.gameState);
  const initFromDB = useGalaxyStore(s => s.initFromDB);
  const { user } = useAuth();

  useEffect(() => {
    if (user) initFromDB();
  }, [user]);

  useEffect(() => {
    if (gameState === 'exploring') {
      navigate('/network', { replace: true });
    }
  }, [gameState, navigate]);

  return <OnboardingModal />;
};

export default Onboarding;
