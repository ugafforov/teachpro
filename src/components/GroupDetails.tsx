import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar as CalendarIcon, RotateCcw, Star, AlertTriangle, Archive, Trash2, ChevronDown, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { db } from '@/lib/firebase';
import ConfirmDialog from './ConfirmDialog';
import RestoreDialog from './RestoreDialog';
import {
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
    addDoc,
    serverTimestamp,
    getDoc,
    writeBatch,
    updateDoc,
    deleteDoc,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import StudentImport from './StudentImport';
import StudentDetailsPopup from './StudentDetailsPopup';
import GroupStatisticsCard from './GroupStatisticsCard';
import AttendanceJournal from './AttendanceJournal';
import { studentSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { fetchAllRecords, calculateGroupStatistics, GroupStatistics } from '@/lib/firebaseHelpers';
import { PRESENT_POINTS, LATE_POINTS } from '@/lib/studentScoreCalculator';

interface Student {
    id: string;
    name: string;
    student_id?: string;
    email?: string;
    phone?: string;
    group_name: string;
    teacher_id: string;
    created_at: any;
    join_date?: string; // O'quvchi qo'shilgan sana (YYYY-MM-DD format)
    is_active?: boolean;
    rewardPenaltyPoints?: number;
    averageScore?: number;
    totalRewards?: number;
    totalPenalties?: number;
    bahoScore?: number;
    mukofotScore?: number;
    jarimaScore?: number;
    archived_at?: any; // Sana o'quvchi arxivlandi
    archiveDocId?: string; // ID of the document in archived_students collection
}

type AttendanceStatus = 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason' | 'absent';

interface AttendanceRecord {
    id: string;
    student_id: string;
    teacher_id: string;
    date: string;
    status: AttendanceStatus;
    created_at: any;
    updated_at: any;
}

interface GroupDetailsProps {
    groupName: string;
    teacherId: string;
    onBack: () => void;
    onStatsUpdate: () => Promise<void>;
    availableGroups?: Array<{ id: string; name: string }>;
    onGroupChange?: (groupName: string) => void;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({
    groupName,
    teacherId,
    onBack,
    onStatsUpdate,
    availableGroups = [],
    onGroupChange
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [activeTab, setActiveTab] = useState<'journal' | 'attendance'>('journal');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
    const [rewardPoints, setRewardPoints] = useState('');
    const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [groupStats, setGroupStats] = useState<GroupStatistics | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
    const [showAbsentDialog, setShowAbsentDialog] = useState<string | null>(null);
    const [showReasonInput, setShowReasonInput] = useState(false);
    const [absentReason, setAbsentReason] = useState('');
    const [editingScoreCell, setEditingScoreCell] = useState<{ studentId: string, type: 'baho' | 'mukofot' | 'jarima' } | null>(null);
    const [scoreInputValue, setScoreInputValue] = useState('');
    const [showScoreChangeDialog, setShowScoreChangeDialog] = useState<{ studentId: string, newScore: number, type: 'baho' | 'mukofot' | 'jarima', existingRecordId?: string } | null>(null);
    const [scoreChangeReason, setScoreChangeReason] = useState('');
    const [dailyScores, setDailyScores] = useState<Record<string, { baho?: { points: number, id: string }, mukofot?: { points: number, id: string }, jarima?: { points: number, id: string } }>>({});
    const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);
    // TODO: Kelajakda bu period ni props orqali Dashboard dan olish kerak
    // Hozircha har bir guruh o'zining alohida period ni saqlaydi
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [newStudent, setNewStudent] = useState({
        name: '',
        join_date: format(new Date(), 'yyyy-MM-dd'),
        student_id: '',
        email: '',
        phone: ''
    });
    const { toast } = useToast();
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        type: 'archive' | 'delete';
        studentId: string;
        studentName: string;
    }>({
        isOpen: false,
        type: 'archive',
        studentId: '',
        studentName: ''
    });
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [restoreDialog, setRestoreDialog] = useState<{
        isOpen: boolean;
        studentId: string;
        studentName: string;
        archiveDocId?: string;
    }>({
        isOpen: false,
        studentId: '',
        studentName: '',
    });
    const isNavigatingRef = useRef(false);

    // 1. Initial load of students (only when group/teacher changes)
    useEffect(() => {
        const loadGroupData = async () => {
            // setLoading(true); // Removed to prevent full page reload on group switch
            await fetchStudents();
            setLoading(false);
        };
        loadGroupData();
    }, [groupName, teacherId, selectedPeriod]);

    // 2. Load daily data when date or students change (no global loading)
    useEffect(() => {
        const loadDailyData = async () => {
            await fetchAttendanceForDate(selectedDate);
            if (students.length > 0) {
                fetchDailyScores(selectedDate);
            }
        };
        loadDailyData();
    }, [selectedDate, teacherId, students]);

    // 3. Load calendar highlights when students change
    useEffect(() => {
        if (students.length > 0) {
            fetchAttendanceDates();
        }
    }, [students]);

    const fetchAttendanceDates = async () => {
        try {
            const q = query(
                collection(db, 'attendance_records'),
                where('teacher_id', '==', teacherId)
            );
            const snapshot = await getDocs(q);
            const records = snapshot.docs.map(d => d.data());

            // Filter by group students in memory
            const groupStudentIds = new Set(students.map(s => s.id));
            const uniqueDates = [...new Set(records.filter(r => groupStudentIds.has(r.student_id)).map(r => r.date))];
            setAttendanceDates(uniqueDates.map(date => parseISO(date)));
        } catch (error) {
            console.error('Error fetching attendance dates:', error);
        }
    };

    const fetchStudents = async () => {
        try {
            // Fetch active students
            const q = query(
                collection(db, 'students'),
                where('teacher_id', '==', teacherId),
                where('group_name', '==', groupName),
                where('is_active', '==', true)
            );
            const snapshot = await getDocs(q);
            const studentsData = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Student))
                .sort((a, b) => a.name.localeCompare(b.name));

            // Fetch archived students
            const archivedQ = query(
                collection(db, 'archived_students'),
                where('teacher_id', '==', teacherId),
                where('group_name', '==', groupName)
            );
            const archivedSnapshot = await getDocs(archivedQ);
            const archivedData = archivedSnapshot.docs
                .map(d => {
                    const data = d.data();
                    return {
                        id: data.original_student_id || d.id,
                        name: data.name,
                        student_id: data.student_id,
                        email: data.email,
                        phone: data.phone,
                        group_name: data.group_name,
                        teacher_id: data.teacher_id,
                        created_at: data.created_at,
                        join_date: data.join_date,
                        is_active: false,
                        archiveDocId: d.id
                    } as Student;
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            const studentIds = studentsData.map(s => s.id);
            if (studentIds.length > 0) {
                setStatsLoading(true);
                const [historyData, attendanceData, stats] = await Promise.all([
                    fetchAllRecords<{ student_id: string; points: number; type: string; date: string }>('reward_penalty_history', teacherId, undefined, studentIds),
                    fetchAllRecords<{ student_id: string; status: string; date: string }>('attendance_records', teacherId, undefined, studentIds),
                    calculateGroupStatistics(teacherId, groupName, studentIds, selectedPeriod)
                ]);

                setGroupStats(stats);
                setStatsLoading(false);

                // Calculate start date for filtering
                let startDate: string | null = null;
                if (selectedPeriod !== 'all') {
                    const now = new Date();
                    switch (selectedPeriod) {
                        case '1_day': now.setDate(now.getDate() - 1); break;
                        case '1_week': now.setDate(now.getDate() - 7); break;
                        case '1_month': now.setMonth(now.getMonth() - 1); break;
                        case '2_months': now.setMonth(now.getMonth() - 2); break;
                        case '3_months': now.setMonth(now.getMonth() - 3); break;
                        case '6_months': now.setMonth(now.getMonth() - 6); break;
                        case '10_months': now.setMonth(now.getMonth() - 10); break;
                    }
                    startDate = now.toISOString().split('T')[0];
                }

                const studentsWithRewards = studentsData.map(student => {
                    const studentHistory = historyData.filter(h => h.student_id === student.id && (!startDate || h.date >= startDate));
                    const studentAttendance = attendanceData.filter(a => a.student_id === student.id && (!startDate || a.date >= startDate));

                    let bahoScore = 0;
                    let mukofotScore = 0;
                    let jarimaScore = 0;

                    studentHistory.forEach(record => {
                        if (record.type === 'Baho') bahoScore += record.points;
                        else if (record.type === 'Mukofot') mukofotScore += record.points;
                        else if (record.type === 'Jarima') jarimaScore += record.points;
                    });

                    const bahoRecords = studentHistory.filter(h => h.type === 'Baho');
                    const averageScore = bahoRecords.length > 0 ? bahoScore / bahoRecords.length : 0;

                    const attendancePoints = studentAttendance.reduce((total, record) => {
                        if (record.status === 'present') return total + PRESENT_POINTS;
                        if (record.status === 'late') return total + LATE_POINTS;
                        return total;
                    }, 0);

                    const totalScore = mukofotScore - jarimaScore + attendancePoints;

                    return {
                        ...student,
                        rewardPenaltyPoints: totalScore,
                        averageScore,
                        bahoScore,
                        mukofotScore,
                        jarimaScore,
                        totalRewards: mukofotScore,
                        totalPenalties: jarimaScore
                    };
                });
                // Combine active and archived students
                const allStudents = [...studentsWithRewards, ...archivedData];
                setStudents(allStudents);
            } else {
                setStudents([]);
                setGroupStats(null);
                setStatsLoading(false);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendanceForDate = async (date: string) => {
        try {
            const q = query(
                collection(db, 'attendance_records'),
                where('teacher_id', '==', teacherId),
                where('date', '==', date)
            );
            const snapshot = await getDocs(q);
            const attendanceMap: Record<string, AttendanceStatus> = {};
            snapshot.docs.forEach(d => {
                const data = d.data();
                attendanceMap[data.student_id] = (data.status === 'absent' ? 'absent_without_reason' : data.status) as AttendanceStatus;
            });
            setAttendance(attendanceMap);
        } catch (error) {
            console.error('Error fetching attendance:', error);
        }
    };

    const fetchDailyScores = async (date: string) => {
        try {
            const studentIds = students.map(s => s.id);
            if (studentIds.length === 0) return;

            const q = query(
                collection(db, 'reward_penalty_history'),
                where('teacher_id', '==', teacherId),
                where('date', '==', date)
            );
            const snapshot = await getDocs(q);
            const scoresMap: Record<string, { baho?: { points: number, id: string }, mukofot?: { points: number, id: string }, jarima?: { points: number, id: string } }> = {};

            snapshot.docs.forEach(d => {
                const record = { id: d.id, ...d.data() } as any;
                if (studentIds.includes(record.student_id)) {
                    if (!scoresMap[record.student_id]) scoresMap[record.student_id] = {};
                    if (record.type === 'Baho') scoresMap[record.student_id].baho = { points: record.points, id: record.id };
                    else if (record.type === 'Mukofot') scoresMap[record.student_id].mukofot = { points: record.points, id: record.id };
                    else if (record.type === 'Jarima') scoresMap[record.student_id].jarima = { points: record.points, id: record.id };
                }
            });

            setDailyScores(scoresMap);
        } catch (error) {
            console.error('Error fetching daily scores:', error);
        }
    };

    const addStudent = async () => {
        try {
            studentSchema.parse({
                name: newStudent.name,
                join_date: newStudent.join_date,
                student_id: newStudent.student_id || '',
                email: newStudent.email || '',
                phone: newStudent.phone || ''
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                toast({ title: "Validatsiya xatosi", description: formatValidationError(error), variant: "destructive" });
            }
            return;
        }

        try {
            await addDoc(collection(db, 'students'), {
                teacher_id: teacherId,
                name: newStudent.name.trim(),
                join_date: newStudent.join_date,
                student_id: newStudent.student_id.trim() || null,
                email: newStudent.email.trim() || null,
                phone: newStudent.phone.trim() || null,
                group_name: groupName,
                is_active: true,
                created_at: serverTimestamp()
            });
            await fetchStudents();
            await onStatsUpdate();
            setNewStudent({ name: '', join_date: format(new Date(), 'yyyy-MM-dd'), student_id: '', email: '', phone: '' });
            setIsAddDialogOpen(false);
            toast({ title: "Muvaffaqiyatli", description: "O'quvchi qo'shildi" });
        } catch (error) {
            console.error('Error adding student:', error);
            toast({ title: "Xatolik", description: "O'quvchini qo'shishda xatolik yuz berdi", variant: "destructive" });
        }
    };

    const editStudent = async () => {
        if (!editingStudent || !editingStudent.name.trim()) {
            toast({ title: "Xatolik", description: "Ism kiritish majburiy", variant: "destructive" });
            return;
        }

        if (!editingStudent.join_date) {
            toast({ title: "Xatolik", description: "Qo'shilgan sana kiritish majburiy", variant: "destructive" });
            return;
        }

        try {
            await updateDoc(doc(db, 'students', editingStudent.id), {
                name: editingStudent.name.trim(),
                join_date: editingStudent.join_date,
                student_id: editingStudent.student_id?.trim() || null,
                email: editingStudent.email?.trim() || null,
                phone: editingStudent.phone?.trim() || null,
                updated_at: serverTimestamp()
            });

            await fetchStudents();
            onStatsUpdate?.();
            setIsEditDialogOpen(false);
            setEditingStudent(null);
            toast({ title: "Muvaffaqiyatli", description: "O'quvchi ma'lumotlari yangilandi" });
        } catch (error) {
            console.error('Error updating student:', error);
            toast({ title: "Xatolik", description: "Tahrirlashda xatolik yuz berdi", variant: "destructive" });
        }
    };

    const markAttendance = async (studentId: string, status: AttendanceStatus, notes?: string | null) => {
        try {
            // Tanlangan sana o'quvchining join_date dan oldin bo'lsa, davomat kiritmaslik
            const student = students.find(s => s.id === studentId);
            const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;

            if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
                toast({
                    title: "Xatolik",
                    description: `${student?.name} ${effectiveJoinDate} sanasida qo'shilgan. Ushbu sanadan oldin davomat kiritib bo'lmaydi.`,
                    variant: "destructive"
                });
                return;
            }

            const docId = `${studentId}_${selectedDate}`;
            const docRef = doc(db, 'attendance_records', docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const existingData = docSnap.data();
                if (existingData.status === status && (notes ?? existingData.notes ?? null) === (existingData.notes ?? null)) {
                    await deleteDoc(docRef);
                    setAttendance(prev => {
                        const next = { ...prev };
                        delete next[studentId];
                        return next;
                    });
                } else {
                    await setDoc(docRef, {
                        status,
                        notes: notes === undefined ? existingData.notes ?? null : notes,
                        updated_at: serverTimestamp()
                    }, { merge: true });
                    setAttendance(prev => ({ ...prev, [studentId]: status }));
                }
            } else {
                await setDoc(docRef, {
                    teacher_id: teacherId,
                    student_id: studentId,
                    date: selectedDate,
                    status,
                    notes: notes ?? null,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp()
                });
                setAttendance(prev => ({ ...prev, [studentId]: status }));
            }
            onStatsUpdate?.();
        } catch (error) {
            console.error('Error marking attendance:', error);
            fetchAttendanceForDate(selectedDate);
        }
    };

    const markAllAsPresent = async () => {
        try {
            const batch = writeBatch(db);
            students.forEach(student => {
                const docId = `${student.id}_${selectedDate}`;
                batch.set(doc(db, 'attendance_records', docId), {
                    teacher_id: teacherId,
                    student_id: student.id,
                    date: selectedDate,
                    status: 'present',
                    updated_at: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            fetchAttendanceForDate(selectedDate);
            onStatsUpdate?.();
        } catch (error) {
            console.error('Error marking all as present:', error);
        }
    };

    const clearAllAttendance = async () => {
        try {
            const q = query(
                collection(db, 'attendance_records'),
                where('teacher_id', '==', teacherId),
                where('date', '==', selectedDate)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            setAttendance({});
            onStatsUpdate?.();
        } catch (error) {
            console.error('Error clearing attendance:', error);
        }
    };

    const addReward = async (studentId: string) => {
        if (!rewardPoints) return;
        const points = parseFloat(rewardPoints);
        if (isNaN(points)) return;

        try {
            const type = rewardType === 'reward' ? 'Mukofot' : 'Jarima';
            await addDoc(collection(db, 'reward_penalty_history'), {
                student_id: studentId,
                teacher_id: teacherId,
                points: Math.abs(points),
                type,
                reason: type,
                date: format(new Date(), 'yyyy-MM-dd'),
                created_at: serverTimestamp()
            });
            setShowRewardDialog(null);
            setRewardPoints('');
            await fetchStudents();
            onStatsUpdate?.();
        } catch (error) {
            console.error('Error adding reward/penalty:', error);
        }
    };

    const handleScoreCellClick = (studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
        setEditingScoreCell({ studentId, type });
        setScoreInputValue('');
    };

    const handleScoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
            setScoreInputValue(value);
        }
    };

    const saveScore = async (studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
        if (scoreInputValue === '' || scoreInputValue === '-') {
            return true; // Allow navigation if empty
        }
        const newScore = parseFloat(scoreInputValue);
        if (isNaN(newScore)) return true; // Allow navigation if invalid (or maybe block?)

        if (newScore < 0 || newScore > 5) {
            toast({ title: "Xatolik", description: "Ball 0 dan 5 gacha bo'lishi kerak", variant: "destructive" });
            return false;
        }

        const existingScore = dailyScores[studentId]?.[type];
        if (existingScore) {
            if (existingScore.points === newScore) return true; // No change
            setShowScoreChangeDialog({ studentId, newScore, type, existingRecordId: existingScore.id });
            return false; // Dialog opened, stop navigation
        } else {
            await submitScore(studentId, newScore, null, type);
            return true;
        }
    };

    const handleScoreBlur = async (studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
        // Give a small delay to check if navigation happened
        setTimeout(async () => {
            if (isNavigatingRef.current) return;
            await saveScore(studentId, type);
            setEditingScoreCell(null);
        }, 100);
    };

    const submitScore = async (studentId: string, newScore: number, reason: string | null, type: 'baho' | 'mukofot' | 'jarima', existingRecordId?: string) => {
        try {
            const typeLabel = type === 'baho' ? 'Baho' : type === 'mukofot' ? 'Mukofot' : 'Jarima';

            // Tanlangan sana o'quvchining join_date dan oldin bo'lsa, ball kiritmaslik
            const student = students.find(s => s.id === studentId);
            const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;

            if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
                toast({
                    title: "Xatolik",
                    description: `${student?.name} ${effectiveJoinDate} sanasida qo'shilgan. Ushbu sanadan oldin ball kiritib bo'lmaydi.`,
                    variant: "destructive"
                });
                return;
            }

            if (existingRecordId) {
                if (!reason || reason.trim() === '') {
                    toast({ title: "Xatolik", description: "Izoh kiritish majburiy", variant: "destructive" });
                    return;
                }
                await updateDoc(doc(db, 'reward_penalty_history', existingRecordId), {
                    points: newScore,
                    reason: reason,
                    updated_at: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'reward_penalty_history'), {
                    student_id: studentId,
                    teacher_id: teacherId,
                    points: newScore,
                    reason: reason || typeLabel,
                    type: typeLabel,
                    date: selectedDate,
                    created_at: serverTimestamp()
                });
            }

            fetchStudents();
            fetchDailyScores(selectedDate);
            onStatsUpdate?.();
            toast({ title: "Muvaffaqiyatli", description: `${typeLabel} saqlandi` });
        } catch (error) {
            console.error('Error submitting score:', error);
        } finally {
            setShowScoreChangeDialog(null);
            setScoreChangeReason('');
        }
    };

    const handleScoreKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, type: 'baho' | 'mukofot' | 'jarima') => {
        const types: ('baho' | 'mukofot' | 'jarima')[] = ['baho', 'mukofot', 'jarima'];
        const currentTypeIndex = types.indexOf(type);

        if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            isNavigatingRef.current = true;

            const canNavigate = await saveScore(students[studentIndex].id, type);
            if (!canNavigate) {
                isNavigatingRef.current = false;
                return;
            }

            let nextStudentIndex = studentIndex;
            let nextTypeIndex = currentTypeIndex;

            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                nextStudentIndex = studentIndex + 1;
            } else if (e.key === 'ArrowUp') {
                nextStudentIndex = studentIndex - 1;
            } else if (e.key === 'ArrowLeft') {
                nextTypeIndex = currentTypeIndex - 1;
            } else if (e.key === 'ArrowRight') {
                nextTypeIndex = currentTypeIndex + 1;
            }

            // Boundary checks
            if (nextStudentIndex >= 0 && nextStudentIndex < students.length && nextTypeIndex >= 0 && nextTypeIndex < types.length) {
                setEditingScoreCell({ studentId: students[nextStudentIndex].id, type: types[nextTypeIndex] });
                setScoreInputValue('');
            } else {
                // If out of bounds, maybe just close?
                setEditingScoreCell(null);
            }

            // Reset navigation flag after state update
            setTimeout(() => {
                isNavigatingRef.current = false;
            }, 200);
        } else if (e.key === 'Escape') {
            setEditingScoreCell(null);
        }
    };

    const handleStudentClick = (studentId: string) => {
        setSelectedStudentId(studentId);
        setIsStudentPopupOpen(true);
    };

    const handleAction = (type: 'archive' | 'delete', studentId: string, studentName: string) => {
        setConfirmDialog({
            isOpen: true,
            type,
            studentId,
            studentName
        });
    };

    const executeAction = async () => {
        const { type, studentId } = confirmDialog;
        if (type === 'archive') {
            await handleArchive(studentId);
        } else {
            await handleDelete(studentId);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    };

    const handleArchive = async (studentId: string) => {
        try {
            const studentDoc = await getDoc(doc(db, 'students', studentId));
            if (!studentDoc.exists()) return;
            const studentData = studentDoc.data();

            await updateDoc(doc(db, 'students', studentId), { is_active: false });
            await addDoc(collection(db, 'archived_students'), {
                ...studentData,
                original_student_id: studentId,
                archived_at: serverTimestamp()
            });

            await fetchStudents();
            onStatsUpdate?.();
            toast({ title: "Muvaffaqiyatli", description: "O'quvchi arxivlandi" });
        } catch (error) {
            console.error('Error archiving student:', error);
        }
    };

    const handleDelete = async (studentId: string) => {
        try {
            const studentDoc = await getDoc(doc(db, 'students', studentId));
            if (!studentDoc.exists()) return;
            const studentData = studentDoc.data();

            await updateDoc(doc(db, 'students', studentId), { is_active: false });
            await addDoc(collection(db, 'deleted_students'), {
                ...studentData,
                original_student_id: studentId,
                deleted_at: serverTimestamp()
            });

            await fetchStudents();
            onStatsUpdate?.();
            toast({ title: "Muvaffaqiyatli", description: "O'quvchi chiqindilar qutisiga o'tkazildi" });
        } catch (error) {
            console.error('Error deleting student:', error);
        }
    };

    const handleRestoreClick = (studentId: string, studentName: string, archiveDocId?: string) => {
        setRestoreDialog({
            isOpen: true,
            studentId,
            studentName,
            archiveDocId
        });
    };

    const executeRestore = async (date: Date) => {
        const { studentId, archiveDocId } = restoreDialog;
        if (!studentId) return;

        try {
            const formattedDate = format(date, 'yyyy-MM-dd');

            // 1. Update student status and join_date
            await updateDoc(doc(db, 'students', studentId), {
                is_active: true,
                join_date: formattedDate,
                updated_at: serverTimestamp()
            });

            // 2. Remove from archived_students if archiveDocId exists
            if (archiveDocId) {
                await deleteDoc(doc(db, 'archived_students', archiveDocId));
            } else {
                // Fallback: try to find and delete if archiveDocId is missing (shouldn't happen with new logic)
                const q = query(collection(db, 'archived_students'), where('original_student_id', '==', studentId));
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(async (d) => {
                    await deleteDoc(d.ref);
                });
            }

            await fetchStudents();
            onStatsUpdate?.();
            toast({ title: "Muvaffaqiyatli", description: "O'quvchi tiklandi" });
        } catch (error) {
            console.error('Error restoring student:', error);
            toast({ title: "Xatolik", description: "Tiklashda xatolik yuz berdi", variant: "destructive" });
        }
    };

    // Helper: Get effective join date (join_date or created_at)
    const getEffectiveJoinDate = (student: Student): string | null => {
        if (student.join_date) return student.join_date;

        // Fallback to created_at
        if (student.created_at) {
            if (student.created_at instanceof Timestamp) {
                return student.created_at.toDate().toISOString().split('T')[0];
            } else if (typeof student.created_at === 'string') {
                return student.created_at.split('T')[0];
            }
        }
        return null;
    };

    // Get the note text to display for grayed out students
    const getStudentStatusNote = (student: Student, selectedDate: string): string | null => {
        const effectiveJoinDate = getEffectiveJoinDate(student);

        // Check if before join date
        if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
            const [year, month, day] = effectiveJoinDate.split('-');
            return `${day}-${month}-${year} da kelgan`;
        }

        // Check if archived (after archive date)
        if (!student.is_active && student.archived_at) {
            let archivedDate = '';
            if (student.archived_at instanceof Timestamp) {
                archivedDate = student.archived_at.toDate().toISOString().split('T')[0];
            } else if (typeof student.archived_at === 'string') {
                archivedDate = student.archived_at.split('T')[0];
            }
            if (archivedDate) {
                const [year, month, day] = archivedDate.split('-');
                return `${day}-${month}-${year} da chiqib ketgan`;
            }
        }

        return null;
    };

    const getButtonStyle = (studentId: string, targetStatus: AttendanceStatus) => {
        const currentStatus = attendance[studentId];
        const normalized = (currentStatus === 'absent' ? 'absent_without_reason' : currentStatus) as AttendanceStatus | undefined;
        const student = students.find(s => s.id === studentId);
        const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;
        const isBeforeJoinDate = effectiveJoinDate && selectedDate < effectiveJoinDate;
        const baseStyle = `w-10 h-10 p-0 border ${isBeforeJoinDate ? 'opacity-40 cursor-not-allowed' : ''}`;

        if (targetStatus !== 'absent') {
            const isActive = normalized === targetStatus;
            if (!isActive) return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
            switch (targetStatus) {
                case 'present': return `${baseStyle} border-green-500 bg-green-500 hover:bg-green-600 text-white`;
                case 'late': return `${baseStyle} border-orange-500 bg-orange-500 hover:bg-orange-600 text-white`;
                default: return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
            }
        }
        if (normalized === 'absent_with_reason') return `${baseStyle} border-yellow-500 bg-yellow-500 hover:bg-yellow-600 text-white`;
        if (normalized === 'absent_without_reason') return `${baseStyle} border-red-500 bg-red-500 hover:bg-red-600 text-white`;
        return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
    };

    const getScoreCellStyle = (type: string, points: number) => {
        const baseStyle = "border";
        if (type === 'baho') {
            return `${baseStyle} bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100`;
        }
        if (type === 'mukofot') {
            return `${baseStyle} bg-green-50 text-green-700 border-green-200 hover:bg-green-100`;
        }
        if (type === 'jarima') {
            return `${baseStyle} bg-red-50 text-red-700 border-red-200 hover:bg-red-100`;
        }
        return `${baseStyle} bg-gray-50 text-gray-400 border-gray-200`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <GroupStatisticsCard
                totalStudents={groupStats?.totalStudents || students.length}
                attendancePercentage={groupStats?.attendancePercentage || 0}
                totalLessons={groupStats?.totalLessons || 0}
                topStudent={groupStats?.topStudent || null}
                loading={statsLoading}
            />
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button onClick={onBack} variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
                    <div className="flex items-center gap-4">
                        {availableGroups && availableGroups.length > 1 && onGroupChange ? (
                            <Select value={groupName} onValueChange={onGroupChange}>
                                <SelectTrigger className="w-[200px] border-0 hover:bg-gray-50 p-0 h-auto">
                                    <SelectValue><h2 className="text-2xl font-bold">{groupName}</h2></SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableGroups.map((group) => <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div><h2 className="text-2xl font-bold">{groupName}</h2></div>
                        )}
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Davr" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1_day">1 kun</SelectItem>
                                <SelectItem value="1_week">1 hafta</SelectItem>
                                <SelectItem value="1_month">1 oy</SelectItem>
                                <SelectItem value="2_months">2 oy</SelectItem>
                                <SelectItem value="3_months">3 oy</SelectItem>
                                <SelectItem value="6_months">6 oy</SelectItem>
                                <SelectItem value="10_months">10 oy</SelectItem>
                                <SelectItem value="all">Barchasi</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-sm text-gray-600">{students.length} o'quvchi</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <StudentImport teacherId={teacherId} groupName={groupName} onImportComplete={() => { fetchStudents(); fetchAttendanceForDate(selectedDate); fetchDailyScores(selectedDate); onStatsUpdate(); }} />
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild><Button className="apple-button"><Plus className="w-4 h-4 mr-2" />O'quvchi qo'shish</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Yangi o'quvchi qo'shish</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2"><Label>F.I.SH (majburiy)</Label><Input value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="Masalan: Ali Valiyev" /></div>
                                <div className="space-y-2">
                                    <Label>Qo'shilgan sana (majburiy)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newStudent.join_date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {newStudent.join_date ? format(parseISO(newStudent.join_date), "d-MMMM, yyyy", { locale: uz }) : <span>Sana tanlang</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={parseISO(newStudent.join_date)}
                                                onSelect={(date) => date && setNewStudent({ ...newStudent, join_date: format(date, 'yyyy-MM-dd') })}
                                                initialFocus
                                                locale={uz}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2"><Label>O'quvchi ID (ixtiyoriy)</Label><Input value={newStudent.student_id} onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })} placeholder="Masalan: 12345" /></div>
                                <div className="space-y-2"><Label>Email (ixtiyoriy)</Label><Input value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="Masalan: ali@example.com" /></div>
                                <div className="space-y-2"><Label>Telefon (ixtiyoriy)</Label><Input value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} placeholder="Masalan: +998901234567" /></div>
                                <Button onClick={addStudent} className="w-full apple-button">Qo'shish</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>O'quvchini tahrirlash</DialogTitle></DialogHeader>
                            {editingStudent && (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>F.I.SH</Label>
                                        <Input
                                            value={editingStudent.name}
                                            onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                            placeholder="Masalan: Ali Valiyev"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>O'quvchi ID (ixtiyoriy)</Label>
                                        <Input
                                            value={editingStudent.student_id || ''}
                                            onChange={(e) => setEditingStudent({ ...editingStudent, student_id: e.target.value })}
                                            placeholder="Masalan: 12345"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email (ixtiyoriy)</Label>
                                        <Input
                                            value={editingStudent.email || ''}
                                            onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                                            placeholder="Masalan: ali@example.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Telefon (ixtiyoriy)</Label>
                                        <Input
                                            value={editingStudent.phone || ''}
                                            onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                                            placeholder="Masalan: +998901234567"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Qo'shilgan sana (majburiy)</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editingStudent.join_date && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {editingStudent.join_date ? format(parseISO(editingStudent.join_date), "d-MMMM, yyyy", { locale: uz }) : <span>Sana tanlang</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={editingStudent.join_date ? parseISO(editingStudent.join_date) : new Date()}
                                                    onSelect={(date) => date && setEditingStudent({ ...editingStudent, join_date: format(date, 'yyyy-MM-dd') })}
                                                    initialFocus
                                                    locale={uz}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <Button onClick={editStudent} className="w-full apple-button">Saqlash</Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Tab panel */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('journal')}
                    className={cn(
                        'px-4 py-2 font-medium text-sm transition-all border-b-2',
                        activeTab === 'journal'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    )}
                >
                    Davomat Jurnali
                </button>
                <button
                    onClick={() => setActiveTab('attendance')}
                    className={cn(
                        'px-4 py-2 font-medium text-sm transition-all border-b-2',
                        activeTab === 'attendance'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    )}
                >
                    Kunlik Jurnal
                </button>
            </div>

            {/* Davomat Jurnali tab */}
            {activeTab === 'journal' && (
                <AttendanceJournal teacherId={teacherId} groupName={groupName} />
            )}

            {/* Kunlik Jurnal tab */}
            {activeTab === 'attendance' && (
                <Card className="apple-card overflow-hidden">
                    <div className="p-6 border-b border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
                        <div className="flex items-center space-x-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal apple-button-secondary", !selectedDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(parseISO(selectedDate), "d-MMMM, yyyy", { locale: uz }) : <span>Sana tanlang</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={parseISO(selectedDate)}
                                        onSelect={(date) => date && setSelectedDate(format(date, 'yyyy-MM-dd'))}
                                        initialFocus
                                        locale={uz}
                                        modifiers={{ hasAttendance: attendanceDates }}
                                        modifiersStyles={{
                                            hasAttendance: {
                                                backgroundColor: '#22c55e',
                                                color: 'white',
                                                borderRadius: '50%'
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="flex gap-2">
                                <Button onClick={markAllAsPresent} variant="outline" size="sm" className="apple-button-secondary"><CheckCircle className="w-4 h-4 mr-2 text-green-600" />Barchasi kelgan</Button>
                                <Button onClick={clearAllAttendance} variant="outline" size="sm" className="apple-button-secondary text-red-600 hover:text-red-700"><RotateCcw className="w-4 h-4 mr-2" />Tozalash</Button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="w-[50px] text-center">#</TableHead>
                                    <TableHead>O'quvchi</TableHead>
                                    <TableHead className="text-center">Davomat</TableHead>
                                    <TableHead className="text-center">Baholash</TableHead>
                                    <TableHead className="text-center">Umumiy ball</TableHead>
                                    <TableHead className="text-right">Amallar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student, index) => {
                                    const effectiveJoinDate = getEffectiveJoinDate(student);
                                    const isBeforeJoinDate = effectiveJoinDate && selectedDate < effectiveJoinDate;
                                    const isArchived = !student.is_active;
                                    const isFirstArchived = isArchived && (index === 0 || students[index - 1].is_active);
                                    return (
                                        <>
                                            {isFirstArchived && (
                                                <TableRow className="bg-gray-100 hover:bg-gray-100">
                                                    <TableCell colSpan={6} className="text-center py-2">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chiqib ketgan o'quvchilar</span>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            <TableRow key={student.id} className={cn("transition-colors", isArchived ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-gray-50/50", isBeforeJoinDate && "opacity-40")}>
                                                <TableCell className="text-center text-gray-500 font-medium">{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col cursor-pointer group" onClick={() => handleStudentClick(student.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{student.name}</span>
                                                            {getStudentStatusNote(student, selectedDate) && (
                                                                <span className={cn("text-xs px-2 py-0.5 rounded font-medium", isBeforeJoinDate ? "bg-yellow-100 text-yellow-800" : "bg-orange-100 text-orange-800")}>
                                                                    {getStudentStatusNote(student, selectedDate)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-500">{student.student_id || 'ID yo\'q'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center space-x-1">
                                                        <Button size="sm" variant="outline" className={getButtonStyle(student.id, 'present')} disabled={isBeforeJoinDate} onClick={() => markAttendance(student.id, 'present')} title={isBeforeJoinDate ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan` : ''}><CheckCircle className="w-4 h-4" /></Button>
                                                        <Button size="sm" variant="outline" className={getButtonStyle(student.id, 'late')} disabled={isBeforeJoinDate} onClick={() => markAttendance(student.id, 'late')} title={isBeforeJoinDate ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan` : ''}><Clock className="w-4 h-4" /></Button>
                                                        <Button size="sm" variant="outline" className={getButtonStyle(student.id, 'absent')} disabled={isBeforeJoinDate} onClick={() => { setShowReasonInput(false); setAbsentReason(''); setShowAbsentDialog(student.id); }} title={isBeforeJoinDate ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan` : ''}><XCircle className="w-4 h-4" /></Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-1">
                                                        {['baho', 'mukofot', 'jarima'].map((type) => (
                                                            <div key={type}>
                                                                {editingScoreCell?.studentId === student.id && editingScoreCell?.type === type && !isBeforeJoinDate ? (
                                                                    <Input
                                                                        className="w-10 h-10 mx-auto text-center p-0"
                                                                        value={scoreInputValue}
                                                                        onChange={handleScoreInputChange}
                                                                        onBlur={() => handleScoreBlur(student.id, type as any)}
                                                                        onKeyDown={(e) => handleScoreKeyDown(e, index, type as any)}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className={cn("w-10 h-10 mx-auto flex items-center justify-center rounded-md transition-all font-medium", isBeforeJoinDate ? "opacity-40 cursor-not-allowed bg-gray-100" : "cursor-pointer hover:ring-2 hover:ring-primary/20", getScoreCellStyle(type, dailyScores[student.id]?.[type as any]?.points || 0))}
                                                                        onClick={() => !isBeforeJoinDate && handleScoreCellClick(student.id, type as any)}
                                                                        title={isBeforeJoinDate ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan` : (type === 'baho' ? 'Baho' : type === 'mukofot' ? 'Mukofot' : 'Jarima')}
                                                                    >
                                                                        {dailyScores[student.id]?.[type as any]?.points || 0}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                                                        {student.rewardPenaltyPoints?.toFixed(1) || 0}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {!isArchived ? (
                                                            <>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => {
                                                                    const studentWithJoinDate = {
                                                                        ...student,
                                                                        join_date: student.join_date || getEffectiveJoinDate(student) || format(new Date(), 'yyyy-MM-dd')
                                                                    };
                                                                    setEditingStudent(studentWithJoinDate);
                                                                    setIsEditDialogOpen(true);
                                                                }}><Edit2 className="w-4 h-4" /></Button>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => handleAction('archive', student.id, student.name)}><Archive className="w-4 h-4" /></Button>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction('delete', student.id, student.name)}><Trash2 className="w-4 h-4" /></Button>
                                                            </>
                                                        ) : (
                                                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestoreClick(student.id, student.name, student.archiveDocId)}>
                                                                Tiklash
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Dialogs */}
            {showAbsentDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">{students.find(s => s.id === showAbsentDialog)?.name} - Kelmadi</h3>
                            <Button variant="ghost" size="sm" onClick={() => setShowAbsentDialog(null)} className="h-8 w-8 p-0"><XCircle className="w-4 h-4" /></Button>
                        </div>
                        {!showReasonInput ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Button onClick={() => { markAttendance(showAbsentDialog, 'absent_without_reason'); setShowAbsentDialog(null); }} variant="outline" className="h-12">Sababsiz</Button>
                                <Button onClick={() => setShowReasonInput(true)} variant="outline" className="h-12">Sababli</Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div><Label>Sabab (majburiy)</Label><Input value={absentReason} onChange={(e) => setAbsentReason(e.target.value)} placeholder="Sabab kiriting..." autoFocus /></div>
                                <div className="flex space-x-2">
                                    <Button onClick={() => { markAttendance(showAbsentDialog, 'absent_with_reason', absentReason); setShowAbsentDialog(null); }} className="flex-1 apple-button" disabled={!absentReason.trim()}>Saqlash</Button>
                                    <Button onClick={() => setShowReasonInput(false)} variant="outline" className="flex-1">Ortga</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showScoreChangeDialog && (
                <AlertDialog open={!!showScoreChangeDialog} onOpenChange={() => setShowScoreChangeDialog(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Ballni o'zgartirish</AlertDialogTitle>
                            <AlertDialogDescription>Siz mavjud ballni o'zgartirmoqchisiz. Iltimos, sababini ko'rsating.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4"><Label>O'zgartirish sababi</Label><Input value={scoreChangeReason} onChange={(e) => setScoreChangeReason(e.target.value)} placeholder="Masalan: Xato kiritilgan" autoFocus /></div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                            <AlertDialogAction onClick={() => submitScore(showScoreChangeDialog.studentId, showScoreChangeDialog.newScore, scoreChangeReason, showScoreChangeDialog.type, showScoreChangeDialog.existingRecordId)} disabled={!scoreChangeReason.trim()}>Tasdiqlash</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {selectedStudentId && (
                <StudentDetailsPopup
                    studentId={selectedStudentId}
                    isOpen={isStudentPopupOpen}
                    onClose={() => { setIsStudentPopupOpen(false); setSelectedStudentId(null); }}
                    teacherId={teacherId}
                />
            )}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={executeAction}
                title={confirmDialog.type === 'archive' ? "O'quvchini arxivlash" : "O'quvchini o'chirish"}
                description={`"${confirmDialog.studentName}" ni ${confirmDialog.type === 'archive' ? 'arxivlashga' : "o'chirishga"} ishonchingiz komilmi?`}
                confirmText={confirmDialog.type === 'archive' ? "Arxivlash" : "O'chirish"}
                variant={confirmDialog.type === 'archive' ? 'warning' : 'danger'}
            />

            <RestoreDialog
                isOpen={restoreDialog.isOpen}
                onClose={() => setRestoreDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={executeRestore}
                title="O'quvchini tiklash"
                description={`"${restoreDialog.studentName}" ni tiklashni tasdiqlaysizmi?`}
            />
        </div>
    );
};

export default GroupDetails;
