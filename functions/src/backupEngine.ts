import * as firestore from "@google-cloud/firestore";
import * as logger from "firebase-functions/logger";

const client = new firestore.v1.FirestoreAdminClient();

export async function runGCPBackup() {
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    logger.error("Project ID topilmadi, backup bekor qilindi");
    return;
  }
  
  // Asosiy Firebase Storage bucket ichida 'firestore-backups' papkasi
  const bucketName = `gs://${projectId}.appspot.com/firestore-backups`;
  const databaseName = client.databasePath(projectId, "(default)");
  
  try {
    logger.info(`Zaxiralash boshlandi. Manzil: ${bucketName}`);
    const [response] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: bucketName,
      collectionIds: [] // Bo'sh array = barcha collectionlarni saqlash
    });
    
    logger.info("Backup muvaffaqiyatli yakunlandi", response);
  } catch (error) {
    logger.error("Zaxiralash jarayonida xatolik yuz berdi", error);
    throw error;
  }
}
