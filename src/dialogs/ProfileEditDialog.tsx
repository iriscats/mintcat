import React from "react";
import {Modal, Tabs} from "antd";


interface ProfileEditDialogStates {
    isModalOpen?: boolean;

}


class ProfileEditDialog extends React.Component<any, ProfileEditDialogStates> {

    public constructor(props: any, context: ProfileEditDialogStates) {
        super(props, context);

        this.state = {
            isModalOpen: false,
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

    private async handleOk() {
        this.setState({isModalOpen: false});
    }

    private handleCancel() {
        this.setState({isModalOpen: false});
    }

    public render() {
        return (
            <Modal title="Edit Profile"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
            </Modal>
        );
    }
}


export default ProfileEditDialog;

