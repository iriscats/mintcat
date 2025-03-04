import React from "react";
import {Button, Card, Flex, Input, List, Modal} from "antd";
import {ModListPageContext} from "../AppContext.ts";
import Icon, {CopyOutlined, DeleteOutlined, EditOutlined, FileAddOutlined, PlusCircleOutlined} from "@ant-design/icons";


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
                <Card size={"small"}>
                    <List size="small"
                          dataSource={this.context.ProfileList}
                          header={
                              <Flex>
                                  <Input size="small"
                                         placeholder="Input New Profile"/>
                                  <Button type={"text"}
                                          style={{marginLeft: "8px", marginRight: "20px"}}
                                          onClick={this.handleOk}
                                          icon={<PlusCircleOutlined/>}
                                  />
                              </Flex>
                          }
                          renderItem={
                              item =>
                                  <List.Item>
                                      <Flex style={{width: "100%", display: "block"}}>
                                          <span style={{lineHeight: "32px"}}>
                                              {item}
                                          </span>
                                          <Button type={"text"}
                                                  style={{float: "right"}}
                                                  onClick={this.handleOk}
                                                  icon={<DeleteOutlined/>}
                                          />
                                          <Button type={"text"}
                                                  style={{float: "right"}}
                                                  onClick={this.handleOk}
                                                  icon={<CopyOutlined/>}
                                          />
                                          <Button type={"text"}
                                                  style={{float: "right"}}
                                                  onClick={this.handleOk}
                                                  icon={<EditOutlined/>}
                                          />
                                      </Flex>
                                  </List.Item>
                          }
                    />
                </Card>
            </Modal>
        );
    }
}


export default ProfileEditDialog;

