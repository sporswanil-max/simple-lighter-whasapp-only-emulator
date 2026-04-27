const { app, BrowserWindow, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. PORTABILITY: Force data to save in the app folder
const dataPath = path.join(__dirname, 'whatsapp_session');
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
app.setPath('userData', dataPath);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        show: false, 
        title: "Whatsapp Portable",
        icon: path.join(__dirname, 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false 
        }
    });

    // Force the window to maximize before showing it
    mainWindow.maximize();
    mainWindow.show();

    // TABLET EMULATION: Triggers the mobile/tablet login flow
    const tabletUA = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = tabletUA;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    mainWindow.loadURL('https://web.whatsapp.com', { userAgent: tabletUA });

    // --- SHORTCUTS (Moved inside ready/createWindow) ---
    
    // Alt+W: Stealth Mode (Hide/Show)
    globalShortcut.register('Alt+W', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });

    // Ctrl+Shift+R: Emergency Hard Reset (Clears all data)
    globalShortcut.register('CommandOrControl+Shift+R', () => {
        session.defaultSession.clearStorageData().then(() => {
            app.relaunch();
            app.exit();
        });
    });

    // --- EVENTS ---

    mainWindow.webContents.on('did-finish-load', () => {
        // Inject CSS
        const cssPath = path.join(__dirname, 'style.css');
        if (fs.existsSync(cssPath)) {
            const customCSS = fs.readFileSync(cssPath, 'utf8');
            mainWindow.webContents.insertCSS(customCSS);
        }

        // Real-time QR Monitor
        setInterval(async () => {
            try {
                if (!mainWindow) return;
                const qrExists = await mainWindow.webContents.executeJavaScript(`!!document.querySelector('canvas')`);
                if (qrExists) {
                    const image = await mainWindow.capturePage();
                    fs.writeFile(path.join(__dirname, 'LOGIN_QR_CODE.png'), image.toPNG(), (err) => {
                        if (!err) console.log('QR Updated');
                    });
                }
            } catch (e) {}
        }, 3000);
    });

    // Emergency: Auto-Refresh on Connection Loss
    mainWindow.webContents.on('did-fail-load', () => {
        setTimeout(() => { if (mainWindow) mainWindow.reload(); }, 5000);
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll(); // Clean up shortcuts on exit
    if (process.platform !== 'darwin') app.quit();
});