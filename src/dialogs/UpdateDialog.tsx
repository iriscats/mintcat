import React from "react";
import {t} from "i18next";
import {message, Modal} from "antd";
import {check, type Update} from "@tauri-apps/plugin-updater";
import {relaunch} from "@tauri-apps/plugin-process";
import StatusBar from "@/components/StatusBar.tsx";
import Markdown from "react-markdown";

class UpdateDialog extends React.Component<any, any> {

    state = {
        isModalOpen: false,
        version: "",
        changelog: "",
        isInstalling: false,
    }

    private update?: Update;

    public constructor(props: any) {
        super(props);

        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    private async handleOk() {
        if (!this.update || this.state.isInstalling) {
            return;
        }

        this.setState({isInstalling: true});

        try {
            await StatusBar.info(t("MintCat Update"));

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
                        await StatusBar.info(`${t("Downloading")} ${downloaded} / ${contentLength}`);
                        break;
                    case 'Finished':
                        await StatusBar.success(t("Download Finished"));
                        break;
                }
            });

            await StatusBar.success(t("Update Finish"));
            await relaunch();
        } catch (e) {
            console.warn('[UpdateDialog] Update install failed:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            await StatusBar.error(`${t("Update Failed")}: ${errorMessage}`);
            message.error(`${t("Update Failed")}: ${errorMessage}`);
            this.setState({isInstalling: false});
        }
    }

    private async handleCancel() {
        this.setState({
            isModalOpen: false
        });
    }

    componentDidMount() {
        check().then((update) => {
            if (update) {
                this.update = update;
                this.setState({
                    isModalOpen: true,
                    version: update.version,
                    changelog: update.body,
                });
            }
        }).catch((e) => {
            console.warn('[UpdateDialog] Update check failed:', e);
        });
    }

    render() {
        return (
            <Modal title={t("Update")}
                   mask={true}
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
                   confirmLoading={this.state.isInstalling}
                   cancelButtonProps={{disabled: this.state.isInstalling}}
            >
                <h1>{t("Found Update")}</h1>
                <h2>{this.state.version}</h2>
                <Markdown>{this.state.changelog}</Markdown>
            </Modal>
        );
    }

}


export default UpdateDialog;