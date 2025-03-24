import {Modal} from "antd";
import {ModalFuncProps} from "antd/es/modal/interface";

export class MessageBox {

    static async confirm(props: ModalFuncProps): Promise<boolean> {
        return new Promise((resolve) => {
            Modal.confirm({
                ...props,
                onOk: () => {
                    props.onOk?.();
                    resolve(true);
                },
                onCancel: () => {
                    props.onCancel?.();
                    resolve(false);
                }
            });
        });
    }

}


