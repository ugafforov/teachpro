
import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  importText: string;
  setImportText: (t: string) => void;
}

const StudentImportTextarea: React.FC<Props> = ({ importText, setImportText }) => (
  <div>
    <Label htmlFor="importText">O'quvchilar nomi</Label>
    <Textarea
      id="importText"
      value={importText}
      onChange={e => setImportText(e.target.value)}
      placeholder={`Ali Valiyev
Olima Karimova
Sardor Usmonov`}
      rows={10}
      className="font-mono text-sm"
    />
  </div>
);

export default StudentImportTextarea;
