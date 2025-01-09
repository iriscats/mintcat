import React from 'react';
import {Form, Input, Modal} from 'antd';

interface AddModDialogStates {
    isModalOpen?: boolean;
}

type InputCallback = (name: string) => void;


class AddModDialog extends React.Component<any, AddModDialogStates> {

    private readonly localFormRef: any = React.createRef();

    private callback: InputCallback;

    public constructor(props: any, context: AddModDialogStates) {
        super(props, context);

        this.state = {
            isModalOpen: false
        }

        this.show = this.show.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    public show() {
        this.setState({
            isModalOpen: true
        });
    }

    public setCallback(callback: InputCallback) {
        this.callback = callback;
    }

    private async handleOk() {
        const values = this.localFormRef.current.getFieldsValue();
        this.callback?.call(this, values["text"]);
        this.setState({isModalOpen: false});
    }

    private handleCancel() {
        this.setState({isModalOpen: false});
    }

    render() {
        return (
            <Modal title="Input Name"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <Form ref={this.localFormRef} layout="vertical">
                    <Form.Item name="text" label="Name" rules={[{required: true}]}>
                        <Input/>
                    </Form.Item>
                </Form>
            </Modal>
        );
    }
}

export default AddModDialog;