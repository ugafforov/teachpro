import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export async function sendWeeklyReport() {
  const db = getFirestore();
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken || !telegramChatId) {
    logger.warn("Telegram bot tokeni yoki Chat ID kiritilmagan. Hisobot yuborilmadi.");
    return;
  }

  try {
    // Bazadan ma'lumotlarni yig'ish
    const studentsSnapshot = await db.collection("students").get();
    const attendanceSnapshot = await db.collection("attendance_records")
      .where("date", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .get();

    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const attendance = attendanceSnapshot.docs.map(doc => doc.data() as any);

    // CSV formatlash
    let csvContent = "O'quvchi Ismi,Sana,Holat\n";
    
    attendance.forEach(record => {
      const studentName = students.find(s => s.id === record.student_id)?.name || "Noma'lum";
      const status = record.status === "present" ? "Keldi" : "Kelmadi";
      csvContent += `${studentName},${record.date},${status}\n`;
    });

    const buffer = Buffer.from(csvContent, "utf-8");

    // Telegram API orqali fayl yuborish
    const formData = new FormData();
    formData.append("chat_id", telegramChatId);
    formData.append("document", new Blob([buffer]), "haftalik_hisobot.csv");
    formData.append("caption", "📊 Bu haftadagi o'quvchilarning davomat hisoboti.");

    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Telegram xatolik: ${response.statusText}`);
    }

    logger.info("Haftalik hisobot Telegramga muvaffaqiyatli yuborildi.");
  } catch (error) {
    logger.error("Haftalik hisobotni yuborishda xatolik:", error);
    throw error;
  }
}
