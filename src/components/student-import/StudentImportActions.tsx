
import React from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onImport: () => void;
  onCancel: () => void;
  loading: boolean;
  disabled: boolean;
}

const StudentImportActions: React.FC<Props> = ({ onImport, onCancel, loading, disabled }) => (
  <div className="flex space-x-2">
    <Button
      onClick={onImport}
      disabled={loading || disabled}
      className="flex-1"
    >
      {loading ? "Import qilinmoqda..." : "Import qilish"}
    </Button>
    <Button
      onClick={onCancel}
      variant="outline"
      className="flex-1"
    >
      Bekor qilish
    </Button>
  </div>
);

export default StudentImportActions;
