import React from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

import domMax from './features';

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax} strict>
      {children}
    </LazyMotion>
  </MotionConfig>
);
