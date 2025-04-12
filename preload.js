const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'app', {
        // Window controls
        minimize: () => ipcRenderer.send('minimize'),
        maximize: () => ipcRenderer.send('maximize'),
        close: () => ipcRenderer.send('close'),
        
        // Navigation
        navigate: (page) => ipcRenderer.send('navigate', page),
        getCurrentPage: () => ipcRenderer.invoke('get-current-page'),
        
        // Watch Later functionality
        watchLater: {
            get: () => ipcRenderer.invoke('get-watch-later'),
            add: (item) => ipcRenderer.send('add-watch-later', item),
            remove: (id) => ipcRenderer.send('remove-watch-later', id),
            clear: () => ipcRenderer.send('clear-watch-later')
        },
        
        // Settings
        settings: {
            get: () => ipcRenderer.invoke('get-settings'),
            set: (settings) => ipcRenderer.send('set-settings', settings)
        },
        
        // Event listeners
        on: (channel, callback) => {
            // Whitelist channels
            const validChannels = [
                'navigate',
                'show-watch-later',
                'show-settings',
                'deep-link',
                'update-available',
                'download-progress'
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => callback(...args));
            }
        },
        
        // Remove event listener
        removeListener: (channel, callback) => {
            const validChannels = [
                'navigate',
                'show-watch-later',
                'show-settings',
                'deep-link',
                'update-available',
                'download-progress'
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.removeListener(channel, callback);
            }
        }
    }
); 
 