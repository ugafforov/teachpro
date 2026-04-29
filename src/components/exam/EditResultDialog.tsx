import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EditResultDialogProps {
  editingResult: { id: string; studentName: string; currentScore: number } | null;
  setEditingResult: (val: { id: string; studentName: string; currentScore: number } | null) => void;
  editScore: string;
  setEditScore: (val: string) => void;
  editReason: string;
  setEditReason: (val: string) => void;
  updateExamResult: () => void;
  updatingResult: boolean;
}

export const EditResultDialog: React.FC<EditResultDialogProps> = ({
  editingResult,
  setEditingResult,
  editScore,
  setEditScore,
  editReason,
  setEditReason,
  updateExamResult,
  updatingResult,
}) => {
  return (
    <Dialog
      open={!!editingResult}
      onOpenChange={(open) => {
        if (!open) setEditingResult(null);
      }}
    >
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-xl">Natijani tahrirlash</DialogTitle>
          <DialogDescription className="text-base text-foreground font-medium mt-1">
            {editingResult?.studentName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ball</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={1}
              value={editScore}
              onChange={(e) => setEditScore(e.target.value)}
              className="border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Izoh (sabab)</Label>
            <Input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="O'zgartirish sababi..."
              className="border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
            />
          </div>
          <Button
            onClick={updateExamResult}
            className="w-full h-10 mt-2 font-medium"
            disabled={updatingResult}
          >
            {updatingResult ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Saqlanmoqda...
              </span>
            ) : (
              "Saqlash"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
