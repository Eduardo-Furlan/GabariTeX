import React from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

const loadFeatures = () => import('./features').then((mod) => mod.default);

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  </MotionConfig>
);
