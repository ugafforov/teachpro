import React, { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RestoreDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
}

const RestoreDialog: React.FC<RestoreDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Tiklash",
    cancelText = "Bekor qilish"
}) => {
    const [date, setDate] = useState<Date>(new Date());

    const handleConfirm = () => {
        onConfirm(date);
        onClose();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-[400px] rounded-2xl apple-card">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-600">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4 space-y-2">
                    <label className="text-sm font-medium text-gray-700">Qaysi sanadan tiklansin?</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal border-gray-200 rounded-xl h-12",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "d-MMMM, yyyy", { locale: uz }) : <span>Sana tanlang</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && setDate(d)}
                                initialFocus
                                locale={uz}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel onClick={onClose} className="rounded-xl border-gray-200">
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                    >
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default RestoreDialog;
