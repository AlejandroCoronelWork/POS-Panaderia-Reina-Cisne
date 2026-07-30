const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const firestore = require("@google-cloud/firestore");

admin.initializeApp();

const client = new firestore.v1.FirestoreAdminClient();

// Automated Cloud Backup for 'ventas' and 'productos'
// Runs every day at 22:00 in America/Guayaquil timezone
exports.automatedBackup = onSchedule({
    schedule: "0 22 * * *",
    timeZone: "America/Guayaquil", // Replace with user's specific timezone if different
    timeoutSeconds: 300,
    memory: "256MiB"
}, async (event) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const bucketName = `gs://${projectId}-backups`; // Replace with the actual Google Cloud Storage bucket
    const collectionsToBackup = ["ventas", "productos"];
    
    const databaseName = client.databasePath(projectId, '(default)');

    console.log(`Starting automated backup for project ${projectId}`);
    
    try {
        const responses = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: bucketName,
            collectionIds: collectionsToBackup,
        });

        const response = responses[0];
        console.log(`Backup operation started successfully: ${response.name}`);
        
    } catch (error) {
        console.error("Backup operation failed.", error);
        throw new Error("Backup operation failed.");
    }
});
