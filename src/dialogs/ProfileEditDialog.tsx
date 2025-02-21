import React from "react";
import {List, Modal} from "antd";
import {ModListPageContext} from "../AppContext.ts";


interface ProfileEditDialogStates {
    isModalOpen?: boolean;
    dataSource?: any;
}


class ProfileEditDialog extends React.Component<any, ProfileEditDialogStates> {

    declare context: React.ContextType<typeof ModListPageContext>;
    static contextType = ModListPageContext;

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


    render() {
        return (
            <Modal title="Edit Profile"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <List dataSource={this.context.ProfileList}
                />
            </Modal>
        );
    }
}


export default ProfileEditDialog;

