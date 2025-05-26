import React from "react";
import {t} from "i18next";
import {Button, Card, Flex, Input, List, message, Modal} from "antd";
import {CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, PlusCircleOutlined} from "@ant-design/icons";
import {ProfileTree} from "../vm/config/ProfileList.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {HomeViewModel} from "../vm/HomeViewModel.ts";

interface ProfileEditDialogStates {
    isModalOpen?: boolean;
    newProfileName?: string;
    editingKey?: string | null;
    editingValue?: string;
    profileList?: string[];
}

type InputCallback = (name: string) => void;

class ProfileEditDialog extends React.Component<any, ProfileEditDialogStates> {

    private callback: InputCallback;

    public constructor(props: any) {
        super(props);

        this.state = {
            isModalOpen: false,
            newProfileName: "",
            editingKey: null,
            editingValue: ""
        }

        this.show = this.show.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleAdd = this.handleAdd.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleRename = this.handleRename.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handleProfileInputChange = this.handleProfileInputChange.bind(this);
    }

    public setCallback(callback) {
        this.callback = callback;
        return this;
    }

    public show() {
        this.setState({
            isModalOpen: true
        });
    }

    private async handleOk() {
        this.setState({isModalOpen: false});
        this.callback?.call(this);
    }

    private handleCancel() {
        this.setState({isModalOpen: false});
        this.callback?.call(this);
    }

    private async handleAdd() {
        if (this.state.newProfileName === "") {
            message.error(t("Profile Name Cannot Be Empty"));
            return;
        }

        const vm = await HomeViewModel.getInstance();
        await vm.addProfile(
            this.state.newProfileName,
            new ProfileTree(this.state.newProfileName).toJson());

        this.forceUpdate();
        this.setState({
            newProfileName: ""
        });
    }

    private async handleDelete(key: string) {
        const vm = await HomeViewModel.getInstance();
        await vm.removeProfile(key);
        this.forceUpdate();
    }

    private async handleRename(key: string, newName: string) {
        const vm = await HomeViewModel.getInstance();
        await vm.renameProfile(key, newName);
        this.setState({
            editingKey: null,
            editingValue: ""
        });
    }

    private async handleCopy(key: string) {
        const data = await ConfigApi.loadProfileDetails(key);
        const vm = await HomeViewModel.getInstance();
        await vm.addProfile(key + "_copy", data);
        this.forceUpdate();
    }

    private handleProfileInputChange(e) {
        this.setState({newProfileName: e.target.value})
    }

    private async fetchData() {
        const vm = await HomeViewModel.getInstance();
        this.setState({
            profileList: vm.ProfileList
        })
    }

    componentDidMount() {
        this.fetchData().then();
    }

    render() {
        return (
            <Modal title={t("Edit Profile")}
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <Card size={"small"}>
                    <List size="small"
                          dataSource={this.state.profileList}
                          header={
                              <Flex>
                                  <Input size="small"
                                         type={"text"}
                                         value={this.state.newProfileName}
                                         placeholder={t("Input New Profile")}
                                         onChange={this.handleProfileInputChange}
                                         onPressEnter={this.handleAdd}
                                         autoComplete={"off"}
                                  />
                                  <Button type={"text"}
                                          style={{marginLeft: "8px", marginRight: "20px"}}
                                          onClick={this.handleAdd}
                                          icon={<PlusCircleOutlined/>}
                                  />
                              </Flex>
                          }
                          renderItem={
                              item =>
                                  <List.Item>
                                      <Flex style={{width: "100%", display: "block"}}>
                                            <span style={{lineHeight: "32px"}}>
                                                {this.state.editingKey === item ? (
                                                    <Input
                                                        size="small"
                                                        value={this.state.editingValue}
                                                        onChange={(e) => this.setState({editingValue: e.target.value})}
                                                        onPressEnter={() => this.handleRename(item, this.state.editingValue)}
                                                        style={{width: "200px"}}
                                                        autoFocus
                                                        autoComplete={"off"}
                                                    />
                                                ) : (
                                                    <span>{item}</span>
                                                )}
                                            </span>
                                          <Button type={"text"}
                                                  style={{float: "right"}}
                                                  onClick={() => this.handleDelete(item)}
                                                  icon={<DeleteOutlined/>}
                                          />
                                          <Button type={"text"}
                                                  style={{float: "right"}}
                                                  onClick={() => this.handleCopy(item)}
                                                  icon={<CopyOutlined/>}
                                          />
                                          <Button
                                              type={"text"}
                                              style={{float: "right"}}
                                              onClick={async () => {
                                                  if (this.state.editingKey === item) {
                                                      await this.handleRename(item, this.state.editingValue);
                                                  } else {
                                                      this.setState({
                                                          editingKey: item,
                                                          editingValue: item
                                                      });
                                                  }
                                              }}
                                              icon={this.state.editingKey === item ? <CheckOutlined/> : <EditOutlined/>}
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

