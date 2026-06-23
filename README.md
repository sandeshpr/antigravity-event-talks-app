# BigQuery Release Pulse & Tweet Composer

BigQuery Release Pulse is a modern web application built with **Python Flask** on the backend and **vanilla HTML, JavaScript, and CSS** on the frontend. The application automatically fetches and parses Google BigQuery release notes and presents them in a premium glassmorphic feed dashboard. Users can filter and search release notes on the fly and select any specific update to customize and share directly to X (Twitter) using a responsive, simulated Tweet Composer.

---

## ✨ Features

*   **Granular Parsing & Segmentation**: Parses daily Atom feed updates, separating distinct features, changes, and deprecations into individual cards.
*   **Dual-State Caching System**: Employs a 5-minute server-side in-memory cache to ensure instantaneous loads, while permitting a manual cache bypass ("Refresh" button).
*   **Offline Fallback Resilience**: Gracefully falls back to stale cache data if Google's RSS servers are down or offline.
*   **Reactive Timeline Feed**: Timeline layout featuring responsive tag markers matching normalized update types (*Feature*, *Changed*, *Deprecated*, *Fixed*, *General*).
*   **X (Twitter) Intent Sandbox**: 
    *   Simulated user profile showing verified checkmark, handle, and dynamic text updates.
    *   Dynamic character progress circle tracking the 280-character limit.
    *   Quick toggle buttons to append origin release URLs or hashtags.
    *   One-click clipboard copying.

---

## 📂 Project Structure

```
bigquery-release-notes-app/
│
├── app.py                 # Flask server, Atom XML parser, & caching controller
├── requirements.txt       # Dependencies (Flask, requests, beautifulsoup4)
├── run.bat                # Windows quick launcher batch script
├── .gitignore             # Configured Git tracking exclusion rules
├── README.md              # Documentation
│
├── templates/
│   └── index.html         # HTML layout, layout container grid, & SVGs
│
└── static/
    ├── css/
    │   └── style.css      # Custom dark-theme stylesheet
    └── js/
        └── app.js         # Frontend controller, search, filters, & composer bindings
```

---

## 🛠️ Prerequisites

*   **Python 3.9+**
*   **Pip** (Python package installer)
*   **Web Browser** (Chrome, Edge, Firefox, etc.)

---

## 🚀 Getting Started

### Option A: One-Click Startup (Windows)
1. Double-click the launcher script:
   ```bash
   run.bat
   ```
   *This automatically sets up a python virtual environment, installs dependencies, and launches the local web server.*
2. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000/
   ```

### Option B: Manual Setup (Cross-Platform)
If you prefer running commands manually from a terminal:

1.  **Navigate to the project folder**:
    ```bash
    cd bigquery-release-notes-app
    ```
2.  **Create and activate a virtual environment**:
    *   **Windows**:
        ```bash
        python -m venv venv
        venv\Scripts\activate
        ```
    *   **macOS / Linux**:
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the Flask application**:
    ```bash
    python app.py
    ```
5.  Open your browser and navigate to `http://127.0.0.1:5000/`.

---

## 💡 How to Use the App

1.  **Browse and Sync**: View the latest updates synced from the BigQuery Atom feed. Click **Refresh** to manually pull fresh releases.
2.  **Filter and Search**: Click tab filters (*Features*, *Changes*, *Deprecations*) or type terms in the search bar to locate specific updates in real time.
3.  **Compose a Tweet**:
    *   Click on any card or the **Select to Compose** button.
    *   The **Tweet Composer** sidebar slides open.
    *   Review the generated draft. Toggle options to include links or hashtags, or edit the text.
    *   Click **Tweet on X** to open a new tab containing X's official web compose intent page, or click **Copy Text** to copy the draft.
