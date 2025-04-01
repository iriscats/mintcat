/*        const existedWindow = await WebviewWindow.getByLabel('search')
        if (existedWindow) {
            const isVisible = await existedWindow.isVisible()
            if (isVisible) {
                await existedWindow.hide()
            } else {
                await existedWindow.show()
            }
            return
        }
        const webview = new WebviewWindow('search', {
            center: true,
            width: 800,
            height: 400,
            alwaysOnTop: true,
            skipTaskbar: true,
            decorations: false,
            closable: true,
            dragDropEnabled: true,
            url: 'http://localhost:1420/Search'
        })
        webview.once('tauri://created', function () {
            console.log('webview created')
        })
        webview.once('tauri://error', function (e) {
            console.log('error creating webview', e)
        })*/