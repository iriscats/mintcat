import { App, Modal } from "antd";
import type { ModalFuncProps } from "antd/es/modal/interface";
import React from "react";

/** 由 MessageBoxThemeBridge 注入，用于在 ConfigProvider/App 上下文中弹出确认框以跟随主题 */
let themedModal: ReturnType<typeof App.useApp>["modal"] | null = null;

export function setMessageBoxThemedModal(modal: ReturnType<typeof App.useApp>["modal"] | null) {
    themedModal = modal;
}

export class MessageBox {

    static async confirm(props: ModalFuncProps): Promise<boolean> {
        return new Promise((resolve) => {
            const run = (api: { confirm: (p: ModalFuncProps) => ReturnType<typeof Modal.confirm> }) => {
                api.confirm({
                    ...props,
                    onOk: () => {
                        props.onOk?.();
                        resolve(true);
                    },
                    onCancel: () => {
                        props.onCancel?.();
                        resolve(false);
                    },
                });
            };
            if (themedModal) {
                run(themedModal);
            } else {
                run(Modal);
            }
        });
    }

}

/** 在 App 内挂载一次，使 MessageBox.confirm 使用 AntdApp 的 modal，从而跟随 ConfigProvider 主题 */
export function MessageBoxThemeBridge() {
    const { modal } = App.useApp();
    React.useEffect(() => {
        setMessageBoxThemedModal(modal);
        return () => setMessageBoxThemedModal(null);
    }, [modal]);
    return null;
}


