const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isQuitting = false;

// Store window states
const windowStateKeeper = {
    states: new Map(),
    save(window, id) {
        if (!window.isMaximized()) {
            this.states.set(id, window.getBounds());
        }
        this.states.set(`${id}_maximized`, window.isMaximized());
    },
    get(id) {
        return {
            bounds: this.states.get(id) || { width: 1280, height: 800, x: undefined, y: undefined },
            isMaximized: this.states.get(`${id}_maximized`) || false
        };
    }
};

function createWindow() {
    const state = windowStateKeeper.get('main');
    
    // Create the browser window
    mainWindow = new BrowserWindow({
        ...state.bounds,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        backgroundColor: '#09091C',
        show: false,
        icon: path.join(__dirname, 'logo.png')
    });

    // Load the index page
    mainWindow.loadFile('index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (state.isMaximized) {
            mainWindow.maximize();
        }
    });

    // Inject custom APIs
    mainWindow.webContents.executeJavaScript(`
        window.electron = {
            minimize: () => window.ipcRenderer.send('minimize'),
            maximize: () => window.ipcRenderer.send('maximize'),
            close: () => window.ipcRenderer.send('close'),
            setFullScreen: (flag) => window.ipcRenderer.send('set-fullscreen', flag),
            navigate: (page) => window.ipcRenderer.send('navigate', page),
            getCurrentPage: () => window.ipcRenderer.invoke('get-current-page'),
            watchLater: {
                get: () => window.ipcRenderer.invoke('get-watch-later'),
                add: (item) => window.ipcRenderer.send('add-watch-later', item),
                remove: (id) => window.ipcRenderer.send('remove-watch-later', id),
                clear: () => window.ipcRenderer.send('clear-watch-later')
            },
            settings: {
                get: () => window.ipcRenderer.invoke('get-settings'),
                set: (settings) => window.ipcRenderer.send('set-settings', settings)
            }
        };
    `);

    // Create system tray
    const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'logo.png'));
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Show App',
            click: () => mainWindow.show()
        },
        { type: 'separator' },
        {
            label: 'Movies',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', 'movies');
            }
        },
        {
            label: 'TV Shows',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', 'shows');
            }
        },
        {
            label: 'Live Sports',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('navigate', 'sports');
            }
        },
        { type: 'separator' },
        {
            label: 'Watch Later',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('show-watch-later');
            }
        },
        {
            label: 'Settings',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('show-settings');
            }
        },
        { type: 'separator' },
        { 
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Fastfilmy');
    tray.setContextMenu(contextMenu);

    // Handle tray click
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });

    // Register global shortcuts
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });

    // Handle IPC messages
    ipcMain.on('minimize', () => mainWindow.minimize());
    ipcMain.on('maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('close', () => mainWindow.hide());

    ipcMain.on('navigate', (event, page) => {
        mainWindow.loadFile(`${page}.html`);
    });

    // Handle window close
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
        windowStateKeeper.save(mainWindow, 'main');
    });

    // Save window state on changes
    mainWindow.on('resize', () => windowStateKeeper.save(mainWindow, 'main'));
    mainWindow.on('move', () => windowStateKeeper.save(mainWindow, 'main'));

    // Handle navigation
    mainWindow.webContents.on('will-navigate', (event, url) => {
        // Prevent navigation to external URLs
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });
}

// App events
app.whenReady().then(() => {
    createWindow();

    // Register protocol handler
    app.setAsDefaultProtocolClient('fastfilmy');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle protocol
app.on('open-url', (event, url) => {
    event.preventDefault();
    const urlObj = new URL(url);
    if (urlObj.protocol === 'fastfilmy:') {
        // Handle deep linking
        const path = urlObj.hostname;
        const params = Object.fromEntries(urlObj.searchParams);
        if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('deep-link', { path, params });
        }
    }
});

// Clean up before quit
app.on('before-quit', () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
}); 
 