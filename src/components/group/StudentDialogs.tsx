
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
  
  isReasonDialogOpen, setReasonDialogOpen,
  reasonStudent, reasonText, setReasonText,
  onReasonSave,
}) => (
  <>
    <RewardPenaltyDialog
      isOpen={!!showRewardDialog}
      onClose={() => { setShowRewardDialog(null); setRewardPoints(""); }}
      rewardPoints={rewardPoints}
      onRewardPointsChange={setRewardPoints}
      rewardType={rewardType}
      onRewardTypeChange={setRewardType}
      onSave={() => showRewardDialog && onRewardSave(showRewardDialog)}
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

export default StudentDialogs;
