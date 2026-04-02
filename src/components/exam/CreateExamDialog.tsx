import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Group, ExamType } from "./types";

interface CreateExamDialogProps {
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
  selectedGroup: string;
  setSelectedGroup: (val: string) => void;
  selectedExamType: string;
  setSelectedExamType: (val: string) => void;
  customExamName: string;
  setCustomExamName: (val: string) => void;
  examDate: string;
  setExamDate: (val: string) => void;
  groups: Group[];
  examTypes: ExamType[];
  creatingExam: boolean;
  createExam: () => void;
}

export const CreateExamDialog: React.FC<CreateExamDialogProps> = ({
  showCreateDialog,
  setShowCreateDialog,
  selectedGroup,
  setSelectedGroup,
  selectedExamType,
  setSelectedExamType,
  customExamName,
  setCustomExamName,
  examDate,
  setExamDate,
  groups,
  examTypes,
  creatingExam,
  createExam,
}) => {
  return (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto h-10 shadow-sm font-medium">
          <Plus className="w-4 h-4 mr-2" />
          Yangi imtihon
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Yangi imtihon yaratish</DialogTitle>
          <DialogDescription>
            Guruh, imtihon nomi va sanani tanlang.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Guruh</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Imtihon turi</Label>
            <Select
              value={selectedExamType}
              onValueChange={(v) => {
                setSelectedExamType(v);
                setCustomExamName("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Imtihon turini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {examTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Yoki yangi nom kiriting</Label>
            <Input
              value={customExamName}
              onChange={(e) => {
                setCustomExamName(e.target.value);
                setSelectedExamType("");
              }}
              placeholder="Masalan: Oraliq nazorat"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Imtihon sanasi</Label>
            <Input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button
            onClick={createExam}
            className="w-full h-10 mt-2 font-medium"
            disabled={
              creatingExam ||
              !selectedGroup ||
              (!selectedExamType && !customExamName) ||
              !examDate
            }
          >
            {creatingExam ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Yaratilmoqda...
              </span>
            ) : (
              "Davom etish"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
