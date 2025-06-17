
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GradeInputProps {
  studentId: string;
  teacherId: string;
  selectedDate: string;
  onGradeChange?: () => void;
}

const allowedGrades = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

const GradeInput: React.FC<GradeInputProps> = ({ 
  studentId, 
  teacherId, 
  selectedDate, 
  onGradeChange 
}) => {
  const [grade, setGrade] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchExistingGrade();
  }, [studentId, selectedDate]);

  const fetchExistingGrade = async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('grade')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('date_given', selectedDate)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setGrade(data.grade.toString());
      } else {
        setGrade('');
      }
    } catch (error) {
      console.error('Error fetching grade:', error);
    }
  };

  const handleGradeChange = async (value: string) => {
    if (value === '') {
      setGrade('');
      // O'chirish uchun
      try {
        setIsLoading(true);
        const { error } = await supabase
          .from('grades')
          .delete()
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .eq('date_given', selectedDate);

        if (error) throw error;
        
        if (onGradeChange) onGradeChange();
      } catch (error) {
        console.error('Error deleting grade:', error);
        toast({
          title: "Xatolik",
          description: "Bahoni o'chirishda xatolik yuz berdi. Internet aloqangizni tekshiring.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const numericGrade = parseFloat(value);
    if (!allowedGrades.includes(numericGrade)) {
      toast({
        title: "Noto'g'ri baho",
        description: "Faqat 2, 2.5, 3, 3.5, 4, 4.5, 5 baholarni kiritish mumkin.",
        variant: "destructive",
      });
      return;
    }

    setGrade(value);
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('grades')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          grade: numericGrade,
          date_given: selectedDate
        }, {
          onConflict: 'student_id,teacher_id,date_given'
        });

      if (error) throw error;

      // Reyting ballarini yangilash
      await updateStudentRewardPoints(studentId, teacherId);
      
      if (onGradeChange) onGradeChange();
      
      toast({
        title: "Muvaffaqiyat",
        description: "Baho muvaffaqiyatli saqlandi.",
      });
    } catch (error) {
      console.error('Error saving grade:', error);
      toast({
        title: "Xatolik",
        description: "Bahoni saqlashda xatolik yuz berdi. Internet aloqangizni tekshiring.",
        variant: "destructive",
      });
      setGrade(''); // Reset on error
    } finally {
      setIsLoading(false);
    }
  };

  const updateStudentRewardPoints = async (studentId: string, teacherId: string) => {
    try {
      // Baholarning yig'indisini hisoblash
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('grade')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (gradesError) throw gradesError;

      const totalGradePoints = gradesData?.reduce((sum, g) => sum + g.grade, 0) || 0;

      // Mavjud mukofot/jarima ballarini olish
      const { data: existingScore, error: scoreError } = await supabase
        .from('student_scores')
        .select('reward_penalty_points')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (scoreError) throw scoreError;

      const rewardPenaltyPoints = existingScore?.reward_penalty_points || 0;
      const newTotalScore = rewardPenaltyPoints + totalGradePoints;

      // Student_scores jadvalini yangilash
      await supabase
        .from('student_scores')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          reward_penalty_points: rewardPenaltyPoints,
          total_score: newTotalScore
        }, {
          onConflict: 'student_id,teacher_id'
        });

    } catch (error) {
      console.error('Error updating student reward points:', error);
    }
  };

  return (
    <Input
      type="number"
      step="0.5"
      min="2"
      max="5"
      value={grade}
      onChange={(e) => handleGradeChange(e.target.value)}
      placeholder="Baho"
      className="w-16 h-8 text-center text-sm"
      disabled={isLoading}
    />
  );
};

export default GradeInput;
