const { google } = require('googleapis');
const config = require('./config');

const keyFile = JSON.parse(
  Buffer.from(config.googleServiceAccountJsonB64, 'base64').toString('utf8')
);

const auth = new google.auth.JWT({
  email: keyFile.client_email,
  key: keyFile.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function getValues(spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

async function batchUpdateValues(spreadsheetId, data) {
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

module.exports = { getValues, batchUpdateValues };
