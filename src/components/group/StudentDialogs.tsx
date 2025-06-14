
import React from "react";
import RewardPenaltyDialog from "./RewardPenaltyDialog";
import AbsentReasonDialog from "./AbsentReasonDialog";

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
}

type RewardType = "reward" | "penalty";

interface StudentDialogsProps {
  showRewardDialog: string | null;
  setShowRewardDialog: (id: string | null) => void;
  rewardPoints: string;
  setRewardPoints: (points: string) => void;
  rewardType: RewardType;
  setRewardType: (type: RewardType) => void;
  onRewardSave: (sid: string) => void;
  isSaving: boolean;

  isReasonDialogOpen: boolean;
  setReasonDialogOpen: (open: boolean) => void;
  reasonStudent: Student | null;
  reasonText: string;
  setReasonText: (r: string) => void;
  onReasonSave: () => void;
}

const StudentDialogs: React.FC<StudentDialogsProps> = ({
  showRewardDialog, setShowRewardDialog,
  rewardPoints, setRewardPoints,
  rewardType, setRewardType,
  onRewardSave,
  isSaving,
  
  isReasonDialogOpen, setReasonDialogOpen,
  reasonStudent, reasonText, setReasonText,
  onReasonSave,
}) => {

  const handleRewardSave = () => {
    console.log('StudentDialogs handleRewardSave called, showRewardDialog:', showRewardDialog);
    if (showRewardDialog) {
      onRewardSave(showRewardDialog);
    }
  };

  return (
    <>
      <RewardPenaltyDialog
        isOpen={!!showRewardDialog}
        onClose={() => { 
          if (isSaving) return;
          setShowRewardDialog(null); 
          setRewardPoints(""); 
        }}
        rewardPoints={rewardPoints}
        onRewardPointsChange={setRewardPoints}
        rewardType={rewardType}
        onRewardTypeChange={setRewardType}
        onSave={handleRewardSave}
        isSaving={isSaving}
      />
      <AbsentReasonDialog
        isOpen={isReasonDialogOpen}
        onOpenChange={setReasonDialogOpen}
        student={reasonStudent}
        reasonText={reasonText}
        onReasonTextChange={setReasonText}
        onSave={onReasonSave}
      />
    </>
  );
};

export default StudentDialogs;
