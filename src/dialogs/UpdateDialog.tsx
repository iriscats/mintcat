import React from "react";
import {t} from "i18next";
import {Modal} from "antd";
import {check} from "@tauri-apps/plugin-updater";
import {emit} from "@tauri-apps/api/event";
import Markdown from "react-markdown";

class UpdateDialog extends React.Component<any, any> {

    state = {
        isModalOpen: false,
        version: "",
        changelog: "",
    }

    private update ? = undefined;

    public constructor(props: any) {
        super(props);

        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    private async handleOk() {
        try {
            await emit("status-bar-log", t("MintCat Update"));

            let downloaded = 0;
            let contentLength = 0;

            // alternatively we could also call update.download() and update.install() separately
            await this.update?.downloadAndInstall(async (event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength;
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        await emit("status-bar-log", `${t("Downloading")} ${downloaded} / ${contentLength}`);
                        break;
                    case 'Finished':
                        await emit("status-bar-log", t("Download Finished"));
                        break;
                }
            });

            //await relaunch();
        } catch (e) {
        }
    }

    private async handleCancel() {
        this.setState({
            isModalOpen: false
        });
    }

    componentDidMount() {
        try {
            check().then((update) => {
                if (update) {
                    this.update = update;
                    this.setState({
                        isModalOpen: true,
                        version: update.version,
                        changelog: update.body,
                    });
                }
            });
        } catch (e) {
        }
    }

    render() {
        return (
            <Modal title={t("Update")}
                   mask={true}
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <h1>{t("Found Update")}</h1>
                <h2>{this.state.version}</h2>
                <Markdown>{this.state.changelog}</Markdown>
            </Modal>
        );
    }

}


export default UpdateDialog;