import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export async function exportAllDataToJSON(): Promise<void> {
  try {
    const data: Record<string, any> = {};

    // Asosiy to'plamlarni ro'yxati
    const collectionsToExport = [
      "teachers",
      "students",
      "groups",
      "attendance_records",
      "student_scores",
      "exams",
      "exam_results"
    ];

    for (const colName of collectionsToExport) {
      const querySnapshot = await getDocs(collection(db, colName));
      data[colName] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // JSON formatiga o'tkazish
    const jsonString = JSON.stringify(data, null, 2);
    
    // Blob orqali fayl yaratish
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Avtomatik yuklab olishni boshlash
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `teachpro_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Tozalash
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error("Zaxiralashda xatolik yuz berdi:", error);
    throw new Error("Ma'lumotlarni yuklab olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
  }
}

export async function sendDataToTelegram(): Promise<void> {
  const telegramToken = "8731548222:AAHO9LivULWi9U1TSiHc7SqVP91EEKkjScs";
  const telegramChatId = "5574039857";

  try {
    const studentsSnapshot = await getDocs(collection(db, "students"));
    const attendanceSnapshot = await getDocs(collection(db, "attendance_records"));

    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const attendance = attendanceSnapshot.docs.map(doc => doc.data());

    let csvContent = "O'quvchi Ismi,Sana,Holat\n";
    
    attendance.forEach(record => {
      const studentName = students.find((s: any) => s.id === record.student_id)?.name || "Noma'lum";
      const status = record.status === "present" ? "Keldi" : "Kelmadi";
      csvContent += `${studentName},${record.date},${status}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const formData = new FormData();
    formData.append("chat_id", telegramChatId);
    formData.append("document", blob, "haftalik_hisobot.csv");
    formData.append("caption", "📊 Bu haftadagi o'quvchilarning davomat hisoboti.");

    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Telegram serveri xatolik qaytardi");
    }
  } catch (error) {
    console.error("Telegramga yuborishda xatolik:", error);
    throw new Error("Hisobotni Telegramga yuborishda muammo yuz berdi.");
  }
}
