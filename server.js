require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const activeRequests = new Map();

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];
const TOKEN_PATH = './token.json';
const FOLDER_ID = '1A3F7Ui81xWGRKHDTttzncAGIiClv9pJv';

function getOAuthClient() {
  const creds = process.env.OAUTH_CREDENTIALS
    ? JSON.parse(process.env.OAUTH_CREDENTIALS)
    : JSON.parse(fs.readFileSync('./oauth-credentials.json'));
  const { client_id, client_secret, redirect_uris } = creds.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

function getAuthenticatedClient() {
  const oauthClient = getOAuthClient();
  const token = process.env.GOOGLE_TOKEN
    ? JSON.parse(process.env.GOOGLE_TOKEN)
    : JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauthClient.setCredentials(token);
  return oauthClient;
}

app.get('/auth', (req, res) => {
  const oauthClient = getOAuthClient();
  const url = oauthClient.generateAuthUrl({ access_type: 'offline', scope: OAUTH_SCOPES, prompt: 'consent' });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const oauthClient = getOAuthClient();
  const { tokens } = await oauthClient.getToken(req.query.code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  res.send('<h2>Authentication successful! You can close this tab and use the app.</h2>');
});

async function createGoogleSheet(feature, csvData) {
  const authClient = getAuthenticatedClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const drive = google.drive({ version: 'v3', auth: authClient });

  const lines = csvData.trim().split('\n');
  const rows = lines.map(line => {
    const cols = [];
    let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cols.push(current.trim());
    return cols;
  });

  const file = await drive.files.create({
    requestBody: {
      name: `Test Cases - ${feature} - ${new Date().toLocaleDateString()}`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [FOLDER_ID]
    },
    fields: 'id'
  });

  const spreadsheetId = file.data.id;
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = meta.data.sheets[0].properties.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: { values: rows }
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 11 },
            cell: { userEnteredFormat: { textFormat: { fontFamily: 'Verdana', fontSize: 10 } } },
            fields: 'userEnteredFormat.textFormat'
          }
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.757, green: 0.482, blue: 0.247 },
                textFormat: { fontFamily: 'Verdana', fontSize: 10, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE'
              }
            },
            fields: 'userEnteredFormat'
          }
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
          }
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 11 }
          }
        },
        {
          addBanding: {
            bandedRange: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 11 },
              rowProperties: {
                headerColor: { red: 0.757, green: 0.482, blue: 0.247 },
                firstBandColor: { red: 1, green: 1, blue: 1 },
                secondBandColor: { red: 0.98, green: 0.95, blue: 0.91 }
              }
            }
          }
        },
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: 11 },
            top: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } },
            bottom: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } },
            left: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } },
            right: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } },
            innerHorizontal: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } },
            innerVertical: { style: 'SOLID', color: { red: 0.8, green: 0.7, blue: 0.6 } }
          }
        }
      ]
    }
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

app.use(express.static('.'));

app.post('/generate', async (req, res) => {
  const { mode, feature, imageBase64, mediaType, requestId } = req.body;

  try {
    let messages;

    if (mode === 'text') {
      messages = [{ role: 'user', content: `Generate test cases for this feature: ${feature}` }];
    } else {
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Analyze this UI design and generate comprehensive test cases for it.' }
        ]
      }];
    }

    let cancelled = false;
    activeRequests.set(requestId, () => { cancelled = true; });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are an expert QA Engineer. When given a feature description or UI screenshot, generate structured test cases in CSV format ONLY.

Output MUST start with this exact header row:
TEST CASE ID,TEST TYPE,MODULE,TEST SCENARIO,PRECONDITIONS,STEPS,TEST DATA,EXPECTED RESULT,ACTUAL RESULT,PRIORITY,STATUS

Rules:
- Wrap ALL fields in double quotes
- Use semicolons (;) to separate multiple steps inside the STEPS field
- TEST TYPE values: Positive / Negative / Edge Case
- PRIORITY values: Critical / High / Medium / Low
- STATUS values: Not Executed
- ACTUAL RESULT: leave as empty quotes ""
- MODULE should reflect the feature area (e.g. Login, Wallet, KYC)
- TEST DATA should include specific sample data used
- Generate a healthy mix of Positive, Negative, and Edge Case test types
- Be thorough and professional
- Output ONLY the CSV. No markdown, no explanation, no extra text.`,
      messages
    });

    activeRequests.delete(requestId);
    if (cancelled) return res.status(499).json({ error: 'Request cancelled' });

    const csv = response.content[0].text;
    const featureLabel = mode === 'text' ? feature : 'UI Screenshot Analysis';
    const sheetUrl = await createGoogleSheet(featureLabel, csv);

    res.json({ result: csv, sheetUrl });

  } catch (error) {
    activeRequests.delete(requestId);
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/cancel', (req, res) => {
  const { requestId } = req.body;
  if (activeRequests.has(requestId)) {
    activeRequests.get(requestId)();
    activeRequests.delete(requestId);
  }
  res.json({ cancelled: true });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`QA Agent Server running at http://localhost:${PORT}`);
  console.log(`API key secured on server`);
  console.log(`Google Sheets integration active`);
  console.log(`To authenticate with Google visit: http://localhost:${PORT}/auth`);
});