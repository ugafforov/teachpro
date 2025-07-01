
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
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchExistingGrade();
  }, [studentId, selectedDate, teacherId]);

  const fetchExistingGrade = async () => {
    if (!studentId || !teacherId || !selectedDate) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('grade')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('date_given', selectedDate)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching grade:', error);
        return;
      }
      
      if (data) {
        setGrade(data.grade.toString());
      } else {
        setGrade('');
      }
    } catch (error) {
      console.error('Error fetching grade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeChange = async (value: string) => {
    if (isSaving) return;

    // Handle empty value (delete grade)
    if (value === '' || value === '0') {
      setGrade('');
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('grades')
          .delete()
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .eq('date_given', selectedDate);

        if (error && error.code !== 'PGRST116') {
          console.error('Error deleting grade:', error);
          toast({
            title: "Xatolik",
            description: "Bahoni o'chirishda xatolik yuz berdi",
            variant: "destructive",
          });
          return;
        }
        
        await updateStudentTotalScore(studentId, teacherId);
        if (onGradeChange) onGradeChange();
        
      } catch (error) {
        console.error('Error deleting grade:', error);
        toast({
          title: "Xatolik",
          description: "Bahoni o'chirishda xatolik yuz berdi",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const numericGrade = parseFloat(value);
    if (isNaN(numericGrade) || !allowedGrades.includes(numericGrade)) {
      toast({
        title: "Noto'g'ri baho",
        description: "Faqat 2, 2.5, 3, 3.5, 4, 4.5, 5 baholarni kiritish mumkin.",
        variant: "destructive",
      });
      return;
    }

    setGrade(value);
    setIsSaving(true);
    
    try {
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

      if (error) {
        console.error('Error saving grade:', error);
        toast({
          title: "Xatolik",
          description: "Bahoni saqlashda xatolik yuz berdi",
          variant: "destructive",
        });
        setGrade('');
        return;
      }

      await updateStudentTotalScore(studentId, teacherId);
      
      if (onGradeChange) onGradeChange();
      
      toast({
        title: "Muvaffaqiyat",
        description: "Baho muvaffaqiyatli saqlandi",
      });
      
    } catch (error) {
      console.error('Error saving grade:', error);
      toast({
        title: "Xatolik",
        description: "Bahoni saqlashda xatolik yuz berdi",
        variant: "destructive",
      });
      setGrade('');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStudentTotalScore = async (studentId: string, teacherId: string) => {
    try {
      // Get all grades for this student
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('grade')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (gradesError) {
        console.error('Error fetching grades for total score:', gradesError);
        return;
      }

      const totalGradePoints = gradesData?.reduce((sum, g) => sum + g.grade, 0) || 0;

      // Get existing reward/penalty points
      const { data: existingScore, error: scoreError } = await supabase
        .from('student_scores')
        .select('reward_penalty_points')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (scoreError && scoreError.code !== 'PGRST116') {
        console.error('Error fetching existing score:', scoreError);
        return;
      }

      const rewardPenaltyPoints = existingScore?.reward_penalty_points || 0;
      const newTotalScore = rewardPenaltyPoints + totalGradePoints;

      // Update or insert student score
      const { error: updateError } = await supabase
        .from('student_scores')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          reward_penalty_points: rewardPenaltyPoints,
          total_score: newTotalScore
        }, {
          onConflict: 'student_id,teacher_id'
        });

      if (updateError) {
        console.error('Error updating student total score:', updateError);
      }

    } catch (error) {
      console.error('Error updating student total score:', error);
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
      disabled={isLoading || isSaving}
    />
  );
};

export default GradeInput;
