import React, { useEffect } from 'react';
import { useBank } from '../context/BankContext';
import { Route } from '../router/hashRouter';
import { BubbleLoader } from '../components/ui/BubbleLoader';

export interface BankScreenProps {
  onNavigate?: (route: Route) => void;
}

export const BankScreen: React.FC<BankScreenProps> = () => {
  const { isLoaded, isLoading, ensureLoaded } = useBank();

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  if (!isLoaded && isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <BubbleLoader size="lg" />
        <span className="text-meta font-medium text-slate-500 mt-4">
          Carregando Banco de Questões...
        </span>
      </div>
    );
  }

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col flex-1">
      <h1 className="font-display font-bold text-2xl text-slate-900">
        Banco de Questões
      </h1>
    </div>
  );
};

export default BankScreen;
