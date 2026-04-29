const { initializeApp } = require("firebase-admin/app");
const { sendWeeklyReport } = require("./lib/reportEngine");
require('dotenv').config();

initializeApp();
sendWeeklyReport()
  .then(() => console.log("Success"))
  .catch(e => console.error("Failed", e));
