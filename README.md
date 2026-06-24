# QA Test Generator Agent

An AI-powered QA Test Generator Agent built with the Claude API. Accepts a feature description or UI screenshot (Figma, wireframe, design) and automatically generates structured test cases — then pushes them directly to a formatted Google Sheet.



## What It Does

- Accepts text input (feature description) or image input (Figma/UI screenshot)
- Generates structured test cases covering Positive, Negative, and Edge Case scenarios
- Outputs all 11 fields: `TEST CASE ID`, `TEST TYPE`, `MODULE`, `TEST SCENARIO`, `PRECONDITIONS`, `STEPS`, `TEST DATA`, `EXPECTED RESULT`, `ACTUAL RESULT`, `PRIORITY`, `STATUS`
- Automatically creates and formats a Google Sheet with the results
- Displays results in a clean table UI with dropdown selectors for Test Type and Status
- Secure backend — API key never exposed to the browser



## Tech Stack

| Layer | Technology |
|---|---|
| AI Model | Claude Sonnet 4.6 (Anthropic API) |
| Backend | Node.js + Express |
| Google Integration | Google Sheets API + Google Drive API (OAuth2) |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Auth | Google OAuth2 with token persistence |



## Project Structure

```
qa-test-generator-agent/
├── index.js              # Terminal version of the agent
├── index.html            # Web UI
├── server.js             # Express backend (API key + Google Sheets logic)
├── .env                  # Environment variables (not committed)
├── .gitignore            # Protects sensitive files
├── oauth-credentials.json # Google OAuth credentials (not committed)
├── token.json            # Google auth token (not committed)
├── credentials.json      # Google service account (not committed)
├── package.json
└── node_modules/
```


## Setup

### 1. Clone the repository

```bash
git clone https://github.com/RachieJosh/qa-test-generator-agent.git
cd qa-test-generator-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root folder:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 4. Set up Google OAuth2

- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Enable **Google Sheets API** and **Google Drive API**
- Create an OAuth 2.0 Client ID (Web application)
- Add `http://localhost:3000/auth/callback` as an authorized redirect URI
- Download the credentials JSON and save it as `oauth-credentials.json` in the project root

### 5. Authenticate with Google (one-time only)

```bash
node server.js
```

Then open `http://localhost:3000/auth` in your browser and log in with your Google account. A `token.json` file will be saved automatically — you will not need to authenticate again.

## Running the Agent

### Web UI (recommended)

```bash
node server.js
```

Open `http://localhost:3000` in your browser.

### Terminal version

```bash
node index.js
```

## How It Works

```
User inputs feature description or drops a UI screenshot
                        |
              Express server receives request
                        |
         Claude API analyzes and generates test cases
                        |
         Results parsed and rendered as a table in the UI
                        |
     Google Sheets API creates and formats a new spreadsheet
                        |
        "Open in Sheets" link appears with the live Google Sheet
```

## Features

| Feature | Details |
|---|---|
| Text mode | Describe any feature in plain English |
| Image mode | Drop a Figma or UI screenshot directly |
| Quick examples | One-click fintech feature chips |
| Stop button | Cancel generation mid-request |
| Google Sheets export | Auto-creates a formatted Sheet with Verdana font |
| Copy CSV | Copies raw CSV to clipboard |
| Dropdown selectors | Test Type and Status are editable dropdowns |
| Stats bar | Shows total, positive, negative, edge case, and critical counts |

## Security

- `ANTHROPIC_API_KEY` is stored in `.env` and read server-side only
- The browser never directly calls the Anthropic API
- Google OAuth token stored locally in `token.json` (not committed to GitHub)
- `.gitignore` excludes all sensitive files

## Author

**Racheal Joshua**
QA Engineer Intern
