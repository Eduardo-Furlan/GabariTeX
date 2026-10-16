import React from 'react';
import { useProfile } from '../context/ProfileContext';
import { ClassroomManager } from '../components/classrooms/ClassroomManager';

export const ClassesScreen: React.FC = () => {
  const {
    classes,
    activeClassId,
    setActiveClassId,
    updateClasses,
    records,
    handleDisassociateRecordsFromClass,
  } = useProfile();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col flex-1">
      <ClassroomManager
        isOpen={true}
        asScreen={true}
        onClose={() => {}}
        classes={classes}
        activeClassId={activeClassId}
        onSelectActiveClass={setActiveClassId}
        onUpdateClasses={updateClasses}
        records={records}
        onDisassociateRecordsFromClass={handleDisassociateRecordsFromClass}
      />
    </div>
  );
};

